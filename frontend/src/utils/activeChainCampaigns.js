import {
  CAMPAIGN_ABI,
  FACTORY_ABI,
  getFactoryAddress,
} from "../config/contracts";
import { DEFAULT_CHAIN_ID } from "../config/networks";
import { requestCampaigns } from "../graphql/queries";
import {
  toBool,
  toNumber,
  toSeconds,
  toUsdc,
} from "./campaignStatus";

function normalizeGraphCampaign(campaign = {}) {
  return {
    ...campaign,
    address: campaign.address || campaign.id || "",
    creator: campaign.creator || "",
    goal: toUsdc(campaign.goal, campaign.chainId),
    raised: toUsdc(campaign.raised, campaign.chainId),
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

const FACTORY_PAGE_SIZE = 200n;

async function readOnchainCampaign(publicClient, address, chainId) {
  const [creator, goal, totalRaised, deadline, stateCode] = await Promise.all([
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
  ]);

  const normalizedStateCode = toNumber(stateCode);

  return {
    address,
    creator,
    goal: toUsdc(goal, chainId),
    raised: toUsdc(totalRaised, chainId),
    deadline: toSeconds(deadline),
    finalized: normalizedStateCode === 1 || normalizedStateCode === 2 || normalizedStateCode === 3,
    successful: normalizedStateCode === 1 || normalizedStateCode === 3,
    stateCode: normalizedStateCode,
    createdAtBlock: 0,
    contributionCount: 0,
    backerCount: 0,
    fundsClaimed: normalizedStateCode === 3,
    refundsClaimedCount: 0,
  };
}

function mergeCampaignData(onchainCampaign, graphCampaign) {
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
    contributionCount: graphCampaign.contributionCount,
    backerCount: graphCampaign.backerCount,
    refundsClaimedCount: graphCampaign.refundsClaimedCount,
    createdAtBlock: graphCampaign.createdAtBlock,
    fundsClaimed: graphCampaign.fundsClaimed || onchainCampaign.fundsClaimed,
  };
}

async function readFactoryCampaignAddresses(publicClient, factoryAddress) {
  const campaignCount = await publicClient.readContract({
    address: factoryAddress,
    abi: FACTORY_ABI,
    functionName: "campaignCount",
  });

  const total = Number(campaignCount || 0n);

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

  return addresses;
}

export async function loadActiveChainCampaigns({
  publicClient,
  chainId,
  graphClient,
}) {
  const factoryAddress = getFactoryAddress(chainId);

  if (!publicClient || !factoryAddress) {
    return [];
  }

  let graphCampaigns = [];

  try {
    const graphResponse = await requestCampaigns(graphClient);
    graphCampaigns = Array.isArray(graphResponse?.campaigns)
      ? graphResponse.campaigns.map((campaign) => normalizeGraphCampaign(campaign))
      : [];
  } catch {
    graphCampaigns = [];
  }

  let factoryCampaignAddresses = [];
  let factoryReadSucceeded = false;

  try {
    factoryCampaignAddresses = await readFactoryCampaignAddresses(
      publicClient,
      factoryAddress
    );
    factoryReadSucceeded = true;
  } catch {
    factoryCampaignAddresses = [];
  }

  if (!factoryReadSucceeded) {
    return Number(chainId) === Number(DEFAULT_CHAIN_ID) ? graphCampaigns : [];
  }

  if (factoryCampaignAddresses.length === 0) {
    return [];
  }

  const normalizedFactoryAddresses = factoryCampaignAddresses.map((address) =>
    String(address).toLowerCase()
  );
  const factoryAddressSet = new Set(normalizedFactoryAddresses);
  const filteredGraphCampaigns = factoryAddressSet.size
    ? graphCampaigns.filter((campaign) =>
        factoryAddressSet.has(String(campaign.address || "").toLowerCase())
      )
    : graphCampaigns;
  const onchainCampaigns = await Promise.all(
    factoryCampaignAddresses.map(async (address) => {
      try {
        return await readOnchainCampaign(publicClient, address, chainId);
      } catch {
        return null;
      }
    })
  );

  const graphByAddress = new Map(
    filteredGraphCampaigns.map((campaign) => [
      String(campaign.address || "").toLowerCase(),
      campaign,
    ])
  );
  const onchainByAddress = new Map(
    onchainCampaigns
      .filter(Boolean)
      .map((campaign) => [String(campaign.address || "").toLowerCase(), campaign])
  );

  return factoryCampaignAddresses
    .map((address) => {
      const normalizedAddress = String(address || "").toLowerCase();
      return mergeCampaignData(
        onchainByAddress.get(normalizedAddress) || null,
        graphByAddress.get(normalizedAddress) || null
      );
    })
    .filter(Boolean);
}
