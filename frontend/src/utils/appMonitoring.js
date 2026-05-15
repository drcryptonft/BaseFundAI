import { resolveConfiguredApiBase } from "./apiBase";

const configuredApiBase = String(import.meta.env.VITE_API_BASE_URL || "").trim();
const API_BASE = resolveConfiguredApiBase(configuredApiBase);
const MONITORING_ENABLED =
  String(import.meta.env.VITE_ENABLE_APP_MONITORING || "true")
    .trim()
    .toLowerCase() !== "false";
const ERROR_THROTTLE_MS = 30 * 1000;
const MAX_MESSAGE_LENGTH = 240;
const errorThrottleMap = new Map();

function getApiUrl(path) {
  return `${API_BASE}${path}`;
}

function sanitizeString(value, maxLength = MAX_MESSAGE_LENGTH) {
  const normalized = String(value || "")
    .replace(/\b0x[a-f0-9]{8,}\b/gi, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, Math.max(0, maxLength - 3))}...`
    : normalized;
}

function shouldTrackError(signature) {
  const now = Date.now();
  const previous = errorThrottleMap.get(signature) || 0;

  if (now - previous < ERROR_THROTTLE_MS) {
    return false;
  }

  errorThrottleMap.set(signature, now);
  return true;
}

async function sendMonitoringPayload(payload) {
  if (!MONITORING_ENABLED) {
    return;
  }

  const body = JSON.stringify(payload);
  const url = getApiUrl("/api/monitoring/events");

  try {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      const blob = new Blob([body], {
        type: "application/json",
      });

      navigator.sendBeacon(url, blob);
      return;
    }
  } catch {
    // Fall back to fetch when sendBeacon is unavailable or rejected.
  }

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
      keepalive: true,
    });
  } catch {
    // Monitoring must never disturb product flows.
  }
}

export function trackAppMetric({
  eventType,
  status,
  chainId,
  metadata = {},
  source = "frontend",
} = {}) {
  if (!MONITORING_ENABLED || !eventType || !status) {
    return;
  }

  void sendMonitoringPayload({
    category: "metric",
    source,
    eventType,
    status,
    chainId,
    metadata,
  });
}

export function trackAppError({
  eventType = "frontend_runtime_error",
  message,
  source = "frontend",
  chainId,
  metadata = {},
} = {}) {
  if (!MONITORING_ENABLED) {
    return;
  }

  const sanitizedMessage = sanitizeString(message);

  if (!sanitizedMessage) {
    return;
  }

  const signature = `${source}:${eventType}:${sanitizedMessage}`;

  if (!shouldTrackError(signature)) {
    return;
  }

  void sendMonitoringPayload({
    category: "error",
    source,
    eventType,
    status: "failed",
    chainId,
    message: sanitizedMessage,
    metadata,
  });
}

export function installGlobalAppMonitoring() {
  if (!MONITORING_ENABLED || typeof window === "undefined") {
    return;
  }

  if (window.__basefundaiMonitoringInstalled) {
    return;
  }

  window.__basefundaiMonitoringInstalled = true;

  window.addEventListener("error", (event) => {
    trackAppError({
      eventType: "frontend_runtime_error",
      message: event?.error?.message || event?.message || "Unknown frontend error",
      metadata: {
        kind: "error",
        file: sanitizeString(event?.filename || "", 80),
      },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    const message =
      reason?.message ||
      reason?.shortMessage ||
      (typeof reason === "string" ? reason : "Unhandled promise rejection");

    trackAppError({
      eventType: "frontend_unhandled_rejection",
      message,
      metadata: {
        kind: "unhandledrejection",
      },
    });
  });
}
