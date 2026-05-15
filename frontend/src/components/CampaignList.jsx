import { useEffect, useState } from "react";
import { useChainId, usePublicClient } from "wagmi";

import CampaignCardPreview from "./CampaignCardPreview";
import { useApp } from "../providers/AppProvider";
import { getGraphClient } from "../graphql/client";
import { loadActiveChainCampaigns } from "../utils/activeChainCampaigns";
import { requestCampaignFeed } from "../utils/campaignFeed";

const EMPTY_COUNTS = {
  ALL: 0,
  ACTIVE: 0,
  SUCCESSFUL: 0,
  FAILED: 0,
  SETTLED: 0,
};

function getResolvedLimit(limit, filter) {
  if (limit) {
    return limit;
  }

  if (filter === "SUCCESSFUL" || filter === "FAILED" || filter === "SETTLED") {
    return 20;
  }

  return 24;
}

function getResolvedSort(sort, filter) {
  if (filter === "SUCCESSFUL" || filter === "FAILED" || filter === "SETTLED") {
    return "NEW";
  }

  return sort;
}

export default function CampaignList({
  sort = "TRENDING",
  limit,
  hideFilters,
  showTrending = false,
}) {
  const { setCampaigns: setAppCampaigns } = useApp() || {};
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const graphClient = getGraphClient(chainId);
  const [campaignData, setCampaignData] = useState([]);
  const [campaignCounts, setCampaignCounts] = useState(EMPTY_COUNTS);
  const [trendingCampaigns, setTrendingCampaigns] = useState([]);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    let cancelled = false;

    async function refreshCampaigns() {
      try {
        const response = await requestCampaignFeed({
          chainId,
          state: filter,
          sort: getResolvedSort(sort, filter),
          limit: getResolvedLimit(limit, filter),
        });

        if (cancelled || !response) {
          return;
        }

        const nextItems = Array.isArray(response.items) ? response.items : [];
        setCampaignData(nextItems);
        setCampaignCounts(response.counts || EMPTY_COUNTS);
        setTrendingCampaigns(
          Array.isArray(response.trending) ? response.trending : []
        );

        if (setAppCampaigns) {
          setAppCampaigns(nextItems);
        }

        return;
      } catch (error) {
        console.log("Campaign feed error:", error);
      }

      try {
        const fallbackCampaigns = await loadActiveChainCampaigns({
          publicClient,
          chainId,
          graphClient,
        });

        if (cancelled) {
          return;
        }

        setCampaignData(Array.isArray(fallbackCampaigns) ? fallbackCampaigns : []);
        setCampaignCounts({
          ...EMPTY_COUNTS,
          ALL: Array.isArray(fallbackCampaigns) ? fallbackCampaigns.length : 0,
          ACTIVE: Array.isArray(fallbackCampaigns) ? fallbackCampaigns.length : 0,
        });
        setTrendingCampaigns(
          Array.isArray(fallbackCampaigns) ? fallbackCampaigns.slice(0, 3) : []
        );

        if (setAppCampaigns) {
          setAppCampaigns(Array.isArray(fallbackCampaigns) ? fallbackCampaigns : []);
        }
      } catch (fallbackError) {
        console.log("Campaign fallback error:", fallbackError);
      }
    }

    void refreshCampaigns();

    const refetch = setInterval(() => {
      void refreshCampaigns();
    }, 30000);

    const handleUpdate = (event) => {
      if (
        event?.detail?.chainId &&
        Number(event.detail.chainId) !== Number(chainId)
      ) {
        return;
      }

      void refreshCampaigns();
    };

    window.addEventListener("campaign-updated", handleUpdate);

    return () => {
      cancelled = true;
      clearInterval(refetch);
      window.removeEventListener("campaign-updated", handleUpdate);
    };
  }, [chainId, filter, graphClient, hideFilters, limit, publicClient, setAppCampaigns, sort]);

  return (
    <div>
      {!hideFilters && (
        <>
          {showTrending && (
          <div className="mb-10">
            <h2 className="theme-heading mb-4 flex items-center gap-2 text-xl font-semibold">
              Trending Campaigns
              <span className="theme-muted text-xs">(Top performing right now)</span>
            </h2>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {trendingCampaigns.map((campaign) => (
                <div key={campaign.address} className="transition hover:scale-[1.02]">
                  <CampaignCardPreview campaign={campaign} />
                </div>
              ))}
            </div>
          </div>
          )}

          <div className="mb-6 flex flex-wrap gap-2 overflow-x-auto">
            {[
              ["ALL", "All"],
              ["ACTIVE", "Active"],
              ["SUCCESSFUL", "Successful"],
              ["FAILED", "Failed"],
              ["SETTLED", "Settled"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  filter === key
                    ? "border-emerald-500 bg-emerald-500 text-white shadow-[0_12px_24px_rgba(16,185,129,0.18)]"
                    : "border-slate-300 bg-white/90 text-slate-800 hover:border-emerald-300 hover:bg-white dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-100 dark:hover:border-emerald-400/50 dark:hover:bg-slate-800"
                }`}
              >
                {label} ({campaignCounts[key] ?? 0})
              </button>
            ))}
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
        {campaignData.map((campaign) => (
          <CampaignCardPreview key={campaign.address} campaign={campaign} />
        ))}
      </div>
    </div>
  );
}
