import { fetchJson } from "../utils/fetch.js";

const MAX_SCORE = 13;
const BASE_SEPOLIA_ID = 84532;
const ARC_TESTNET_ID = 5042002;
const ROBINHOOD_TESTNET_ID = 46630;
const ETHERSCAN_V2_API_URL = "https://api.etherscan.io/v2/api";

function normalizeApiUrl(value, fallback) {
  return String(value || fallback).trim();
}

function normalizeExplorerMessage(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericExplorerMessage(message) {
  const normalized = normalizeExplorerMessage(message).toUpperCase();
  return !normalized || normalized === "NOTOK" || normalized === "ERROR!" || normalized === "ERROR";
}

function getExplorerErrorMessage(payload, label) {
  const resultMessage =
    typeof payload?.result === "string"
      ? normalizeExplorerMessage(payload.result)
      : typeof payload?.result?.message === "string"
        ? normalizeExplorerMessage(payload.result.message)
        : "";
  const message =
    typeof payload?.message === "string"
      ? normalizeExplorerMessage(payload.message)
      : "";

  if (resultMessage && !isGenericExplorerMessage(resultMessage)) {
    return resultMessage;
  }

  if (message && !isGenericExplorerMessage(message)) {
    return message;
  }

  if (resultMessage) {
    return resultMessage;
  }

  if (message) {
    return message;
  }

  return `${label} returned an error`;
}

function ensureSentence(value) {
  const normalized = normalizeExplorerMessage(value);

  if (!normalized) {
    return "";
  }

  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function formatExplorerLookupSummary(label, reason) {
  const normalizedReason = normalizeExplorerMessage(reason);

  if (!normalizedReason) {
    return `${label} age lookup is unavailable right now.`;
  }

  if (normalizedReason.toLowerCase().startsWith(label.toLowerCase())) {
    return ensureSentence(normalizedReason);
  }

  return ensureSentence(`${label} age lookup failed: ${normalizedReason}`);
}

function toBlockscoutCompatApiUrl(value, chainId) {
  const fallbackV2Url = `https://api.blockscout.com/${chainId}/api/v2`;
  const normalized = normalizeApiUrl(value, fallbackV2Url);

  if (normalized.endsWith("/api/v2")) {
    return `${normalized.slice(0, -3)}`;
  }

  if (normalized.endsWith("/api/v2/")) {
    return `${normalized.slice(0, -4)}`;
  }

  if (normalized.endsWith("/api")) {
    return normalized;
  }

  return `${normalized.replace(/\/+$/, "")}/api`;
}

function getExplorerConfig(chainId) {
  const normalizedChainId = Number(chainId || BASE_SEPOLIA_ID);

  if (normalizedChainId === ARC_TESTNET_ID) {
    return {
      label: "ArcScan",
      apiUrl: toBlockscoutCompatApiUrl(process.env.ARCSCAN_API_URL, ARC_TESTNET_ID),
      apiKey: String(process.env.ARCSCAN_API_KEY || "").trim(),
      apiStyle: "blockscout",
      chainId: normalizedChainId,
    };
  }

  if (normalizedChainId === ROBINHOOD_TESTNET_ID) {
    return {
      label: "Robinhood Explorer",
      apiUrl: toBlockscoutCompatApiUrl(
        process.env.ROBINHOODSCAN_API_URL ||
          "https://explorer.testnet.chain.robinhood.com",
        ROBINHOOD_TESTNET_ID
      ),
      apiKey: String(process.env.ROBINHOODSCAN_API_KEY || "").trim(),
      apiStyle: "blockscout",
      chainId: normalizedChainId,
    };
  }

  return {
    label: "BaseScan",
    apiUrl: normalizeApiUrl(process.env.ETHERSCAN_API_URL, ETHERSCAN_V2_API_URL),
    apiKey: String(
      process.env.ETHERSCAN_API_KEY || process.env.BASESCAN_API_KEY || ""
    ).trim(),
    apiStyle: "etherscan-v2",
    chainId: normalizedChainId,
  };
}

function buildExplorerUrl(address, chainId, { sort = "asc", offset = 25 } = {}) {
  const { apiUrl, apiKey, apiStyle, chainId: normalizedChainId } = getExplorerConfig(
    chainId
  );
  const url = new URL(apiUrl);

  if (apiStyle === "etherscan-v2") {
    url.searchParams.set("chainid", String(normalizedChainId));
  }

  url.searchParams.set("module", "account");
  url.searchParams.set("action", "txlist");
  url.searchParams.set("address", address);
  url.searchParams.set("startblock", "0");
  url.searchParams.set("endblock", "99999999");
  url.searchParams.set("page", "1");
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("sort", sort);

  if (apiKey) {
    url.searchParams.set("apikey", apiKey);
  }

  return url.toString();
}

async function requestTransactions(address, chainId, options) {
  const { apiKey, label, apiStyle } = getExplorerConfig(chainId);

  if (apiStyle === "etherscan-v2" && !apiKey) {
    throw new Error(
      `${label} / Etherscan API key is not configured`
    );
  }

  const result = await fetchJson(buildExplorerUrl(address, chainId, options), {}, 12000);

  if (!result.ok) {
    throw new Error(`${label} request failed (${result.status})`);
  }

  const payload = result.data || {};

  if (payload.status === "0" && !Array.isArray(payload.result)) {
    throw new Error(getExplorerErrorMessage(payload, label));
  }

  return Array.isArray(payload.result) ? payload.result : [];
}

export async function getBaseScanSignal(address, chainId) {
  const { label } = getExplorerConfig(chainId);

  try {
    const [oldestTransactions, recentTransactions] = await Promise.all([
      requestTransactions(address, chainId, { sort: "asc", offset: 1 }),
      requestTransactions(address, chainId, { sort: "desc", offset: 25 }),
    ]);

    const oldestTransaction = oldestTransactions[0] || null;
    const oldestTimestamp = oldestTransaction?.timeStamp
      ? Number(oldestTransaction.timeStamp)
      : null;
    const now = Math.floor(Date.now() / 1000);
    const ageDays =
      oldestTimestamp && oldestTimestamp <= now
        ? Math.floor((now - oldestTimestamp) / 86400)
        : null;
    const counterparties = new Set(
      recentTransactions
        .flatMap((transaction) => [transaction.from, transaction.to])
        .map((value) => String(value || "").toLowerCase())
        .filter((value) => value && value !== address.toLowerCase())
    );

    let score = 0;

    if (ageDays !== null) {
      if (ageDays >= 365) score = 13;
      else if (ageDays >= 180) score = 11;
      else if (ageDays >= 90) score = 8;
      else if (ageDays >= 30) score = 5;
      else if (ageDays >= 7) score = 2;
    }

    return {
      key: "wallet-age",
      label: "Wallet Age",
      available: true,
      score,
      maxScore: MAX_SCORE,
      summary:
        ageDays === null
          ? `No ${label} history was found for this wallet.`
          : `Oldest ${label} transaction is ${ageDays} days old.`,
      highlights:
        ageDays >= 90
          ? [`Wallet has an older ${label} transaction history.`]
          : [],
      stats: {
        ageDays,
        recentTransactionSample: recentTransactions.length,
        uniqueRecentCounterparties: counterparties.size,
      },
    };
  } catch (error) {
    const failureReason = normalizeExplorerMessage(error?.message);

    return {
      key: "wallet-age",
      label: "Wallet Age",
      available: false,
      score: 0,
      maxScore: MAX_SCORE,
      summary: formatExplorerLookupSummary(label, failureReason),
      stats: {
        ageDays: null,
        error: failureReason || `${label} age lookup is unavailable right now`,
      },
    };
  }
}
