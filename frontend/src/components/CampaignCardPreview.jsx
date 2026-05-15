import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useChainId } from "wagmi";
import useCountdown from "../hooks/useCountdown";
import {
  getFallbackCampaignContent,
  loadCampaignProfile,
  resolveAssetUrl,
} from "../utils/campaignRegistry";
import {
  FALLBACK_CAMPAIGN_MEDIA_URL,
  getCampaignExcerpt,
  getCampaignPreviewImageUrl,
  hasCampaignRenderablePreview,
} from "../utils/campaignPresentation";
import {
  getStoredCampaignChainId,
  rememberCampaignReference,
} from "../utils/campaignLocator";
import { DEFAULT_CHAIN_ID } from "../config/networks";
import TrustBadge from "./TrustBadge";

export default function CampaignCardPreview({ campaign }) {
  const chainId = useChainId();
  const resolvedChainId = Number(
    campaign?.chainId ||
      getStoredCampaignChainId(campaign?.address) ||
      chainId ||
      DEFAULT_CHAIN_ID
  );
  const embeddedMetadata =
    campaign?.metadata && typeof campaign.metadata === "object"
      ? campaign.metadata
      : null;
  const [meta, setMeta] = useState(
    () => embeddedMetadata || getFallbackCampaignContent(campaign?.address)
  );
  const [trust, setTrust] = useState(() => campaign?.trust || null);
  const navigate = useNavigate();
  const previewImage = getCampaignPreviewImageUrl(meta, {
    resolveImageUrl: resolveAssetUrl,
  });

  useEffect(() => {
    let isCancelled = false;
    const fallback = getFallbackCampaignContent(campaign?.address);
    const nextEmbeddedMetadata =
      campaign?.metadata && typeof campaign.metadata === "object"
        ? campaign.metadata
        : null;
    const nextEmbeddedTrust = campaign?.trust || null;
    const hasEmbeddedMetadata =
      nextEmbeddedMetadata && Object.keys(nextEmbeddedMetadata).length > 0;
    const shouldHydrateProfile =
      !hasEmbeddedMetadata || !hasCampaignRenderablePreview(nextEmbeddedMetadata);
    const initialMetadata = hasEmbeddedMetadata ? nextEmbeddedMetadata : fallback;

    setMeta(initialMetadata);
    setTrust(nextEmbeddedTrust);

    if (hasEmbeddedMetadata && campaign?.address) {
      rememberCampaignReference(
        campaign.address,
        resolvedChainId,
        campaign?.ipfsHash || ""
      );
    }

    if (!shouldHydrateProfile) {
      return () => {
        isCancelled = true;
      };
    }

    async function loadProfile() {
      if (!campaign?.address) {
        setMeta(fallback);
        setTrust(nextEmbeddedTrust);
        return;
      }

      const profile = await loadCampaignProfile(campaign.address, resolvedChainId);

      if (isCancelled) {
        return;
      }

      setMeta(
        profile.metadata && Object.keys(profile.metadata).length > 0
          ? profile.metadata
          : initialMetadata
      );
      setTrust(profile.trust || null);
      rememberCampaignReference(
        campaign.address,
        resolvedChainId,
        profile.metadataURI || profile.ipfsHash || ""
      );
    }

    loadProfile();

    return () => {
      isCancelled = true;
    };
  }, [
    campaign?.address,
    campaign?.ipfsHash,
    campaign?.metadata,
    campaign?.trust,
    resolvedChainId,
  ]);

  const raised = campaign?.raised || 0;
  const goal = campaign?.goal || 0;
  const progress = goal > 0 ? Math.min((raised / goal) * 100, 100) : 0;
  const timeLeft = useCountdown(campaign?.deadline || 0);
  const isSettled = campaign?.stateCode === 3 || campaign?.fundsClaimed;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.04 }}
      transition={{ duration: 0.4 }}
      onClick={() =>
        navigate(`/campaign/${campaign.address}?chainId=${resolvedChainId}`)
      }
      className="theme-card cursor-pointer overflow-hidden transition duration-300 hover:scale-[1.03] hover:shadow-xl"
    >
      <div className="relative">
        {isSettled && (
          <div className="absolute right-3 top-3 z-10 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-slate-900 shadow-md">
            Settled
          </div>
        )}

        <img
          src={previewImage}
          alt={meta.headline || "Campaign"}
          loading="lazy"
          decoding="async"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = FALLBACK_CAMPAIGN_MEDIA_URL;
          }}
          className="h-48 w-full bg-slate-100 object-cover dark:bg-slate-900"
        />
      </div>

      <div className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="theme-heading truncate text-lg font-semibold">
            {meta.headline ||
              `Campaign ${
                campaign.address ? campaign.address.slice(0, 6) : "0x0000"
              }...`}
          </h3>

          <TrustBadge trust={trust} compact />
        </div>

        <p className="theme-muted text-xs">
          {getCampaignExcerpt(meta, 84) || "No description"}
        </p>

        <div className="theme-muted text-xs">
          Creator:{" "}
          {campaign.creator
            ? `${campaign.creator.slice(0, 6)}...${campaign.creator.slice(-4)}`
            : "Unknown"}
        </div>

        <div className="theme-muted text-xs">Time Left: {timeLeft || "Loading..."}</div>

        <div className="mb-1 flex justify-between text-sm">
          <span className="text-green-400">${raised.toFixed(2)}</span>
          <span className="theme-muted">${goal.toFixed(2)}</span>
        </div>

        <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className="h-full bg-green-400"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="theme-muted flex items-center justify-between text-xs">
          <span>View Details</span>
          <span>{Math.floor(progress)}%</span>
        </div>
      </div>
    </motion.div>
  );
}
