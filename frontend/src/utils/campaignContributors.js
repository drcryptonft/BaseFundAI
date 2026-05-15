import { parseAbiItem } from "viem";
import {
  ARC_TESTNET_ID,
  BASE_SEPOLIA_ID,
  ROBINHOOD_TESTNET_ID,
} from "../config/networks.js";

const CONTRIBUTED_EVENT = parseAbiItem(
  "event Contributed(address indexed user, uint256 amount, uint256 totalRaised)"
);
const REFUNDED_EVENT = parseAbiItem(
  "event Refunded(address indexed user, uint256 amount)"
);
const CHAIN_START_BLOCKS = {
  [BASE_SEPOLIA_ID]: 40070668n,
  [ARC_TESTNET_ID]: 36606552n,
  [ROBINHOOD_TESTNET_ID]: 40485115n,
};
// Keep log windows below public RPC limits and split further when providers are stricter.
const BLOCK_RANGE_SIZE = 9000n;
const MIN_BLOCK_RANGE_SIZE = 1n;
const CACHE_TTL_MS = 2 * 60 * 1000;
const contributorStatsCache = new Map();

function getEmptyContributorStats() {
  return {
    backerCount: 0,
    contributionCount: 0,
    refundsClaimedCount: 0,
    contributors: [],
    activeContributors: [],
  };
}

function normalizeAddress(value = "") {
  return String(value || "").trim().toLowerCase();
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

function sortByContribution(left, right) {
  const leftAmount = toBigInt(left?.totalContributed || 0);
  const rightAmount = toBigInt(right?.totalContributed || 0);

  if (leftAmount === rightAmount) {
    return Number(right?.contributionCount || 0) - Number(left?.contributionCount || 0);
  }

  return rightAmount > leftAmount ? 1 : -1;
}

function getStartBlock(chainId, createdAtBlock) {
  const createdBlock = toPositiveBlockNumber(createdAtBlock);

  if (createdBlock > 0n) {
    return createdBlock;
  }

  return CHAIN_START_BLOCKS[Number(chainId || 0)] || 0n;
}

function getCacheKey(campaignAddress, chainId, createdAtBlock) {
  return `${Number(chainId || 0)}:${normalizeAddress(campaignAddress)}:${String(
    toPositiveBlockNumber(createdAtBlock)
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

    const midpoint = fromBlock + (rangeSize / 2n) - 1n;

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

export function invalidateCampaignContributorStats({
  campaignAddress,
  chainId,
} = {}) {
  const normalizedCampaignAddress = normalizeAddress(campaignAddress);
  const normalizedChainId = Number(chainId || 0);

  [...contributorStatsCache.keys()].forEach((cacheKey) => {
    const [cacheChainId, cacheCampaignAddress] = String(cacheKey).split(":");

    if (
      Number(cacheChainId || 0) === normalizedChainId &&
      cacheCampaignAddress === normalizedCampaignAddress
    ) {
      contributorStatsCache.delete(cacheKey);
    }
  });
}

function createContributorRecord(campaignAddress, contributorAddress) {
  const normalizedCampaignAddress = normalizeAddress(campaignAddress);
  const normalizedContributorAddress = normalizeAddress(contributorAddress);

  return {
    id: `${normalizedCampaignAddress}-${normalizedContributorAddress}`,
    contributor: contributorAddress,
    totalContributed: "0",
    contributionCount: 0,
    refunded: false,
    refundedAtBlock: null,
    refundedAtTimestamp: null,
  };
}

async function fetchContributorStats({
  publicClient,
  campaignAddress,
  chainId,
  createdAtBlock,
}) {
  if (!publicClient || !campaignAddress) {
    return getEmptyContributorStats();
  }

  const startBlock = getStartBlock(chainId, createdAtBlock);
  const currentBlock = await publicClient.getBlockNumber();

  if (startBlock <= 0n || startBlock > currentBlock) {
    return getEmptyContributorStats();
  }

  const contributors = new Map();
  let contributionCount = 0;
  let refundsClaimedCount = 0;

  for (
    let fromBlock = startBlock;
    fromBlock <= currentBlock;
    fromBlock += BLOCK_RANGE_SIZE
  ) {
    const toBlock =
      fromBlock + BLOCK_RANGE_SIZE - 1n > currentBlock
        ? currentBlock
        : fromBlock + BLOCK_RANGE_SIZE - 1n;

    const [contributionLogs, refundLogs] = await Promise.all([
      getLogsWithAdaptiveRange({
        publicClient,
        campaignAddress,
        event: CONTRIBUTED_EVENT,
        fromBlock,
        toBlock,
      }),
      getLogsWithAdaptiveRange({
        publicClient,
        campaignAddress,
        event: REFUNDED_EVENT,
        fromBlock,
        toBlock,
      }),
    ]);

    const orderedEvents = [
      ...contributionLogs.map((log) => ({ kind: "contribution", log })),
      ...refundLogs.map((log) => ({ kind: "refund", log })),
    ].sort((left, right) => {
      if (left.log.blockNumber === right.log.blockNumber) {
        return Number(left.log.logIndex || 0) - Number(right.log.logIndex || 0);
      }

      return left.log.blockNumber < right.log.blockNumber ? -1 : 1;
    });

    orderedEvents.forEach(({ kind, log }) => {
      const contributorAddress = String(log.args?.user || "").trim();
      const normalizedContributor = normalizeAddress(contributorAddress);

      if (!normalizedContributor) {
        return;
      }

      const currentContributor =
        contributors.get(normalizedContributor) ||
        createContributorRecord(campaignAddress, contributorAddress);

      if (kind === "contribution") {
        contributionCount += 1;
        currentContributor.totalContributed = (
          toBigInt(currentContributor.totalContributed) + toBigInt(log.args?.amount || 0)
        ).toString();
        currentContributor.contributionCount =
          Number(currentContributor.contributionCount || 0) + 1;
        currentContributor.refunded = false;
        currentContributor.refundedAtBlock = null;
        currentContributor.refundedAtTimestamp = null;
      } else {
        refundsClaimedCount += 1;
        currentContributor.refunded = true;
        currentContributor.refundedAtBlock = String(log.blockNumber || "");
        currentContributor.refundedAtTimestamp = null;
      }

      contributors.set(normalizedContributor, currentContributor);
    });
  }

  const contributorList = [...contributors.values()].sort(sortByContribution);
  const activeContributors = contributorList
    .filter((contributor) => !contributor.refunded)
    .sort(sortByContribution);

  return {
    backerCount: contributorList.filter(
      (contributor) => Number(contributor.contributionCount || 0) > 0
    ).length,
    contributionCount,
    refundsClaimedCount,
    contributors: contributorList,
    activeContributors,
  };
}

export async function loadCampaignContributorStats({
  publicClient,
  campaignAddress,
  chainId,
  createdAtBlock,
  force = false,
}) {
  if (!publicClient || !campaignAddress) {
    return getEmptyContributorStats();
  }

  const cacheKey = getCacheKey(campaignAddress, chainId, createdAtBlock);
  const cached = contributorStatsCache.get(cacheKey);

  if (!force && cached?.value && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }

  if (!force && cached?.promise) {
    return cached.promise;
  }

  const promise = fetchContributorStats({
    publicClient,
    campaignAddress,
    chainId,
    createdAtBlock,
  })
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
