import { GraphQLClient } from "graphql-request";
import { createPublicClient, http, parseAbiItem } from "viem";
import { requestCampaigns } from "../../src/graphql/queries.js";
import { listCampaignRecords } from "./campaignRegistry.js";

const BASE_SEPOLIA_ID = 84532;
const ARC_TESTNET_ID = 5042002;
const ROBINHOOD_TESTNET_ID = 46630;
const DEFAULT_CHAIN_ID = BASE_SEPOLIA_ID;
const FUNDING_TOKEN_DECIMALS = {
  [BASE_SEPOLIA_ID]: 6,
  [ARC_TESTNET_ID]: 6,
  [ROBINHOOD_TESTNET_ID]: 6,
};
const FUNDING_TOKEN_ADDRESSES = {
  [ROBINHOOD_TESTNET_ID]: "0x7E955252E15c84f5768B83c41a71F9eba181802F",
};
const FEED_CACHE_TTL_MS = 30 * 1000;
const FEED_STALE_TTL_MS = 5 * 60 * 1000;
const MAX_LIMIT = 250;
const FACTORY_PAGE_SIZE = 200n;
const CONTRIBUTOR_STATS_CACHE_TTL_MS = 2 * 60 * 1000;
const MIN_BLOCK_RANGE_SIZE = 1n;

const FACTORY_ADDRESSES = {
  [BASE_SEPOLIA_ID]: "0xAF9b63f245eF00044FbC5d50c6aB8DC918BD6827",
  [ARC_TESTNET_ID]: "0x9727b1E6A0a8c97Cf5AC42322160B1140467B60B",
  [ROBINHOOD_TESTNET_ID]: "0x625aF810614687e13b2F5b763c2A4374282078bE",
};

const FACTORY_ABI = [
  {
    inputs: [],
    name: "campaignCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "start", type: "uint256" },
      { internalType: "uint256", name: "limit", type: "uint256" },
    ],
    name: "getCampaignsPaginated",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
];

const CAMPAIGN_ABI = [
  {
    inputs: [],
    name: "creator",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "goal",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "deadline",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalRaised",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getState",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
];

const CONTRIBUTED_EVENT = parseAbiItem(
  "event Contributed(address indexed user, uint256 amount, uint256 totalRaised)"
);
const REFUNDED_EVENT = parseAbiItem(
  "event Refunded(address indexed user, uint256 amount)"
);
const CONTRIBUTOR_STATS_START_BLOCKS = {
  [BASE_SEPOLIA_ID]: 40070668n,
  [ARC_TESTNET_ID]: 36606552n,
  [ROBINHOOD_TESTNET_ID]: 40485115n,
};

const defaultGraphEndpoint =
  String(process.env.GRAPH_API_URL_BASE_SEPOLIA || "")
    .trim() ||
  String(process.env.VITE_GRAPH_API_URL_BASE_SEPOLIA || "")
    .trim() ||
  String(process.env.GRAPH_API_URL || "")
    .trim() ||
  String(import.meta.env?.VITE_GRAPH_API_URL || "")
    .trim() ||
  "https://api.studio.thegraph.com/query/1744275/basefundai/version/latest";

const graphEndpoints = {
  [BASE_SEPOLIA_ID]:
    String(process.env.GRAPH_API_URL_BASE_SEPOLIA || "").trim() ||
    String(process.env.VITE_GRAPH_API_URL_BASE_SEPOLIA || "").trim() ||
    defaultGraphEndpoint,
  [ARC_TESTNET_ID]:
    String(process.env.GRAPH_API_URL_ARC_TESTNET || "").trim() ||
    String(process.env.VITE_GRAPH_API_URL_ARC_TESTNET || "").trim() ||
    defaultGraphEndpoint,
  [ROBINHOOD_TESTNET_ID]:
    String(process.env.GRAPH_API_URL_ROBINHOOD_TESTNET || "").trim() ||
    String(process.env.VITE_GRAPH_API_URL_ROBINHOOD_TESTNET || "").trim(),
};

const rpcEndpoints = {
  [BASE_SEPOLIA_ID]:
    String(process.env.ALCHEMY_RPC_URL || "").trim() ||
    String(process.env.VITE_ALCHEMY_RPC_URL || "").trim() ||
    "https://sepolia.base.org",
  [ARC_TESTNET_ID]:
    String(process.env.ARC_RPC_URL || "").trim() ||
    String(process.env.VITE_ARC_RPC_URL || "").trim() ||
    "https://rpc.testnet.arc.network",
  [ROBINHOOD_TESTNET_ID]:
    String(process.env.ROBINHOOD_RPC_URL || "").trim() ||
    String(process.env.VITE_ROBINHOOD_RPC_URL || "").trim() ||
    "https://rpc.testnet.chain.robinhood.com",
};

const graphClientCache = new Map();
const publicClientCache = new Map();
const feedCache = new Map();
const inflightFeedRequests = new Map();
const contributorStatsCache = new Map();

function normalizeChainId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_CHAIN_ID;
}

function toNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "bigint") {
    return Number(value.toString());
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value && typeof value.toString === "function") {
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toBool(value) {
  return value === true || value === "true";
}

function getFundingTokenDecimals(chainId) {
  return Number(FUNDING_TOKEN_DECIMALS[normalizeChainId(chainId)] || 6);
}

function toUsdc(value, chainId) {
  return toNumber(value) / 10 ** getFundingTokenDecimals(chainId);
}

function toSeconds(value) {
  const parsed = toNumber(value);
  return parsed > 1e12 ? Math.floor(parsed / 1000) : parsed;
}

function normalizeAddress(value = "") {
  return String(value || "").trim().toLowerCase();
}

function toPositiveBlockNumber(value) {
  if (typeof value === "bigint") {
    return value > 0n ? value : 0n;
  }

  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0n;
  }

  return BigInt(Math.floor(parsed));
}

function getContributorStatsStartBlock(chainId, createdAtBlock) {
  const createdBlock = toPositiveBlockNumber(createdAtBlock);

  if (createdBlock > 0n) {
    return createdBlock;
  }

  return CONTRIBUTOR_STATS_START_BLOCKS[normalizeChainId(chainId)] || 0n;
}

function getContributorStatsCacheKey(campaignAddress, chainId, createdAtBlock) {
  return `${normalizeChainId(chainId)}:${normalizeAddress(campaignAddress)}:${String(
    getContributorStatsStartBlock(chainId, createdAtBlock)
  )}`;
}

function isLogRangeLimitError(error) {
  const message = [
    error?.shortMessage,
    error?.details,
    error?.message,
    error?.cause?.message,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    message.includes("eth_getlogs") &&
    (message.includes("10,000 range") ||
      message.includes("10000 range") ||
      message.includes("block range") ||
      message.includes("413"))
  );
}

async function getLogsWithAdaptiveRange({
  publicClient,
  campaignAddress,
  event,
  fromBlock,
  toBlock,
}) {
  try {
    return await publicClient.getLogs({
      address: campaignAddress,
      event,
      fromBlock,
      toBlock,
    });
  } catch (error) {
    const rangeSize = toBlock - fromBlock + 1n;

    if (!isLogRangeLimitError(error) || rangeSize <= MIN_BLOCK_RANGE_SIZE) {
      throw error;
    }

    const midpoint = fromBlock + rangeSize / 2n - 1n;

    if (midpoint < fromBlock || midpoint >= toBlock) {
      throw error;
    }

    const [leftLogs, rightLogs] = await Promise.all([
      getLogsWithAdaptiveRange({
        publicClient,
        campaignAddress,
        event,
        fromBlock,
        toBlock: midpoint,
      }),
      getLogsWithAdaptiveRange({
        publicClient,
        campaignAddress,
        event,
        fromBlock: midpoint + 1n,
        toBlock,
      }),
    ]);

    return [...leftLogs, ...rightLogs];
  }
}

function isAlchemyRpcEndpoint(value = "") {
  return /^https:\/\/[^/]*alchemy\.com\//i.test(String(value || "").trim());
}

function getFundingTokenAddress(chainId = DEFAULT_CHAIN_ID) {
  return String(FUNDING_TOKEN_ADDRESSES[normalizeChainId(chainId)] || "").trim();
}

function getAlchemyTransferParams({
  fromBlock,
  toBlock,
  campaignAddress,
  tokenAddress,
  pageKey,
}) {
  const params = {
    fromBlock: `0x${fromBlock.toString(16)}`,
    toBlock: `0x${toBlock.toString(16)}`,
    toAddress: campaignAddress,
    contractAddresses: [tokenAddress],
    category: ["erc20"],
    withMetadata: false,
    excludeZeroValue: true,
    maxCount: "0x3e8",
  };

  if (pageKey) {
    params.pageKey = pageKey;
  }

  return params;
}

async function fetchAlchemyTransferPage(rpcEndpoint, params) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(rpcEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getAssetTransfers",
        params: [params],
      }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);

    if (!response.ok || data?.error) {
      throw new Error(
        data?.error?.message || `Alchemy transfer lookup failed (${response.status})`
      );
    }

    return data?.result || {};
  } finally {
    clearTimeout(timeout);
  }
}

async function loadContributorStatsFromAlchemyTransfers({
  campaignAddress,
  chainId,
  createdAtBlock = 0,
  currentBlock,
} = {}) {
  const normalizedChainId = normalizeChainId(chainId);
  const rpcEndpoint = getRpcEndpoint(normalizedChainId);
  const tokenAddress = getFundingTokenAddress(normalizedChainId);

  if (
    normalizedChainId !== ROBINHOOD_TESTNET_ID ||
    !campaignAddress ||
    !tokenAddress ||
    !isAlchemyRpcEndpoint(rpcEndpoint)
  ) {
    return null;
  }

  const startBlock = getContributorStatsStartBlock(normalizedChainId, createdAtBlock);
  const latestBlock = toPositiveBlockNumber(currentBlock);

  if (startBlock <= 0n || latestBlock <= 0n || startBlock > latestBlock) {
    return null;
  }

  const normalizedCampaignAddress = normalizeAddress(campaignAddress);
  const normalizedTokenAddress = normalizeAddress(tokenAddress);
  const uniqueBackers = new Set();
  let contributionCount = 0;
  let pageKey = "";

  do {
    const result = await fetchAlchemyTransferPage(
      rpcEndpoint,
      getAlchemyTransferParams({
        fromBlock: startBlock,
        toBlock: latestBlock,
        campaignAddress,
        tokenAddress,
        pageKey,
      })
    );

    const transfers = Array.isArray(result.transfers) ? result.transfers : [];

    for (const transfer of transfers) {
      const from = normalizeAddress(transfer?.from);
      const to = normalizeAddress(transfer?.to);
      const contractAddress = normalizeAddress(transfer?.rawContract?.address);

      if (
        !from ||
        to !== normalizedCampaignAddress ||
        contractAddress !== normalizedTokenAddress
      ) {
        continue;
      }

      uniqueBackers.add(from);
      contributionCount += 1;
    }

    pageKey = String(result.pageKey || "").trim();
  } while (pageKey);

  return {
    backerCount: uniqueBackers.size,
    contributionCount,
    refundsClaimedCount: 0,
  };
}

async function loadCampaignContributorStats({
  publicClient,
  campaignAddress,
  chainId,
  createdAtBlock = 0,
} = {}) {
  if (!publicClient || !campaignAddress) {
    return {
      backerCount: 0,
      contributionCount: 0,
      refundsClaimedCount: 0,
    };
  }

  const cacheKey = getContributorStatsCacheKey(campaignAddress, chainId, createdAtBlock);
  const cached = contributorStatsCache.get(cacheKey);

  if (cached?.value && Date.now() - cached.timestamp < CONTRIBUTOR_STATS_CACHE_TTL_MS) {
    return cached.value;
  }

  if (cached?.promise) {
    return cached.promise;
  }

  const promise = (async () => {
    const startBlock = getContributorStatsStartBlock(chainId, createdAtBlock);
    const currentBlock = await publicClient.getBlockNumber();

    if (startBlock <= 0n || startBlock > currentBlock) {
      return {
        backerCount: 0,
        contributionCount: 0,
        refundsClaimedCount: 0,
      };
    }

    const alchemyTransferStats = await loadContributorStatsFromAlchemyTransfers({
      campaignAddress,
      chainId,
      createdAtBlock,
      currentBlock,
    }).catch(() => null);

    if (alchemyTransferStats) {
      return alchemyTransferStats;
    }

    const [contributionLogs, refundLogs] = await Promise.all([
      getLogsWithAdaptiveRange({
        publicClient,
        campaignAddress,
        event: CONTRIBUTED_EVENT,
        fromBlock: startBlock,
        toBlock: currentBlock,
      }),
      getLogsWithAdaptiveRange({
        publicClient,
        campaignAddress,
        event: REFUNDED_EVENT,
        fromBlock: startBlock,
        toBlock: currentBlock,
      }),
    ]);

    const uniqueBackers = new Set(
      contributionLogs
        .map((log) => normalizeAddress(log.args?.user))
        .filter(Boolean)
    );

    return {
      backerCount: uniqueBackers.size,
      contributionCount: contributionLogs.length,
      refundsClaimedCount: refundLogs.length,
    };
  })()
    .then((value) => {
      contributorStatsCache.set(cacheKey, {
        value,
        timestamp: Date.now(),
      });
      return value;
    })
    .catch((error) => {
      contributorStatsCache.delete(cacheKey);
      throw error;
    });

  contributorStatsCache.set(cacheKey, {
    promise,
    timestamp: Date.now(),
  });

  return promise;
}

function getCampaignState(campaign, now = Math.floor(Date.now() / 1000)) {
  const code = toNumber(campaign?.stateCode);
  const raised = toNumber(campaign?.raised);
  const goal = toNumber(campaign?.goal);
  const deadline = toSeconds(campaign?.deadline);
  const finalized = toBool(campaign?.finalized);
  const successful = toBool(campaign?.successful);
  const fundsClaimed = toBool(campaign?.fundsClaimed);
  const goalReached = goal > 0 && raised >= goal;
  const hasEnded = deadline > 0 && deadline <= now;

  if (code === 3 || fundsClaimed) return "SETTLED";
  if (code === 1) return "SUCCESSFUL";
  if (code === 2) return "FAILED";
  if (finalized) return successful ? "SUCCESSFUL" : "FAILED";
  if (successful || goalReached) return "SUCCESSFUL";
  if (hasEnded) return goalReached ? "SUCCESSFUL" : "FAILED";
  return "ACTIVE";
}

function getTrendingScore(campaign = {}) {
  return Number(campaign.raised || 0) * 0.7 + Number(campaign.backerCount || 0) * 0.3;
}

function getGraphEndpoint(chainId = DEFAULT_CHAIN_ID) {
  return String(graphEndpoints[normalizeChainId(chainId)] || "").trim();
}

function getGraphClient(chainId = DEFAULT_CHAIN_ID) {
  const endpoint = getGraphEndpoint(chainId);

  if (!endpoint) {
    return null;
  }

  if (!graphClientCache.has(endpoint)) {
    graphClientCache.set(endpoint, new GraphQLClient(endpoint));
  }

  return graphClientCache.get(endpoint);
}

function getFactoryAddress(chainId = DEFAULT_CHAIN_ID) {
  return String(FACTORY_ADDRESSES[normalizeChainId(chainId)] || "").trim();
}

function getRpcEndpoint(chainId = DEFAULT_CHAIN_ID) {
  return String(rpcEndpoints[normalizeChainId(chainId)] || "").trim();
}

function getPublicClient(chainId = DEFAULT_CHAIN_ID) {
  const normalizedChainId = normalizeChainId(chainId);

  if (publicClientCache.has(normalizedChainId)) {
    return publicClientCache.get(normalizedChainId);
  }

  const rpcEndpoint = getRpcEndpoint(normalizedChainId);

  if (!rpcEndpoint) {
    return null;
  }

  const client = createPublicClient({
    transport: http(rpcEndpoint),
  });

  publicClientCache.set(normalizedChainId, client);
  return client;
}

function normalizeGraphCampaign(campaign = {}, chainId = DEFAULT_CHAIN_ID) {
  const normalizedChainId = normalizeChainId(chainId);

  return {
    address: String(campaign.address || campaign.id || "").trim(),
    chainId: normalizedChainId,
    creator: String(campaign.creator || "").trim(),
    goal: toUsdc(campaign.goal, normalizedChainId),
    raised: toUsdc(campaign.raised, normalizedChainId),
    deadline: toSeconds(campaign.deadline),
    finalized: toBool(campaign.finalized),
    successful: toBool(campaign.successful),
    stateCode:
      campaign.stateCode !== undefined && campaign.stateCode !== null
        ? toNumber(campaign.stateCode)
        : null,
    createdAtBlock: toNumber(campaign.createdAtBlock),
    contributionCount: toNumber(campaign.contributionCount),
    backerCount: toNumber(campaign.backerCount),
    fundsClaimed: toBool(campaign.fundsClaimed),
    refundsClaimedCount: toNumber(campaign.refundsClaimedCount),
  };
}

function normalizeOnchainCampaign(campaign = {}, chainId = DEFAULT_CHAIN_ID) {
  const normalizedChainId = normalizeChainId(chainId);
  const stateCode = toNumber(campaign.stateCode);

  return {
    address: String(campaign.address || "").trim(),
    chainId: normalizedChainId,
    creator: String(campaign.creator || "").trim(),
    goal: toUsdc(campaign.goal, normalizedChainId),
    raised: toUsdc(campaign.raised, normalizedChainId),
    deadline: toSeconds(campaign.deadline),
    finalized: stateCode === 1 || stateCode === 2 || stateCode === 3,
    successful: stateCode === 1 || stateCode === 3,
    stateCode,
    createdAtBlock: 0,
    contributionCount: toNumber(campaign.contributionCount),
    backerCount: toNumber(campaign.backerCount),
    fundsClaimed: stateCode === 3,
    refundsClaimedCount: toNumber(campaign.refundsClaimedCount),
  };
}

async function readFactoryCampaignAddresses(publicClient, factoryAddress) {
  const campaignCount = await publicClient.readContract({
    address: factoryAddress,
    abi: FACTORY_ABI,
    functionName: "campaignCount",
  });
  const total = toNumber(campaignCount);

  if (!Number.isFinite(total) || total <= 0) {
    return [];
  }

  const addresses = [];

  for (let start = 0; start < total; start += Number(FACTORY_PAGE_SIZE)) {
    const batch = await publicClient.readContract({
      address: factoryAddress,
      abi: FACTORY_ABI,
      functionName: "getCampaignsPaginated",
      args: [BigInt(start), FACTORY_PAGE_SIZE],
    });

    if (Array.isArray(batch) && batch.length > 0) {
      addresses.push(...batch);
    }
  }

  return [...new Set(addresses.map((address) => String(address || "").trim().toLowerCase()))];
}

async function readOnchainCampaign(
  publicClient,
  address,
  chainId = DEFAULT_CHAIN_ID,
  { includeContributorStats = false } = {}
) {
  const [creator, goal, totalRaised, deadline, stateCode, contributorStats] = await Promise.all([
    publicClient.readContract({
      address,
      abi: CAMPAIGN_ABI,
      functionName: "creator",
    }),
    publicClient.readContract({
      address,
      abi: CAMPAIGN_ABI,
      functionName: "goal",
    }),
    publicClient.readContract({
      address,
      abi: CAMPAIGN_ABI,
      functionName: "totalRaised",
    }),
    publicClient.readContract({
      address,
      abi: CAMPAIGN_ABI,
      functionName: "deadline",
    }),
    publicClient.readContract({
      address,
      abi: CAMPAIGN_ABI,
      functionName: "getState",
    }),
    includeContributorStats
      ? loadCampaignContributorStats({
          publicClient,
          campaignAddress: address,
          chainId,
          createdAtBlock: 0,
        }).catch(() => null)
      : Promise.resolve(null),
  ]);

  return normalizeOnchainCampaign(
    {
      address,
      creator,
      goal,
      raised: totalRaised,
      deadline,
      stateCode,
      contributionCount: contributorStats?.contributionCount || 0,
      backerCount: contributorStats?.backerCount || 0,
      refundsClaimedCount: contributorStats?.refundsClaimedCount || 0,
    },
    chainId
  );
}

async function loadOnchainCampaignCatalog(chainId = DEFAULT_CHAIN_ID) {
  const normalizedChainId = normalizeChainId(chainId);
  const factoryAddress = getFactoryAddress(normalizedChainId);
  const publicClient = getPublicClient(normalizedChainId);
  const includeContributorStats = normalizedChainId === ROBINHOOD_TESTNET_ID;

  if (!factoryAddress || !publicClient) {
    return [];
  }

  let addresses = [];

  try {
    addresses = await readFactoryCampaignAddresses(publicClient, factoryAddress);
  } catch {
    return [];
  }

  if (!addresses.length) {
    return [];
  }

  const campaigns = await Promise.all(
    addresses.map(async (address) => {
      try {
        return await readOnchainCampaign(publicClient, address, normalizedChainId, {
          includeContributorStats,
        });
      } catch {
        return null;
      }
    })
  );

  return campaigns.filter((campaign) => campaign?.address);
}

async function enrichCampaignsWithContributorStats(
  campaigns = [],
  chainId = DEFAULT_CHAIN_ID
) {
  const publicClient = getPublicClient(chainId);

  if (!publicClient || !Array.isArray(campaigns) || campaigns.length === 0) {
    return campaigns;
  }

  const enrichedCampaigns = await Promise.all(
    campaigns.map(async (campaign) => {
      if (!campaign?.address) {
        return campaign;
      }

      const hasContributorStats =
        Number(campaign.contributionCount || 0) > 0 ||
        Number(campaign.backerCount || 0) > 0 ||
        Number(campaign.refundsClaimedCount || 0) > 0;

      if (hasContributorStats) {
        return campaign;
      }

      try {
        const contributorStats = await loadCampaignContributorStats({
          publicClient,
          campaignAddress: campaign.address,
          chainId,
          createdAtBlock: campaign.createdAtBlock || 0,
        });

        return {
          ...campaign,
          contributionCount: Math.max(
            Number(campaign.contributionCount || 0),
            Number(contributorStats.contributionCount || 0)
          ),
          backerCount: Math.max(
            Number(campaign.backerCount || 0),
            Number(contributorStats.backerCount || 0)
          ),
          refundsClaimedCount: Math.max(
            Number(campaign.refundsClaimedCount || 0),
            Number(contributorStats.refundsClaimedCount || 0)
          ),
        };
      } catch {
        return campaign;
      }
    })
  );

  return enrichedCampaigns;
}

function mergeIndexedCampaign(onchainCampaign = null, graphCampaign = null) {
  if (!onchainCampaign && !graphCampaign) {
    return null;
  }

  if (!onchainCampaign) {
    return graphCampaign;
  }

  if (!graphCampaign) {
    return onchainCampaign;
  }

  return {
    ...onchainCampaign,
    createdAtBlock: Number(graphCampaign.createdAtBlock || 0),
    contributionCount: Math.max(
      Number(onchainCampaign.contributionCount || 0),
      Number(graphCampaign.contributionCount || 0)
    ),
    backerCount: Math.max(
      Number(onchainCampaign.backerCount || 0),
      Number(graphCampaign.backerCount || 0)
    ),
    refundsClaimedCount: Math.max(
      Number(onchainCampaign.refundsClaimedCount || 0),
      Number(graphCampaign.refundsClaimedCount || 0)
    ),
    finalized: Boolean(graphCampaign.finalized || onchainCampaign.finalized),
    successful: Boolean(graphCampaign.successful || onchainCampaign.successful),
    stateCode:
      graphCampaign.stateCode !== undefined && graphCampaign.stateCode !== null
        ? Number(graphCampaign.stateCode)
        : onchainCampaign.stateCode,
    fundsClaimed: Boolean(graphCampaign.fundsClaimed || onchainCampaign.fundsClaimed),
  };
}

function mergeIndexedCampaignCatalog(graphCampaigns = [], onchainCampaigns = []) {
  if (!onchainCampaigns.length) {
    return graphCampaigns;
  }

  const graphByAddress = new Map(
    graphCampaigns.map((campaign) => [String(campaign.address || "").toLowerCase(), campaign])
  );
  const onchainByAddress = new Map(
    onchainCampaigns.map((campaign) => [String(campaign.address || "").toLowerCase(), campaign])
  );
  const addressSet = new Set([...graphByAddress.keys(), ...onchainByAddress.keys()]);

  return [...addressSet]
    .map((address) =>
      mergeIndexedCampaign(onchainByAddress.get(address) || null, graphByAddress.get(address) || null)
    )
    .filter((campaign) => campaign?.address);
}

function shouldLoadOnchainFallback({
  chainId = DEFAULT_CHAIN_ID,
  graphCampaigns = [],
  graphMode = "unavailable",
  registryRecords = [],
} = {}) {
  const normalizedChainId = normalizeChainId(chainId);

  if (
    graphCampaigns.length > 0 &&
    String(graphMode || "").trim().toLowerCase() === "enhanced" &&
    normalizedChainId !== ROBINHOOD_TESTNET_ID
  ) {
    return false;
  }

  if (!getFactoryAddress(normalizedChainId) || !getRpcEndpoint(normalizedChainId)) {
    return false;
  }

  if (!getGraphEndpoint(normalizedChainId)) {
    return true;
  }

  return normalizedChainId === ROBINHOOD_TESTNET_ID || registryRecords.length > 0;
}

function mergeCampaignFeedEntry(record, graphCampaign, chainId = DEFAULT_CHAIN_ID) {
  const normalizedChainId = normalizeChainId(chainId);

  return {
    address: String(graphCampaign?.address || record?.address || "").trim(),
    chainId: normalizedChainId,
    creator: String(graphCampaign?.creator || record?.creator || "").trim(),
    goal: Number(graphCampaign?.goal || 0),
    raised: Number(graphCampaign?.raised || 0),
    deadline: Number(graphCampaign?.deadline || 0),
    finalized: Boolean(graphCampaign?.finalized),
    successful: Boolean(graphCampaign?.successful),
    stateCode:
      graphCampaign?.stateCode !== undefined && graphCampaign?.stateCode !== null
        ? Number(graphCampaign.stateCode)
        : null,
    createdAtBlock: Number(graphCampaign?.createdAtBlock || 0),
    contributionCount: Number(graphCampaign?.contributionCount || 0),
    backerCount: Number(graphCampaign?.backerCount || 0),
    fundsClaimed: Boolean(graphCampaign?.fundsClaimed),
    refundsClaimedCount: Number(graphCampaign?.refundsClaimedCount || 0),
    ipfsHash: String(record?.ipfsHash || "").trim(),
    metadata: record?.metadata || {},
    trust: record?.trust || null,
    recordUpdatedAt: String(record?.updatedAt || "").trim(),
    recordCreatedAt: String(record?.createdAt || "").trim(),
    indexed: Boolean(graphCampaign?.address),
  };
}

function isPubliclyListableCampaign(campaign = {}) {
  if (campaign?.indexed) {
    return true;
  }

  return (
    Number(campaign?.createdAtBlock || 0) > 0 ||
    Number(campaign?.deadline || 0) > 0 ||
    Number(campaign?.goal || 0) > 0 ||
    Number(campaign?.raised || 0) > 0 ||
    Number(campaign?.contributionCount || 0) > 0 ||
    Number(campaign?.backerCount || 0) > 0 ||
    Number(campaign?.refundsClaimedCount || 0) > 0 ||
    campaign?.stateCode !== null && campaign?.stateCode !== undefined ||
    Boolean(campaign?.finalized) ||
    Boolean(campaign?.successful) ||
    Boolean(campaign?.fundsClaimed)
  );
}

function sortCampaigns(items = [], sort = "TRENDING", now = Math.floor(Date.now() / 1000)) {
  const nextItems = [...items];

  if (sort === "NEW") {
    return nextItems.sort((a, b) => Number(b.createdAtBlock || 0) - Number(a.createdAtBlock || 0));
  }

  if (sort === "ENDING") {
    return nextItems
      .filter((campaign) => getCampaignState(campaign, now) === "ACTIVE")
      .sort((a, b) => Number(a.deadline || 0) - Number(b.deadline || 0));
  }

  return nextItems.sort((a, b) => getTrendingScore(b) - getTrendingScore(a));
}

function filterByState(items = [], state = "ALL", now = Math.floor(Date.now() / 1000)) {
  if (state === "ALL") {
    return items;
  }

  return items.filter((campaign) => getCampaignState(campaign, now) === state);
}

function buildCounts(items = [], now = Math.floor(Date.now() / 1000)) {
  const counts = {
    ALL: items.length,
    ACTIVE: 0,
    SUCCESSFUL: 0,
    FAILED: 0,
    SETTLED: 0,
  };

  for (const campaign of items) {
    const state = getCampaignState(campaign, now);

    if (counts[state] !== undefined) {
      counts[state] += 1;
    }
  }

  return counts;
}

function buildSummary(items = [], now = Math.floor(Date.now() / 1000)) {
  return {
    raised: items.reduce((sum, campaign) => sum + Number(campaign.raised || 0), 0),
    campaigns: items.length,
    backers: items.reduce((sum, campaign) => sum + Number(campaign.backerCount || 0), 0),
    activeCampaigns: items.filter((campaign) => getCampaignState(campaign, now) === "ACTIVE")
      .length,
    successfulCampaigns: items.filter(
      (campaign) => getCampaignState(campaign, now) === "SUCCESSFUL"
    ).length,
    failedCampaigns: items.filter((campaign) => getCampaignState(campaign, now) === "FAILED")
      .length,
    settledCampaigns: items.filter((campaign) => getCampaignState(campaign, now) === "SETTLED")
      .length,
  };
}

async function loadCampaignCatalog(chainId = DEFAULT_CHAIN_ID) {
  const normalizedChainId = normalizeChainId(chainId);
  const [registryRecords, graphResponse] = await Promise.all([
    listCampaignRecords(normalizedChainId),
    (async () => {
      const graphClient = getGraphClient(normalizedChainId);

      if (!graphClient) {
        return { campaigns: [] };
      }

      try {
        return await requestCampaigns(graphClient);
      } catch {
        return { campaigns: [] };
      }
    })(),
  ]);

  const recordsByAddress = new Map(
    registryRecords
      .filter((record) => record?.address)
      .map((record) => [String(record.address || "").toLowerCase(), record])
  );
  const graphCampaigns = Array.isArray(graphResponse?.campaigns)
    ? graphResponse.campaigns
        .map((campaign) => normalizeGraphCampaign(campaign, normalizedChainId))
        .filter((campaign) => campaign.address)
    : [];
  const graphMode = String(graphResponse?.graphMode || "unavailable").trim().toLowerCase();
  const onchainCampaigns = shouldLoadOnchainFallback({
    chainId: normalizedChainId,
    graphCampaigns,
    graphMode,
    registryRecords,
  })
    ? await loadOnchainCampaignCatalog(normalizedChainId)
    : [];
  let indexedCampaigns = mergeIndexedCampaignCatalog(graphCampaigns, onchainCampaigns);

  if (normalizedChainId === ROBINHOOD_TESTNET_ID || graphMode !== "enhanced") {
    indexedCampaigns = await enrichCampaignsWithContributorStats(
      indexedCampaigns,
      normalizedChainId
    );
  }

  const indexedByAddress = new Map(
    indexedCampaigns.map((campaign) => [String(campaign.address || "").toLowerCase(), campaign])
  );
  const addressSet = new Set([...recordsByAddress.keys(), ...indexedByAddress.keys()]);

  return [...addressSet]
    .map((address) =>
      mergeCampaignFeedEntry(
        recordsByAddress.get(address),
        indexedByAddress.get(address),
        normalizedChainId
      )
    )
    .filter((campaign) => campaign.address);
}

async function getCachedCampaignCatalog(chainId = DEFAULT_CHAIN_ID) {
  const normalizedChainId = normalizeChainId(chainId);
  const cacheEntry = feedCache.get(normalizedChainId);

  if (cacheEntry && Date.now() - cacheEntry.cachedAt < FEED_CACHE_TTL_MS) {
    return cacheEntry.value;
  }

  if (inflightFeedRequests.has(normalizedChainId)) {
    return inflightFeedRequests.get(normalizedChainId);
  }

  const request = loadCampaignCatalog(normalizedChainId)
    .then((value) => {
      feedCache.set(normalizedChainId, {
        cachedAt: Date.now(),
        value,
      });
      inflightFeedRequests.delete(normalizedChainId);
      return value;
    })
    .catch((error) => {
      inflightFeedRequests.delete(normalizedChainId);

      if (cacheEntry && Date.now() - cacheEntry.cachedAt < FEED_STALE_TTL_MS) {
        return cacheEntry.value;
      }

      throw error;
    });

  inflightFeedRequests.set(normalizedChainId, request);
  return request;
}

function normalizeLimit(limit, fallback) {
  const parsed = Number(limit);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function normalizeOffset(offset) {
  const parsed = Number(offset);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function normalizeState(state) {
  const normalized = String(state || "ALL").trim().toUpperCase();
  return ["ALL", "ACTIVE", "SUCCESSFUL", "FAILED", "SETTLED"].includes(normalized)
    ? normalized
    : "ALL";
}

function normalizeSort(sort) {
  const normalized = String(sort || "TRENDING").trim().toUpperCase();
  return ["TRENDING", "NEW", "ENDING"].includes(normalized) ? normalized : "TRENDING";
}

function normalizeCreator(creator) {
  return String(creator || "").trim().toLowerCase();
}

function normalizeAddresses(addresses) {
  const rawValues = Array.isArray(addresses)
    ? addresses
    : typeof addresses === "string"
      ? addresses.split(",")
      : [];

  return [...new Set(
    rawValues
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean)
  )];
}

function shouldIncludeUnindexedCampaigns({ creator = "", addresses = [] } = {}) {
  return Boolean(normalizeCreator(creator) || normalizeAddresses(addresses).length > 0);
}

function applyCampaignFilters(items = [], { creator = "", addresses = [] } = {}) {
  const normalizedCreator = normalizeCreator(creator);
  const normalizedAddresses = normalizeAddresses(addresses);
  const addressSet = normalizedAddresses.length > 0 ? new Set(normalizedAddresses) : null;

  return items.filter((campaign) => {
    const creatorMatches = normalizedCreator
      ? String(campaign?.creator || "").trim().toLowerCase() === normalizedCreator
      : true;
    const addressMatches = addressSet
      ? addressSet.has(String(campaign?.address || "").trim().toLowerCase())
      : true;

    return creatorMatches && addressMatches;
  });
}

export async function getCampaignFeed({
  chainId = DEFAULT_CHAIN_ID,
  state = "ALL",
  sort = "TRENDING",
  limit = 24,
  offset = 0,
  creator = "",
  addresses = [],
} = {}) {
  const normalizedChainId = normalizeChainId(chainId);
  const normalizedState = normalizeState(state);
  const normalizedSort = normalizeSort(sort);
  const normalizedLimit = normalizeLimit(limit, 24);
  const normalizedOffset = normalizeOffset(offset);
  const normalizedCreator = normalizeCreator(creator);
  const normalizedAddresses = normalizeAddresses(addresses);
  const now = Math.floor(Date.now() / 1000);
  const allItems = await getCachedCampaignCatalog(normalizedChainId);
  const feedSourceItems = shouldIncludeUnindexedCampaigns({
    creator: normalizedCreator,
    addresses: normalizedAddresses,
  })
    ? allItems
    : allItems.filter((campaign) => isPubliclyListableCampaign(campaign));
  const scopedItems = applyCampaignFilters(feedSourceItems, {
    creator: normalizedCreator,
    addresses: normalizedAddresses,
  });
  const filteredItems = filterByState(scopedItems, normalizedState, now);
  const sortedItems = sortCampaigns(filteredItems, normalizedSort, now);
  const pagedItems = sortedItems.slice(
    normalizedOffset,
    normalizedOffset + normalizedLimit
  );
  const items = pagedItems.map((campaign) => ({
    ...campaign,
    state: getCampaignState(campaign, now),
  }));
  const trending = sortCampaigns(
    filterByState(scopedItems, "ACTIVE", now),
    "TRENDING",
    now
  )
    .slice(0, 3)
    .map((campaign) => ({
      ...campaign,
      state: getCampaignState(campaign, now),
    }));

  return {
    chainId: normalizedChainId,
    state: normalizedState,
    sort: normalizedSort,
    limit: normalizedLimit,
    offset: normalizedOffset,
    total: sortedItems.length,
    counts: buildCounts(scopedItems, now),
    trending,
    items,
    updatedAt: new Date().toISOString(),
  };
}

export async function getCampaignSummary({ chainId = DEFAULT_CHAIN_ID } = {}) {
  const normalizedChainId = normalizeChainId(chainId);
  const now = Math.floor(Date.now() / 1000);
  const allItems = (await getCachedCampaignCatalog(normalizedChainId)).filter((campaign) =>
    isPubliclyListableCampaign(campaign)
  );

  return {
    chainId: normalizedChainId,
    summary: buildSummary(allItems, now),
    updatedAt: new Date().toISOString(),
  };
}
