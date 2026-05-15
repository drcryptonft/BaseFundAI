import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getMonitoringHealthSnapshot,
  getMonitoringSummary,
  isAppMonitoringEnabled,
  recordMonitoringError,
  recordMonitoringEvent,
} from "./appMonitoring.js";

const testDirectory = mkdtempSync(join(tmpdir(), "basefundai-monitoring-"));
process.env.CAMPAIGN_REGISTRY_DB_PATH = join(
  testDirectory,
  "campaign-registry.sqlite"
);

test.after(() => {
  try {
    rmSync(testDirectory, { recursive: true, force: true });
  } catch {
    // better-sqlite3 keeps the test database open for this process lifetime.
  }
});

test("app monitoring is enabled by default", () => {
  delete process.env.APP_MONITORING_ENABLED;
  assert.equal(isAppMonitoringEnabled(), true);
});

test("recordMonitoringEvent stores metric counts", async () => {
  const beforeSummary = await getMonitoringSummary({ windowHours: 24 });
  const beforeCount = Number(
    beforeSummary.metrics?.create_campaign?.started || 0
  );

  const result = await recordMonitoringEvent({
    category: "metric",
    source: "frontend",
    eventType: "create_campaign",
    status: "started",
    chainId: 84532,
    metadata: {
      imageCount: 1,
      walletAddress: "0x1234",
    },
  });

  const afterSummary = await getMonitoringSummary({ windowHours: 24 });

  assert.equal(result.ok, true);
  assert.equal(
    Number(afterSummary.metrics?.create_campaign?.started || 0),
    beforeCount + 1
  );
});

test("recordMonitoringError redacts sensitive error strings", async () => {
  await recordMonitoringError({
    source: "frontend",
    eventType: "frontend_runtime_error",
    status: "failed",
    message:
      "Campaign sync failed for 0x1234567890abcdef1234567890abcdef12345678 at tx 0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
    metadata: {
      route: "/explore",
      campaignAddress: "0x1234567890abcdef1234567890abcdef12345678",
    },
  });

  const summary = await getMonitoringSummary({ windowHours: 24 });
  const latestError = summary.errors.recent[0];

  assert.equal(latestError.source, "frontend");
  assert.match(latestError.message, /\[redacted\]/);
  assert.equal(
    Object.prototype.hasOwnProperty.call(latestError.metadata, "campaignAddress"),
    false
  );
});

test("getMonitoringHealthSnapshot exposes runtime health", () => {
  const snapshot = getMonitoringHealthSnapshot();

  assert.equal(typeof snapshot.runtime?.uptimeSeconds, "number");
  assert.equal(typeof snapshot.runtime?.memory?.rssMb, "number");
});
