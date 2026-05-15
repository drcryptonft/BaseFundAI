import { useEffect, useState } from "react";
import { gql } from "graphql-request";
import { usePublicClient } from "wagmi";
import { getGraphClient } from "../graphql/client";
import { loadCampaignContributorStats } from "../utils/campaignContributors";

const GET_BACKERS = gql`
  query ($id: ID!) {
    campaignContributors(
      where: { campaign: $id, refunded: false }
      orderBy: totalContributed
      orderDirection: desc
    ) {
      id
      contributor
      totalContributed
      contributionCount
      refunded
    }
  }
`;

function normalizeBackers(items = []) {
  return [...items]
    .filter((backer) => !backer?.refunded && backer?.contributor)
    .sort((left, right) => Number(right.totalContributed || 0) - Number(left.totalContributed || 0));
}

function getPreferredBackers(indexedBackers = [], fallbackStats = null) {
  const fallbackBackers = normalizeBackers(fallbackStats?.activeContributors || []);

  if (fallbackBackers.length > 0 || indexedBackers.length === 0) {
    return fallbackBackers;
  }

  return normalizeBackers(indexedBackers);
}

function mergeOptimisticBackers(items = [], optimisticUpdate, campaignId) {
  const normalized = normalizeBackers(items);

  if (!optimisticUpdate?.contributorAddress) {
    return normalized;
  }

  const contributorAddress = String(optimisticUpdate.contributorAddress || "").toLowerCase();
  const hasIndexedContributor = normalized.some(
    (backer) => String(backer.contributor || "").toLowerCase() === contributorAddress
  );

  if (hasIndexedContributor) {
    return normalized;
  }

  const contributionAmountRaw = BigInt(
    optimisticUpdate.contributionAmountRaw ||
      Math.round(Number(optimisticUpdate.contributionDelta || 0) * 1e6)
  );

  return normalizeBackers([
    {
      id: `optimistic-${String(campaignId).toLowerCase()}-${optimisticUpdate.txHash || contributorAddress}`,
      contributor: optimisticUpdate.contributorAddress,
      totalContributed: contributionAmountRaw.toString(),
      contributionCount: 1,
      refunded: false,
    },
    ...normalized,
  ]);
}

export default function BackerList({
  campaignId,
  chainId,
  createdAtBlock,
  prefetchedStats,
  optimisticUpdate,
}) {
  const [backers, setBackers] = useState(() =>
    normalizeBackers(prefetchedStats?.activeContributors || [])
  );
  const [loading, setLoading] = useState(false);
  const graphClient = getGraphClient(chainId);
  const publicClient = usePublicClient({ chainId });
  const hasCreatedAtBlock =
    createdAtBlock !== undefined && createdAtBlock !== null && createdAtBlock !== "";
  const canLoadFallbackStats = Boolean(publicClient && hasCreatedAtBlock);

  useEffect(() => {
    const prefetchedBackers = normalizeBackers(prefetchedStats?.activeContributors || []);

    if (prefetchedBackers.length > 0) {
      setBackers((currentBackers) =>
        currentBackers.length > 0 ? currentBackers : prefetchedBackers
      );
    }
  }, [campaignId, prefetchedStats]);

  useEffect(() => {
    if (!campaignId) {
      setBackers([]);
      return undefined;
    }

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const shouldForceFallbackRefresh =
          canLoadFallbackStats &&
          (!prefetchedStats || !Array.isArray(prefetchedStats.activeContributors));
        const [indexedResult, fallbackStats] = await Promise.all([
          graphClient
            ? graphClient.request(GET_BACKERS, {
                id: campaignId.toLowerCase(),
              })
            : Promise.resolve(null),
          canLoadFallbackStats
            ? loadCampaignContributorStats({
                publicClient,
                campaignAddress: campaignId,
                chainId,
                createdAtBlock,
                force: shouldForceFallbackRefresh,
              })
            : Promise.resolve(null),
        ]);

        if (!cancelled) {
          setBackers(
            mergeOptimisticBackers(
              getPreferredBackers(
                indexedResult?.campaignContributors || [],
                fallbackStats || prefetchedStats
              ),
              optimisticUpdate,
              campaignId
            )
          );
        }
      } catch (err) {
        console.log("Backer list error:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [
    campaignId,
    canLoadFallbackStats,
    chainId,
    createdAtBlock,
    graphClient,
    optimisticUpdate,
    prefetchedStats,
    publicClient,
  ]);

  useEffect(() => {
    if (!campaignId || !optimisticUpdate?.contributorAddress) {
      return undefined;
    }

    let cancelled = false;
    const contributorAddress = String(optimisticUpdate.contributorAddress || "").toLowerCase();
    const contributionAmountRaw = BigInt(
      optimisticUpdate.contributionAmountRaw ||
        Math.round(Number(optimisticUpdate.contributionDelta || 0) * 1e6)
    );

    setBackers((current) => {
      const existingIndex = current.findIndex(
        (backer) => String(backer.contributor || "").toLowerCase() === contributorAddress
      );

      if (existingIndex === -1) {
        return normalizeBackers([
          {
            id: `optimistic-${String(campaignId).toLowerCase()}-${optimisticUpdate.txHash || contributorAddress}`,
            contributor: optimisticUpdate.contributorAddress,
            totalContributed: contributionAmountRaw.toString(),
            contributionCount: 1,
            refunded: false,
          },
          ...current,
        ]);
      }

      return normalizeBackers(
        current.map((backer, index) =>
          index === existingIndex
            ? {
                ...backer,
                totalContributed: (
                  BigInt(backer.totalContributed || 0) + contributionAmountRaw
                ).toString(),
                contributionCount: Number(backer.contributionCount || 0) + 1,
                refunded: false,
              }
            : backer
        )
      );
    });

    async function syncIndexedBackers() {
      const retryDelays = [1200, 2600, 5200];

      for (const delay of retryDelays) {
        await new Promise((resolve) => setTimeout(resolve, delay));

        if (cancelled) {
          return;
        }

        try {
          const [indexedResult, fallbackStats] = await Promise.all([
            graphClient
              ? graphClient.request(GET_BACKERS, {
                  id: campaignId.toLowerCase(),
                })
              : Promise.resolve(null),
            canLoadFallbackStats
              ? loadCampaignContributorStats({
                  publicClient,
                  campaignAddress: campaignId,
                  chainId,
                  createdAtBlock,
                  force: true,
                })
              : Promise.resolve(null),
          ]);

          if (!cancelled) {
            setBackers(
              mergeOptimisticBackers(
                getPreferredBackers(
                  indexedResult?.campaignContributors || [],
                  fallbackStats || prefetchedStats
                ),
                optimisticUpdate,
                campaignId
              )
            );
          }
        } catch (error) {
          console.log("Backer sync error:", error);
        }
      }
    }

    void syncIndexedBackers();

    return () => {
      cancelled = true;
    };
  }, [
    campaignId,
    canLoadFallbackStats,
    chainId,
    createdAtBlock,
    graphClient,
    optimisticUpdate,
    prefetchedStats,
    publicClient,
  ]);

  return (
    <div className="space-y-5">
      <div>
        <p className="theme-muted text-xs uppercase tracking-[0.24em]">
          Community Support
        </p>
        <h3 className="theme-heading mt-2 text-xl font-semibold">Recent backers</h3>
      </div>

      {loading && backers.length === 0 ? (
        <div className="theme-card-soft rounded-2xl p-5 text-sm">
          <div className="theme-heading font-semibold">Loading backers</div>
          <p className="theme-muted mt-2">
            Pulling recent contribution activity for this campaign.
          </p>
        </div>
      ) : backers.length === 0 ? (
        <div className="theme-card-soft rounded-2xl p-5 text-sm">
          <div className="theme-heading font-semibold">No backers yet</div>
          <p className="theme-muted mt-2">
            This campaign is ready for its first supporter. Early contributors set
            the trust signal for everyone who visits next.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {backers.map((backer, index) => (
            <div
              key={backer.id}
              className="theme-card-soft flex items-center justify-between rounded-2xl px-4 py-3 text-sm"
            >
              <div>
                <div className="theme-heading font-semibold">
                  Backer {index + 1}
                </div>
                <div className="theme-muted mt-1">
                  {backer.contributor.slice(0, 6)}...{backer.contributor.slice(-4)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                  ${(Number(backer.totalContributed) / 1e6).toFixed(2)}
                </div>
                <div className="theme-muted mt-1 text-xs">
                  {backer.contributionCount || 1} contribution
                  {Number(backer.contributionCount || 1) > 1 ? "s" : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
