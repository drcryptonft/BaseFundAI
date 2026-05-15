import { getAppDatabase } from "./campaignRegistry.js";

const DEFAULT_CHAIN_ID = Number(process.env.DEFAULT_CHAIN_ID || 84532);
const MAX_MESSAGE_LENGTH = 240;
const MAX_METADATA_KEYS = 12;
const MAX_METADATA_STRING_LENGTH = 120;
const MAX_RECENT_ERRORS = 10;
const SENSITIVE_KEY_PATTERN =
  /(address|wallet|tx|hash|headline|description|email|phone|fingerprint|ip)/i;
const HEX_VALUE_PATTERN = /\b0x[a-f0-9]{8,}\b/gi;
const MONITORING_ENABLED =
  String(process.env.APP_MONITORING_ENABLED || "true").trim().toLowerCase() !==
  "false";

function normalizeChainId(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_CHAIN_ID;
}

function normalizeLabel(value, fallback) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || fallback;
}

function sanitizeString(value, maxLength = MAX_METADATA_STRING_LENGTH) {
  const normalized = String(value || "")
    .replace(HEX_VALUE_PATTERN, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, Math.max(0, maxLength - 3))}...`
    : normalized;
}

function sanitizeMessage(value) {
  return sanitizeString(value, MAX_MESSAGE_LENGTH);
}

function sanitizeMetadataValue(value, depth = 0) {
  if (value === null) {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const sanitized = sanitizeString(value);
    return sanitized || undefined;
  }

  if (Array.isArray(value) && depth < 1) {
    const sanitizedItems = value
      .slice(0, 5)
      .map((item) => sanitizeMetadataValue(item, depth + 1))
      .filter((item) => item !== undefined);

    return sanitizedItems.length ? sanitizedItems : undefined;
  }

  if (value && typeof value === "object" && depth < 1) {
    const sanitizedEntries = Object.entries(value)
      .slice(0, 8)
      .filter(([key]) => !SENSITIVE_KEY_PATTERN.test(key))
      .map(([key, entryValue]) => [
        key,
        sanitizeMetadataValue(entryValue, depth + 1),
      ])
      .filter(([, entryValue]) => entryValue !== undefined);

    return sanitizedEntries.length ? Object.fromEntries(sanitizedEntries) : undefined;
  }

  return undefined;
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }

  const sanitizedEntries = Object.entries(metadata)
    .slice(0, MAX_METADATA_KEYS)
    .filter(([key]) => !SENSITIVE_KEY_PATTERN.test(key))
    .map(([key, value]) => [key, sanitizeMetadataValue(value)])
    .filter(([, value]) => value !== undefined);

  return sanitizedEntries.length ? Object.fromEntries(sanitizedEntries) : {};
}

function ensureSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_monitoring_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      source TEXT NOT NULL,
      event_type TEXT NOT NULL,
      status TEXT NOT NULL,
      chain_id INTEGER,
      message TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_app_monitoring_events_created_at
      ON app_monitoring_events (created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_app_monitoring_events_category
      ON app_monitoring_events (category, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_app_monitoring_events_type
      ON app_monitoring_events (event_type, status, created_at DESC);
  `);
}

function getDatabase() {
  const database = getAppDatabase();
  ensureSchema(database);
  return database;
}

function getWindowHours(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 24;
  }

  return Math.min(Math.max(Math.round(parsed), 1), 24 * 30);
}

function getSinceIso(windowHours) {
  return new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
}

function buildMetricStateRows(rows) {
  return rows.reduce((result, row) => {
    const eventType = String(row.event_type || "");
    const status = String(row.status || "unknown");
    const count = Number(row.count || 0);

    if (!result[eventType]) {
      result[eventType] = {};
    }

    result[eventType][status] = count;
    return result;
  }, {});
}

function buildErrorSourceRows(rows) {
  return rows.reduce((result, row) => {
    const source = String(row.source || "unknown");
    result[source] = Number(row.count || 0);
    return result;
  }, {});
}

export function isAppMonitoringEnabled() {
  return MONITORING_ENABLED;
}

export async function recordMonitoringEvent(input = {}) {
  if (!MONITORING_ENABLED) {
    return {
      ok: true,
      skipped: true,
      recordedAt: null,
    };
  }

  const database = getDatabase();
  const now = new Date().toISOString();
  const category = normalizeLabel(input.category, "metric");
  const source = normalizeLabel(input.source, "frontend");
  const eventType = normalizeLabel(input.eventType, "unknown");
  const status = normalizeLabel(input.status, "info");
  const chainId = normalizeChainId(input.chainId);
  const message = sanitizeMessage(input.message);
  const metadata = sanitizeMetadata(input.metadata);

  database
    .prepare(
      `
        INSERT INTO app_monitoring_events (
          category,
          source,
          event_type,
          status,
          chain_id,
          message,
          metadata_json,
          created_at
        ) VALUES (
          @category,
          @source,
          @eventType,
          @status,
          @chainId,
          @message,
          @metadataJson,
          @createdAt
        )
      `
    )
    .run({
      category,
      source,
      eventType,
      status,
      chainId,
      message: message || null,
      metadataJson: Object.keys(metadata).length ? JSON.stringify(metadata) : null,
      createdAt: now,
    });

  return {
    ok: true,
    skipped: false,
    recordedAt: now,
  };
}

export async function recordMonitoringError(input = {}) {
  return recordMonitoringEvent({
    category: "error",
    source: input.source || "server",
    eventType: input.eventType || "runtime_error",
    status: input.status || "failed",
    chainId: input.chainId,
    message: input.message,
    metadata: input.metadata,
  });
}

export async function getMonitoringSummary({ windowHours = 24 } = {}) {
  const normalizedWindowHours = getWindowHours(windowHours);
  const since = getSinceIso(normalizedWindowHours);

  if (!MONITORING_ENABLED) {
    return {
      enabled: false,
      windowHours: normalizedWindowHours,
      since,
      generatedAt: new Date().toISOString(),
      metrics: {},
      errors: {
        bySource: {},
        recent: [],
      },
    };
  }

  const database = getDatabase();
  const metricRows = database
    .prepare(
      `
        SELECT event_type, status, COUNT(*) AS count
        FROM app_monitoring_events
        WHERE category = 'metric' AND created_at >= ?
        GROUP BY event_type, status
      `
    )
    .all(since);
  const errorSourceRows = database
    .prepare(
      `
        SELECT source, COUNT(*) AS count
        FROM app_monitoring_events
        WHERE category = 'error' AND created_at >= ?
        GROUP BY source
      `
    )
    .all(since);
  const recentErrors = database
    .prepare(
      `
        SELECT source, event_type, status, message, metadata_json, created_at
        FROM app_monitoring_events
        WHERE category = 'error' AND created_at >= ?
        ORDER BY created_at DESC
        LIMIT ?
      `
    )
    .all(since, MAX_RECENT_ERRORS)
    .map((row) => ({
      source: row.source,
      eventType: row.event_type,
      status: row.status,
      message: row.message || "",
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : {},
      createdAt: row.created_at,
    }));

  return {
    enabled: true,
    windowHours: normalizedWindowHours,
    since,
    generatedAt: new Date().toISOString(),
    metrics: buildMetricStateRows(metricRows),
    errors: {
      bySource: buildErrorSourceRows(errorSourceRows),
      recent: recentErrors,
    },
  };
}

export function getMonitoringHealthSnapshot() {
  const memoryUsage = process.memoryUsage();
  const uptimeSeconds = Math.round(process.uptime());

  if (!MONITORING_ENABLED) {
    return {
      monitoring: {
        enabled: false,
      },
      runtime: {
        uptimeSeconds,
        memory: {
          rssMb: Number((memoryUsage.rss / (1024 * 1024)).toFixed(1)),
          heapUsedMb: Number((memoryUsage.heapUsed / (1024 * 1024)).toFixed(1)),
        },
      },
    };
  }

  try {
    const database = getDatabase();
    const since = getSinceIso(24);
    const totalEvents = Number(
      database
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM app_monitoring_events
            WHERE created_at >= ?
          `
        )
        .get(since)?.count || 0
    );
    const errorEvents = Number(
      database
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM app_monitoring_events
            WHERE category = 'error' AND created_at >= ?
          `
        )
        .get(since)?.count || 0
    );

    return {
      monitoring: {
        enabled: true,
        eventsLast24h: totalEvents,
        errorsLast24h: errorEvents,
      },
      runtime: {
        uptimeSeconds,
        memory: {
          rssMb: Number((memoryUsage.rss / (1024 * 1024)).toFixed(1)),
          heapUsedMb: Number((memoryUsage.heapUsed / (1024 * 1024)).toFixed(1)),
        },
      },
    };
  } catch (error) {
    return {
      monitoring: {
        enabled: true,
        unavailable: true,
      },
      runtime: {
        uptimeSeconds,
        memory: {
          rssMb: Number((memoryUsage.rss / (1024 * 1024)).toFixed(1)),
          heapUsedMb: Number((memoryUsage.heapUsed / (1024 * 1024)).toFixed(1)),
        },
      },
      note: sanitizeMessage(error?.message || "Monitoring health unavailable"),
    };
  }
}
