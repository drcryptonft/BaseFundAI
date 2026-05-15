import { getChainLabel } from "../config/networks";
import { resolveConfiguredApiBase } from "./apiBase";

const configuredApiBase = String(import.meta.env.VITE_API_BASE_URL || "").trim();
const DONATION_MOMENT_ENABLED =
  String(import.meta.env.VITE_ENABLE_DONATION_MOMENT || "true")
    .trim()
    .toLowerCase() !== "false";
const API_BASE = resolveConfiguredApiBase(configuredApiBase);
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

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
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

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value >= 100 ? 0 : 2,
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(toNumber(value));
}

function normalizeHeadline(value = "") {
  return String(value || "").trim() || "this campaign";
}

function getApiUrl(path) {
  return `${API_BASE}${path}`;
}

function buildSeed(value) {
  let hash = 0;

  for (const character of String(value || "")) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash;
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

  return seed % 100 < 18 ? "resonant" : "warm";
}

function getProgressPercentage(goalRaw, totalRaisedRaw) {
  const normalizedGoal = toBigInt(goalRaw);

  if (normalizedGoal <= 0n) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, Math.round((Number(toBigInt(totalRaisedRaw)) / Number(normalizedGoal)) * 100))
  );
}

function buildFallbackCopy(momentType, headline) {
  const copy = {
    first_signal: {
      title: "You became an early backer.",
      message: `Your support gave ${headline} its first meaningful lift. This page now carries proof that someone believed early.`,
      shareText: `I just became an early supporter of ${headline} on BaseFundAI. The contribution is confirmed onchain.`,
    },
    finishing_push: {
      title: "You pulled the goal closer.",
      message: `Your contribution moved ${headline} deeper into the final stretch. Progress becomes easier to trust when the finish line is visibly closer.`,
      shareText: `I just helped push ${headline} closer to the finish line on BaseFundAI. The support is confirmed onchain.`,
    },
    goal_reached: {
      title: "This campaign reached its goal.",
      message: `Your support helped carry ${headline} across the line. This campaign is now fully funded with a confirmed onchain record.`,
      shareText: `I just helped ${headline} reach its goal on BaseFundAI. The contribution is confirmed onchain.`,
    },
    momentum_wave: {
      title: "You created visible momentum.",
      message: `Your support gave ${headline} a measurable lift. The next supporter will see a stronger campaign because of this contribution.`,
      shareText: `I just gave ${headline} a meaningful boost on BaseFundAI. The support is confirmed onchain.`,
    },
    steady_support: {
      title: "You moved this campaign forward.",
      message: `Your contribution added real progress to ${headline}. Reliable support is what turns interest into trust over time.`,
      shareText: `I just supported ${headline} on BaseFundAI. The contribution is confirmed onchain.`,
    },
  };

  return copy[momentType] || copy.steady_support;
}

export function isDonationMomentEnabled() {
  return DONATION_MOMENT_ENABLED;
}

export function getDonationMomentBaseOrigin() {
  if (typeof window === "undefined") {
    return API_BASE || "";
  }

  if (/^https?:\/\//i.test(API_BASE)) {
    return API_BASE;
  }

  return window.location.origin;
}

export function buildDonationMomentShareUrl(moment) {
  const baseOrigin = getDonationMomentBaseOrigin();
  const sharePath = String(moment?.sharePath || moment?.campaignPath || "").trim();

  if (!sharePath) {
    return baseOrigin;
  }

  if (/^https?:\/\//i.test(sharePath)) {
    return sharePath;
  }

  if (!baseOrigin) {
    return sharePath;
  }

  return `${baseOrigin}${sharePath.startsWith("/") ? sharePath : `/${sharePath}`}`;
}

export function buildFallbackDonationMoment(input = {}) {
  const chainId = Number(input.chainId || 0);
  const txHash = String(input.txHash || "").trim().toLowerCase();
  const headline = normalizeHeadline(input.campaignHeadline);
  const amountRaw = String(input.amountRaw || "0");
  const totalRaisedRaw = String(input.totalRaisedRaw || "0");
  const goalRaw = String(input.goalRaw || "0");
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
  const copy = buildFallbackCopy(momentType, headline);
  const campaignPath = `/campaign/${input.campaignAddress}?chainId=${chainId}`;

  return {
    chainId,
    txHash,
    campaignAddress: input.campaignAddress,
    donorAddress: input.donorAddress,
    campaignHeadline: headline,
    campaignImage: String(input.campaignImage || "").trim(),
    amountRaw,
    amount: Number(amountRaw) / 1e6,
    amountDisplay: formatCurrency(Number(amountRaw) / 1e6),
    totalRaisedRaw,
    totalRaised: Number(totalRaisedRaw) / 1e6,
    totalRaisedDisplay: formatCurrency(Number(totalRaisedRaw) / 1e6),
    goalRaw,
    goal: Number(goalRaw) / 1e6,
    goalDisplay: formatCurrency(Number(goalRaw) / 1e6),
    progressPercentage: getProgressPercentage(goalRaw, totalRaisedRaw),
    momentType,
    rarity,
    rarityLabel: RARITY_META[rarity]?.label || RARITY_META.warm.label,
    rarityAccent: RARITY_META[rarity]?.accent || RARITY_META.warm.accent,
    title: copy.title,
    message: copy.message,
    shareText: copy.shareText,
    sharePath: "",
    campaignPath,
    experienceVersion: "v2-signature-receipt",
    source: "local-fallback",
    chainLabel: getChainLabel(chainId),
  };
}

export async function requestDonationMoment(payload = {}) {
  if (!DONATION_MOMENT_ENABLED) {
    return null;
  }

  const response = await fetch(getApiUrl("/api/donation-moments"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const error = new Error(data?.error || "Donation moment request failed");
    error.status = response.status;
    throw error;
  }

  return data?.moment || null;
}

export async function trackDonationMomentEvent({
  chainId,
  txHash,
  eventType,
  metadata = {},
} = {}) {
  if (!DONATION_MOMENT_ENABLED || !txHash || !eventType) {
    return;
  }

  const payload = JSON.stringify({
    chainId,
    txHash,
    eventType,
    metadata,
  });
  const url = getApiUrl("/api/donation-moments/track");

  try {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      const blob = new Blob([payload], {
        type: "application/json",
      });

      navigator.sendBeacon(url, blob);
      return;
    }
  } catch {
    // Fall back to fetch when sendBeacon is unavailable or rejected.
  }

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: payload,
      keepalive: true,
    });
  } catch {
    // Tracking should never disturb the donor flow.
  }
}
