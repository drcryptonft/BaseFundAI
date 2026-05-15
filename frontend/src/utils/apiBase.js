function stripTrailingSlash(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

function isLocalApiBase(value) {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function resolveConfiguredApiBase(
  configuredApiBase,
  { allowNullInDev = false } = {}
) {
  const normalized = String(configuredApiBase || "").trim();

  if (normalized === "same-origin") {
    return "";
  }

  const stripped = stripTrailingSlash(normalized);

  if (import.meta.env.DEV && stripped && isLocalApiBase(stripped)) {
    return "";
  }

  if (stripped) {
    return stripped;
  }

  return allowNullInDev && !import.meta.env.PROD ? null : "";
}
