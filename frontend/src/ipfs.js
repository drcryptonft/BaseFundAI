import { toMetadataUri } from "./utils/metadataIntegrity";
import {
  sanitizeCampaignMetadataDraft,
  sanitizeCampaignMetadataForTransport,
} from "./utils/campaignMetadata";

const configuredApiBase = String(import.meta.env.VITE_API_BASE_URL || "").trim();
const useSameOriginProxy =
  import.meta.env.DEV &&
  /^https?:\/\/localhost:5000\/?$/i.test(configuredApiBase);
const API_BASE =
  useSameOriginProxy
    ? ""
    : configuredApiBase === "same-origin"
    ? ""
    : configuredApiBase
      ? configuredApiBase.replace(/\/$/, "")
      : import.meta.env.PROD
        ? ""
        : null;
const LOCAL_METADATA_STORE_KEY = "campaignLocalMetadataStoreV1";
const LOCAL_HASH_PREFIX = "local:";
const LOCAL_IMAGE_LENGTH_LIMIT = 250000;
const localMetadataMemoryStore = new Map();
let apiUnavailableUntil = 0;
let apiHealthPromise = null;
let apiHealthStatus = API_BASE === null ? "disabled" : "unknown";

function getApiUrl(path) {
  return `${API_BASE}${path}`;
}

function buildLocalHash() {
  return `${LOCAL_HASH_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function canUseLocalFallback() {
  return !import.meta.env.PROD;
}

function sanitizeLocalFallbackMetadata(metadata = {}) {
  const normalized = sanitizeCampaignMetadataDraft(metadata);
  const safeImages = Array.isArray(normalized.images)
    ? normalized.images
        .filter((image) => {
          if (typeof image !== "string") {
            return false;
          }

          if (!image.startsWith("data:")) {
            return true;
          }

          return image.length <= LOCAL_IMAGE_LENGTH_LIMIT;
        })
        .slice(0, 3)
    : [];

  return {
    headline: String(normalized.headline || "").trim(),
    problemStatement: String(normalized.problemStatement || "").trim(),
    impactPlan: String(normalized.impactPlan || "").trim(),
    description: String(normalized.description || "").trim(),
    youtube: String(normalized.youtube || "").trim(),
    images: safeImages,
    socials: normalized.socials || {},
    trust: normalized.trust || undefined,
  };
}

function saveLocalMetadata(hash, metadata) {
  const safeMetadata = sanitizeLocalFallbackMetadata(metadata);
  localMetadataMemoryStore.set(hash, safeMetadata);

  if (typeof window === "undefined") {
    return hash;
  }

  try {
    const store = JSON.parse(localStorage.getItem(LOCAL_METADATA_STORE_KEY) || "{}");
    store[hash] = {
      metadata: safeMetadata,
      savedAt: Date.now(),
    };
    localStorage.setItem(LOCAL_METADATA_STORE_KEY, JSON.stringify(store));
  } catch {
    // Memory fallback keeps dev mode usable even when browser storage is full.
  }

  return hash;
}

function createLocalMetadataFallback(metadata) {
  if (!canUseLocalFallback()) {
    throw new Error("Campaign metadata service is unavailable. Please try again.");
  }

  const localHash = buildLocalHash();
  const safeMetadata = sanitizeLocalFallbackMetadata(metadata);
  saveLocalMetadata(localHash, safeMetadata);

  return {
    reference: localHash,
    ipfsHash: localHash,
    metadataURI: localHash,
    metadata: safeMetadata,
  };
}

async function ensureApiAvailability() {
  if (API_BASE === null) {
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
      const response = await fetch(getApiUrl("/api/health"));

      if (!response.ok) {
        throw new Error(`Health check failed (${response.status})`);
      }

      apiHealthStatus = "available";
      apiUnavailableUntil = 0;
      return true;
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

export function getLocalMetadata(localHash) {
  if (!localHash?.startsWith?.(LOCAL_HASH_PREFIX)) {
    return null;
  }

  const memoryValue = localMetadataMemoryStore.get(localHash);

  if (memoryValue) {
    return memoryValue;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const store = JSON.parse(localStorage.getItem(LOCAL_METADATA_STORE_KEY) || "{}");
    return store[localHash]?.metadata || null;
  } catch {
    return null;
  }
}

export async function uploadMetadata(metadata, { allowLocalFallback = false } = {}) {
  if (API_BASE === null) {
    if (allowLocalFallback) {
      return createLocalMetadataFallback(metadata);
    }

    throw new Error("Campaign metadata service is unavailable. Please try again.");
  }

  const isAvailable = await ensureApiAvailability();

  if (!isAvailable) {
    if (allowLocalFallback && canUseLocalFallback()) {
      return createLocalMetadataFallback(metadata);
    }

    throw new Error("Campaign metadata service is unavailable. Please try again.");
  }

  try {
    const response = await fetch(getApiUrl("/api/metadata/upload"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ metadata }),
    });

    const text = await response.text();
    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    if (!response.ok || !data?.ipfsHash) {
      throw new Error(data?.detail || data?.error || "Metadata upload failed");
    }

    const metadataURI = toMetadataUri(data.metadataURI || data.ipfsHash);

    return {
      reference: metadataURI,
      ipfsHash: String(data.ipfsHash || "").trim(),
      metadataURI,
      metadata: sanitizeCampaignMetadataForTransport(data.metadata || metadata),
    };
  } catch (error) {
    apiHealthStatus = "unavailable";
    apiUnavailableUntil = Date.now() + 60000;

    if (allowLocalFallback && canUseLocalFallback()) {
      return createLocalMetadataFallback(metadata);
    }

    throw error;
  }
}
