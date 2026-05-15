const CACHE_PREFIX = "campaignCacheV2";
const CACHE_TTL_MS = 60000;

function getCacheKey(chainId) {
  return `${CACHE_PREFIX}:${chainId || "default"}`;
}

export function saveCampaignCache(data, chainId) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(
      getCacheKey(chainId),
      JSON.stringify({
        data,
        timestamp: Date.now(),
      })
    );
  } catch {
    // Ignore storage quota failures and keep the live in-memory state.
  }
}

export function loadCampaignCache(chainId) {
  if (typeof window === "undefined") {
    return null;
  }

  const cache = localStorage.getItem(getCacheKey(chainId));

  if (!cache) return null;

  try {
    const parsed = JSON.parse(cache);

    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}
