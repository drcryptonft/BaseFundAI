import { calculateTrustScore } from "../services/trustEngine.js";
import { getClientIp, readJsonBody, sendError, sendJson } from "../utils/http.js";
import { enforceRateLimit } from "../utils/rateLimit.js";

const TRUST_PREVIEW_LIMIT_BYTES = 64 * 1024;

export async function handleTrustRoute(request, response, pathname) {
  if (pathname !== "/api/trust/score") {
    return false;
  }

  if (request.method !== "POST") {
    sendError(response, request, 405, "Method not allowed");
    return true;
  }

  try {
    const ip = getClientIp(request);

    enforceRateLimit({
      bucket: "trust-preview",
      key: ip,
      limit: 40,
      windowMs: 10 * 60 * 1000,
    });

    const body = await readJsonBody(request, {
      maxBytes: TRUST_PREVIEW_LIMIT_BYTES,
    });
    const trust = await calculateTrustScore(body, {
      ip,
    });

    sendJson(response, request, 200, { trust });
  } catch (error) {
    sendError(response, request, Number(error?.statusCode || 500), "Trust calculation failed", {
      detail: error.message,
    });
  }

  return true;
}
