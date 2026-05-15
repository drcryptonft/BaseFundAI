import { useEffect, useState } from "react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { useApp } from "../providers/AppProvider";
import { getGraphClient } from "../graphql/client";
import { requestUserContributions } from "../graphql/queries";
import { CAMPAIGN_ABI } from "../contracts";
import {
  toBool,
  toNumber,
  toSeconds,
  toUsdc,
} from "../utils/campaignStatus";
import { getCampaignActionStatus } from "../utils/campaignActionStatus";
import { loadActiveChainCampaigns } from "../utils/activeChainCampaigns";
import { requestCampaignFeed } from "../utils/campaignFeed";

function normalizeCampaign(raw = {}, fallbackChainId = 0) {
  const normalizedChainId = Number(raw.chainId || fallbackChainId || 0);
  const goal =
    typeof raw.goal === "number" ? raw.goal : toUsdc(raw.goal, normalizedChainId);
  const raised =
    typeof raw.raised === "number" ? raw.raised : toUsdc(raw.raised, normalizedChainId);

  return {
    ...raw,
    chainId: normalizedChainId,
    address: raw.address || raw.id || "",
    creator: raw.creator || "",
    goal,
    raised,
    deadline: toSeconds(raw.deadline),
    finalized: toBool(raw.finalized),
    successful: toBool(raw.successful),
    stateCode:
      raw.stateCode !== undefined && raw.stateCode !== null
        ? toNumber(raw.stateCode)
        : null,
    createdAtBlock: toNumber(raw.createdAtBlock),
    contributionCount: toNumber(raw.contributionCount),
    backerCount: toNumber(raw.backerCount),
    fundsClaimed: toBool(raw.fundsClaimed),
    refundsClaimedCount: toNumber(raw.refundsClaimedCount),
  };
}

function normalizeCampaignCollection(items = [], chainId = 0) {
  const campaignsByAddress = new Map();

  for (const item of items) {
    const campaign = normalizeCampaign(item, chainId);

    if (!campaign.address) {
      continue;
    }

    campaignsByAddress.set(campaign.address.toLowerCase(), campaign);
  }

  return [...campaignsByAddress.values()].sort(
    (a, b) => b.createdAtBlock - a.createdAtBlock
  );
}

function mergeCampaignCollections(collections = [], chainId = 0) {
  const merged = [];

  for (const collection of collections) {
    if (Array.isArray(collection) && collection.length > 0) {
      merged.push(...collection);
    }
  }

  return normalizeCampaignCollection(merged, chainId);
}

function mergeWalletStatus(campaign, walletAddress) {
  if (!campaign?.address || !walletAddress) return campaign;

  const localStatus = getCampaignActionStatus(campaign.address, walletAddress);

  return {
    ...campaign,
    fundsClaimed: toBool(campaign.fundsClaimed) || Boolean(localStatus.fundsClaimed),
  };
}

function buildCampaignMap(campaigns = [], walletAddress = "") {
  return new Map(
    campaigns.map((campaign) => [
      campaign.address.toLowerCase(),
      mergeWalletStatus(campaign, walletAddress),
    ])
  );
}

function getContributionAddresses(campaignContributors = []) {
  return [...new Set(
    campaignContributors
      .map((item) => String(item?.campaign?.id || "").trim())
      .filter(Boolean)
  )];
}

function mapUserContributions({
  campaignContributors = [],
  campaignMap,
  address,
  chainId,
}) {
  return campaignContributors.map((item) => {
    const campaignAddress = item.campaign?.id || "";
    const campaignFromQuery =
      item.campaign && Object.keys(item.campaign).length > 1
        ? normalizeCampaign(item.campaign, chainId)
        : null;
    const walletStatus = getCampaignActionStatus(campaignAddress, address);
    const mergedCampaign =
      mergeWalletStatus(
        campaignFromQuery ||
          campaignMap.get(campaignAddress.toLowerCase()) || {
            address: campaignAddress,
            chainId,
          },
        address
      ) || null;

    return {
      id: item.id || `${campaignAddress}-${address.toLowerCase()}`,
      campaign: campaignAddress,
      campaignData: mergedCampaign,
      amount: toUsdc(item.totalContributed, chainId),
      contributionCount: toNumber(item.contributionCount),
      refunded: toBool(item.refunded) || Boolean(walletStatus.refundClaimed),
      refundClaimed: toBool(item.refunded) || Boolean(walletStatus.refundClaimed),
      hasUserContributed:
        toUsdc(item.totalContributed, chainId) > 0 ||
        toNumber(item.contributionCount) > 0 ||
        Boolean(walletStatus.refundClaimed),
    };
  });
}

async function scanOnchainContributions({
  campaigns = [],
  address,
  chainId,
  publicClient,
}) {
  const contributions = await Promise.all(
    campaigns.map(async (campaign) => {
      try {
        const amount = await publicClient.readContract({
          address: campaign.address,
          abi: CAMPAIGN_ABI,
          functionName: "contributions",
          args: [address],
        });

        if (amount <= 0n) {
          return null;
        }

        const walletStatus = getCampaignActionStatus(campaign.address, address);

        return {
          id: `${campaign.address}-${address.toLowerCase()}`,
          campaign: campaign.address,
          campaignData: mergeWalletStatus(campaign, address),
          amount: toUsdc(amount, chainId),
          contributionCount: 1,
          refunded: Boolean(walletStatus.refundClaimed),
          refundClaimed: Boolean(walletStatus.refundClaimed),
          hasUserContributed: true,
        };
      } catch {
        return null;
      }
    })
  );

  return contributions.filter(Boolean);
}

async function safeRequestUserContributions(graphClient, walletAddress) {
  try {
    return await requestUserContributions(graphClient, walletAddress.toLowerCase());
  } catch (error) {
    console.log("Dashboard contributions query error:", error);
    return {
      campaignContributors: [],
      graphMode: "unavailable",
    };
  }
}

export default function useDashboardData() {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const [loading, setLoading] = useState(false);
  const {
    setCampaigns,
    setUserCampaigns,
    setUserContributions,
  } = useApp();
  const graphClient = getGraphClient(chainId);

  useEffect(() => {
    if (!address) {
      setCampaigns([]);
      setUserCampaigns([]);
      setUserContributions([]);
      setLoading(false);
      return undefined;
    }

    let disposed = false;

    async function loadDashboardData() {
      try {
        setLoading(true);

        const contributionResponse = await safeRequestUserContributions(
          graphClient,
          address
        );
        const campaignContributors = contributionResponse?.campaignContributors || [];
        const contributionAddresses = getContributionAddresses(campaignContributors);

        try {
          const [createdFeedResponse, contributedFeedResponse] = await Promise.all([
            requestCampaignFeed({
              chainId,
              state: "ALL",
              sort: "NEW",
              limit: 200,
              creator: address,
            }),
            contributionAddresses.length > 0
              ? requestCampaignFeed({
                  chainId,
                  state: "ALL",
                  sort: "NEW",
                  limit: contributionAddresses.length,
                  addresses: contributionAddresses,
                })
              : Promise.resolve({ items: [] }),
          ]);

          if (disposed) {
            return;
          }

          let normalizedCampaigns = mergeCampaignCollections(
            [createdFeedResponse?.items, contributedFeedResponse?.items],
            chainId
          );

          let nextUserCampaigns = normalizedCampaigns
            .filter(
              (campaign) =>
                campaign.creator &&
                campaign.creator.toLowerCase() === address.toLowerCase()
            )
            .map((campaign) => mergeWalletStatus(campaign, address));
          let campaignMap = buildCampaignMap(normalizedCampaigns, address);
          let nextUserContributions = mapUserContributions({
            campaignContributors,
            campaignMap,
            address,
            chainId,
          });

          if (nextUserContributions.length === 0 && publicClient) {
            const fallbackCampaigns = await loadActiveChainCampaigns({
              publicClient,
              chainId,
              graphClient,
            });

            if (disposed) {
              return;
            }

            const normalizedFallbackCampaigns = normalizeCampaignCollection(
              fallbackCampaigns,
              chainId
            );

            normalizedCampaigns = mergeCampaignCollections(
              [normalizedCampaigns, normalizedFallbackCampaigns],
              chainId
            );
            campaignMap = buildCampaignMap(normalizedCampaigns, address);
            nextUserCampaigns = normalizedCampaigns
              .filter(
                (campaign) =>
                  campaign.creator &&
                  campaign.creator.toLowerCase() === address.toLowerCase()
              )
              .map((campaign) => mergeWalletStatus(campaign, address));
            nextUserContributions = await scanOnchainContributions({
              campaigns: normalizedFallbackCampaigns,
              address,
              chainId,
              publicClient,
            });
          }

          setCampaigns(normalizedCampaigns);
          setUserCampaigns(nextUserCampaigns);
          setUserContributions(nextUserContributions);
          return;
        } catch (feedError) {
          console.log("Dashboard feed error:", feedError);
        }

        const campaigns = await loadActiveChainCampaigns({
          publicClient,
          chainId,
          graphClient,
        });

        if (disposed) {
          return;
        }

        const normalizedCampaigns = normalizeCampaignCollection(campaigns, chainId);
        const nextUserCampaigns = normalizedCampaigns
          .filter(
            (campaign) =>
              campaign.creator &&
              campaign.creator.toLowerCase() === address.toLowerCase()
          )
          .map((campaign) => mergeWalletStatus(campaign, address));
        const campaignMap = buildCampaignMap(normalizedCampaigns, address);
        let nextUserContributions = mapUserContributions({
          campaignContributors,
          campaignMap,
          address,
          chainId,
        });

        if (nextUserContributions.length === 0 && publicClient) {
          nextUserContributions = await scanOnchainContributions({
            campaigns: normalizedCampaigns,
            address,
            chainId,
            publicClient,
          });
        }

        setCampaigns(normalizedCampaigns);
        setUserCampaigns(nextUserCampaigns);
        setUserContributions(nextUserContributions);
      } catch (error) {
        console.log("Dashboard data error:", error);
        if (!disposed) {
          setUserCampaigns([]);
          setUserContributions([]);
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    }

    void loadDashboardData();

    const interval = setInterval(() => {
      void loadDashboardData();
    }, 30000);

    const handleUpdate = (event) => {
      if (
        event?.detail?.chainId &&
        Number(event.detail.chainId) !== Number(chainId)
      ) {
        return;
      }

      void loadDashboardData();
    };

    window.addEventListener("campaign-updated", handleUpdate);

    return () => {
      disposed = true;
      clearInterval(interval);
      window.removeEventListener("campaign-updated", handleUpdate);
    };
  }, [
    address,
    chainId,
    publicClient,
    graphClient,
    setCampaigns,
    setUserCampaigns,
    setUserContributions,
  ]);

  return { loading };
}
