import { fetchJson } from "../utils/fetch.js";

const MAX_SCORE = 12;
const BASE_SEPOLIA_ID = 84532;
const ARC_TESTNET_ID = 5042002;
const ROBINHOOD_TESTNET_ID = 46630;

function parseHexInt(value) {
  if (!value) return 0;
  return Number.parseInt(String(value), 16) || 0;
}

function getRpcConfig(chainId) {
  const normalizedChainId = Number(chainId || BASE_SEPOLIA_ID);

  if (normalizedChainId === ARC_TESTNET_ID) {
    return {
      label: "Arc RPC",
      rpcUrl: String(
        process.env.ARC_RPC_URL ||
          process.env.VITE_ARC_RPC_URL ||
          "https://rpc.testnet.arc.network"
      ).trim(),
    };
  }

  if (normalizedChainId === ROBINHOOD_TESTNET_ID) {
    return {
      label: "Robinhood RPC",
      rpcUrl: String(
        process.env.ROBINHOOD_RPC_URL ||
          process.env.VITE_ROBINHOOD_RPC_URL ||
          "https://rpc.testnet.chain.robinhood.com"
      ).trim(),
    };
  }

  return {
    label: "Alchemy RPC",
    rpcUrl: String(process.env.ALCHEMY_RPC_URL || "").trim(),
  };
}

export async function getAlchemySignal(address, chainId) {
  const { rpcUrl, label } = getRpcConfig(chainId);

  if (!rpcUrl) {
    return {
      key: "wallet-activity",
      label: "Wallet Activity",
      available: false,
      score: 0,
      maxScore: MAX_SCORE,
      summary: `${label} is not configured.`,
      stats: {
        txCount: 0,
      },
    };
  }

  try {
    const result = await fetchJson(
      rpcUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getTransactionCount",
          params: [address, "latest"],
        }),
      },
      10000
    );

    if (!result.ok || result.data?.error) {
      throw new Error(
        result.data?.error?.message || `Alchemy request failed (${result.status})`
      );
    }

    const txCount = parseHexInt(result.data?.result);
    let score = 0;

    if (txCount >= 250) score = 12;
    else if (txCount >= 100) score = 10;
    else if (txCount >= 50) score = 8;
    else if (txCount >= 15) score = 5;
    else if (txCount > 0) score = 2;

    return {
      key: "wallet-activity",
      label: "Wallet Activity",
      available: true,
      score,
      maxScore: MAX_SCORE,
      summary:
        txCount > 0
          ? `Wallet shows ${txCount} onchain transactions on the selected network.`
          : "Wallet has no transaction count on the selected network yet.",
      highlights:
        txCount >= 50
          ? ["Wallet has meaningful onchain activity history."]
          : [],
      stats: {
        txCount,
      },
    };
  } catch (error) {
    return {
      key: "wallet-activity",
      label: "Wallet Activity",
      available: false,
      score: 0,
      maxScore: MAX_SCORE,
      summary: `${label} activity lookup is unavailable right now.`,
      stats: {
        txCount: 0,
        error: error.message,
      },
    };
  }
}
