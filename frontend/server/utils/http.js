import { recordMonitoringError } from "../services/appMonitoring.js";

const DEFAULT_JSON_BODY_LIMIT_BYTES = 1024 * 1024;

const LOCALHOST_ORIGINS = new Set([
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "http://localhost:5001",
  "http://127.0.0.1:5001",
  "http://localhost:5050",
  "http://127.0.0.1:5050",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function shouldTrustProxyHeaders() {
  return String(process.env.TRUST_TRUST_PROXY || "")
    .trim()
    .toLowerCase() === "true";
}

function isLoopbackOrigin(origin) {
  return LOCALHOST_ORIGINS.has(String(origin || "").trim().toLowerCase());
}

function getSameOriginCandidate(request) {
  const host = String(request.headers.host || "").trim();

  if (!host) {
    return "";
  }

  const protocol = shouldTrustProxyHeaders()
    ? String(request.headers["x-forwarded-proto"] || "http").split(",")[0].trim()
    : "http";

  return `${protocol}://${host}`.toLowerCase();
}

export function getCorsOrigin(request) {
  const configuredAllowed = String(process.env.TRUST_ALLOWED_ORIGIN || "").trim();
  const requestOrigin = String(request.headers.origin || "").trim();

  if (!requestOrigin) {
    return "";
  }

  if (configuredAllowed === "*") {
    return "*";
  }

  if (configuredAllowed) {
    const candidates = configuredAllowed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (candidates.includes(requestOrigin)) {
      return requestOrigin;
    }

    return "";
  }

  if (isLoopbackOrigin(requestOrigin)) {
    return requestOrigin;
  }

  return requestOrigin.toLowerCase() === getSameOriginCandidate(request)
    ? requestOrigin
    : "";
}

export function corsHeaders(request) {
  const origin = getCorsOrigin(request);
  const headers = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }

  return headers;
}

export async function readJsonBody(
  request,
  { maxBytes = DEFAULT_JSON_BODY_LIMIT_BYTES } = {}
) {
  const chunks = [];
  const contentType = String(request.headers["content-type"] || "").toLowerCase();
  let totalBytes = 0;

  if (contentType && !contentType.includes("application/json")) {
    throw createHttpError("Request body must be JSON", 415);
  }

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;

    if (totalBytes > maxBytes) {
      throw createHttpError("Request body is too large", 413);
    }

    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return {};
  }

  const body = Buffer.concat(chunks).toString("utf8");

  if (!body.trim()) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    throw createHttpError("Invalid JSON body", 400);
  }
}

export function sendJson(response, request, statusCode, payload) {
  response.writeHead(statusCode, {
    ...corsHeaders(request),
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

export function sendError(response, request, statusCode, message, extra = {}) {
  if (
    Number(statusCode) >= 500 &&
    !String(request?.url || "").startsWith("/api/monitoring/")
  ) {
    queueMicrotask(() => {
      void recordMonitoringError({
        source: "backend",
        eventType: "backend_response_error",
        status: "failed",
        message,
        metadata: {
          method: request?.method || "GET",
          route: String(request?.url || "").split("?")[0] || "",
          statusCode: Number(statusCode),
        },
      }).catch(() => {});
    });
  }

  sendJson(response, request, statusCode, {
    error: message,
    ...extra,
  });
}

export function sendNoContent(response, request) {
  response.writeHead(204, corsHeaders(request));
  response.end();
}

export function getClientIp(request) {
  if (shouldTrustProxyHeaders()) {
    const forwarded = request.headers["x-forwarded-for"];

    if (typeof forwarded === "string" && forwarded.trim()) {
      return forwarded.split(",")[0].trim().replace(/^::ffff:/, "");
    }

    const realIp = request.headers["x-real-ip"];

    if (typeof realIp === "string" && realIp.trim()) {
      return realIp.trim().replace(/^::ffff:/, "");
    }
  }

  return String(request.socket?.remoteAddress || "").replace(/^::ffff:/, "");
}
