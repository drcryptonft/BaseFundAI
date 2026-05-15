import { resolveConfiguredApiBase } from "./apiBase";

const configuredApiBase = String(import.meta.env.VITE_API_BASE_URL || "").trim();
const API_BASE = resolveConfiguredApiBase(configuredApiBase);
const MONITORING_TOKEN_STORAGE_KEY = "basefundai-monitoring-token";

function getApiUrl(path) {
  return `${API_BASE}${path}`;
}

function buildHeaders(token) {
  const normalizedToken = String(token || "").trim();
  const headers = {};

  if (normalizedToken) {
    headers["x-monitoring-token"] = normalizedToken;
  }

  return headers;
}

async function requestJson(path, { token = "" } = {}) {
  const response = await fetch(getApiUrl(path), {
    headers: buildHeaders(token),
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

  if (!response.ok) {
    const error = new Error(
      data?.detail || data?.error || `Request failed (${response.status})`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

export function getSavedMonitoringToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return String(window.sessionStorage.getItem(MONITORING_TOKEN_STORAGE_KEY) || "").trim();
}

export function saveMonitoringToken(token) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedToken = String(token || "").trim();

  if (normalizedToken) {
    window.sessionStorage.setItem(MONITORING_TOKEN_STORAGE_KEY, normalizedToken);
  }
}

export function clearMonitoringToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(MONITORING_TOKEN_STORAGE_KEY);
}

export async function requestMonitoringSummary({ windowHours = 24, token = "" } = {}) {
  const searchParams = new URLSearchParams();

  if (windowHours) {
    searchParams.set("windowHours", String(windowHours));
  }

  const queryString = searchParams.toString();
  return requestJson(`/api/monitoring/summary${queryString ? `?${queryString}` : ""}`, {
    token,
  });
}

export async function requestMonitoringHealth({ token = "" } = {}) {
  return requestJson("/api/monitoring/health", { token });
}
