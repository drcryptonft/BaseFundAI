import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { decodeEventLog, parseUnits } from "viem";
import { useChainId, usePublicClient, useWalletClient } from "wagmi";
import toast from "react-hot-toast";
import {
  FACTORY_ABI,
  getFactoryAddress,
  getFundingTokenDecimals,
  getFundingTokenSymbol,
} from "../contracts";
import { uploadMetadata } from "../ipfs";
import TrustSummary from "./TrustSummary";
import {
  registerCampaignRecord,
  requestTrustPreview,
} from "../utils/campaignRegistry";
import {
  getChainLabel,
  isSupportedChain,
} from "../config/networks";
import {
  buildCampaignDescription,
  getYoutubeEmbedUrl,
} from "../utils/campaignPresentation";
import {
  computeMetadataHash,
  extractIpfsHash,
  isImmutableMetadataUri,
  toMetadataUri,
} from "../utils/metadataIntegrity";
import { rememberCampaignReference } from "../utils/campaignLocator";
import {
  MAX_SOURCE_IMAGE_BYTES,
  prepareCampaignImageDataUrl,
} from "../utils/imageUpload";
import { trackAppError, trackAppMetric } from "../utils/appMonitoring";
import SeoMeta from "./SeoMeta";

const initialSocials = {
  facebook: "",
  twitter: "",
  linkedin: "",
  telegram: "",
};

function findNestedError(error, predicate) {
  const visited = new Set();
  let current = error;

  while (current && typeof current === "object" && !visited.has(current)) {
    if (predicate(current)) {
      return current;
    }

    visited.add(current);
    current = current.cause;
  }

  return null;
}

function isUserRejectedRequest(error) {
  return Boolean(
    findNestedError(error, (candidate) => {
      const name = String(candidate?.name || "");
      const message = String(
        candidate?.shortMessage || candidate?.message || ""
      ).toLowerCase();

      return (
        name === "UserRejectedRequestError" ||
        candidate?.code === 4001 ||
        message.includes("user rejected") ||
        message.includes("user denied")
      );
    })
  );
}

function parseTransactionError(error) {
  const detailedError = findNestedError(
    error,
    (candidate) => Boolean(candidate?.shortMessage || candidate?.message)
  );

  return (
    detailedError?.shortMessage ||
    detailedError?.message ||
    error?.shortMessage ||
    error?.message ||
    "Campaign creation failed"
  );
}

function getGoalBand(goalValue) {
  if (!Number.isFinite(goalValue) || goalValue <= 0) {
    return "unknown";
  }

  if (goalValue < 100) {
    return "50_99";
  }

  if (goalValue < 500) {
    return "100_499";
  }

  return "500_plus";
}

export default function CreateCampaign() {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient({ chainId });
  const navigate = useNavigate();
  const factoryAddress = getFactoryAddress(chainId);
  const tokenDecimals = getFundingTokenDecimals(chainId);
  const tokenSymbol = getFundingTokenSymbol(chainId);

  const [headline, setHeadline] = useState("");
  const [problemStatement, setProblemStatement] = useState("");
  const [impactPlan, setImpactPlan] = useState("");
  const [goal, setGoal] = useState("");
  const [video, setVideo] = useState("");
  const [duration, setDuration] = useState("7");
  const [images, setImages] = useState([]);
  const [socials, setSocials] = useState(initialSocials);
  const [trustPreview, setTrustPreview] = useState(null);
  const [trustSnapshotKey, setTrustSnapshotKey] = useState("");
  const [trustLoading, setTrustLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const campaignDescription = buildCampaignDescription(problemStatement, impactPlan);

  function buildCreateMetricMetadata() {
    return {
      durationDays: Number(duration || 0),
      goalBand: getGoalBand(Number(goal || 0)),
      hasTrustPreview: Boolean(trustPreview),
      hasVideo: Boolean(String(video || "").trim()),
      imageCount: images.length,
    };
  }

  async function handleImageUpload(event) {
    const selectedFiles = Array.from(event.target.files || []);
    const remainingSlots = Math.max(0, 3 - images.length);

    if (remainingSlots === 0) {
      toast.error("You can upload up to 3 images");
      event.target.value = "";
      return;
    }

    if (selectedFiles.length > remainingSlots) {
      toast("Only the first 3 images will be kept.");
    }

    const files = selectedFiles.slice(0, remainingSlots);

    const optimizeToast = toast.loading("Optimizing images...");

    try {
      const results = await Promise.all(
        files.map(async (file) => {
          if (file.size > MAX_SOURCE_IMAGE_BYTES) {
            toast.error("Each source image must be 12MB or smaller");
            return null;
          }

          try {
            return await prepareCampaignImageDataUrl(file);
          } catch (error) {
            toast.error(error?.message || "Image optimization failed");
            return null;
          }
        })
      );
      const nextImages = results.filter(Boolean);

      setImages((currentImages) =>
        [...currentImages, ...nextImages].slice(0, 3)
      );

      if (nextImages.length > 0) {
        toast.success(
          `${nextImages.length} image${nextImages.length === 1 ? "" : "s"} ready`,
          { id: optimizeToast }
        );
      } else {
        toast.dismiss(optimizeToast);
      }
    } finally {
      event.target.value = "";
    }
  }

  function getSocialPayload() {
    return Object.fromEntries(
      Object.entries(socials).filter(([, value]) => String(value || "").trim())
    );
  }

  function buildTrustPayload() {
    return {
      chainId: Number(chainId || 0),
      walletAddress: walletClient?.account?.address || "",
      headline,
      description: campaignDescription,
      goal: Number(goal || 0),
      duration: Number(duration || 0),
      youtube: getYoutubeEmbedUrl(video),
      mediaCount: images.length,
      socials: getSocialPayload(),
    };
  }

  function getTrustSnapshotValue() {
    return JSON.stringify(buildTrustPayload());
  }

  function updateSocial(key, value) {
    setSocials((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function ensureCorrectNetwork() {
    if (!walletClient) {
      throw new Error("Connect wallet");
    }

    const connectedChainId = await walletClient.getChainId();

    if (!isSupportedChain(connectedChainId)) {
      throw new Error(
        `Switch to a supported network. Current: ${getChainLabel(connectedChainId)}`
      );
    }

    if (connectedChainId !== chainId) {
      throw new Error(`Switch wallet to ${getChainLabel(chainId)}`);
    }
  }

  async function runTrustPreview({ silent = false } = {}) {
    if (!walletClient?.account?.address) {
      if (!silent) {
        toast.error("Connect wallet to run trust preview");
      }
      return null;
    }

    if (!headline || !problemStatement || !impactPlan || !goal) {
      if (!silent) {
        toast.error("Add a headline, both story sections, and goal first");
      }
      return null;
    }

    setTrustLoading(true);

    try {
      const preview = await requestTrustPreview(buildTrustPayload());

      if (!preview) {
        if (!silent) {
          toast("Trust preview is unavailable right now. Launch can still continue.");
        }
        return null;
      }

      setTrustPreview(preview);
      setTrustSnapshotKey(getTrustSnapshotValue());

      if (!silent) {
        toast.success("Trust preview updated");
      }

      return preview;
    } finally {
      setTrustLoading(false);
    }
  }

  async function createCampaign() {
    let transactionConfirmed = false;
    let pendingToast = "";

    try {
      if (submitting) return;

      if (!walletClient) {
        toast.error("Connect wallet");
        return;
      }

      if (!publicClient) {
        toast.error("Wallet not ready");
        return;
      }

      if (!isSupportedChain(chainId) || !factoryAddress) {
        toast.error(
          `Switch to a supported network. Current: ${getChainLabel(chainId)}`
        );
        return;
      }

      if (!headline || !problemStatement || !impactPlan || !goal) {
        toast.error("Fill the headline, both story sections, and goal");
        return;
      }

      if (Number(duration) < 1 || Number(duration) > 30) {
        toast.error("Campaign duration must be between 1 and 30 days");
        return;
      }

      const goalValue = Number(goal || 0);

      if (goalValue < 50) {
        toast.error(`Goal must be at least 50 ${tokenSymbol}`);
        return;
      }

      if (goalValue > 1000) {
        toast.error(`Goal must be at most 1000 ${tokenSymbol}`);
        return;
      }

      trackAppMetric({
        eventType: "create_campaign",
        status: "started",
        chainId,
        metadata: buildCreateMetricMetadata(),
      });

      setSubmitting(true);
      pendingToast = toast.loading("Preparing campaign draft...");
      await ensureCorrectNetwork();

      let resolvedTrust = trustPreview;

      if (!resolvedTrust || trustSnapshotKey !== getTrustSnapshotValue()) {
        resolvedTrust = await runTrustPreview({ silent: true });
      }

      const metadata = {
        headline,
        problemStatement,
        impactPlan,
        description: campaignDescription,
        youtube: getYoutubeEmbedUrl(video),
        images,
        socials: getSocialPayload(),
        trust: resolvedTrust || undefined,
      };

      const uploadedMetadata = await uploadMetadata(metadata);
      const metadataURI = toMetadataUri(
        uploadedMetadata?.metadataURI ||
          uploadedMetadata?.reference ||
          uploadedMetadata?.ipfsHash
      );
      const ipfsHash =
        extractIpfsHash(metadataURI) ||
        extractIpfsHash(uploadedMetadata?.ipfsHash) ||
        extractIpfsHash(uploadedMetadata?.reference);
      const canonicalMetadata = uploadedMetadata?.metadata || metadata;

      if (!isImmutableMetadataUri(metadataURI)) {
        throw new Error(
          "Metadata upload did not return an immutable IPFS or Arweave URI. Please check the metadata service and try again."
        );
      }

      const metadataHash = computeMetadataHash(canonicalMetadata);
      const goalUnits = parseUnits(goal, tokenDecimals);

      await ensureCorrectNetwork();
      toast.loading("Confirm campaign creation in wallet", { id: pendingToast });

      const txHash = await walletClient.writeContract({
        address: factoryAddress,
        abi: FACTORY_ABI,
        functionName: "createCampaign",
        args: [
          {
            goal: goalUnits,
            durationInDays: Number(duration),
            metadataURI,
            metadataHash,
          },
        ],
        account: walletClient.account,
      });

      toast.loading("Campaign transaction submitted", { id: pendingToast });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status !== "success") {
        throw new Error("Campaign transaction failed");
      }

      transactionConfirmed = true;

      const creationLog = receipt.logs.find((log) => {
        try {
          const parsed = decodeEventLog({
            abi: FACTORY_ABI,
            data: log.data,
            topics: log.topics,
          });

          return parsed.eventName === "CampaignCreated";
        } catch {
          return false;
        }
      });

      let newCampaignAddress = "";

      if (creationLog) {
        const parsedLog = decodeEventLog({
          abi: FACTORY_ABI,
          data: creationLog.data,
          topics: creationLog.topics,
        });

        newCampaignAddress = parsedLog.args?.campaign || "";
      }

      if (!newCampaignAddress) {
        toast.error("Campaign address not found. Try again.", { id: pendingToast });
        return;
      }

      rememberCampaignReference(newCampaignAddress, chainId, metadataURI || ipfsHash);
      trackAppMetric({
        eventType: "create_campaign",
        status: "success",
        chainId,
        metadata: {
          ...buildCreateMetricMetadata(),
          hasTrustPreview: Boolean(resolvedTrust),
        },
      });

      try {
        await registerCampaignRecord({
          chainId,
          address: newCampaignAddress,
          creator: walletClient.account.address,
          ipfsHash: ipfsHash || metadataURI,
          metadata: canonicalMetadata,
          trust: resolvedTrust,
          fingerprint: resolvedTrust?.stats?.fingerprint || "",
        });
      } catch (registryError) {
        console.warn("Campaign registry sync skipped:", registryError);
      }

      window.dispatchEvent(
        new CustomEvent("campaign-updated", {
          detail: {
            address: newCampaignAddress,
            chainId,
          },
        })
      );

      toast.success("Campaign created", { id: pendingToast });
      navigate(`/campaign/${newCampaignAddress}?chainId=${chainId}`);
    } catch (error) {
      if (transactionConfirmed) {
        console.error(error);
        trackAppError({
          eventType: "create_campaign_sync_error",
          chainId,
          message:
            parseTransactionError(error) ||
            "Campaign created onchain but sync failed",
          metadata: {
            area: "create_campaign",
            phase: "post_confirmation",
          },
        });
        toast.error(
          parseTransactionError(error) ||
            "Campaign was created onchain, but the page needs a quick refresh to finish syncing.",
          { id: pendingToast || undefined }
        );
        return;
      }

      if (isUserRejectedRequest(error)) {
        trackAppMetric({
          eventType: "create_campaign",
          status: "cancelled",
          chainId,
          metadata: buildCreateMetricMetadata(),
        });
        toast.error("Campaign creation cancelled", {
          id: pendingToast || undefined,
        });
        return;
      }

      console.error(error);
      trackAppMetric({
        eventType: "create_campaign",
        status: "failed",
        chainId,
        metadata: buildCreateMetricMetadata(),
      });
      trackAppError({
        eventType: "create_campaign_error",
        chainId,
        message: parseTransactionError(error),
        metadata: {
          area: "create_campaign",
          errorName: String(error?.name || "unknown"),
        },
      });
      toast.error(parseTransactionError(error), {
        id: pendingToast || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const previewIsStale =
    Boolean(trustPreview) && trustSnapshotKey !== getTrustSnapshotValue();

  return (
    <div className="theme-shell p-6 md:p-8">
      <SeoMeta
        title="Launch Campaign"
        description="Create a BaseFundAI campaign with onchain metadata, public trust signals, and stable-asset fundraising across supported testnets."
        path="/create"
        keywords={[
          "create campaign",
          "launch fundraiser",
          "onchain crowdfunding",
          "stablecoin campaign",
        ]}
      />

      <div className="mb-8 max-w-3xl">
        <h2 className="theme-heading text-3xl font-bold">Launch Campaign</h2>
        <p className="theme-muted mt-3">
          Build contributor confidence with strong storytelling, public proof,
          and a shared trust review that travels with your campaign.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <input
          placeholder="Headline"
          value={headline}
          onChange={(event) => setHeadline(event.target.value)}
          className="theme-input px-4 py-3"
        />

        <input
          placeholder={`Goal in ${tokenSymbol}`}
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          className="theme-input px-4 py-3"
        />

        <select
          value={duration}
          onChange={(event) => setDuration(event.target.value)}
          className="theme-input px-4 py-3"
        >
          <option value="1">1 day</option>
          <option value="3">3 days</option>
          <option value="7">7 days</option>
          <option value="10">10 days</option>
          <option value="15">15 days</option>
          <option value="30">30 days</option>
        </select>

        <input
          placeholder="YouTube video"
          value={video}
          onChange={(event) => setVideo(event.target.value)}
          className="theme-input px-4 py-3 md:col-span-2 xl:col-span-3"
        />

        <div className="space-y-2 md:col-span-2 xl:col-span-3">
          <label className="theme-soft block text-sm font-medium">
            1. What is the problem and why do you need this amount?
          </label>
          <textarea
            placeholder="Explain the challenge clearly so contributors understand the urgency."
            value={problemStatement}
            onChange={(event) => setProblemStatement(event.target.value)}
            className="theme-input min-h-[160px] w-full px-4 py-3"
          />
        </div>

        <div className="space-y-2 md:col-span-2 xl:col-span-3">
          <label className="theme-soft block text-sm font-medium">
            2. If you receive the amount, how will you use it and how will your life
            change?
          </label>
          <textarea
            placeholder="Show contributors how the funds will be used and what outcome they are helping create."
            value={impactPlan}
            onChange={(event) => setImpactPlan(event.target.value)}
            className="theme-input min-h-[160px] w-full px-4 py-3"
          />
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <input
          placeholder="Facebook"
          value={socials.facebook}
          onChange={(event) => updateSocial("facebook", event.target.value)}
          className="theme-input px-4 py-3"
        />
        <input
          placeholder="Twitter / X"
          value={socials.twitter}
          onChange={(event) => updateSocial("twitter", event.target.value)}
          className="theme-input px-4 py-3"
        />
        <input
          placeholder="LinkedIn"
          value={socials.linkedin}
          onChange={(event) => updateSocial("linkedin", event.target.value)}
          className="theme-input px-4 py-3"
        />
        <input
          placeholder="Telegram"
          value={socials.telegram}
          onChange={(event) => updateSocial("telegram", event.target.value)}
          className="theme-input px-4 py-3"
        />
      </div>

      <div className="mt-6 space-y-4">
        <div className="theme-card-soft p-4">
          <label className="theme-soft mb-3 block text-sm font-medium">
            Upload up to 3 images
          </label>
          <p className="theme-muted mb-3 text-xs">
            Images are auto-optimized for fast loading and Pinata free-tier
            storage. Best results usually come from 1 clear cover image.
          </p>

          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleImageUpload}
          />

          {images.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {images.map((image, index) => (
                <img
                  key={index}
                  src={image}
                  className="h-20 w-28 rounded-xl object-cover"
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="theme-heading text-lg font-semibold">
                Trust Preview
              </h3>
              <p className="theme-muted mt-1 text-sm">
                Uses wallet history, Gitcoin Passport, content review, social
                proof, and privacy-safe duplicate heuristics.
              </p>
            </div>

            <button
              type="button"
              onClick={() => runTrustPreview()}
              disabled={trustLoading}
              className="theme-button-secondary rounded-xl px-5 py-3 text-sm font-semibold"
            >
              {trustLoading ? "Reviewing..." : "Run Trust Preview"}
            </button>
          </div>

          {trustPreview ? (
            <div className="space-y-3">
              {previewIsStale && (
                <div className="rounded-2xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
                  Trust preview is based on an older draft. Run it again before
                  launch for the latest score.
                </div>
              )}
              <TrustSummary trust={trustPreview} />
            </div>
          ) : (
            <div className="theme-card-soft rounded-2xl p-5">
              <p className="theme-muted text-sm">
                No preview yet. Campaign creation still works, but a preview helps
                creators understand what contributors will see.
              </p>
            </div>
          )}
        </div>

        <button
          onClick={createCampaign}
          disabled={submitting}
          className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-6 py-3 font-semibold text-slate-900 shadow-lg shadow-emerald-400/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Creating..." : "Create Campaign"}
        </button>
      </div>
    </div>
  );
}
