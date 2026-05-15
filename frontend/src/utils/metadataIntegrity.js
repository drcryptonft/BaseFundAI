import { keccak256, stringToHex } from "viem";

function normalizeMetadataValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeMetadataValue(item));
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        const normalizedValue = normalizeMetadataValue(value[key]);

        if (normalizedValue !== undefined) {
          result[key] = normalizedValue;
        }

        return result;
      }, {});
  }

  return value;
}

export function stableSerializeMetadata(metadata = {}) {
  return JSON.stringify(normalizeMetadataValue(metadata));
}

export function computeMetadataHash(metadata = {}) {
  return keccak256(stringToHex(stableSerializeMetadata(metadata)));
}

export function toMetadataUri(reference) {
  const normalized = String(reference || "").trim();

  if (!normalized) {
    return "";
  }

  if (
    normalized.startsWith("ipfs://") ||
    normalized.startsWith("ar://") ||
    normalized.startsWith("local:")
  ) {
    return normalized;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  return `ipfs://${normalized.replace(/^ipfs:\/\//i, "").replace(/^\/+/, "")}`;
}

export function isImmutableMetadataUri(reference) {
  const normalized = String(reference || "").trim();

  return normalized.startsWith("ipfs://") || normalized.startsWith("ar://");
}

export function extractIpfsHash(reference) {
  const normalized = String(reference || "").trim();

  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("ipfs://")) {
    return normalized
      .slice("ipfs://".length)
      .replace(/^ipfs\//i, "")
      .replace(/^\/+/, "");
  }

  if (/^https?:\/\/[^/]+\/ipfs\//i.test(normalized)) {
    return normalized.replace(/^https?:\/\/[^/]+\/ipfs\//i, "").replace(/^\/+/, "");
  }

  if (/^(Qm|bafy)/i.test(normalized)) {
    return normalized;
  }

  return "";
}

export function getMetadataFetchUrl(reference) {
  const normalized = String(reference || "").trim();

  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("ar://")) {
    return `https://arweave.net/${normalized.slice("ar://".length).replace(/^\/+/, "")}`;
  }

  const ipfsHash = extractIpfsHash(normalized);

  if (ipfsHash) {
    return `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  return "";
}
