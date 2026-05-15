import { resolveConfiguredApiBase } from "./apiBase";

const configuredApiBase = String(import.meta.env.VITE_API_BASE_URL || "").trim();
const API_BASE = resolveConfiguredApiBase(configuredApiBase);

function getApiUrl(path) {
  return `${API_BASE}${path}`;
}

async function requestJson(path) {
  const response = await fetch(getApiUrl(path));
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
    throw new Error(data?.detail || data?.error || `Request failed (${response.status})`);
  }

  return data;
}

export async function requestCampaignFeed({
  chainId,
  state = "ALL",
  sort = "TRENDING",
  limit = 24,
  offset = 0,
  creator = "",
  addresses = [],
} = {}) {
  const searchParams = new URLSearchParams();

  if (chainId) {
    searchParams.set("chainId", String(chainId));
  }

  if (state) {
    searchParams.set("state", String(state));
  }

  if (sort) {
    searchParams.set("sort", String(sort));
  }

  if (limit) {
    searchParams.set("limit", String(limit));
  }

  if (offset) {
    searchParams.set("offset", String(offset));
  }

  if (creator) {
    searchParams.set("creator", String(creator));
  }

  const normalizedAddresses = Array.isArray(addresses)
    ? [...new Set(addresses.map((address) => String(address || "").trim()).filter(Boolean))]
    : typeof addresses === "string"
      ? [...new Set(addresses.split(",").map((address) => address.trim()).filter(Boolean))]
      : [];

  if (normalizedAddresses.length > 0) {
    searchParams.set("addresses", normalizedAddresses.join(","));
  }

  const queryString = searchParams.toString();
  return requestJson(`/api/campaigns/feed${queryString ? `?${queryString}` : ""}`);
}

export async function requestCampaignSummary({ chainId } = {}) {
  const searchParams = new URLSearchParams();

  if (chainId) {
    searchParams.set("chainId", String(chainId));
  }

  const queryString = searchParams.toString();
  return requestJson(`/api/campaigns/summary${queryString ? `?${queryString}` : ""}`);
}
