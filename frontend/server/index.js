import http from "node:http";
import { loadEnvFiles } from "./utils/env.js";

loadEnvFiles();

const [
  { sendError, sendJson, sendNoContent },
  { handleTrustRoute },
  { handleCampaignRoute },
  { handleMonitoringRoute },
  { handleDonationMomentRoute },
  { handleMetadataRoute },
  { recordMonitoringError },
  { serveStaticAsset },
] = await Promise.all([
  import("./utils/http.js"),
  import("./routes/trust.js"),
  import("./routes/campaigns.js"),
  import("./routes/monitoring.js"),
  import("./routes/donationMoment.js"),
  import("./routes/metadata.js"),
  import("./services/appMonitoring.js"),
  import("./utils/static.js"),
]);

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
  void recordMonitoringError({
    source: "backend",
    eventType: "backend_unhandled_rejection",
    message: error?.message || String(error || "Unhandled rejection"),
    metadata: {
      kind: "unhandled_rejection",
    },
  });
});

process.on("uncaughtExceptionMonitor", (error) => {
  console.error("Uncaught exception:", error);
  void recordMonitoringError({
    source: "backend",
    eventType: "backend_uncaught_exception",
    message: error?.message || String(error || "Uncaught exception"),
    metadata: {
      kind: "uncaught_exception",
    },
  });
});

const requestedPort = Number(process.env.TRUST_PORT || 5000);
const fallbackPorts = [
  requestedPort,
  requestedPort + 1,
  requestedPort + 2,
  5000,
  5001,
  5050,
].filter(
  (value, index, list) =>
    Number.isInteger(value) && value > 0 && list.indexOf(value) === index
);

const server = http.createServer(async (request, response) => {
  try {
    if (!request.url) {
      sendError(response, request, 400, "Invalid request");
      return;
    }

    if (request.method === "OPTIONS") {
      sendNoContent(response, request);
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const pathname = url.pathname;

    if (pathname === "/api/health") {
      sendJson(response, request, 200, {
        ok: true,
        service: "basefundai-trust-engine",
        time: new Date().toISOString(),
      });
      return;
    }

    if (await handleTrustRoute(request, response, pathname)) {
      return;
    }

    if (await handleCampaignRoute(request, response, pathname)) {
      return;
    }

    if (await handleMonitoringRoute(request, response, pathname)) {
      return;
    }

    if (await handleDonationMomentRoute(request, response, pathname)) {
      return;
    }

    if (await handleMetadataRoute(request, response, pathname)) {
      return;
    }

    if (pathname.startsWith("/api/")) {
      sendError(response, request, 404, "Route not found");
      return;
    }

    if (await serveStaticAsset(request, response, pathname)) {
      return;
    }

    sendError(response, request, 404, "Route not found");
  } catch (error) {
    console.error("Server request failed:", error);
    sendError(response, request, 500, "Server request failed", {
      detail: error?.message || "Unknown server error",
    });
  }
});

function startServer(portIndex = 0) {
  const port = fallbackPorts[portIndex];

  if (!port) {
    console.error("BaseFundAI trust engine failed to start: no free fallback port found.");
    process.exit(1);
    return;
  }

  const onListening = () => {
    server.off("error", onError);
    console.log(`BaseFundAI trust engine running on port ${port}`);
    if (port !== requestedPort) {
      console.log(`Requested port ${requestedPort} was busy. Using fallback port ${port}.`);
    }
  };

  const onError = (error) => {
    server.off("listening", onListening);
    if (error?.code === "EADDRINUSE") {
      console.warn(`Port ${port} is already in use. Trying another port...`);
      startServer(portIndex + 1);
      return;
    }

    throw error;
  };

  server.once("listening", onListening);
  server.once("error", onError);
  server.listen(port);
}

startServer();
