export const SITE_NAME = "BaseFundAI";
export const SITE_TITLE = "BaseFundAI | Onchain crowdfunding for real-world needs";
export const SITE_DESCRIPTION =
  "BaseFundAI is a non-custodial crowdfunding app for Base Sepolia, Arc Testnet, and Robinhood Testnet with transparent campaign funding and trust-aware creator flows.";
export const SITE_URL = String(import.meta.env.VITE_SITE_URL || "")
  .trim()
  .replace(/\/$/, "");
export const SITE_IMAGE_PATH = "/logo.png";

function normalizeUrl(value) {
  return String(value || "").trim();
}

export const SOCIAL_LINKS = {
  x: normalizeUrl(import.meta.env.VITE_SOCIAL_X_URL || "https://x.com/basefundai"),
  telegram: normalizeUrl(import.meta.env.VITE_SOCIAL_TELEGRAM_URL),
  discord: normalizeUrl(import.meta.env.VITE_SOCIAL_DISCORD_URL),
  github: normalizeUrl(
    import.meta.env.VITE_SOCIAL_GITHUB_URL ||
      "https://github.com/drcryptonft/BaseFundAI"
  ),
  medium: normalizeUrl(import.meta.env.VITE_SOCIAL_MEDIUM_URL),
  docs: normalizeUrl(import.meta.env.VITE_DOCS_URL),
  mediaKit: normalizeUrl(import.meta.env.VITE_MEDIA_KIT_URL),
};

export function toAbsoluteUrl(path = "") {
  const normalizedPath = String(path || "").trim();

  if (!normalizedPath) {
    return SITE_URL;
  }

  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath;
  }

  if (!SITE_URL) {
    return "";
  }

  return `${SITE_URL}${normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`}`;
}
