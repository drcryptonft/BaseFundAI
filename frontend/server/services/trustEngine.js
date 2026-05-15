import { getAlchemySignal } from "./alchemy.js";
import { getBaseScanSignal } from "./basescan.js";
import { getGitcoinSignal } from "./gitcoin.js";
import { getGeminiSignal } from "./gemini.js";
import { getSocialSignal, normalizeSocials } from "./social.js";
import { getBehaviorSignal } from "./ipReputation.js";
import { getRegistryInsights } from "./campaignRegistry.js";
import {
  createCampaignFingerprint,
  hashValue,
  normalizeAddress,
  normalizeWhitespace,
} from "../utils/hash.js";
import { getDataFile, readJsonFile, updateJsonFile } from "../utils/store.js";

const TRUST_CACHE_FILE = getDataFile("trust-cache.json");
const EMPTY_CACHE = {
  drafts: {},
};
const CACHE_TTL_MS = 30 * 60 * 1000;
const STALE_WALLET_AGE_MESSAGES = [
  "deprecated v1 endpoint",
  "switch to etherscan api v2",
  "missing or unsupported chainid parameter",
  "required for v2 api",
];

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeDraft(input = {}) {
  return {
    chainId: Number(input.chainId || 84532),
    walletAddress: normalizeAddress(input.walletAddress),
    headline: normalizeWhitespace(input.headline),
    description: normalizeWhitespace(input.description),
    goal: Number(input.goal || 0),
    duration: Number(input.duration || 0),
    socials: normalizeSocials(input.socials || {}),
    youtube: String(input.youtube || "").trim(),
    mediaCount: Number(input.mediaCount || 0),
  };
}

function getBadge(score, coverage) {
  if (score >= 80 && coverage >= 70) {
    return {
      label: "High Trust",
      tone: "emerald",
    };
  }

  if (score >= 65) {
    return {
      label: "Good Standing",
      tone: "sky",
    };
  }

  if (score >= 45) {
    return {
      label: "Emerging",
      tone: "amber",
    };
  }

  return {
    label: "Caution",
    tone: "rose",
  };
}

function dedupe(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function hasDeprecatedWalletAgeCache(value) {
  const walletAgeSignal = Array.isArray(value?.signals)
    ? value.signals.find((signal) => signal?.key === "wallet-age")
    : null;
  const reason = String(
    walletAgeSignal?.stats?.error || walletAgeSignal?.summary || ""
  ).toLowerCase();

  return STALE_WALLET_AGE_MESSAGES.some((message) => reason.includes(message));
}

async function getCachedTrust(cacheKey) {
  const cache = await readJsonFile(TRUST_CACHE_FILE, EMPTY_CACHE);
  const cached = cache.drafts?.[cacheKey];

  if (!cached) {
    return null;
  }

  if (Date.now() - Number(cached.cachedAt || 0) > CACHE_TTL_MS) {
    return null;
  }

  if (hasDeprecatedWalletAgeCache(cached.value)) {
    return null;
  }

  return cached.value || null;
}

async function setCachedTrust(cacheKey, value) {
  await updateJsonFile(TRUST_CACHE_FILE, EMPTY_CACHE, (current) => {
    current.drafts[cacheKey] = {
      cachedAt: Date.now(),
      value,
    };

    return current;
  });
}

export async function calculateTrustScore(input = {}, { ip = "" } = {}) {
  const draft = normalizeDraft(input);

  if (!draft.walletAddress) {
    throw new Error("walletAddress is required");
  }

  const ipHash = ip ? hashValue(ip) : "";
  const fingerprint = createCampaignFingerprint(draft);
  const cacheKey = hashValue(
    JSON.stringify({
      chainId: draft.chainId,
      walletAddress: draft.walletAddress,
      fingerprint,
      ipHash,
    })
  );
  const cached = await getCachedTrust(cacheKey);

  if (cached) {
    return cached;
  }

  const insights = await getRegistryInsights({
    walletAddress: draft.walletAddress,
    ipHash,
    fingerprint,
  });

  const [walletActivity, walletAge, passport, content] = await Promise.all([
    getAlchemySignal(draft.walletAddress, draft.chainId),
    getBaseScanSignal(draft.walletAddress, draft.chainId),
    getGitcoinSignal(draft.walletAddress),
    getGeminiSignal(draft),
  ]);

  const social = getSocialSignal(draft.socials);
  const behavior = getBehaviorSignal(insights);
  const signals = [passport, walletAge, walletActivity, content, social, behavior];
  const availableWeight = signals
    .filter((signal) => signal.available)
    .reduce((total, signal) => total + signal.maxScore, 0);
  const earnedAvailableScore = signals
    .filter((signal) => signal.available)
    .reduce((total, signal) => total + signal.score, 0);
  const rawScore =
    availableWeight > 0 ? (earnedAvailableScore / availableWeight) * 100 : 45;
  const coverage = Math.round((availableWeight / 100) * 100);
  const coverageFactor = 0.65 + (coverage / 100) * 0.35;
  const finalScore = clamp(Math.round(rawScore * coverageFactor), 0, 100);
  const badge = getBadge(finalScore, coverage);
  const highlights = dedupe(signals.flatMap((signal) => signal.highlights || [])).slice(
    0,
    4
  );
  const warnings = dedupe(signals.flatMap((signal) => signal.warnings || [])).slice(
    0,
    4
  );
  const flags = dedupe(signals.flatMap((signal) => signal.flags || [])).slice(0, 4);

  const trust = {
    score: finalScore,
    trustPoints: finalScore,
    coverage,
    badge,
    highlights,
    warnings,
    flags,
    signals,
    stats: {
      walletAddress: draft.walletAddress,
      chainId: draft.chainId,
      fingerprint,
      ipHash,
      creatorCampaignCount: insights.creatorCampaignCount,
      sharedIpCampaignCount: insights.sharedIpCampaignCount,
      sharedIpWalletCount: insights.sharedIpWalletCount,
      duplicateFingerprintCount: insights.duplicateFingerprintCount,
      duplicateOtherWalletCount: insights.duplicateOtherWalletCount,
      txCount: walletActivity.stats?.txCount || 0,
      walletAgeDays: walletAge.stats?.ageDays ?? null,
      passportScore: passport.stats?.passportScore || 0,
      socialsConnected: social.stats?.connected || [],
    },
    updatedAt: new Date().toISOString(),
  };

  await setCachedTrust(cacheKey, trust);
  return trust;
}
