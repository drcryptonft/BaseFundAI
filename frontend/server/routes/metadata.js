import {
  METADATA_UPLOAD_LIMIT_BYTES,
  uploadCampaignMetadata,
} from "../services/metadata.js";
import { getClientIp, readJsonBody, sendError, sendJson } from "../utils/http.js";
import { enforceRateLimit } from "../utils/rateLimit.js";

export async function handleMetadataRoute(request, response, pathname) {
  if (pathname !== "/api/metadata/upload") {
    return false;
  }

  if (request.method !== "POST") {
    sendError(response, request, 405, "Method not allowed");
    return true;
  }

  try {
    enforceRateLimit({
      bucket: "metadata-upload",
      key: getClientIp(request),
      limit: 12,
      windowMs: 10 * 60 * 1000,
    });

    const body = await readJsonBody(request, {
      maxBytes: METADATA_UPLOAD_LIMIT_BYTES,
    });
    const result = await uploadCampaignMetadata(body?.metadata || {});
    sendJson(response, request, 200, result);
  } catch (error) {
    sendError(
      response,
      request,
      Number(error?.statusCode || 500),
      "Metadata upload failed",
      {
      detail: error.message,
      }
    );
  }

  return true;
}
