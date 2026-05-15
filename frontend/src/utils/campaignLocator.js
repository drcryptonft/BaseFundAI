import { FACTORY_ABI, getFactoryAddress } from "../contracts";
import { DEFAULT_CHAIN_ID, supportedChains } from "../config/networks";
import { getPublicClient } from "../wagmi";

const CAMPAIGN_META_STORAGE_KEY = "campaignMeta";

function normalizeAddress(value = "") {
  return String(value || "").trim().toLowerCase();
}

function readCampaignMetaMap() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    return JSON.parse(localStorage.getItem(CAMPAIGN_META_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeCampaignMetaMap(map) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(CAMPAIGN_META_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota issues and continue without local hints.
  }
}

export function getStoredCampaignChainId(address) {
  const normalizedAddress = normalizeAddress(address);

  if (!normalizedAddress) {
    return 0;
  }

  const map = readCampaignMetaMap();
  const hintedChainId = Number(map?.__chainHints?.[normalizedAddress] || 0);

  if (hintedChainId > 0) {
    return hintedChainId;
  }

  const chainScopedKey = Object.keys(map).find((key) =>
    key.endsWith(`:${normalizedAddress}`)
  );

  if (!chainScopedKey) {
    return 0;
  }

  return Number(chainScopedKey.split(":")[0] || 0);
}

export function rememberCampaignReference(address, chainId, reference = "") {
  const normalizedAddress = normalizeAddress(address);
  const normalizedChainId = Number(chainId || 0);
  const normalizedReference = String(reference || "").trim();

  if (!normalizedAddress || normalizedChainId <= 0 || typeof window === "undefined") {
    return;
  }

  const map = readCampaignMetaMap();
  const chainHints =
    map.__chainHints && typeof map.__chainHints === "object"
      ? map.__chainHints
      : {};

  chainHints[normalizedAddress] = normalizedChainId;
  map.__chainHints = chainHints;

  if (normalizedReference) {
    map[`${normalizedChainId}:${normalizedAddress}`] = normalizedReference;
    map[normalizedAddress] = normalizedReference;
  }

  writeCampaignMetaMap(map);
}

export async function detectCampaignChainId(
  address,
  {
    preferredChainIds = [],
    fallbackChainId = DEFAULT_CHAIN_ID,
  } = {}
) {
  const normalizedAddress = normalizeAddress(address);

  if (!normalizedAddress) {
    return 0;
  }

  const candidates = [
    ...preferredChainIds,
    getStoredCampaignChainId(normalizedAddress),
    fallbackChainId,
    ...supportedChains.map((chain) => chain.id),
  ]
    .map((value) => Number(value || 0))
    .filter((value, index, list) => value > 0 && list.indexOf(value) === index);

  for (const chainId of candidates) {
    try {
      const factoryAddress = getFactoryAddress(chainId);
      const publicClient = getPublicClient(chainId);

      if (!factoryAddress || !publicClient) {
        continue;
      }

      const isCampaign = await publicClient.readContract({
        address: factoryAddress,
        abi: FACTORY_ABI,
        functionName: "isCampaign",
        args: [normalizedAddress],
      });

      if (isCampaign) {
        rememberCampaignReference(normalizedAddress, chainId);
        return chainId;
      }
    } catch {
      // Ignore chain-specific RPC or contract read issues and try the next chain.
    }
  }

  return 0;
}
