import {
  getCampaignRecord,
  registerCampaignRecord,
} from "../services/campaignRegistry.js";
import {
  getCampaignFeed,
  getCampaignSummary,
} from "../services/campaignFeed.js";
import { verifyCampaignRecordInput } from "../services/campaignVerifier.js";
import { calculateTrustScore } from "../services/trustEngine.js";
import {
  getClientIp,
  readJsonBody,
  sendError,
  sendJson,
} from "../utils/http.js";
import { hashValue } from "../utils/hash.js";
import { enforceRateLimit } from "../utils/rateLimit.js";

const CAMPAIGN_REGISTER_LIMIT_BYTES = 1024 * 1024;

function parseFeedAddresses(url) {
  return [
    ...url.searchParams.getAll("address"),
    ...String(url.searchParams.get("addresses") || "")
      .split(",")
      .filter(Boolean),
  ];
}

function buildCampaignTrustPayload(verifiedCampaign) {
  const metadata = verifiedCampaign.metadata || {};
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const duration = Math.max(
    0,
    Math.ceil((Number(verifiedCampaign.deadline || 0) - nowInSeconds) / 86400)
  );
  const description =
    String(metadata.description || "").trim() ||
    [metadata.problemStatement, metadata.impactPlan].filter(Boolean).join("\n\n");

  return {
    chainId: verifiedCampaign.chainId,
    walletAddress: verifiedCampaign.creator,
    headline: metadata.headline || "",
    description,
    goal: Number(verifiedCampaign.goal || 0),
    duration,
    youtube: metadata.youtube || "",
    mediaCount: Array.isArray(metadata.images) ? metadata.images.length : 0,
    socials: metadata.socials || {},
  };
}

export async function handleCampaignRoute(request, response, pathname) {
  if (pathname === "/api/campaigns/feed") {
    if (request.method !== "GET") {
      sendError(response, request, 405, "Method not allowed");
      return true;
    }

    try {
      const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
      const feed = await getCampaignFeed({
        chainId: Number(url.searchParams.get("chainId") || 84532),
        state: url.searchParams.get("state") || "ALL",
        sort: url.searchParams.get("sort") || "TRENDING",
        limit: Number(url.searchParams.get("limit") || 24),
        offset: Number(url.searchParams.get("offset") || 0),
        creator: url.searchParams.get("creator") || "",
        addresses: parseFeedAddresses(url),
      });

      sendJson(response, request, 200, feed);
    } catch (error) {
      sendError(response, request, 500, "Campaign feed failed", {
        detail: error.message,
      });
    }

    return true;
  }

  if (pathname === "/api/campaigns/summary") {
    if (request.method !== "GET") {
      sendError(response, request, 405, "Method not allowed");
      return true;
    }

    try {
      const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
      const summary = await getCampaignSummary({
        chainId: Number(url.searchParams.get("chainId") || 84532),
      });

      sendJson(response, request, 200, summary);
    } catch (error) {
      sendError(response, request, 500, "Campaign summary failed", {
        detail: error.message,
      });
    }

    return true;
  }

  if (pathname === "/api/campaigns/register") {
    if (request.method !== "POST") {
      sendError(response, request, 405, "Method not allowed");
      return true;
    }

    try {
      const ip = getClientIp(request);

      enforceRateLimit({
        bucket: "campaign-register",
        key: ip,
        limit: 20,
        windowMs: 10 * 60 * 1000,
      });

      const body = await readJsonBody(request, {
        maxBytes: CAMPAIGN_REGISTER_LIMIT_BYTES,
      });
      const verifiedCampaign = await verifyCampaignRecordInput(body);
      const trust = await calculateTrustScore(
        buildCampaignTrustPayload(verifiedCampaign),
        {
          ip,
        }
      );
      const campaign = await registerCampaignRecord({
        ...verifiedCampaign,
        trust,
        fingerprint: trust?.stats?.fingerprint || "",
        ipHash: ip ? hashValue(ip) : "",
      });

      sendJson(response, request, 200, { campaign });
    } catch (error) {
      sendError(
        response,
        request,
        Number(error?.statusCode || 500),
        "Campaign registration failed",
        {
          detail: error.message,
        }
      );
    }

    return true;
  }

  if (pathname.startsWith("/api/campaigns/")) {
    if (request.method !== "GET") {
      sendError(response, request, 405, "Method not allowed");
      return true;
    }

    const address = pathname.slice("/api/campaigns/".length);
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const chainId = Number(url.searchParams.get("chainId") || 84532);

    try {
      const campaign = await getCampaignRecord(address, chainId);

      if (!campaign) {
        sendJson(response, request, 200, { campaign: null });
        return true;
      }

      sendJson(response, request, 200, { campaign });
    } catch (error) {
      sendError(response, request, 500, "Campaign lookup failed", {
        detail: error.message,
      });
    }

    return true;
  }

  return false;
}
