import {
  createDonationMoment,
  getDonationMoment,
  renderDonationMomentPage,
  trackDonationMomentEvent,
} from "../services/donationMoment.js";
import { readJsonBody, sendError, sendJson } from "../utils/http.js";

function getRequestOrigin(request) {
  const protocolHeader = String(request.headers["x-forwarded-proto"] || "").trim();
  const protocol = protocolHeader || "http";
  const host = String(request.headers.host || "localhost").trim();
  return `${protocol}://${host}`;
}

function matchSharePage(pathname) {
  const matched = pathname.match(/^\/moments\/(\d+)\/(0x[a-fA-F0-9]{64})$/);

  if (!matched) {
    return null;
  }

  return {
    chainId: Number(matched[1]),
    txHash: matched[2],
  };
}

export async function handleDonationMomentRoute(request, response, pathname) {
  if (pathname === "/api/donation-moments") {
    if (request.method !== "POST") {
      sendError(response, request, 405, "Method not allowed");
      return true;
    }

    try {
      const body = await readJsonBody(request);
      const moment = await createDonationMoment(body);
      sendJson(response, request, 200, { moment });
    } catch (error) {
      sendError(response, request, 500, "Donation moment generation failed", {
        detail: error.message,
      });
    }

    return true;
  }

  if (pathname === "/api/donation-moments/track") {
    if (request.method !== "POST") {
      sendError(response, request, 405, "Method not allowed");
      return true;
    }

    try {
      const body = await readJsonBody(request);
      const tracking = await trackDonationMomentEvent(body);
      sendJson(response, request, 200, tracking);
    } catch (error) {
      sendError(response, request, 500, "Donation moment tracking failed", {
        detail: error.message,
      });
    }

    return true;
  }

  const sharePage = matchSharePage(pathname);

  if (!sharePage) {
    return false;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    sendError(response, request, 405, "Method not allowed");
    return true;
  }

  try {
    const moment = await getDonationMoment(sharePage.chainId, sharePage.txHash);

    if (!moment) {
      sendError(response, request, 404, "Donation moment not found");
      return true;
    }

    const html = renderDonationMomentPage(moment, getRequestOrigin(request));

    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    });

    if (request.method === "HEAD") {
      response.end();
      return true;
    }

    response.end(html);
  } catch (error) {
    sendError(response, request, 500, "Donation moment page failed", {
      detail: error.message,
    });
  }

  return true;
}
