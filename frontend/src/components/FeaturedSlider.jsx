import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useChainId, usePublicClient } from "wagmi";
import { getGraphClient } from "../graphql/client";
import { getCampaignState } from "../utils/campaignStatus";
import useCountdown from "../hooks/useCountdown";
import {
  loadCampaignProfile,
  resolveAssetUrl,
} from "../utils/campaignRegistry";
import { loadActiveChainCampaigns } from "../utils/activeChainCampaigns";
import { requestCampaignFeed } from "../utils/campaignFeed";
import {
  getCampaignExcerpt,
  getCampaignMediaImages,
} from "../utils/campaignPresentation";
import TrustBadge from "./TrustBadge";

const FEATURED_FEED_STEPS = [
  { state: "ACTIVE", sort: "TRENDING", limit: 5 },
  { state: "ALL", sort: "TRENDING", limit: 5 },
  { state: "SUCCESSFUL", sort: "LATEST", limit: 5 },
  { state: "FAILED", sort: "LATEST", limit: 5 },
];

function mergePreviewContent(primary = {}, fallback = {}) {
  return {
    ...fallback,
    ...primary,
    images:
      getCampaignMediaImages(primary).length > 0
        ? getCampaignMediaImages(primary)
        : getCampaignMediaImages(fallback),
    youtube: primary?.youtube || fallback?.youtube || "",
  };
}

function getProfileKey(chainId, address) {
  return `${chainId}:${String(address || "").toLowerCase()}`;
}

function hasCampaignImagePreview(content = {}) {
  return Boolean(getCampaignMediaImages(content)[0]);
}

function getCampaignImageUrl(content = {}) {
  const primaryImage = getCampaignMediaImages(content)[0];
  return primaryImage ? resolveAssetUrl(primaryImage) : "";
}

async function requestFeaturedCampaigns(chainId) {
  for (const step of FEATURED_FEED_STEPS) {
    try {
      const feed = await requestCampaignFeed({
        chainId,
        state: step.state,
        sort: step.sort,
        limit: step.limit,
      });

      if (Array.isArray(feed?.items) && feed.items.length > 0) {
        return feed;
      }
    } catch (error) {
      console.log(`Featured ${step.state.toLowerCase()} feed error:`, error);
    }
  }

  return null;
}

function selectFeaturedCampaigns(items = [], profiles = {}, chainId) {
  const imageBackedCampaigns = items.filter((campaign) => {
    const profile =
      profiles[getProfileKey(campaign?.chainId || chainId, campaign?.address)] ||
      {};
    const mergedContent = mergePreviewContent(
      campaign?.metadata && typeof campaign.metadata === "object"
        ? campaign.metadata
        : {},
      profile.metadata || {}
    );

    return hasCampaignImagePreview(mergedContent);
  });

  return imageBackedCampaigns.length > 0 ? imageBackedCampaigns : items;
}

export default function FeaturedSlider() {
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const [campaigns, setCampaigns] = useState([]);
  const [index, setIndex] = useState(0);
  const [profiles, setProfiles] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const graphClient = getGraphClient(chainId);
  const current = campaigns[index] || null;
  const currentProfileKey = current
    ? getProfileKey(current?.chainId || chainId, current.address)
    : "";
  const currentProfile = current ? profiles[currentProfileKey] || {} : {};
  const currentFeedMetadata =
    current?.metadata && typeof current.metadata === "object"
      ? current.metadata
      : {};
  const content = mergePreviewContent(
    currentFeedMetadata,
    currentProfile.metadata || {}
  );
  const trust = current?.trust || currentProfile.trust || null;
  const currentImageUrl = getCampaignImageUrl(content);
  const timeLeft = useCountdown(current?.deadline || 0);
  const completionPercent =
    current?.goal > 0 ? Math.min((current.raised / current.goal) * 100, 100) : 0;

  useEffect(() => {
    setCampaigns([]);
    setProfiles({});
    setIndex(0);
    loadCampaigns();

    const interval = setInterval(() => {
      loadCampaigns();
    }, 30000);

    const handleUpdate = (event) => {
      if (
        event?.detail?.chainId &&
        Number(event.detail.chainId) !== Number(chainId)
      ) {
        return;
      }

      loadCampaigns();
    };

    window.addEventListener("campaign-updated", handleUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener("campaign-updated", handleUpdate);
    };
  }, [chainId, publicClient]);

  async function loadCampaigns() {
    try {
      setIsLoading(true);
      const feed = await requestFeaturedCampaigns(chainId);

      if (Array.isArray(feed?.items) && feed.items.length > 0) {
        const profileEntries = await Promise.all(
          feed.items.map(async (campaign) => [
            getProfileKey(campaign?.chainId || chainId, campaign.address),
            await loadCampaignProfile(
              campaign.address,
              campaign?.chainId || chainId
            ),
          ])
        );
        const nextProfiles = Object.fromEntries(profileEntries);
        const nextCampaigns = selectFeaturedCampaigns(
          feed.items,
          nextProfiles,
          chainId
        );

        setProfiles(nextProfiles);
        setCampaigns(nextCampaigns);

        if (index >= nextCampaigns.length && nextCampaigns.length > 0) {
          setIndex(0);
        }

        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const data = await loadActiveChainCampaigns({
        publicClient,
        chainId,
        graphClient,
      });

      const topCampaigns = data
        .filter((campaign) => getCampaignState(campaign, now) === "ACTIVE")
        .sort((a, b) => b.raised - a.raised)
        .slice(0, 5);

      const profileEntries = await Promise.all(
        topCampaigns.map(async (campaign) => [
          getProfileKey(chainId, campaign.address),
          await loadCampaignProfile(campaign.address, chainId),
        ])
      );
      const nextProfiles = Object.fromEntries(profileEntries);
      const nextCampaigns = selectFeaturedCampaigns(
        topCampaigns,
        nextProfiles,
        chainId
      );

      setProfiles(nextProfiles);
      setCampaigns(nextCampaigns);

      if (index >= nextCampaigns.length && nextCampaigns.length > 0) {
        setIndex(0);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (campaigns.length === 0) return undefined;

    const interval = setInterval(() => {
      setIndex((previous) => (previous + 1) % campaigns.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [campaigns]);

  if (isLoading && campaigns.length === 0) {
    return <div className="theme-muted text-center">Loading...</div>;
  }

  if (campaigns.length === 0 || !current) {
    return (
      <div className="theme-card-soft flex h-[500px] items-center justify-center rounded-3xl p-8 text-center sm:h-[420px]">
        <div>
          <h3 className="theme-heading text-xl font-semibold">
            No featured campaigns available
          </h3>
          <p className="theme-muted mt-2 text-sm">
            This section will automatically fill with live or recently finished
            campaigns as soon as they are available in the index.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[500px] w-full overflow-hidden rounded-[32px] border border-slate-200/80 shadow-[0_28px_80px_rgba(15,23,42,0.24)] dark:border-slate-700/80 dark:shadow-[0_28px_90px_rgba(2,6,23,0.42)] sm:h-[420px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 cursor-pointer"
          onClick={() =>
            navigate(
              `/campaign/${current.address}?chainId=${current?.chainId || chainId}`
            )
          }
        >
          <div
            className="absolute inset-0 scale-[1.06] bg-cover blur-lg"
            style={{
              backgroundImage: currentImageUrl
                ? `url(${currentImageUrl})`
                : "linear-gradient(135deg, rgba(15,23,42,1), rgba(30,41,59,1))",
              backgroundPosition: "center 18%",
            }}
          />

          <div
            className="absolute inset-0 bg-cover"
            style={{
              backgroundImage: currentImageUrl
                ? `url(${currentImageUrl})`
                : "linear-gradient(135deg, rgba(15,23,42,1), rgba(30,41,59,1))",
              backgroundPosition: "center 18%",
            }}
          />

          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/82 to-slate-950/28" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 24% 46%, rgba(15, 23, 42, 0.26), transparent 34%)",
            }}
          />

          <div className="relative z-10 flex h-full items-start p-4 sm:items-center md:p-6 lg:p-7">
            <div className="relative w-full max-w-[43rem] overflow-hidden rounded-[30px] border border-white/14 bg-slate-950/72 px-4 py-4 shadow-[0_24px_70px_rgba(2,6,23,0.46)] backdrop-blur-2xl sm:px-5 sm:py-5 md:px-6 md:py-5">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(2, 6, 23, 0.92), rgba(15, 23, 42, 0.84) 56%, rgba(30, 41, 59, 0.72))",
                }}
              />

              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at top left, rgba(148, 163, 184, 0.18), transparent 34%)",
                }}
              />

              <div className="relative flex flex-col gap-3 sm:gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2
                    className="max-w-full pr-2 text-[clamp(1.15rem,7vw,2rem)] font-bold leading-[1.12] text-white [text-shadow:0_6px_18px_rgba(2,6,23,0.42)] sm:max-w-[28rem] sm:pr-3 sm:text-[clamp(1.2rem,2.35vw,2.1rem)]"
                    style={{
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 2,
                      overflow: "hidden",
                    }}
                  >
                    {content.headline || "Featured Campaign"}
                  </h2>
                  <div className="rounded-full bg-slate-950/52 p-0.5 backdrop-blur-md">
                    <TrustBadge trust={trust} />
                  </div>
                </div>

                <p
                  className="max-w-full text-[13px] leading-5 text-slate-100/88 sm:max-w-[32rem] sm:text-sm sm:leading-6"
                  style={{
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 2,
                    overflow: "hidden",
                  }}
                >
                  {getCampaignExcerpt(content, 170) ||
                    "Open the campaign to view the full story and trust signals."}
                </p>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-white/14 bg-slate-900/72 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-4 sm:py-3">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                      Raised
                    </div>
                    <div className="mt-1 text-sm font-semibold text-emerald-300 sm:mt-1.5 sm:text-lg">
                      ${current.raised.toFixed(2)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/14 bg-slate-900/72 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-4 sm:py-3">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                      Goal
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white sm:mt-1.5 sm:text-lg">
                      ${current.goal.toFixed(2)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/14 bg-slate-900/72 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-4 sm:py-3">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                      Time Left
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white sm:mt-1.5 sm:text-lg">
                      {timeLeft}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-slate-400">
                    <span>Progress</span>
                    <span>{Math.floor(completionPercent)}%</span>
                  </div>

                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800/95 ring-1 ring-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-teal-400"
                      style={{
                        width: `${completionPercent}%`,
                      }}
                    />
                  </div>

                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(
                        `/campaign/${current.address}?chainId=${
                          current?.chainId || chainId
                        }`
                      );
                    }}
                    className="inline-flex w-fit items-center rounded-2xl bg-white/95 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:scale-[1.02] hover:bg-white sm:px-5 sm:text-base"
                  >
                    View Campaign
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
        {campaigns.map((_, itemIndex) => (
          <div
            key={itemIndex}
            className={`h-2 w-2 rounded-full transition ${
              itemIndex === index ? "scale-125 bg-white" : "bg-white/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
