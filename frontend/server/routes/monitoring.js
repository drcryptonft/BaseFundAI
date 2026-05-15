import {
  getMonitoringHealthSnapshot,
  getMonitoringSummary,
  isAppMonitoringEnabled,
  recordMonitoringEvent,
} from "../services/appMonitoring.js";
import { enforceRateLimit } from "../utils/rateLimit.js";
import { getClientIp, readJsonBody, sendError, sendJson } from "../utils/http.js";

const MONITORING_EVENT_LIMIT_BYTES = 32 * 1024;
const MONITORING_ADMIN_HEADER = "x-monitoring-token";

function getMonitoringAdminToken() {
  return String(process.env.MONITORING_ADMIN_TOKEN || "").trim();
}

function getProvidedMonitoringToken(request) {
  const directHeader = String(request.headers[MONITORING_ADMIN_HEADER] || "").trim();

  if (directHeader) {
    return directHeader;
  }

  const authorization = String(request.headers.authorization || "").trim();

  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return "";
}

function ensureMonitoringAuthorized(request) {
  const configuredToken = getMonitoringAdminToken();

  if (!configuredToken) {
    const error = new Error("Monitoring admin token is not configured");
    error.statusCode = 503;
    throw error;
  }

  const providedToken = getProvidedMonitoringToken(request);

  if (!providedToken || providedToken !== configuredToken) {
    const error = new Error("Monitoring access denied");
    error.statusCode = 401;
    throw error;
  }
}

export async function handleMonitoringRoute(request, response, pathname) {
  if (pathname === "/api/monitoring/events") {
    if (request.method !== "POST") {
      sendError(response, request, 405, "Method not allowed");
      return true;
    }

    try {
      const ip = getClientIp(request);

      enforceRateLimit({
        bucket: "monitoring-events",
        key: ip,
        limit: 120,
        windowMs: 10 * 60 * 1000,
      });

      const body = await readJsonBody(request, {
        maxBytes: MONITORING_EVENT_LIMIT_BYTES,
      });
      const tracking = await recordMonitoringEvent({
        category: body.category || "metric",
        source: body.source || "frontend",
        eventType: body.eventType || "unknown",
        status: body.status || "info",
        chainId: body.chainId,
        message: body.message,
        metadata: body.metadata || {},
      });

      sendJson(response, request, 200, tracking);
    } catch (error) {
      sendError(
        response,
        request,
        Number(error?.statusCode || 500),
        "Monitoring event failed",
        {
          detail: error.message,
        }
      );
    }

    return true;
  }

  if (pathname === "/api/monitoring/health") {
    if (request.method !== "GET") {
      sendError(response, request, 405, "Method not allowed");
      return true;
    }

    try {
      ensureMonitoringAuthorized(request);

      sendJson(response, request, 200, {
        ok: true,
        service: "basefundai-trust-engine",
        time: new Date().toISOString(),
        ...getMonitoringHealthSnapshot(),
      });
    } catch (error) {
      sendError(
        response,
        request,
        Number(error?.statusCode || 500),
        "Monitoring health failed",
        {
          detail: error.message,
        }
      );
    }

    return true;
  }

  if (pathname === "/api/monitoring/summary") {
    if (request.method !== "GET") {
      sendError(response, request, 405, "Method not allowed");
      return true;
    }

    try {
      ensureMonitoringAuthorized(request);

      const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
      const summary = await getMonitoringSummary({
        windowHours: Number(url.searchParams.get("windowHours") || 24),
      });

      sendJson(response, request, 200, summary);
    } catch (error) {
      sendError(
        response,
        request,
        Number(error?.statusCode || 500),
        "Monitoring summary failed",
        {
          detail: error.message,
        }
      );
    }

    return true;
  }

  if (pathname === "/api/monitoring/status") {
    if (request.method !== "GET") {
      sendError(response, request, 405, "Method not allowed");
      return true;
    }

    try {
      ensureMonitoringAuthorized(request);

      sendJson(response, request, 200, {
        enabled: isAppMonitoringEnabled(),
      });
    } catch (error) {
      sendError(
        response,
        request,
        Number(error?.statusCode || 500),
        "Monitoring status failed",
        {
          detail: error.message,
        }
      );
    }

    return true;
  }

  return false;
}
