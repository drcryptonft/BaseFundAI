import { createPublicClient, http } from "viem";
import { campaignContent } from "../campaignContent";
import { CAMPAIGN_ABI } from "../contracts";
import { DEFAULT_CHAIN_ID, supportedChains } from "../config/networks";
import { getLocalMetadata } from "../ipfs";
import {
  computeMetadataHash,
  extractIpfsHash,
  getMetadataFetchUrl,
  toMetadataUri,
} from "./metadataIntegrity";
import {
  normalizeCampaignMetadataShape,
  sanitizeCampaignMetadataDraft,
  sanitizeCampaignMetadataForDisplay,
  sanitizeCampaignMetadataForTransport,
} from "./campaignMetadata";
import { FALLBACK_CAMPAIGN_MEDIA_URL } from "./campaignPresentation";
import { resolveConfiguredApiBase } from "./apiBase";
import { rememberCampaignReference } from "./campaignLocator";

const configuredApiBase = String(import.meta.env.VITE_API_BASE_URL || "").trim();
const configuredDevProxy = String(import.meta.env.VITE_DEV_API_PROXY || "").trim();
const INITIAL_API_BASE = resolveConfiguredApiBase(configuredApiBase, {
  allowNullInDev: true,
});
const API_ENABLED = INITIAL_API_BASE !== null;
const RECORD_CACHE_TTL_MS = 2 * 60 * 1000;
const RECORD_MISS_TTL_MS = 2 * 60 * 1000;
const BACKFILL_TTL_MS = 60 * 1000;
const MAX_RECORD_CACHE_BYTES = 180000;
const CACHE_IMAGE_LENGTH_LIMIT = 24000;

let apiUnavailableUntil = 0;
let apiHealthStatus = API_ENABLED ? "unknown" : "disabled";
let apiHealthPromise = null;
let activeApiBase = INITIAL_API_BASE;
const missingRecordCache = new Map();
const backfillAttemptCache = new Map();
const publicClientCache = new Map();

function delay(ms) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function getTrustBadge(score, coverage) {
  if (score >= 80 && coverage >= 70) {
    return { label: "High Trust", tone: "emerald" };
  }

  if (score >= 65) {
    return { label: "Good Standing", tone: "sky" };
  }

  if (score >= 45) {
    return { label: "Emerging", tone: "amber" };
  }

  return { label: "Caution", tone: "rose" };
}

function normalizeApiBase(value) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return "";
  }

  return normalized.replace(/\/$/, "");
}

function getApiUrl(path, base = activeApiBase) {
  return `${base || ""}${path}`;
}

function getApiBaseCandidates() {
  if (!API_ENABLED) {
    return [];
  }

  const candidates = [];
  const seen = new Set();

  const push = (value) => {
    if (value === null || value === undefined) {
      return;
    }

    const normalized = normalizeApiBase(value);
    const isValid =
      normalized === "" || /^https?:\/\//i.test(normalized);

    if (!isValid || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    candidates.push(normalized);
  };

  push(activeApiBase);
  push(INITIAL_API_BASE);

  if (import.meta.env.DEV) {
    push(configuredDevProxy);
    push("");
    push("http://localhost:5000");
    push("http://127.0.0.1:5000");
    push("http://localhost:5001");
    push("http://127.0.0.1:5001");
    push("http://localhost:5050");
    push("http://127.0.0.1:5050");
  }

  return candidates;
}

function buildLocalTrustPreview(payload = {}) {
  const description = String(payload.description || "").trim();
  const headline = String(payload.headline || "").trim();
  const socials = payload.socials || {};
  const socialLinks = [
    socials.facebook || socials.website,
    socials.twitter,
    socials.linkedin,
    socials.telegram,
  ].filter(Boolean);
  const warnings = [
    "Live trust services are temporarily unavailable, so this preview is using local content and social checks.",
  ];
  const highlights = [];
  let contentScore = 8;
  let socialScore = 0;

  if (description.length >= 240) {
    contentScore += 5;
    highlights.push("Description is detailed enough for contributor review.");
  } else if (description.length >= 120) {
    contentScore += 3;
  } else {
    warnings.push("Description is short. Add more operational detail for stronger trust.");
  }

  if (headline.length >= 12 && headline.length <= 90) {
    contentScore += 2;
  }

  if (Number(payload.mediaCount || 0) > 0 || payload.youtube) {
    contentScore += 2;
    highlights.push("Campaign includes media for contributors to inspect.");
  }

  if (socials.facebook || socials.website) socialScore += 4;
  if (socials.twitter) socialScore += 3;
  if (socials.linkedin) socialScore += 3;
  if (socials.telegram) socialScore += 2;

  if (socialLinks.length > 1) {
    highlights.push("Campaign includes multiple public social proof links.");
  }

  const signals = [
    {
      key: "content",
      label: "Content Review",
      available: true,
      score: Math.min(contentScore, 20),
      maxScore: 20,
      summary: "Local fallback review based on story quality and campaign media.",
    },
    {
      key: "social",
      label: "Social Proof",
      available: true,
      score: Math.min(socialScore, 12),
      maxScore: 12,
      summary:
        socialLinks.length > 0
          ? `Public links found: ${socialLinks.join(", ")}.`
          : "No public social proof links were added.",
    },
  ];
  const earned = signals.reduce((total, signal) => total + signal.score, 0);
  const max = signals.reduce((total, signal) => total + signal.maxScore, 0);
  const rawScore = max > 0 ? (earned / max) * 100 : 45;
  const coverage = 32;
  const score = Math.max(20, Math.round(rawScore * 0.72));

  return {
    score,
    trustPoints: score,
    coverage,
    badge: getTrustBadge(score, coverage),
    highlights: highlights.slice(0, 3),
    warnings: warnings.slice(0, 3),
    flags: [],
    signals,
    stats: {
      source: "local-fallback",
      socialsConnected: socialLinks,
    },
    updatedAt: new Date().toISOString(),
  };
}

function getRecordCacheKey(chainId = DEFAULT_CHAIN_ID) {
  return `campaignRegistryCacheV2:${chainId}`;
}

function getRecordKey(address, chainId = DEFAULT_CHAIN_ID) {
  return `${Number(chainId || DEFAULT_CHAIN_ID)}:${String(address || "").toLowerCase()}`;
}

function getRecordCache(chainId = DEFAULT_CHAIN_ID) {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    return JSON.parse(localStorage.getItem(getRecordCacheKey(chainId)) || "{}");
  } catch {
    return {};
  }
}

function setRecordCache(nextCache, chainId = DEFAULT_CHAIN_ID) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(getRecordCacheKey(chainId), JSON.stringify(nextCache));
  } catch {
    // Ignore storage quota failures and continue with network/local memory data.
  }
}

function sanitizeMetadataForCache(metadata = {}) {
  const normalized = sanitizeCampaignMetadataDraft(metadata);
  const safeImages = Array.isArray(normalized.images)
    ? normalized.images.filter((image) => {
        if (typeof image !== "string") {
          return false;
        }

        if (!image.startsWith("data:")) {
          return true;
        }

        return image.length <= CACHE_IMAGE_LENGTH_LIMIT;
      })
    : [];

  return {
    headline: String(normalized.headline || "").trim(),
    problemStatement: String(normalized.problemStatement || "").trim(),
    impactPlan: String(normalized.impactPlan || "").trim(),
    description: String(normalized.description || "").trim(),
    youtube: String(normalized.youtube || "").trim(),
    images: safeImages.slice(0, 3),
    socials: normalized.socials || {},
  };
}

function sanitizeRecordForCache(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const sanitizedRecord = {
    chainId: Number(record.chainId || DEFAULT_CHAIN_ID),
    address: String(record.address || "").trim(),
    creator: String(record.creator || "").trim(),
    ipfsHash: String(record.ipfsHash || "").trim(),
    metadata: sanitizeMetadataForCache(record.metadata || {}),
    trust: record.trust || null,
    createdAt: record.createdAt || "",
    updatedAt: record.updatedAt || "",
  };

  const serialized = JSON.stringify(sanitizedRecord);

  if (serialized.length <= MAX_RECORD_CACHE_BYTES) {
    return sanitizedRecord;
  }

  sanitizedRecord.metadata.images = [];

  if (JSON.stringify(sanitizedRecord).length <= MAX_RECORD_CACHE_BYTES) {
    return sanitizedRecord;
  }

  return null;
}

function saveCachedRecord(address, record, chainId = DEFAULT_CHAIN_ID) {
  if (!address || !record) {
    return;
  }

  const sanitizedRecord = sanitizeRecordForCache(record);

  if (!sanitizedRecord) {
    return;
  }

  const cache = getRecordCache(chainId);
  cache[String(address).toLowerCase()] = {
    timestamp: Date.now(),
    value: sanitizedRecord,
  };
  setRecordCache(cache, chainId);
}

function readCachedRecord(address, chainId = DEFAULT_CHAIN_ID) {
  const cache = getRecordCache(chainId);
  const key = String(address || "").toLowerCase();
  const cached = cache[key];

  if (!cached) {
    return null;
  }

  if (Date.now() - Number(cached.timestamp || 0) > RECORD_CACHE_TTL_MS) {
    delete cache[key];
    setRecordCache(cache, chainId);
    return null;
  }

  return cached.value || null;
}

function hasRecentMissingRecord(address, chainId = DEFAULT_CHAIN_ID) {
  const key = getRecordKey(address, chainId);
  const expiresAt = Number(missingRecordCache.get(key) || 0);

  if (!expiresAt) {
    return false;
  }

  if (Date.now() >= expiresAt) {
    missingRecordCache.delete(key);
    return false;
  }

  return true;
}

function markMissingRecord(address, chainId = DEFAULT_CHAIN_ID) {
  missingRecordCache.set(getRecordKey(address, chainId), Date.now() + RECORD_MISS_TTL_MS);
}

function clearMissingRecord(address, chainId = DEFAULT_CHAIN_ID) {
  missingRecordCache.delete(getRecordKey(address, chainId));
}

function shouldSkipBackfill(address, chainId = DEFAULT_CHAIN_ID) {
  const key = getRecordKey(address, chainId);
  const nextAllowedAt = Number(backfillAttemptCache.get(key) || 0);

  if (!nextAllowedAt) {
    return false;
  }

  if (Date.now() >= nextAllowedAt) {
    backfillAttemptCache.delete(key);
    return false;
  }

  return true;
}

function markBackfillAttempt(address, chainId = DEFAULT_CHAIN_ID) {
  backfillAttemptCache.set(getRecordKey(address, chainId), Date.now() + BACKFILL_TTL_MS);
}

function getChainPublicClient(chainId = DEFAULT_CHAIN_ID) {
  const normalizedChainId = Number(chainId || DEFAULT_CHAIN_ID);

  if (publicClientCache.has(normalizedChainId)) {
    return publicClientCache.get(normalizedChainId);
  }

  const chain = supportedChains.find(
    (supportedChain) => Number(supportedChain.id) === normalizedChainId
  );
  const rpcUrl =
    chain?.rpcUrls?.default?.http?.[0] || chain?.rpcUrls?.public?.http?.[0];

  if (!chain || !rpcUrl) {
    return null;
  }

  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  publicClientCache.set(normalizedChainId, client);
  return client;
}

async function requestJson(path, options = {}) {
  if (!API_ENABLED) {
    throw new Error("Trust API is not enabled");
  }

  if (path !== "/api/health" && Date.now() < apiUnavailableUntil) {
    throw new Error("API temporarily unavailable");
  }

  if (path !== "/api/health") {
    const isAvailable = await ensureApiAvailability();

    if (!isAvailable) {
      const error = new Error("Trust API is unavailable");
      error.code = "API_UNAVAILABLE";
      throw error;
    }
  }

  const response = await fetch(getApiUrl(path), options);
  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const error = new Error(
      data?.detail || data?.error || `Request failed (${response.status})`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

async function safeRequestJson(path, options = {}) {
  try {
    return await requestJson(path, options);
  } catch (error) {
    if (!error?.status || error.status >= 500) {
      apiUnavailableUntil = Date.now() + 15000;
      apiHealthStatus = "unavailable";
    }
    return null;
  }
}

async function requestJsonWithRetry(path, options = {}, attempts = 3) {
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await requestJson(path, options);
    } catch (error) {
      lastError = error;
      const retryable = !error?.status || error.status >= 500;

      if (!retryable || attempt === attempts - 1) {
        break;
      }

      await delay(400 * (attempt + 1));
    }
  }

  throw lastError;
}

async function probeApiBase(base) {
  try {
    const response = await fetch(getApiUrl("/api/health", base));

    if (!response.ok) {
      return false;
    }

    const payload = await response.json().catch(() => null);
    const serviceName = String(payload?.service || "");
    const isExpectedService =
      serviceName === "basefundai-trust-engine" ||
      (payload?.ok === true && !serviceName);

    if (!isExpectedService) {
      return false;
    }

    activeApiBase = base;
    return true;
  } catch {
    return false;
  }
}

async function ensureApiAvailability() {
  if (!API_ENABLED) {
    return false;
  }

  if (apiHealthStatus === "available" && Date.now() >= apiUnavailableUntil) {
    return true;
  }

  if (apiHealthStatus === "unavailable" && Date.now() < apiUnavailableUntil) {
    return false;
  }

  if (apiHealthPromise) {
    return apiHealthPromise;
  }

  apiHealthPromise = (async () => {
    try {
      const candidates = getApiBaseCandidates();

      for (const base of candidates) {
        const isAvailable = await probeApiBase(base);

        if (isAvailable) {
          apiHealthStatus = "available";
          apiUnavailableUntil = 0;
          return true;
        }
      }

      apiHealthStatus = "unavailable";
      apiUnavailableUntil = Date.now() + 60000;
      return false;
    } catch {
      apiHealthStatus = "unavailable";
      apiUnavailableUntil = Date.now() + 60000;
      return false;
    } finally {
      apiHealthPromise = null;
    }
  })();

  return apiHealthPromise;
}

function getLocalCampaignHash(address, chainId = DEFAULT_CHAIN_ID) {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const map = JSON.parse(localStorage.getItem("campaignMeta") || "{}");
    const normalizedAddress = String(address || "").toLowerCase();
    const chainScopedKey = `${chainId}:${normalizedAddress}`;
    const directMatch =
      map[chainScopedKey] ||
      map[address] ||
      map[normalizedAddress] ||
      "";

    if (directMatch) {
      return directMatch;
    }

    const key = Object.keys(map).find((item) => {
      const normalizedKey = String(item || "").toLowerCase();

      return (
        normalizedKey === normalizedAddress ||
        normalizedKey === `${String(chainId)}:${normalizedAddress}`
      );
    });

    return key ? map[key] : "";
  } catch {
    return "";
  }
}

export function resolveAssetUrl(value) {
  if (!value) return FALLBACK_CAMPAIGN_MEDIA_URL;
  if (value.startsWith("data:")) return value;
  if (/^https?:\/\//i.test(value)) return value;

  if (value.startsWith("ar://")) {
    return `https://arweave.net/${value.slice("ar://".length).replace(/^\/+/, "")}`;
  }

  const ipfsHash = extractIpfsHash(value);

  if (ipfsHash) {
    return `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
  }

  return value;
}

function normalizeCampaignMetadata(metadata = {}) {
  return sanitizeCampaignMetadataForDisplay(normalizeCampaignMetadataShape(metadata));
}

export function getFallbackCampaignContent(address) {
  const key = Object.keys(campaignContent).find(
    (item) => item.toLowerCase() === String(address || "").toLowerCase()
  );

  return key ? campaignContent[key] : {};
}

export async function fetchCampaignRecord(
  address,
  { force = false, chainId = DEFAULT_CHAIN_ID } = {}
) {
  if (!address) {
    return null;
  }

  if (!API_ENABLED) {
    return null;
  }

  if (!force && hasRecentMissingRecord(address, chainId)) {
    return null;
  }

  if (!force) {
    const cached = readCachedRecord(address, chainId);

    if (cached) {
      return cached;
    }
  }

  const params = new URLSearchParams({
    chainId: String(chainId || DEFAULT_CHAIN_ID),
  });
  const path = `/api/campaigns/${String(address).toLowerCase()}?${params.toString()}`;

  try {
    const data = await requestJson(path);
    const record = data?.campaign || null;

    if (record) {
      clearMissingRecord(address, chainId);
      rememberCampaignReference(address, chainId, record.ipfsHash || "");
      saveCachedRecord(address, record, chainId);
    } else {
      markMissingRecord(address, chainId);
    }

    return record;
  } catch (error) {
    if (error?.status === 404) {
      markMissingRecord(address, chainId);
      return null;
    }

    if (!error?.status || error.status >= 500) {
      apiUnavailableUntil = Date.now() + 15000;
      apiHealthStatus = "unavailable";
    }

    return null;
  }
}

async function attemptBackfillMissingRecord(
  address,
  chainId,
  ipfsHash,
  metadata
) {
  if (!address || !ipfsHash || !metadata || shouldSkipBackfill(address, chainId)) {
    return null;
  }

  markBackfillAttempt(address, chainId);

  try {
    const publicClient = getChainPublicClient(chainId);

    if (!publicClient) {
      return null;
    }

    const creator = await publicClient.readContract({
      address,
      abi: CAMPAIGN_ABI,
      functionName: "creator",
    });

    const record = await registerCampaignRecord({
      chainId,
      address,
      creator,
      ipfsHash,
      metadata,
      trust: metadata?.trust || null,
    });

    if (record) {
      clearMissingRecord(address, chainId);
      saveCachedRecord(address, record, chainId);
    }

    return record;
  } catch {
    return null;
  }
}

async function readOnchainMetadataRecord(address, chainId = DEFAULT_CHAIN_ID) {
  try {
    const publicClient = getChainPublicClient(chainId);

    if (!publicClient) {
      return null;
    }

    const [metadataURI, metadataHash] = await Promise.all([
      publicClient.readContract({
        address,
        abi: CAMPAIGN_ABI,
        functionName: "metadataURI",
      }),
      publicClient.readContract({
        address,
        abi: CAMPAIGN_ABI,
        functionName: "metadataHash",
      }),
    ]);

    const normalizedURI = toMetadataUri(metadataURI);
    const normalizedHash = String(metadataHash || "").trim();

    if (!normalizedURI) {
      return null;
    }

    return {
      metadataURI: normalizedURI,
      metadataHash: normalizedHash,
    };
  } catch {
    return null;
  }
}

async function fetchVerifiedOnchainMetadata(address, chainId = DEFAULT_CHAIN_ID) {
  const onchainRecord = await readOnchainMetadataRecord(address, chainId);

  if (!onchainRecord?.metadataURI) {
    return null;
  }

  const metadata = await fetchIpfsMetadata(onchainRecord.metadataURI);

  if (!metadata) {
    return {
      ...onchainRecord,
      metadata: null,
      verified: false,
      computedHash: "",
    };
  }

  const displayMetadata = sanitizeCampaignMetadataForDisplay(metadata);
  const canonicalMetadata = sanitizeCampaignMetadataForTransport(metadata);
  let computedHash = computeMetadataHash(canonicalMetadata);
  let verified =
    String(onchainRecord.metadataHash || "").toLowerCase() ===
    String(computedHash || "").toLowerCase();
  let verifiedMetadata = verified ? canonicalMetadata : null;

  if (
    !verified &&
    displayMetadata.images.some((image) => String(image || "").startsWith("data:"))
  ) {
    const legacyHash = computeMetadataHash(displayMetadata);

    if (
      String(onchainRecord.metadataHash || "").toLowerCase() ===
      String(legacyHash || "").toLowerCase()
    ) {
      computedHash = legacyHash;
      verified = true;
      verifiedMetadata = displayMetadata;
    }
  }

  return {
    ...onchainRecord,
    metadata: verifiedMetadata,
    verified,
    computedHash,
  };
}

export async function fetchIpfsMetadata(reference) {
  if (!reference) {
    return null;
  }

  const normalizedReference = String(reference || "").trim();
  const localMetadata =
    getLocalMetadata(normalizedReference) ||
    getLocalMetadata(extractIpfsHash(normalizedReference));

  if (localMetadata) {
    return sanitizeCampaignMetadataForDisplay(localMetadata);
  }

  const fetchUrl = getMetadataFetchUrl(normalizedReference);

  if (!fetchUrl) {
    return null;
  }

  try {
    const response = await fetch(fetchUrl);

    if (!response.ok) {
      throw new Error("Metadata not found");
    }

    const data = await response.json();
    return data && typeof data === "object"
      ? sanitizeCampaignMetadataForDisplay(data)
      : null;
  } catch {
    return null;
  }
}

export async function loadCampaignProfile(
  address,
  chainId = DEFAULT_CHAIN_ID
) {
  if (!address) {
    return {
      metadata: {},
      trust: null,
      record: null,
      ipfsHash: "",
    };
  }

  const fallbackContent = getFallbackCampaignContent(address);
  const [record, onchainMetadataRecord] = await Promise.all([
    fetchCampaignRecord(address, { chainId }),
    fetchVerifiedOnchainMetadata(address, chainId),
  ]);
  const localReference = getLocalCampaignHash(address, chainId);
  const storedReference = record?.ipfsHash || localReference;
  const offchainMetadata = storedReference
    ? await fetchIpfsMetadata(storedReference)
    : null;
  const metadata = normalizeCampaignMetadata({
    ...fallbackContent,
    ...(record?.metadata || {}),
    ...(offchainMetadata || {}),
    ...(onchainMetadataRecord?.metadata || {}),
  });
  const resolvedReference = onchainMetadataRecord?.metadataURI || storedReference;
  const ipfsHash = extractIpfsHash(resolvedReference);

  if (!record && ipfsHash) {
    void attemptBackfillMissingRecord(address, chainId, ipfsHash, metadata);
  }

  if (resolvedReference) {
    rememberCampaignReference(address, chainId, toMetadataUri(resolvedReference));
  }

  return {
    metadata,
    trust: record?.trust || metadata?.trust || null,
    record,
    ipfsHash,
    metadataURI: toMetadataUri(resolvedReference),
    metadataVerified: Boolean(onchainMetadataRecord?.verified),
  };
}

export async function requestTrustPreview(payload) {
  if (!API_ENABLED) {
    return buildLocalTrustPreview(payload);
  }

  const data = await safeRequestJson("/api/trust/score", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return data?.trust || buildLocalTrustPreview(payload);
}

export async function registerCampaignRecord(payload) {
  if (!API_ENABLED) {
    if (import.meta.env.PROD) {
      throw new Error("Campaign registry API is not configured.");
    }

    return null;
  }

  const data = await requestJsonWithRetry("/api/campaigns/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      chainId: Number(payload?.chainId || DEFAULT_CHAIN_ID),
    }),
  });

  if (data?.campaign?.address) {
    rememberCampaignReference(
      data.campaign.address,
      Number(data.campaign.chainId || payload?.chainId || DEFAULT_CHAIN_ID),
      data.campaign.ipfsHash || payload?.ipfsHash || ""
    );
    saveCachedRecord(
      data.campaign.address,
      data.campaign,
      Number(data.campaign.chainId || payload?.chainId || DEFAULT_CHAIN_ID)
    );
  }

  return data?.campaign || null;
}
