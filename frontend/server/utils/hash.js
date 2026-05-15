import crypto from "node:crypto";

export function hashValue(value = "") {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export function normalizeAddress(value = "") {
  return String(value || "").trim().toLowerCase();
}

export function normalizeWhitespace(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function createCampaignFingerprint(input = {}) {
  const normalized = [
    normalizeWhitespace(input.headline).toLowerCase(),
    normalizeWhitespace(input.description).toLowerCase(),
    Number(input.goal || 0),
    Number(input.duration || 0),
    JSON.stringify(input.socials || {}),
  ].join("|");

  return hashValue(normalized);
}
