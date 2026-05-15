import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeAddress } from "../utils/hash.js";
import { sanitizeCampaignMetadataForStorage } from "../../src/utils/campaignMetadata.js";

const serverRoot = fileURLToPath(new URL("..", import.meta.url));
const projectRoot = resolve(serverRoot, "..");
const defaultDatabasePath = join(serverRoot, "data", "campaign-registry.sqlite");
const legacyRegistryPath = join(serverRoot, "data", "campaign-registry.json");
const DEFAULT_CHAIN_ID = Number(process.env.DEFAULT_CHAIN_ID || 84532);

let databaseInstance = null;

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeChainId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_CHAIN_ID;
}

function getDatabasePath() {
  const configuredPath = String(process.env.CAMPAIGN_REGISTRY_DB_PATH || "").trim();

  if (!configuredPath) {
    return defaultDatabasePath;
  }

  return isAbsolute(configuredPath)
    ? configuredPath
    : resolve(projectRoot, configuredPath);
}

function sanitizeMetadata(metadata = {}) {
  return sanitizeCampaignMetadataForStorage(metadata);
}

function tableExists(database, tableName) {
  return Boolean(
    database
      .prepare(
        `
          SELECT name
          FROM sqlite_master
          WHERE type = 'table' AND name = ?
        `
      )
      .get(tableName)
  );
}

function getTableColumns(database, tableName) {
  return database.prepare(`PRAGMA table_info(${tableName})`).all();
}

function ensureRegistryTable(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS campaign_registry (
      chain_id INTEGER NOT NULL,
      address TEXT NOT NULL,
      creator TEXT NOT NULL,
      ipfs_hash TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      trust_json TEXT,
      ip_hash TEXT,
      fingerprint TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (chain_id, address)
    );
  `);
}

function migrateRegistrySchema(database) {
  if (!tableExists(database, "campaign_registry")) {
    ensureRegistryTable(database);
    return;
  }

  const columns = new Set(
    getTableColumns(database, "campaign_registry").map((column) => column.name)
  );

  if (columns.has("chain_id")) {
    ensureRegistryTable(database);
    return;
  }

  database.exec(`
    ALTER TABLE campaign_registry RENAME TO campaign_registry_legacy_v1;
  `);

  ensureRegistryTable(database);

  database.exec(`
    INSERT INTO campaign_registry (
      chain_id,
      address,
      creator,
      ipfs_hash,
      metadata_json,
      trust_json,
      ip_hash,
      fingerprint,
      created_at,
      updated_at
    )
    SELECT
      ${DEFAULT_CHAIN_ID},
      address,
      creator,
      ipfs_hash,
      metadata_json,
      trust_json,
      ip_hash,
      fingerprint,
      created_at,
      updated_at
    FROM campaign_registry_legacy_v1;

    DROP TABLE campaign_registry_legacy_v1;
  `);
}

function ensureSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  migrateRegistrySchema(database);

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_campaign_registry_creator
      ON campaign_registry (creator);

    CREATE INDEX IF NOT EXISTS idx_campaign_registry_chain_creator
      ON campaign_registry (chain_id, creator);

    CREATE INDEX IF NOT EXISTS idx_campaign_registry_ip_hash
      ON campaign_registry (ip_hash);

    CREATE INDEX IF NOT EXISTS idx_campaign_registry_fingerprint
      ON campaign_registry (fingerprint);
  `);

  compactRegistryMetadata(database);
}

function compactRegistryMetadata(database) {
  const rows = database
    .prepare(
      `
        SELECT chain_id, address, metadata_json
        FROM campaign_registry
        WHERE metadata_json LIKE '%data:%'
      `
    )
    .all();

  if (!rows.length) {
    return;
  }

  const updateRecord = database.prepare(`
    UPDATE campaign_registry
    SET metadata_json = ?
    WHERE chain_id = ? AND address = ?
  `);

  const compactTransaction = database.transaction((records) => {
    for (const row of records) {
      const sanitizedMetadata = sanitizeMetadata(parseJson(row.metadata_json, {}));

      updateRecord.run(
        JSON.stringify(sanitizedMetadata),
        Number(row.chain_id || DEFAULT_CHAIN_ID),
        normalizeAddress(row.address)
      );
    }
  });

  compactTransaction(rows);
}

function hasImportedLegacyRegistry(database) {
  const row = database
    .prepare("SELECT value FROM app_meta WHERE key = ?")
    .get("legacy_campaign_registry_imported");

  return row?.value === "1";
}

function markLegacyRegistryImported(database) {
  database
    .prepare(
      `
        INSERT INTO app_meta (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `
    )
    .run("legacy_campaign_registry_imported", "1");
}

function migrateLegacyRegistry(database) {
  if (hasImportedLegacyRegistry(database)) {
    return;
  }

  if (!existsSync(legacyRegistryPath)) {
    markLegacyRegistryImported(database);
    return;
  }

  const legacyRegistry = parseJson(readFileSync(legacyRegistryPath, "utf8"), {
    campaigns: {},
  });
  const campaigns = Object.values(legacyRegistry.campaigns || {});

  if (!campaigns.length) {
    markLegacyRegistryImported(database);
    return;
  }

  const upsertCampaign = database.prepare(`
    INSERT INTO campaign_registry (
      chain_id,
      address,
      creator,
      ipfs_hash,
      metadata_json,
      trust_json,
      ip_hash,
      fingerprint,
      created_at,
      updated_at
    ) VALUES (
      @chainId,
      @address,
      @creator,
      @ipfsHash,
      @metadataJson,
      @trustJson,
      @ipHash,
      @fingerprint,
      @createdAt,
      @updatedAt
    )
    ON CONFLICT(chain_id, address) DO UPDATE SET
      creator = excluded.creator,
      ipfs_hash = excluded.ipfs_hash,
      metadata_json = excluded.metadata_json,
      trust_json = excluded.trust_json,
      ip_hash = excluded.ip_hash,
      fingerprint = excluded.fingerprint,
      updated_at = excluded.updated_at
  `);
  const importTransaction = database.transaction((rows) => {
    for (const row of rows) {
      const chainId = normalizeChainId(row.chainId);
      const address = normalizeAddress(row.address);
      const creator = normalizeAddress(row.creator);

      if (!address || !creator) {
        continue;
      }

      const metadata = sanitizeMetadata(row.metadata || {});
      const trust = row.trust || metadata.trust || null;
      const createdAt = String(
        row.createdAt || row.updatedAt || new Date().toISOString()
      );
      const updatedAt = String(row.updatedAt || createdAt);

      upsertCampaign.run({
        chainId,
        address,
        creator,
        ipfsHash: String(row.ipfsHash || "").trim(),
        metadataJson: JSON.stringify(metadata),
        trustJson: trust ? JSON.stringify(trust) : null,
        ipHash: String(row.ipHash || "").trim(),
        fingerprint: String(row.fingerprint || "").trim(),
        createdAt,
        updatedAt,
      });
    }
  });

  importTransaction(campaigns);
  markLegacyRegistryImported(database);
}

export function getAppDatabase() {
  if (databaseInstance) {
    return databaseInstance;
  }

  const databasePath = getDatabasePath();
  mkdirSync(dirname(databasePath), { recursive: true });

  databaseInstance = new Database(databasePath);
  databaseInstance.pragma("journal_mode = WAL");
  databaseInstance.pragma("busy_timeout = 5000");
  ensureSchema(databaseInstance);
  migrateLegacyRegistry(databaseInstance);
  compactRegistryMetadata(databaseInstance);
  return databaseInstance;
}

function hydrateCampaignRecord(row) {
  if (!row) {
    return null;
  }

  return {
    chainId: Number(row.chain_id || DEFAULT_CHAIN_ID),
    address: row.address,
    creator: row.creator,
    ipfsHash: row.ipfs_hash,
    metadata: sanitizeMetadata(parseJson(row.metadata_json, {})),
    trust: parseJson(row.trust_json, null),
    ipHash: row.ip_hash || "",
    fingerprint: row.fingerprint || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCampaignRecord(address, chainId = DEFAULT_CHAIN_ID) {
  const normalizedAddress = normalizeAddress(address);
  const normalizedChainId = normalizeChainId(chainId);

  if (!normalizedAddress) {
    return null;
  }

  const row = getAppDatabase()
    .prepare(
      `
        SELECT
          chain_id,
          address,
          creator,
          ipfs_hash,
          metadata_json,
          trust_json,
          ip_hash,
          fingerprint,
          created_at,
          updated_at
        FROM campaign_registry
        WHERE chain_id = ? AND address = ?
      `
    )
    .get(normalizedChainId, normalizedAddress);

  return hydrateCampaignRecord(row);
}

export async function listCampaignRecords(chainId = DEFAULT_CHAIN_ID) {
  const normalizedChainId = normalizeChainId(chainId);
  const rows = getAppDatabase()
    .prepare(
      `
        SELECT
          chain_id,
          address,
          creator,
          ipfs_hash,
          metadata_json,
          trust_json,
          ip_hash,
          fingerprint,
          created_at,
          updated_at
        FROM campaign_registry
        WHERE chain_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `
    )
    .all(normalizedChainId);

  return rows.map((row) => hydrateCampaignRecord(row)).filter(Boolean);
}

export async function registerCampaignRecord(input = {}) {
  const normalizedChainId = normalizeChainId(input.chainId);
  const normalizedAddress = normalizeAddress(input.address);
  const normalizedCreator = normalizeAddress(input.creator);
  const database = getAppDatabase();
  const now = new Date().toISOString();

  if (!normalizedAddress || !normalizedCreator) {
    throw new Error("Campaign address and creator are required");
  }

  const existing = await getCampaignRecord(normalizedAddress, normalizedChainId);
  const metadata = sanitizeMetadata(input.metadata || existing?.metadata || {});
  const trust = input.trust || existing?.trust || metadata.trust || null;
  const record = {
    chainId: normalizedChainId,
    address: normalizedAddress,
    creator: normalizedCreator,
    ipfsHash: String(input.ipfsHash || existing?.ipfsHash || "").trim(),
    metadata,
    trust,
    ipHash: String(input.ipHash || existing?.ipHash || "").trim(),
    fingerprint: String(input.fingerprint || existing?.fingerprint || "").trim(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  if (!record.ipfsHash) {
    throw new Error("ipfsHash is required");
  }

  database
    .prepare(
      `
        INSERT INTO campaign_registry (
          chain_id,
          address,
          creator,
          ipfs_hash,
          metadata_json,
          trust_json,
          ip_hash,
          fingerprint,
          created_at,
          updated_at
        ) VALUES (
          @chainId,
          @address,
          @creator,
          @ipfsHash,
          @metadataJson,
          @trustJson,
          @ipHash,
          @fingerprint,
          @createdAt,
          @updatedAt
        )
        ON CONFLICT(chain_id, address) DO UPDATE SET
          creator = excluded.creator,
          ipfs_hash = excluded.ipfs_hash,
          metadata_json = excluded.metadata_json,
          trust_json = excluded.trust_json,
          ip_hash = excluded.ip_hash,
          fingerprint = excluded.fingerprint,
          updated_at = excluded.updated_at
      `
    )
    .run({
      chainId: record.chainId,
      address: record.address,
      creator: record.creator,
      ipfsHash: record.ipfsHash,
      metadataJson: JSON.stringify(record.metadata),
      trustJson: record.trust ? JSON.stringify(record.trust) : null,
      ipHash: record.ipHash,
      fingerprint: record.fingerprint,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });

  return record;
}

export async function getRegistryInsights({ walletAddress, ipHash, fingerprint }) {
  const normalizedWallet = normalizeAddress(walletAddress);
  const normalizedFingerprint = String(fingerprint || "").trim();
  const normalizedIpHash = String(ipHash || "").trim();
  const database = getAppDatabase();

  const byWallet = normalizedWallet
    ? Number(
        database
          .prepare("SELECT COUNT(*) AS count FROM campaign_registry WHERE creator = ?")
          .get(normalizedWallet)?.count || 0
      )
    : 0;
  const byIp = normalizedIpHash
    ? Number(
        database
          .prepare("SELECT COUNT(*) AS count FROM campaign_registry WHERE ip_hash = ?")
          .get(normalizedIpHash)?.count || 0
      )
    : 0;
  const uniqueWalletsFromIp = normalizedIpHash
    ? Number(
        database
          .prepare(
            "SELECT COUNT(DISTINCT creator) AS count FROM campaign_registry WHERE ip_hash = ?"
          )
          .get(normalizedIpHash)?.count || 0
      )
    : 0;
  const duplicateFingerprint = normalizedFingerprint
    ? Number(
        database
          .prepare(
            "SELECT COUNT(*) AS count FROM campaign_registry WHERE fingerprint = ?"
          )
          .get(normalizedFingerprint)?.count || 0
      )
    : 0;
  const duplicateOtherWallets =
    normalizedFingerprint && normalizedWallet
      ? Number(
          database
            .prepare(
              `
                SELECT COUNT(*) AS count
                FROM campaign_registry
                WHERE fingerprint = ? AND creator != ?
              `
            )
            .get(normalizedFingerprint, normalizedWallet)?.count || 0
        )
      : 0;

  return {
    creatorCampaignCount: byWallet,
    sharedIpCampaignCount: byIp,
    sharedIpWalletCount: uniqueWalletsFromIp,
    duplicateFingerprintCount: duplicateFingerprint,
    duplicateOtherWalletCount: duplicateOtherWallets,
  };
}
