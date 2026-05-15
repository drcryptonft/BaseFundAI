import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { getAppDatabase, getCampaignRecord } from "./campaignRegistry.js";
import {
  hashValue,
  normalizeAddress,
  normalizeWhitespace,
} from "../utils/hash.js";

const serverRoot = fileURLToPath(new URL("..", import.meta.url));
const templatesPath = join(serverRoot, "data", "donation-moment-templates.json");
const DEFAULT_CHAIN_ID = Number(process.env.DEFAULT_CHAIN_ID || 84532);
const EXPERIENCE_VERSION = "v2-signature-receipt";
const TEMPLATE_SOURCE = "template-v1";
const FALLBACK_OG_IMAGE_PATH = "/logo.png";
const DONATION_MOMENT_ENABLED =
  String(process.env.DONATION_MOMENT_ENABLED || "true").trim().toLowerCase() !==
  "false";
const CHAIN_LABELS = {
  84532: "Base Sepolia",
  5042002: "Arc Testnet",
  46630: "Robinhood Testnet",
};
const RARITY_META = {
  warm: {
    label: "Early Backing",
    accent: "Trusted support",
  },
  resonant: {
    label: "Visible Momentum",
    accent: "Momentum gained",
  },
  radiant: {
    label: "Goal Milestone",
    accent: "Milestone moment",
  },
};

let templateCache = null;

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
  const parsed = Number(value || DEFAULT_CHAIN_ID);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_CHAIN_ID;
}

function toBigInt(value) {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    return BigInt(Math.floor(value));
  }

  if (typeof value === "string" && value.trim()) {
    return BigInt(value);
  }

  return 0n;
}

function formatUsdc(value) {
  const normalized = Number(toBigInt(value)) / 1e6;
  return Number.isFinite(normalized) ? normalized : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value >= 100 ? 0 : 2,
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(Number(value || 0));
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function getChainLabel(chainId) {
  return CHAIN_LABELS[normalizeChainId(chainId)] || "BaseFundAI";
}

function loadTemplates() {
  if (templateCache) {
    return templateCache;
  }

  if (!existsSync(templatesPath)) {
    templateCache = {};
    return templateCache;
  }

  templateCache = parseJson(readFileSync(templatesPath, "utf8"), {});
  return templateCache;
}

function buildSeed(value) {
  return Number.parseInt(hashValue(value).slice(0, 8), 16);
}

function getTemplate(momentType, seed) {
  const templates = loadTemplates();
  const candidates = Array.isArray(templates?.[momentType]) ? templates[momentType] : [];

  if (!candidates.length) {
    throw new Error(`No donation moment templates found for ${momentType}`);
  }

  return candidates[seed % candidates.length];
}

function fillTemplate(value, replacements) {
  return String(value || "").replace(/\{(\w+)\}/g, (_, key) =>
    replacements[key] !== undefined ? String(replacements[key]) : ""
  );
}

function normalizeHeadline(value = "") {
  return normalizeWhitespace(value) || "this campaign";
}

function normalizeTxHash(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  return /^0x[a-f0-9]{64}$/i.test(normalized) ? normalized : "";
}

function getMomentType({ amountRaw, goalRaw, totalRaisedRaw }) {
  const normalizedAmount = toBigInt(amountRaw);
  const normalizedGoal = toBigInt(goalRaw);
  const normalizedTotalRaised = toBigInt(totalRaisedRaw);
  const priorRaised =
    normalizedTotalRaised > normalizedAmount ? normalizedTotalRaised - normalizedAmount : 0n;

  if (normalizedGoal > 0n && normalizedTotalRaised >= normalizedGoal) {
    return "goal_reached";
  }

  if (priorRaised <= 0n) {
    return "first_signal";
  }

  if (normalizedGoal > 0n) {
    const progressAfter = Number(normalizedTotalRaised) / Number(normalizedGoal);
    const progressDelta = Number(normalizedAmount) / Number(normalizedGoal);

    if (progressAfter >= 0.85) {
      return "finishing_push";
    }

    if (progressDelta >= 0.12) {
      return "momentum_wave";
    }
  }

  return "steady_support";
}

function getRarity({ chainId, txHash, momentType, amountRaw, goalRaw, totalRaisedRaw }) {
  const normalizedGoal = toBigInt(goalRaw);
  const normalizedAmount = toBigInt(amountRaw);
  const normalizedTotalRaised = toBigInt(totalRaisedRaw);
  const seed = buildSeed(`${chainId}:${txHash}:${momentType}`);

  if (momentType === "goal_reached") {
    return "radiant";
  }

  if (normalizedGoal > 0n) {
    const contributionRatio = Number(normalizedAmount) / Number(normalizedGoal);
    const progressAfter = Number(normalizedTotalRaised) / Number(normalizedGoal);

    if (contributionRatio >= 0.18 || progressAfter >= 0.8) {
      return seed % 100 < 55 ? "radiant" : "resonant";
    }
  }

  if (seed % 100 < 18) {
    return "resonant";
  }

  return "warm";
}

function getProgressPercentage(goalRaw, totalRaisedRaw) {
  const normalizedGoal = toBigInt(goalRaw);

  if (normalizedGoal <= 0n) {
    return 0;
  }

  const percentage = (Number(toBigInt(totalRaisedRaw)) / Number(normalizedGoal)) * 100;
  return clamp(Math.round(percentage), 0, 100);
}

function pickCampaignImage(inputImage, record) {
  const recordImage = Array.isArray(record?.metadata?.images)
    ? record.metadata.images[0]
    : record?.metadata?.image;

  return String(inputImage || recordImage || "").trim();
}

function toAbsoluteUrl(value, origin) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return `${origin}${FALLBACK_OG_IMAGE_PATH}`;
  }

  if (normalized.startsWith("data:")) {
    return `${origin}${FALLBACK_OG_IMAGE_PATH}`;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  if (normalized.startsWith("ipfs://")) {
    return `https://gateway.pinata.cloud/ipfs/${normalized.slice("ipfs://".length)}`;
  }

  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(normalized)) {
    return `https://gateway.pinata.cloud/ipfs/${normalized}`;
  }

  if (normalized.startsWith("/")) {
    return `${origin}${normalized}`;
  }

  return `${origin}/${normalized.replace(/^\/+/, "")}`;
}

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ensureSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS donation_moments (
      chain_id INTEGER NOT NULL,
      tx_hash TEXT NOT NULL,
      campaign_address TEXT NOT NULL,
      donor_address TEXT NOT NULL,
      campaign_headline TEXT NOT NULL,
      campaign_image TEXT,
      amount_raw TEXT NOT NULL,
      total_raised_raw TEXT NOT NULL,
      goal_raw TEXT NOT NULL,
      moment_type TEXT NOT NULL,
      rarity TEXT NOT NULL,
      rarity_label TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      share_text TEXT NOT NULL,
      share_path TEXT NOT NULL,
      campaign_path TEXT NOT NULL,
      experience_version TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (chain_id, tx_hash)
    );

    CREATE TABLE IF NOT EXISTS donation_moment_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chain_id INTEGER NOT NULL,
      tx_hash TEXT NOT NULL,
      event_type TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_donation_moments_campaign
      ON donation_moments (campaign_address);

    CREATE INDEX IF NOT EXISTS idx_donation_moments_donor
      ON donation_moments (donor_address);

    CREATE INDEX IF NOT EXISTS idx_donation_moment_events_tx
      ON donation_moment_events (chain_id, tx_hash);
  `);
}

function hydrateDonationMoment(row) {
  if (!row) {
    return null;
  }

  const chainId = normalizeChainId(row.chain_id);
  const amountRaw = String(row.amount_raw || "0");
  const totalRaisedRaw = String(row.total_raised_raw || "0");
  const goalRaw = String(row.goal_raw || "0");

  return {
    chainId,
    txHash: row.tx_hash,
    campaignAddress: row.campaign_address,
    donorAddress: row.donor_address,
    campaignHeadline: row.campaign_headline,
    campaignImage: row.campaign_image || "",
    amountRaw,
    amount: formatUsdc(amountRaw),
    amountDisplay: formatCurrency(formatUsdc(amountRaw)),
    totalRaisedRaw,
    totalRaised: formatUsdc(totalRaisedRaw),
    totalRaisedDisplay: formatCurrency(formatUsdc(totalRaisedRaw)),
    goalRaw,
    goal: formatUsdc(goalRaw),
    goalDisplay: formatCurrency(formatUsdc(goalRaw)),
    progressPercentage: getProgressPercentage(goalRaw, totalRaisedRaw),
    momentType: row.moment_type,
    rarity: row.rarity,
    rarityLabel: row.rarity_label,
    rarityAccent: RARITY_META[row.rarity]?.accent || RARITY_META.warm.accent,
    title: row.title,
    message: row.message,
    shareText: row.share_text,
    sharePath: row.share_path,
    campaignPath: row.campaign_path,
    experienceVersion: row.experience_version,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getDonationMoment(chainId, txHash) {
  ensureSchema(getAppDatabase());

  const normalizedChainId = normalizeChainId(chainId);
  const normalizedTxHash = normalizeTxHash(txHash);

  if (!normalizedTxHash) {
    return null;
  }

  const row = getAppDatabase()
    .prepare(
      `
        SELECT
          chain_id,
          tx_hash,
          campaign_address,
          donor_address,
          campaign_headline,
          campaign_image,
          amount_raw,
          total_raised_raw,
          goal_raw,
          moment_type,
          rarity,
          rarity_label,
          title,
          message,
          share_text,
          share_path,
          campaign_path,
          experience_version,
          source,
          created_at,
          updated_at
        FROM donation_moments
        WHERE chain_id = ? AND tx_hash = ?
      `
    )
    .get(normalizedChainId, normalizedTxHash);

  return hydrateDonationMoment(row);
}

export async function createDonationMoment(input = {}) {
  if (!DONATION_MOMENT_ENABLED) {
    throw new Error("Donation moment feature is disabled");
  }

  ensureSchema(getAppDatabase());

  const chainId = normalizeChainId(input.chainId);
  const txHash = normalizeTxHash(input.txHash);
  const campaignAddress = normalizeAddress(input.campaignAddress);
  const donorAddress = normalizeAddress(input.donorAddress);
  const amountRaw = toBigInt(input.amountRaw);
  const totalRaisedRaw = toBigInt(input.totalRaisedRaw);
  const goalRaw = toBigInt(input.goalRaw);

  if (!txHash || !campaignAddress || !donorAddress || amountRaw <= 0n) {
    throw new Error("txHash, campaignAddress, donorAddress, and amountRaw are required");
  }

  const existing = await getDonationMoment(chainId, txHash);

  if (existing) {
    return existing;
  }

  const record = await getCampaignRecord(campaignAddress, chainId);
  const campaignHeadline = normalizeHeadline(
    input.campaignHeadline || record?.metadata?.headline
  );
  const campaignImage = pickCampaignImage(input.campaignImage, record);
  const momentType = getMomentType({
    amountRaw,
    goalRaw,
    totalRaisedRaw,
  });
  const rarity = getRarity({
    chainId,
    txHash,
    momentType,
    amountRaw,
    goalRaw,
    totalRaisedRaw,
  });
  const seed = buildSeed(`${chainId}:${txHash}:${campaignAddress}`);
  const template = getTemplate(momentType, seed);
  const sharePath = `/moments/${chainId}/${txHash}`;
  const campaignPath = `/campaign/${campaignAddress}?chainId=${chainId}`;
  const replacements = {
    headline: campaignHeadline,
    amount: formatCurrency(formatUsdc(amountRaw)),
    totalRaised: formatCurrency(formatUsdc(totalRaisedRaw)),
    goal: formatCurrency(formatUsdc(goalRaw)),
    chainLabel: getChainLabel(chainId),
  };
  const now = new Date().toISOString();

  getAppDatabase()
    .prepare(
      `
        INSERT INTO donation_moments (
          chain_id,
          tx_hash,
          campaign_address,
          donor_address,
          campaign_headline,
          campaign_image,
          amount_raw,
          total_raised_raw,
          goal_raw,
          moment_type,
          rarity,
          rarity_label,
          title,
          message,
          share_text,
          share_path,
          campaign_path,
          experience_version,
          source,
          created_at,
          updated_at
        ) VALUES (
          @chainId,
          @txHash,
          @campaignAddress,
          @donorAddress,
          @campaignHeadline,
          @campaignImage,
          @amountRaw,
          @totalRaisedRaw,
          @goalRaw,
          @momentType,
          @rarity,
          @rarityLabel,
          @title,
          @message,
          @shareText,
          @sharePath,
          @campaignPath,
          @experienceVersion,
          @source,
          @createdAt,
          @updatedAt
        )
        ON CONFLICT(chain_id, tx_hash) DO NOTHING
      `
    )
    .run({
      chainId,
      txHash,
      campaignAddress,
      donorAddress,
      campaignHeadline,
      campaignImage,
      amountRaw: amountRaw.toString(),
      totalRaisedRaw: totalRaisedRaw.toString(),
      goalRaw: goalRaw.toString(),
      momentType,
      rarity,
      rarityLabel: RARITY_META[rarity]?.label || RARITY_META.warm.label,
      title: fillTemplate(template.title, replacements),
      message: fillTemplate(template.message, replacements),
      shareText: fillTemplate(template.shareText, replacements),
      sharePath,
      campaignPath,
      experienceVersion: EXPERIENCE_VERSION,
      source: TEMPLATE_SOURCE,
      createdAt: now,
      updatedAt: now,
    });

  return getDonationMoment(chainId, txHash);
}

export async function trackDonationMomentEvent(input = {}) {
  ensureSchema(getAppDatabase());

  const chainId = normalizeChainId(input.chainId);
  const txHash = normalizeTxHash(input.txHash);
  const eventType = normalizeWhitespace(input.eventType);

  if (!txHash || !eventType) {
    throw new Error("txHash and eventType are required");
  }

  const now = new Date().toISOString();

  getAppDatabase()
    .prepare(
      `
        INSERT INTO donation_moment_events (
          chain_id,
          tx_hash,
          event_type,
          metadata_json,
          created_at
        ) VALUES (
          @chainId,
          @txHash,
          @eventType,
          @metadataJson,
          @createdAt
        )
      `
    )
    .run({
      chainId,
      txHash,
      eventType,
      metadataJson: JSON.stringify(input.metadata || {}),
      createdAt: now,
    });

  return {
    ok: true,
    recordedAt: now,
  };
}

function buildPageDescription(moment) {
  return `${moment.message} ${moment.shareText}`.trim().slice(0, 220);
}

export function renderDonationMomentPage(moment, origin) {
  const shareUrl = `${origin}${moment.sharePath}`;
  const campaignUrl = `${origin}${moment.campaignPath}`;
  const imageUrl = toAbsoluteUrl(moment.campaignImage, origin);
  const description = buildPageDescription(moment);
  const txHashShort =
    moment.txHash && moment.txHash.length >= 14
      ? `${moment.txHash.slice(0, 6)}...${moment.txHash.slice(-4)}`
      : moment.txHash;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(moment.title)} | BaseFundAI</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="BaseFundAI" />
    <meta property="og:title" content="${escapeHtml(moment.title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(shareUrl)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:alt" content="${escapeHtml(moment.campaignHeadline)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(moment.title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
    <style>
      :root {
        color-scheme: dark;
        --bg: #04111f;
        --card: rgba(10, 18, 32, 0.84);
        --border: rgba(148, 163, 184, 0.16);
        --text: #f8fafc;
        --muted: #cbd5e1;
        --accent: #34d399;
        --accent-soft: rgba(52, 211, 153, 0.18);
        --panel: rgba(255,255,255,0.045);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at 20% 20%, rgba(52, 211, 153, 0.24), transparent 28%),
          radial-gradient(circle at 80% 0%, rgba(56, 189, 248, 0.18), transparent 22%),
          linear-gradient(180deg, #020617 0%, #081424 100%);
        display: grid;
        place-items: center;
        padding: 24px;
      }
      .shell {
        width: min(880px, 100%);
        border-radius: 30px;
        border: 1px solid var(--border);
        background: var(--card);
        backdrop-filter: blur(24px);
        box-shadow: 0 32px 90px rgba(2, 6, 23, 0.44);
        overflow: hidden;
      }
      .layout {
        display: grid;
        grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
      }
      .hero {
        position: relative;
        padding: 34px;
        border-right: 1px solid var(--border);
        background:
          radial-gradient(circle at top left, rgba(52, 211, 153, 0.24), transparent 30%),
          linear-gradient(135deg, rgba(6, 11, 24, 0.96), rgba(8, 22, 39, 0.9));
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 8px 14px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.06);
        color: #d1fae5;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .receipt {
        position: relative;
        min-height: 420px;
        margin-top: 24px;
        padding: 24px;
        border-radius: 28px;
        border: 1px solid rgba(255,255,255,0.12);
        overflow: hidden;
        background:
          linear-gradient(180deg, rgba(2,6,23,0.36), rgba(2,6,23,0.66)),
          url('${escapeHtml(imageUrl)}') center/cover no-repeat;
      }
      .receipt::after {
        content: "";
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 20% 18%, rgba(52,211,153,0.22), transparent 22%),
          radial-gradient(circle at 78% 16%, rgba(56,189,248,0.18), transparent 24%);
      }
      .receipt-card {
        position: relative;
        z-index: 1;
        min-height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        border-radius: 24px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(2, 6, 23, 0.66);
        backdrop-filter: blur(18px);
        padding: 22px;
      }
      .receipt-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin-top: 18px;
      }
      .receipt-cell {
        padding: 14px;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,0.1);
        background: rgba(255,255,255,0.04);
      }
      .receipt-label {
        font-size: 10px;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: #94a3b8;
      }
      .receipt-value {
        margin-top: 8px;
        font-size: 15px;
        font-weight: 700;
        color: var(--text);
      }
      h1 {
        margin: 18px 0 10px;
        font-size: clamp(2rem, 5vw, 3.35rem);
        line-height: 1.04;
      }
      p {
        margin: 0;
        color: var(--muted);
        line-height: 1.7;
        font-size: 1rem;
      }
      .body {
        padding: 34px;
      }
      .campaign {
        padding: 18px 20px;
        border-radius: 22px;
        border: 1px solid var(--border);
        background: var(--panel);
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 22px;
      }
      .meta-chip {
        padding: 10px 14px;
        border-radius: 999px;
        background: var(--accent-soft);
        border: 1px solid rgba(52, 211, 153, 0.18);
        color: #d1fae5;
        font-size: 14px;
      }
      .trust-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin-top: 18px;
      }
      .trust-card {
        padding: 18px;
        border-radius: 20px;
        border: 1px solid var(--border);
        background: var(--panel);
      }
      .trust-title {
        font-size: 10px;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: #94a3b8;
      }
      .trust-value {
        margin-top: 10px;
        font-size: 15px;
        font-weight: 700;
      }
      .trust-note {
        margin-top: 8px;
        font-size: 13px;
        color: #94a3b8;
        line-height: 1.6;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 28px;
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
        padding: 0 18px;
        border-radius: 16px;
        border: 1px solid var(--border);
        color: var(--text);
        text-decoration: none;
        font-weight: 700;
      }
      .button-primary {
        background: linear-gradient(135deg, #10b981, #0ea5e9);
        border-color: transparent;
      }
      .footer {
        margin-top: 18px;
        font-size: 13px;
        color: #94a3b8;
      }
      @media (max-width: 640px) {
        .layout {
          grid-template-columns: 1fr;
        }
        .hero {
          border-right: 0;
          border-bottom: 1px solid var(--border);
        }
        .hero, .body {
          padding: 22px;
        }
        .receipt {
          min-height: 360px;
          padding: 18px;
        }
        .trust-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <div class="layout">
      <section class="hero">
        <div class="badge">${escapeHtml(moment.rarityLabel)} · ${escapeHtml(moment.amountDisplay)}</div>
        <h1>${escapeHtml(moment.title)}</h1>
        <p>${escapeHtml(moment.message)}</p>
        <div class="receipt">
          <div class="receipt-card">
            <div>
              <div class="receipt-label">Support receipt</div>
              <div style="margin-top: 8px; font-size: 34px; font-weight: 800;">${escapeHtml(
                moment.amountDisplay
              )}</div>
              <div style="margin-top: 14px;" class="badge">Confirmed on ${escapeHtml(
                getChainLabel(moment.chainId)
              )}</div>
              <div style="margin-top: 18px; font-size: 18px; font-weight: 700; line-height: 1.4;">${escapeHtml(
                moment.campaignHeadline
              )}</div>
              <div class="receipt-grid">
                <div class="receipt-cell">
                  <div class="receipt-label">Raised now</div>
                  <div class="receipt-value">${escapeHtml(moment.totalRaisedDisplay)}</div>
                </div>
                <div class="receipt-cell">
                  <div class="receipt-label">Goal</div>
                  <div class="receipt-value">${escapeHtml(moment.goalDisplay)}</div>
                </div>
              </div>
            </div>
            <div>
              <div class="receipt-label">Funding progress</div>
              <div style="margin-top: 10px; height: 10px; border-radius: 999px; background: rgba(255,255,255,0.1); overflow: hidden;">
                <div style="height: 100%; width: ${escapeHtml(
                  String(moment.progressPercentage)
                )}%; border-radius: 999px; background: linear-gradient(90deg, #6ee7b7, #22d3ee, #60a5fa);"></div>
              </div>
              <div style="margin-top: 10px; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #94a3b8;">${escapeHtml(
                String(moment.progressPercentage)
              )}% confirmed · ${escapeHtml(txHashShort)}</div>
            </div>
          </div>
        </div>
      </section>
      <section class="body">
        <div class="campaign">
          <div class="trust-title">Campaign snapshot</div>
          <p><strong>${escapeHtml(moment.campaignHeadline)}</strong></p>
          <p style="margin-top: 10px;">${escapeHtml(moment.shareText)}</p>
          <div class="meta">
            <span class="meta-chip">${escapeHtml(moment.totalRaisedDisplay)} raised</span>
            <span class="meta-chip">${escapeHtml(moment.progressPercentage)}% funded</span>
            <span class="meta-chip">${escapeHtml(moment.rarityAccent)}</span>
          </div>
        </div>
        <div class="trust-grid">
          <div class="trust-card">
            <div class="trust-title">Receipt status</div>
            <div class="trust-value">Confirmed on ${escapeHtml(
              getChainLabel(moment.chainId)
            )}</div>
            <div class="trust-note">${escapeHtml(txHashShort)} recorded for this support moment.</div>
          </div>
          <div class="trust-card">
            <div class="trust-title">Share destination</div>
            <div class="trust-value">Crawler-readable page</div>
            <div class="trust-note">Social previews can resolve the campaign metadata and image.</div>
          </div>
          <div class="trust-card">
            <div class="trust-title">Experience signal</div>
            <div class="trust-value">${escapeHtml(moment.rarityLabel)}</div>
            <div class="trust-note">${escapeHtml(moment.rarityAccent)} built from confirmed campaign progress.</div>
          </div>
        </div>
        <div class="actions">
          <a class="button button-primary" href="${escapeHtml(campaignUrl)}">Open campaign</a>
          <a class="button" href="${escapeHtml(shareUrl)}">Open share page</a>
        </div>
        <p class="footer">BaseFundAI · A confirmed onchain support moment on ${escapeHtml(
          getChainLabel(moment.chainId)
        )}</p>
      </section>
      </div>
    </main>
  </body>
</html>`;
}
