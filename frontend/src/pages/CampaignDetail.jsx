import { useParams, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Clock3,
  Copy,
  PlayCircle,
  Share2,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import { parseUnits } from "viem";
import toast from "react-hot-toast";
import { Helmet } from "react-helmet-async";
import { FaFacebookF, FaLinkedinIn, FaTelegram, FaWhatsapp, FaXTwitter } from "react-icons/fa6";
import { useChainId, usePublicClient, useWalletClient } from "wagmi";
import { getGraphClient } from "../graphql/client";
import { requestCampaign } from "../graphql/queries";
import {
  CAMPAIGN_ABI,
  ERC20_ABI,
  getFundingTokenDecimals,
  getFundingTokenSymbol,
  getPlatformWallet,
  getUsdcAddress,
} from "../contracts";
import useCountdown from "../hooks/useCountdown";
import ContributeBox from "../components/ContributeBox";
import CampaignAnalytics from "../components/CampaignAnalytics";
import BackerList from "../components/BackerList";
import DonationMomentModal from "../components/DonationMomentModal";
import TrustSummary from "../components/TrustSummary";
import TrustBadge from "../components/TrustBadge";
import { loadCampaignCache, saveCampaignCache } from "../utils/campaignCache";
import {
  getFallbackCampaignContent,
  loadCampaignProfile,
  requestTrustPreview,
  resolveAssetUrl,
} from "../utils/campaignRegistry";
import {
  detectCampaignChainId,
  getStoredCampaignChainId,
  rememberCampaignReference,
} from "../utils/campaignLocator";
import {
  invalidateCampaignContributorStats,
  loadCampaignContributorStats,
} from "../utils/campaignContributors";
import {
  getCampaignState,
  toBool,
  toNumber,
  toSeconds,
  toUsdc,
} from "../utils/campaignStatus";
import {
  getCampaignActionStatus,
  setCampaignActionStatus,
} from "../utils/campaignActionStatus";
import {
  DEFAULT_CHAIN_ID,
  getChainLabel,
  isSupportedChain,
} from "../config/networks";
import {
  FALLBACK_CAMPAIGN_MEDIA_URL,
  getCampaignStory,
  getCampaignMediaImages,
  getYoutubeEmbedUrl,
  getYoutubeThumbnailUrl,
  normalizeSocialsForDisplay,
  toExternalUrl,
} from "../utils/campaignPresentation";

export default function CampaignDetail() {
  const { address } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const walletChainId = useChainId();
  const routeChainId = Number(searchParams.get("chainId"));
  const storedChainId = getStoredCampaignChainId(address);
  const preferredCampaignChainId = isSupportedChain(routeChainId)
    ? routeChainId
    : isSupportedChain(storedChainId)
      ? storedChainId
    : isSupportedChain(walletChainId)
      ? walletChainId
      : DEFAULT_CHAIN_ID;
  const [campaignChainId, setCampaignChainId] = useState(preferredCampaignChainId);
  const searchParamsString = searchParams.toString();
  const graphClient = getGraphClient(campaignChainId);

  const [campaign, setCampaign] = useState(null);
  const [content, setContent] = useState({});
  const [trust, setTrust] = useState(null);
  const [metadataMeta, setMetadataMeta] = useState({
    verified: false,
    uri: "",
  });
  const [selectedImage, setSelectedImage] = useState(0);
  const [donationEnabled, setDonationEnabled] = useState(false);
  const [donationAmount, setDonationAmount] = useState(1);
  const [loadingTx, setLoadingTx] = useState(false);
  const [loading, setLoading] = useState(true);
  const [txLock, setTxLock] = useState(false);
  const [contributorStatsSnapshot, setContributorStatsSnapshot] = useState(null);
  const [optimisticBackerUpdate, setOptimisticBackerUpdate] = useState(null);
  const [optimisticCampaignPatch, setOptimisticCampaignPatch] = useState(null);
  const [donationMoment, setDonationMoment] = useState(null);
  const [donationMomentOpen, setDonationMomentOpen] = useState(false);
  const trustRefreshAttemptRef = useRef(new Set());
  const dismissedDonationMomentTxRef = useRef("");
  const optimisticContributionTxRef = useRef(new Set());
  const activeLoadRef = useRef(0);

  const { data: walletClient } = useWalletClient({ chainId: campaignChainId });
  const publicClient = usePublicClient({ chainId: campaignChainId });
  const userAddress = walletClient?.account?.address?.toLowerCase();
  const tokenDecimals = getFundingTokenDecimals(campaignChainId);
  const tokenSymbol = getFundingTokenSymbol(campaignChainId);

  function syncCampaignChain(nextChainId, { reference = "" } = {}) {
    if (!address || !isSupportedChain(nextChainId)) {
      return;
    }

    rememberCampaignReference(address, nextChainId, reference);
    setCampaignChainId((currentChainId) =>
      Number(currentChainId) === Number(nextChainId) ? currentChainId : nextChainId
    );

    const nextSearchParams = new URLSearchParams(searchParamsString);

    if (nextSearchParams.get("chainId") !== String(nextChainId)) {
      nextSearchParams.set("chainId", String(nextChainId));
      setSearchParams(nextSearchParams, { replace: true });
    }
  }

  async function ensureCorrectNetwork() {
    if (!walletClient) {
      throw new Error("Connect wallet");
    }

    const connectedChainId = await walletClient.getChainId();

    if (!isSupportedChain(connectedChainId)) {
      throw new Error(
        `Please switch to a supported network. Current: ${getChainLabel(connectedChainId)}`
      );
    }

    if (connectedChainId !== campaignChainId) {
      throw new Error(`Please switch to ${getChainLabel(campaignChainId)} for this campaign`);
    }
  }

  function parseError(error) {
    if (error?.shortMessage) return error.shortMessage;
    if (error?.message) return error.message;
    return "Transaction failed";
  }

  function updateCampaignCache(nextCampaign) {
    const cached = loadCampaignCache(campaignChainId);

    if (!Array.isArray(cached) || cached.length === 0) {
      return;
    }

    const updated = cached.map((item) =>
      item.address?.toLowerCase() === address?.toLowerCase()
        ? { ...item, ...nextCampaign }
        : item
    );

    saveCampaignCache(updated, campaignChainId);
  }

  function isCurrentLoad(requestId) {
    return activeLoadRef.current === requestId;
  }

  function resetMetadataState(nextContent = {}) {
    setContent(nextContent);
    setTrust(null);
    setMetadataMeta({
      verified: false,
      uri: "",
    });
    setSelectedImage(0);
  }

  function commitResolvedCampaign(nextCampaign) {
    if (!nextCampaign) {
      return;
    }

    setCampaign(nextCampaign);
    setOptimisticCampaignPatch((currentPatch) => {
      if (!currentPatch) {
        return null;
      }

      const graphCaughtUp =
        Number(nextCampaign.raised || 0) >= Number(currentPatch.raised || 0) &&
        Number(nextCampaign.contributionCount || 0) >=
          Number(currentPatch.contributionCount || 0) &&
        Number(nextCampaign.backerCount || 0) >= Number(currentPatch.backerCount || 0);

      return graphCaughtUp ? null : currentPatch;
    });
    updateCampaignCache(nextCampaign);
  }

  function buildCampaignState({
    snapshot = {},
    graphCampaign = null,
    graphContributor = null,
    contributorStats = null,
    walletAddress = "",
    localActionStatus = {},
  } = {}) {
    if (!graphCampaign && !snapshot.goal && !snapshot.creator) {
      return null;
    }

    const resolvedCreator = snapshot.creator || graphCampaign?.creator || "";
    const resolvedGoal = toUsdc(snapshot.goal ?? graphCampaign?.goal, campaignChainId);
    const resolvedRaised = toUsdc(
      snapshot.totalRaised ?? graphCampaign?.raised,
      campaignChainId
    );
    const resolvedDeadline = toSeconds(snapshot.deadline ?? graphCampaign?.deadline);
    const graphFinalized = toBool(graphCampaign?.finalized);
    const graphSuccessful = toBool(graphCampaign?.successful);
    const graphStateCode =
      graphCampaign?.stateCode !== undefined && graphCampaign?.stateCode !== null
        ? toNumber(graphCampaign.stateCode)
        : null;
    const resolvedStateCode =
      snapshot.stateCode !== undefined && snapshot.stateCode !== null
        ? toNumber(snapshot.stateCode)
        : graphStateCode !== null
          ? graphStateCode
          : graphFinalized
            ? graphSuccessful
              ? 1
              : 2
            : 0;
    const resolvedFinalized =
      graphFinalized ||
      resolvedStateCode === 1 ||
      resolvedStateCode === 2 ||
      resolvedStateCode === 3;
    const resolvedSuccessful =
      graphSuccessful || resolvedStateCode === 1 || resolvedStateCode === 3;
    const liveContribution = toUsdc(snapshot.contribution ?? 0, campaignChainId);
    const indexedContribution =
      graphContributor && !toBool(graphContributor.refunded)
        ? toUsdc(graphContributor.totalContributed, campaignChainId)
        : 0;
    let refundClaimed = false;
    let fundsClaimed = false;
    let hasUserContributed = false;

    if (walletAddress) {
      const fallbackContributor = contributorStats?.contributors?.find(
        (item) => String(item.contributor || "").toLowerCase() === walletAddress.toLowerCase()
      );
      const isCurrentCreator =
        String(resolvedCreator).toLowerCase() === walletAddress.toLowerCase();

      hasUserContributed =
        liveContribution > 0 ||
        indexedContribution > 0 ||
        Boolean(graphContributor) ||
        Boolean(localActionStatus.refundClaimed) ||
        Number(fallbackContributor?.contributionCount || 0) > 0;

      refundClaimed =
        toBool(graphContributor?.refunded) ||
        Boolean(localActionStatus.refundClaimed) ||
        Boolean(fallbackContributor?.refunded);

      fundsClaimed =
        toBool(graphCampaign?.fundsClaimed) ||
        Boolean(localActionStatus.fundsClaimed) ||
        (isCurrentCreator &&
          resolvedFinalized &&
          resolvedSuccessful &&
          resolvedRaised === 0);
    }

    return {
      ...(graphCampaign || {}),
      address,
      creator: resolvedCreator,
      goal: resolvedGoal,
      raised: resolvedRaised,
      deadline: resolvedDeadline,
      finalized: resolvedFinalized,
      successful: resolvedSuccessful,
      stateCode: resolvedStateCode,
      contribution: liveContribution > 0 ? liveContribution : indexedContribution,
      contributionCount: Math.max(
        toNumber(graphCampaign?.contributionCount),
        Number(contributorStats?.contributionCount || 0)
      ),
      backerCount: Math.max(
        toNumber(graphCampaign?.backerCount),
        Number(contributorStats?.backerCount || 0)
      ),
      fundsClaimed,
      refundClaimed,
      hasUserContributed,
    };
  }

  function applyOptimisticContribution(detail = {}) {
    const contributionTxHash = String(detail?.txHash || "").toLowerCase();

    if (detail?.contributed && contributionTxHash) {
      if (optimisticContributionTxRef.current.has(contributionTxHash)) {
        return;
      }

      optimisticContributionTxRef.current.add(contributionTxHash);
    }

    setCampaign((previous) => {
      if (!previous) return previous;

      const contributionDelta = Number(detail.contributionDelta || 0);
      const isNewBacker =
        Boolean(detail.contributed) &&
        !previous.hasUserContributed &&
        previous.contribution <= 0;
      const nextRaised =
        typeof detail.raised === "number" && Number.isFinite(detail.raised)
          ? detail.raised
          : previous.raised + contributionDelta;
      const nextContribution = detail.contributed
        ? previous.contribution + contributionDelta
        : previous.contribution;

      const optimisticCampaign = {
        ...previous,
        raised: nextRaised,
        contributionCount: detail.contributed
          ? Number(previous.contributionCount || 0) + 1
          : previous.contributionCount,
        backerCount: isNewBacker
          ? Number(previous.backerCount || 0) + 1
          : previous.backerCount,
        contribution: nextContribution,
        hasUserContributed:
          detail.contributed ||
          previous.hasUserContributed ||
          nextContribution > 0,
      };

      setOptimisticCampaignPatch({
        raised: nextRaised,
        contribution: nextContribution,
        contributionCount: Number(optimisticCampaign.contributionCount || 0),
        backerCount: Number(optimisticCampaign.backerCount || 0),
        hasUserContributed: Boolean(optimisticCampaign.hasUserContributed),
      });
      updateCampaignCache(optimisticCampaign);
      return optimisticCampaign;
    });

    if (detail?.contributed && detail?.contributorAddress) {
      setOptimisticBackerUpdate({
        contributorAddress: detail.contributorAddress,
        contributionAmountRaw: detail.contributionAmountRaw,
        contributionDelta: detail.contributionDelta,
        txHash: detail.txHash || `${Date.now()}`,
      });
    }
  }

  function handleDonationMoment(nextMoment) {
    if (!nextMoment?.txHash) {
      return;
    }

    const normalizedTxHash = String(nextMoment.txHash).toLowerCase();
    const normalizedMoment = {
      ...nextMoment,
      txHash: normalizedTxHash,
    };

    setDonationMoment((previous) =>
      previous?.txHash === normalizedTxHash
        ? { ...previous, ...normalizedMoment }
        : normalizedMoment
    );

    if (dismissedDonationMomentTxRef.current !== normalizedTxHash) {
      setDonationMomentOpen(true);
    }
  }

  function handleCloseDonationMoment() {
    dismissedDonationMomentTxRef.current = String(donationMoment?.txHash || "").toLowerCase();
    setDonationMomentOpen(false);
  }

  useEffect(() => {
    setCampaignChainId(preferredCampaignChainId);
  }, [address, preferredCampaignChainId]);

  useEffect(() => {
    if (
      address &&
      (isSupportedChain(routeChainId) || isSupportedChain(storedChainId)) &&
      isSupportedChain(campaignChainId) &&
      Number(routeChainId) !== Number(campaignChainId)
    ) {
      syncCampaignChain(campaignChainId);
    }
  }, [address, routeChainId, storedChainId, campaignChainId, searchParamsString]);

  useEffect(() => {
    if (!address) {
      return undefined;
    }

    if (isSupportedChain(routeChainId) || isSupportedChain(storedChainId)) {
      return undefined;
    }

    let cancelled = false;

    async function resolveCampaignChain() {
      const detectedChainId = await detectCampaignChainId(address, {
        preferredChainIds: [walletChainId, campaignChainId, DEFAULT_CHAIN_ID],
      });

      if (
        !cancelled &&
        isSupportedChain(detectedChainId) &&
        Number(detectedChainId) !== Number(campaignChainId)
      ) {
        syncCampaignChain(detectedChainId);
      }
    }

    void resolveCampaignChain();

    return () => {
      cancelled = true;
    };
  }, [address, routeChainId, storedChainId, walletChainId, campaignChainId]);

  useEffect(() => {
    if (address) {
      loadCampaign({
        forceContributorRefresh: false,
      });
    }
  }, [address, campaignChainId, publicClient, walletClient?.account?.address]);

  useEffect(() => {
    dismissedDonationMomentTxRef.current = "";
    optimisticContributionTxRef.current = new Set();
    setDonationMoment(null);
    setDonationMomentOpen(false);
  }, [address, campaignChainId]);

  useEffect(() => {
    if (!address) return undefined;

    const handleUpdate = (event) => {
      const detail = event?.detail;

      if (
        detail?.chainId &&
        Number(detail.chainId) !== Number(campaignChainId)
      ) {
        return;
      }

      if (detail?.address?.toLowerCase() === address.toLowerCase()) {
        applyOptimisticContribution(detail);
      }

      invalidateCampaignContributorStats({
        campaignAddress: address,
        chainId: campaignChainId,
      });

      void refreshWithRetry(1, {
        forceContributorRefresh: true,
        silent: true,
      });
    };

    window.addEventListener("campaign-updated", handleUpdate);

    return () => {
      window.removeEventListener("campaign-updated", handleUpdate);
    };
  }, [address, campaignChainId, publicClient, walletClient?.account?.address]);

  async function loadMetadata({ requestId } = {}) {
    if (!address) {
      setContributorStatsSnapshot(null);
      resetMetadataState({});
      return;
    }

    const profile = await loadCampaignProfile(address, campaignChainId);

    if (requestId && !isCurrentLoad(requestId)) {
      return;
    }

    setContent(profile.metadata || {});
    setTrust(profile.trust || null);
    setMetadataMeta({
      verified: Boolean(profile.metadataVerified),
      uri: String(profile.metadataURI || ""),
    });
    rememberCampaignReference(
      address,
      campaignChainId,
      profile.metadataURI || profile.ipfsHash || ""
    );
    setSelectedImage(0);
  }

  async function hydrateContributorStats({
    requestId,
    graphCampaign,
    graphContributor,
    snapshot,
    walletAddress,
    localActionStatus,
    force = false,
  }) {
    if (!publicClient || !graphCampaign?.createdAtBlock) {
      return;
    }

    try {
      const contributorStats = await loadCampaignContributorStats({
        publicClient,
        campaignAddress: address,
        chainId: campaignChainId,
        createdAtBlock: graphCampaign.createdAtBlock,
        force,
      });

      if (!isCurrentLoad(requestId)) {
        return;
      }

      setContributorStatsSnapshot(contributorStats || null);
      commitResolvedCampaign(
        buildCampaignState({
          snapshot,
          graphCampaign,
          graphContributor,
          contributorStats,
          walletAddress,
          localActionStatus,
        })
      );
    } catch (error) {
      console.log("Contributor stats error:", error);
    }
  }

  async function loadCampaign(options = {}) {
    if (!address) return;

    const { forceContributorRefresh = false, silent = false } = options;
    const requestId = activeLoadRef.current + 1;
    activeLoadRef.current = requestId;

    try {
      if (!silent) {
        setLoading(true);
        setContributorStatsSnapshot(null);
        resetMetadataState(getFallbackCampaignContent(address));
      }

      const metadataPromise = loadMetadata({ requestId }).catch((error) => {
        console.log("Metadata load error:", error);
        return null;
      });

      const contributorId = walletClient?.account?.address
        ? `${address.toLowerCase()}-${walletClient.account.address.toLowerCase()}`
        : undefined;
      const graphPromise = (async () => {
        try {
          const response = await requestCampaign(graphClient, {
            id: address.toLowerCase(),
            contributorId,
          });

          return {
            graphCampaign: response?.campaign || null,
            graphContributor: response?.campaignContributor || null,
          };
        } catch (error) {
          console.log("Graph error:", error);
          return {
            graphCampaign: null,
            graphContributor: null,
          };
        }
      })();

      let snapshot = {};
      const walletAddress = walletClient?.account?.address;
      const localActionStatus = walletAddress
        ? getCampaignActionStatus(address, walletAddress)
        : {};

      if (publicClient) {
        try {
          const [
            goal,
            totalRaised,
            deadline,
            creator,
            stateCode,
            contribution,
          ] = await Promise.all([
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
              functionName: "creator",
            }),
            publicClient.readContract({
              address,
              abi: CAMPAIGN_ABI,
              functionName: "getState",
            }),
            walletClient?.account?.address
              ? publicClient.readContract({
                  address,
                  abi: CAMPAIGN_ABI,
                  functionName: "contributions",
                  args: [walletClient.account.address],
                })
              : Promise.resolve(0n),
          ]);

          snapshot = {
            goal,
            totalRaised,
            deadline,
            creator,
            stateCode,
            contribution,
          };
        } catch (error) {
          console.log("Contract read error:", error);
        }
      }

      const initialCampaign = buildCampaignState({
        snapshot,
        walletAddress,
        localActionStatus,
      });

      if (initialCampaign && isCurrentLoad(requestId)) {
        commitResolvedCampaign(initialCampaign);

        if (!silent) {
          setLoading(false);
        }
      }

      const { graphCampaign, graphContributor } = await graphPromise;

      if (!isCurrentLoad(requestId)) {
        return;
      }

      const resolvedCampaign = buildCampaignState({
        snapshot,
        graphCampaign,
        graphContributor,
        walletAddress,
        localActionStatus,
      });

      if (!resolvedCampaign) {
        const detectedChainId = await detectCampaignChainId(address, {
          preferredChainIds: [routeChainId, storedChainId, walletChainId, DEFAULT_CHAIN_ID],
        });

        if (
          isSupportedChain(detectedChainId) &&
          Number(detectedChainId) !== Number(campaignChainId)
        ) {
          syncCampaignChain(detectedChainId);
          return;
        }

        setContributorStatsSnapshot(null);
        setCampaign(null);
        return;
      }

      commitResolvedCampaign(resolvedCampaign);

      void hydrateContributorStats({
        requestId,
        graphCampaign,
        graphContributor,
        snapshot,
        walletAddress,
        localActionStatus,
        force: forceContributorRefresh,
      });

      void metadataPromise;
    } catch (error) {
      console.log("Load campaign error:", error);
    } finally {
      if (!silent && isCurrentLoad(requestId)) {
        setLoading(false);
      }
    }
  }

  async function refreshWithRetry(retries = 5, options = {}) {
    const { forceContributorRefresh = false, silent = false } = options;

    for (let index = 0; index < retries; index += 1) {
      await loadCampaign({
        forceContributorRefresh,
        silent,
      });

      if (index < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }
  }

  const timeLeft = useCountdown(campaign?.deadline || 0);
  const displayTimeLeft = timeLeft || "Loading...";
  const state = campaign ? getCampaignState(campaign) : "ACTIVE";
  const isCreator =
    !!userAddress &&
    !!campaign?.creator &&
    userAddress === campaign.creator.toLowerCase();

  async function handleClaimFunds() {
    if (txLock) return;
    if (!walletClient) return toast.error("Connect wallet");
    if (!publicClient) return toast.error("Wallet not ready");

    try {
      setTxLock(true);
      setLoadingTx(true);

      await ensureCorrectNetwork();

      const toastId = toast.loading("Claiming funds...");

      const tx = await walletClient.writeContract({
        address,
        abi: CAMPAIGN_ABI,
        functionName: "claimFunds",
        account: walletClient.account,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

      if (receipt.status !== "success") {
        throw new Error("Claim failed");
      }

      toast.success("Funds claimed", { id: toastId });

      if (walletClient?.account?.address) {
        setCampaignActionStatus(address, walletClient.account.address, {
          fundsClaimed: true,
        });
      }

      setCampaign((previous) =>
        previous
          ? {
              ...previous,
              fundsClaimed: true,
              raised: 0,
              stateCode: 3,
            }
          : previous
      );

      window.dispatchEvent(
        new CustomEvent("campaign-updated", {
          detail: {
            address,
            chainId: campaignChainId,
            fundsClaimed: true,
            stateCode: 3,
            raised: 0,
          },
        })
      );

      await refreshWithRetry();
    } catch (error) {
      toast.error(parseError(error));
    } finally {
      setTxLock(false);
      setLoadingTx(false);
    }
  }

  async function handleRefund() {
    if (txLock) return;
    if (!walletClient) return toast.error("Connect wallet");
    if (!publicClient) return toast.error("Wallet not ready");

    try {
      setTxLock(true);
      setLoadingTx(true);

      await ensureCorrectNetwork();

      const toastId = toast.loading("Claiming refund...");

      const tx = await walletClient.writeContract({
        address,
        abi: CAMPAIGN_ABI,
        functionName: "refund",
        account: walletClient.account,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

      if (receipt.status !== "success") {
        throw new Error("Refund failed");
      }

      toast.success("Refund claimed", { id: toastId });

      if (walletClient?.account?.address) {
        setCampaignActionStatus(address, walletClient.account.address, {
          refundClaimed: true,
        });
      }

      setCampaign((previous) =>
        previous
          ? {
              ...previous,
              refundClaimed: true,
              contribution: 0,
            }
          : previous
      );

      window.dispatchEvent(
        new CustomEvent("campaign-updated", {
          detail: {
            address,
            chainId: campaignChainId,
            refundClaimed: true,
          },
        })
      );

      await refreshWithRetry();
    } catch (error) {
      toast.error(parseError(error));
    } finally {
      setTxLock(false);
      setLoadingTx(false);
    }
  }

  async function handleDonate() {
    if (txLock) return;
    if (!walletClient) return toast.error("Connect wallet");
    if (!publicClient) return toast.error("Wallet not ready");
    if (!donationEnabled || Number(donationAmount) <= 0) {
      return toast.error("Enter donation amount");
    }

    try {
      setTxLock(true);
      setLoadingTx(true);

      await ensureCorrectNetwork();

      const toastId = toast.loading("Sending donation...");
      const usdcAddress = await getUsdcAddress(
        publicClient,
        campaignChainId,
        address
      );
      const platformWallet = getPlatformWallet(campaignChainId);

      if (!usdcAddress || !platformWallet) {
        throw new Error("Network configuration is unavailable");
      }

      const tx = await walletClient.writeContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [platformWallet, parseUnits(String(donationAmount), tokenDecimals)],
        account: walletClient.account,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

      if (receipt.status !== "success") {
        throw new Error("Donation failed");
      }

      toast.success("Donation sent", { id: toastId });
    } catch (error) {
      toast.error(parseError(error));
    } finally {
      setTxLock(false);
      setLoadingTx(false);
    }
  }

  function renderDonationPanel() {
    return (
      <div className="theme-card-soft space-y-4 rounded-2xl p-4">
        <label className="theme-soft flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={donationEnabled}
            onChange={() => setDonationEnabled(!donationEnabled)}
            className="mt-1"
          />
          <div>
            <div className="theme-heading font-semibold">Support BaseFundAI</div>
            <p className="theme-muted mt-1 text-xs leading-5">
              Optional support keeps campaign discovery, trust checks, and metadata
              services running smoothly.
            </p>
          </div>
        </label>

        {donationEnabled && (
          <>
            <input
              type="number"
              min="0"
              value={donationAmount}
              onChange={(event) => setDonationAmount(event.target.value)}
              className="theme-input w-full rounded-xl px-4 py-3"
              placeholder={`Donation amount (${tokenSymbol})`}
            />

            <button
              onClick={handleDonate}
              disabled={loadingTx || txLock}
              className="w-full rounded-2xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-900 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:text-emerald-200"
            >
              {loadingTx ? "Processing..." : "Donate"}
            </button>
          </>
        )}
      </div>
    );
  }

  function renderActions() {
    if (!campaign) return null;

    const canRefund =
      (campaign.contribution > 0 || campaign.hasUserContributed) &&
      !campaign.refundClaimed;

    if (state === "ACTIVE") {
      return (
        <ContributeBox
          address={address}
          campaignChainId={campaignChainId}
          campaignHeadline={campaignHeadline}
          campaignImage={campaignMomentImage}
          onContributionSuccess={applyOptimisticContribution}
          onDonationMoment={handleDonationMoment}
        />
      );
    }

    if (state === "SUCCESSFUL") {
      return (
        <>
          {isCreator && !campaign.fundsClaimed && (
            <button
              onClick={handleClaimFunds}
              disabled={loadingTx || txLock}
              className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(16,185,129,0.25)] transition hover:brightness-[1.03]"
            >
              {loadingTx ? "Processing..." : "Claim Funds"}
            </button>
          )}

          {isCreator && campaign.fundsClaimed && (
            <div className="w-full rounded-2xl bg-slate-100 py-3 text-center text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-white">
              Funds Claimed
            </div>
          )}

          {!isCreator && !campaign.fundsClaimed && (
            <div className="w-full rounded-2xl bg-slate-100 py-3 text-center text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-white">
              Successfully Funded
            </div>
          )}

          {!isCreator && campaign.fundsClaimed && (
            <div className="w-full rounded-2xl bg-slate-100 py-3 text-center text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-white">
              Campaign Settled
            </div>
          )}

          {renderDonationPanel()}
        </>
      );
    }

    if (state === "SETTLED") {
      return (
        <>
          <div className="w-full rounded-2xl bg-slate-100 py-3 text-center text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-white">
            {isCreator ? "Funds Claimed" : "Campaign Settled"}
          </div>

          {renderDonationPanel()}
        </>
      );
    }

    if (state === "FAILED") {
      return (
        <>
          {canRefund && (
            <button
              onClick={handleRefund}
              disabled={loadingTx || txLock}
              className="w-full rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(244,63,94,0.18)] transition hover:brightness-[1.03]"
            >
              {loadingTx ? "Processing..." : "Claim Refund"}
            </button>
          )}

          {campaign.refundClaimed && (
            <div className="w-full rounded-2xl bg-slate-100 py-3 text-center text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-white">
              Refund Claimed
            </div>
          )}

          {!campaign.refundClaimed && !canRefund && (
            <div className="w-full rounded-2xl bg-slate-100 py-3 text-center text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-white">
              Campaign Failed
            </div>
          )}

          {renderDonationPanel()}
        </>
      );
    }

    return null;
  }

  const socialLinks = useMemo(() => {
    const socials = normalizeSocialsForDisplay(content?.socials || {});

    return [
      socials.facebook
        ? {
            label: "Facebook",
            value: socials.facebook,
            href: toExternalUrl(socials.facebook, "facebook"),
          }
        : socials.website
        ? {
            label: "Website",
            value: socials.website,
            href: toExternalUrl(socials.website),
          }
        : null,
      socials.twitter
        ? {
            label: "X",
            value: socials.twitter,
            href: toExternalUrl(socials.twitter),
          }
        : null,
      socials.linkedin
        ? {
            label: "LinkedIn",
            value: socials.linkedin,
            href: toExternalUrl(socials.linkedin),
          }
        : null,
      socials.telegram
        ? {
            label: "Telegram",
            value: socials.telegram,
            href: toExternalUrl(socials.telegram, "telegram"),
          }
        : null,
    ].filter((link) => Boolean(link?.href));
  }, [content]);
  const trustRefreshPayload = useMemo(() => {
    const campaignImages = Array.isArray(content?.images)
      ? content.images
      : content?.image
        ? [content.image]
        : [];
    const trustDescription = [
      String(content?.description || "").trim(),
      String(content?.problemStatement || "").trim(),
      String(content?.impactPlan || "").trim(),
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      chainId: Number(campaignChainId || 0),
      walletAddress: campaign?.creator || "",
      headline: String(content?.headline || "").trim(),
      description: trustDescription,
      goal: Number(campaign?.goal || 0),
      duration: Number(content?.duration || content?.durationInDays || 0),
      youtube: getYoutubeEmbedUrl(content?.youtube || ""),
      mediaCount: campaignImages.length,
      socials: content?.socials || {},
    };
  }, [
    campaign?.creator,
    campaign?.goal,
    campaignChainId,
    content?.description,
    content?.duration,
    content?.durationInDays,
    content?.headline,
    content?.image,
    content?.images,
    content?.impactPlan,
    content?.problemStatement,
    content?.socials,
    content?.youtube,
  ]);
  const trustRefreshKey = useMemo(
    () =>
      JSON.stringify({
        address: String(address || "").toLowerCase(),
        chainId: Number(campaignChainId || 0),
        walletAddress: String(trustRefreshPayload.walletAddress || "").toLowerCase(),
      }),
    [address, campaignChainId, trustRefreshPayload.walletAddress]
  );

  useEffect(() => {
    const hasUnavailableWalletSignals = Array.isArray(trust?.signals)
      ? trust.signals.some(
          (signal) =>
            (signal?.key === "wallet-age" || signal?.key === "wallet-activity") &&
            signal?.available === false
        )
      : false;
    const shouldRefreshTrust =
      Boolean(trustRefreshPayload.walletAddress) && (!trust || hasUnavailableWalletSignals);

    if (!shouldRefreshTrust || trustRefreshAttemptRef.current.has(trustRefreshKey)) {
      return undefined;
    }

    trustRefreshAttemptRef.current.add(trustRefreshKey);
    let cancelled = false;

    requestTrustPreview(trustRefreshPayload)
      .then((nextTrust) => {
        if (!cancelled && nextTrust) {
          setTrust(nextTrust);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [trust, trustRefreshKey, trustRefreshPayload]);

  if (loading) {
    return (
      <div className="px-4 py-6 md:px-6 md:py-8">
        <div className="theme-shell mx-auto max-w-7xl p-8 text-center">
          <div className="theme-heading text-2xl font-semibold">Loading campaign</div>
          <p className="theme-muted mt-3">
            We’re bringing together the campaign story, media, and onchain details.
          </p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="px-4 py-6 md:px-6 md:py-8">
        <div className="theme-shell mx-auto max-w-7xl p-8 text-center">
          <div className="theme-heading text-2xl font-semibold">Campaign not found</div>
          <p className="theme-muted mt-3">
            This campaign could not be loaded on the selected network.
          </p>
        </div>
      </div>
    );
  }

  const displayCampaign = optimisticCampaignPatch
    ? {
        ...campaign,
        raised: Math.max(
          Number(campaign.raised || 0),
          Number(optimisticCampaignPatch.raised || 0)
        ),
        contribution: Math.max(
          Number(campaign.contribution || 0),
          Number(optimisticCampaignPatch.contribution || 0)
        ),
        contributionCount: Math.max(
          Number(campaign.contributionCount || 0),
          Number(optimisticCampaignPatch.contributionCount || 0)
        ),
        backerCount: Math.max(
          Number(campaign.backerCount || 0),
          Number(optimisticCampaignPatch.backerCount || 0)
        ),
        hasUserContributed:
          optimisticCampaignPatch.hasUserContributed || campaign.hasUserContributed,
      }
    : campaign;

  const story = getCampaignStory(content);
  const images = getCampaignMediaImages(content);

  const mediaItems = [
    ...images.map((image, index) => ({
      type: "image",
      value: image,
      label: `Image ${index + 1}`,
      thumbnail: resolveAssetUrl(image),
    })),
    ...(content.youtube
      ? [
          {
            type: "video",
            value: getYoutubeEmbedUrl(content.youtube),
            label: "Video",
            thumbnail: getYoutubeThumbnailUrl(content.youtube),
          },
        ]
      : []),
  ];

  const activeMedia = mediaItems[selectedImage] || mediaItems[0] || null;
  const hasStructuredStory = Boolean(story.problemStatement || story.impactPlan);
  const showStorySections = hasStructuredStory;
  const rawDescription = String(content.description || "").trim();
  const normalizeStoryCopy = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  const normalizedProblem = normalizeStoryCopy(story.problemStatement);
  const normalizedImpact = normalizeStoryCopy(story.impactPlan);
  const structuredDescription = [
    story.problemStatement ? `Problem\n${story.problemStatement}` : "",
    story.impactPlan ? `Impact Plan\n${story.impactPlan}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const normalizedRawDescription = normalizeStoryCopy(rawDescription);
  const normalizedStructuredDescription = normalizeStoryCopy(structuredDescription);
  const standaloneDescription = showStorySections
    ? normalizedRawDescription &&
      normalizedRawDescription !== normalizedProblem &&
      normalizedRawDescription !== normalizedImpact &&
      normalizedRawDescription !== normalizedStructuredDescription
      ? rawDescription
      : ""
    : story.description || rawDescription;
  const campaignHeadline = content.headline || `Campaign ${address?.slice(0, 6)}...`;
  const fundingProgress =
    displayCampaign.goal > 0
      ? Math.min((displayCampaign.raised / displayCampaign.goal) * 100, 100)
      : 0;
  const creatorLabel = displayCampaign.creator
    ? `${displayCampaign.creator.slice(0, 6)}...${displayCampaign.creator.slice(-4)}`
    : "Unknown";
  const pageSummary =
    standaloneDescription ||
    story.problemStatement ||
    story.impactPlan ||
    "Support a community-led campaign with transparent onchain funding and verifiable metadata.";
  const heroFacts = [
    { label: "Network", value: getChainLabel(campaignChainId) },
    { label: "Status", value: state.replaceAll("_", " ") },
    { label: "Creator", value: creatorLabel },
    { label: "Time Left", value: displayTimeLeft },
  ];
  const showImpactCard = Boolean(
    story.impactPlan && normalizeStoryCopy(story.impactPlan) !== normalizedProblem
  );
  const supportFacts = [
    { icon: Users, label: "Backers", value: String(displayCampaign.backerCount ?? 0) },
    { icon: Target, label: "Goal", value: `$${displayCampaign.goal.toFixed(2)}` },
    {
      icon: Clock3,
      label: "Pledges",
      value: String(displayCampaign.contributionCount ?? 0),
    },
  ];
  const normalizeShareCopy = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  const shareSummarySource =
    standaloneDescription ||
    story.problemStatement ||
    story.impactPlan ||
    rawDescription ||
    "Support this community campaign with a direct onchain contribution.";
  const normalizedShareSummary = normalizeShareCopy(shareSummarySource);
  const shareDescription =
    normalizedShareSummary.length > 180
      ? `${normalizedShareSummary.slice(0, 177).trimEnd()}...`
      : normalizedShareSummary;
  const sharePreviewDescription =
    normalizedShareSummary.length > 120
      ? `${normalizedShareSummary.slice(0, 117).trimEnd()}...`
      : normalizedShareSummary;
  const shareCallToAction = `Contribute to this campaign and help it reach more people on ${getChainLabel(
    campaignChainId
  )}.`;
  const shareMessage = `${campaignHeadline}\n\n${shareDescription}\n\n${shareCallToAction}`;
  const shareUrl =
    typeof window !== "undefined"
      ? (() => {
          const nextUrl = new URL(window.location.href);
          nextUrl.searchParams.set("chainId", String(campaignChainId));
          return nextUrl.toString();
        })()
      : "";
  const shareImage =
    typeof window !== "undefined"
      ? (() => {
          const imageCandidate = images[0]
            ? resolveAssetUrl(images[0])
            : FALLBACK_CAMPAIGN_MEDIA_URL;

          try {
            return new URL(imageCandidate, window.location.origin).toString();
          } catch {
            return imageCandidate;
          }
        })()
      : "";
  const campaignMomentImage =
    mediaItems.find((media) => media.type === "image")?.thumbnail ||
    mediaItems.find((media) => media.thumbnail)?.thumbnail ||
    shareImage ||
    "";
  const shareLinks = [
    {
      label: "X",
      icon: FaXTwitter,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        `${campaignHeadline}\n\n${sharePreviewDescription}\n\n${shareCallToAction}`
      )}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: "WhatsApp",
      icon: FaWhatsapp,
      href: `https://api.whatsapp.com/send?text=${encodeURIComponent(
        `Support this campaign: ${campaignHeadline}\n\n${sharePreviewDescription}\n\n${shareCallToAction}\n${shareUrl}`
      )}`,
    },
    {
      label: "Telegram",
      icon: FaTelegram,
      href: `https://t.me/share/url?url=${encodeURIComponent(
        shareUrl
      )}&text=${encodeURIComponent(
        `${campaignHeadline}\n\n${sharePreviewDescription}\n\n${shareCallToAction}`
      )}`,
    },
    {
      label: "Facebook",
      icon: FaFacebookF,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
        shareUrl
      )}&quote=${encodeURIComponent(
        `${campaignHeadline}\n\n${shareCallToAction}`
      )}`,
    },
    {
      label: "LinkedIn",
      icon: FaLinkedinIn,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
        shareUrl
      )}`,
    },
  ];

  async function handleCopyShareLink() {
    if (!shareUrl || typeof navigator === "undefined" || !navigator.clipboard) {
      toast.error("Copy is unavailable on this device");
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Campaign link copied");
    } catch (error) {
      toast.error("Could not copy the link");
    }
  }

  async function handleNativeShare() {
    if (typeof navigator === "undefined" || !navigator.share) {
      handleCopyShareLink();
      return;
    }

    try {
      await navigator.share({
        title: campaignHeadline,
        text: shareMessage,
        url: shareUrl,
      });
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error("Could not open the share sheet");
      }
    }
  }

  return (
    <>
      <Helmet>
        <title>{`${campaignHeadline} | BaseFundAI`}</title>
        <meta name="description" content={shareDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={campaignHeadline} />
        <meta property="og:description" content={shareDescription} />
        <meta property="og:url" content={shareUrl} />
        <meta property="og:image" content={shareImage} />
        <meta property="og:image:alt" content={campaignHeadline} />
        <meta property="og:site_name" content="BaseFundAI" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={campaignHeadline} />
        <meta name="twitter:description" content={shareDescription} />
        <meta name="twitter:image" content={shareImage} />
      </Helmet>
      <div className="px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_360px]">
          <div className="space-y-6">
            <div className="theme-card overflow-hidden border-slate-200/80 bg-white/90 dark:border-slate-800 dark:bg-slate-950/85">
              <div className="relative overflow-hidden bg-gradient-to-br from-white via-emerald-50 to-sky-100 px-6 py-7 text-slate-950 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950 dark:text-white md:px-8 md:py-8">
                <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
                <div className="absolute right-0 top-10 h-44 w-44 rounded-full bg-sky-400/15 blur-3xl" />

                <div className="relative space-y-6">
                  <div className="max-w-4xl space-y-4">
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-white/60">
                      Community Campaign
                    </p>
                    <h1 className="text-3xl font-black leading-tight md:text-5xl">
                      {campaignHeadline}
                    </h1>

                    <div className="flex flex-wrap items-center gap-3">
                      <TrustBadge trust={trust} />
                      {metadataMeta.verified && (
                        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/60 bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm dark:border-emerald-300/25 dark:bg-emerald-400/15 dark:text-emerald-100">
                          <ShieldCheck size={14} />
                          Metadata verified
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {heroFacts.map((fact) => (
                      <div
                        key={fact.label}
                        className="rounded-2xl border border-white/70 bg-white/72 px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/15 dark:bg-white/12 dark:shadow-none"
                      >
                        <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-white/72">
                          {fact.label}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                          {fact.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200/80 bg-slate-50/75 p-4 dark:border-slate-800 dark:bg-slate-950/70 md:p-6">
                {activeMedia?.type === "video" ? (
                  <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)] dark:border-slate-700 dark:bg-slate-950 dark:shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
                    <iframe
                      className="aspect-video w-full"
                      src={activeMedia.value}
                      title="Campaign media"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : activeMedia?.type === "image" ? (
                  <div className="relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)] dark:border-slate-700 dark:bg-slate-950 dark:shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
                    <div className="relative flex min-h-[320px] items-center justify-center p-3 md:min-h-[420px] md:p-5">
                      <img
                        src={resolveAssetUrl(activeMedia.value)}
                        loading="eager"
                        decoding="async"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = FALLBACK_CAMPAIGN_MEDIA_URL;
                        }}
                        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-3xl dark:opacity-35"
                        alt=""
                        aria-hidden="true"
                      />
                      <div className="absolute inset-0 bg-gradient-to-br from-white/92 via-white/60 to-emerald-100/55 dark:from-slate-950/85 dark:via-slate-950/45 dark:to-emerald-950/45" />
                      <div className="relative z-10 flex h-[280px] w-full items-center justify-center md:h-[410px]">
                        <img
                          src={resolveAssetUrl(activeMedia.value)}
                          loading="eager"
                          fetchpriority="high"
                          decoding="async"
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = FALLBACK_CAMPAIGN_MEDIA_URL;
                          }}
                          className="h-full w-auto max-w-full rounded-2xl object-contain shadow-[0_24px_56px_rgba(15,23,42,0.18)] dark:shadow-[0_28px_80px_rgba(15,23,42,0.45)]"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex aspect-[16/10] items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-slate-100 px-6 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    No media available
                  </div>
                )}

                {mediaItems.length > 0 && (
                  <div className="mt-4">
                    <div className="flex gap-3 overflow-x-auto pb-1">
                      {mediaItems.map((media, index) => (
                        <button
                          key={`${media.type}-${index}`}
                          onClick={() => setSelectedImage(index)}
                          onMouseEnter={() => {
                            if (media.type === "video") {
                              setSelectedImage(index);
                            }
                          }}
                          className={`overflow-hidden rounded-2xl border transition ${
                            selectedImage === index
                              ? "border-emerald-400 bg-white/90 shadow-[0_0_0_1px_rgba(52,211,153,0.35)] dark:bg-slate-950/90"
                              : "border-slate-300 bg-white/75 dark:border-slate-700 dark:bg-slate-950/75"
                          }`}
                        >
                          {media.type === "video" ? (
                            <div className="relative h-24 w-32 overflow-hidden bg-slate-100 dark:bg-slate-950">
                              {media.thumbnail ? (
                                <img
                                  src={media.thumbnail}
                                  alt={media.label}
                                  loading="lazy"
                                  decoding="async"
                                  onError={(event) => {
                                    event.currentTarget.onerror = null;
                                    event.currentTarget.src =
                                      FALLBACK_CAMPAIGN_MEDIA_URL;
                                  }}
                                  className="h-full w-full object-cover opacity-85"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-200">
                                  Video
                                </div>
                              )}
                              <div className="absolute inset-0 flex items-center justify-center bg-white/35 dark:bg-slate-950/35">
                                <PlayCircle size={28} className="text-slate-900 dark:text-white" />
                              </div>
                            </div>
                          ) : (
                            <img
                              src={media.thumbnail}
                              alt={media.label}
                              loading="lazy"
                              decoding="async"
                              onError={(event) => {
                                event.currentTarget.onerror = null;
                                event.currentTarget.src = FALLBACK_CAMPAIGN_MEDIA_URL;
                              }}
                              className="h-24 w-32 object-cover"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="theme-card p-6 md:p-8">
              <div className="max-w-4xl">
                <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                  Campaign Story
                </p>
                <h2 className="theme-heading mt-2 text-2xl font-semibold md:text-3xl">
                  Why this campaign matters
                </h2>
              </div>

              {standaloneDescription ? (
                <p className="theme-soft mt-5 whitespace-pre-wrap text-base leading-8 md:text-lg">
                  {standaloneDescription}
                </p>
              ) : !showStorySections ? (
                <p className="theme-soft mt-5 text-base leading-8 md:text-lg">
                  {pageSummary}
                </p>
              ) : null}

              {showStorySections && (
                <div className={`mt-8 grid gap-4 ${showImpactCard ? "md:grid-cols-2" : ""}`}>
                  <div className="theme-card-soft rounded-3xl p-5">
                    <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                      Problem
                    </p>
                    <p className="theme-soft mt-3 whitespace-pre-wrap leading-7">
                      {story.problemStatement || "No problem statement was shared yet."}
                    </p>
                  </div>

                  {showImpactCard && (
                    <div className="theme-card-soft rounded-3xl p-5">
                      <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                        Impact Plan
                      </p>
                      <p className="theme-soft mt-3 whitespace-pre-wrap leading-7">
                        {story.impactPlan || "No impact plan was shared yet."}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <TrustSummary trust={trust} />

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]">
              <div className="theme-card p-6">
                <CampaignAnalytics campaign={displayCampaign} />
              </div>

              <div className="theme-card p-6">
                <BackerList
                  campaignId={address}
                  chainId={campaignChainId}
                  createdAtBlock={displayCampaign.createdAtBlock}
                  prefetchedStats={contributorStatsSnapshot}
                  optimisticUpdate={optimisticBackerUpdate}
                />
              </div>
            </div>
          </div>

          <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            <div className="theme-card overflow-hidden">
              <div className="border-b border-slate-200/80 bg-gradient-to-br from-white to-emerald-50/80 px-6 py-6 dark:border-slate-800 dark:from-slate-900 dark:to-emerald-500/5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                      Support This Campaign
                    </p>
                    <div className="mt-3 text-4xl font-black text-emerald-600 dark:text-emerald-300">
                      ${displayCampaign.raised.toFixed(2)}
                    </div>
                    <div className="theme-soft mt-2 text-sm">
                      raised of ${displayCampaign.goal.toFixed(2)} goal
                    </div>
                  </div>
                  <TrustBadge trust={trust} compact />
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="theme-soft">Funding progress</span>
                    <span className="theme-heading font-semibold">
                      {fundingProgress.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-500 to-sky-500"
                      style={{ width: `${fundingProgress}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-5 p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  {supportFacts.map(({ icon: Icon, label, value }, index) => (
                    <div
                      key={label}
                      className={`theme-card-soft rounded-2xl px-4 py-3 ${
                        index === supportFacts.length - 1 ? "sm:col-span-2" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={16} className="text-emerald-600 dark:text-emerald-300" />
                        <span className="theme-muted text-[11px] uppercase tracking-[0.18em]">
                          {label}
                        </span>
                      </div>
                      <div className="theme-heading mt-2 text-sm font-semibold">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="theme-soft space-y-3 text-sm">
                  <div className="break-all">
                    <span className="theme-muted">Creator</span>
                    <div className="mt-1 font-medium">{campaign.creator}</div>
                  </div>

                  {displayCampaign.contribution > 0 && (
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-50/80 px-4 py-3 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100">
                      Your contribution: ${displayCampaign.contribution.toFixed(2)}
                    </div>
                  )}
                </div>

                {renderActions()}

                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200">
                  Funds move onchain. Campaign media and story are anchored through the
                  campaign metadata record.
                </div>
              </div>
            </div>

            {socialLinks.length > 0 && (
              <div className="theme-card p-6">
                <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                  Social Proof
                </p>
                <h3 className="theme-heading mt-2 text-xl font-semibold">
                  Public identity signals
                </h3>

                <div className="mt-5 space-y-3">
                  {socialLinks.map((link) => (
                    <a
                      key={`${link.label}-${link.href}`}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="theme-card-soft flex items-center justify-between rounded-2xl px-4 py-4 transition hover:border-emerald-400 hover:bg-white dark:hover:bg-slate-900"
                    >
                      <div className="min-w-0">
                        <div className="theme-heading text-sm font-semibold">
                          {link.label}
                        </div>
                        <div className="theme-muted mt-1 truncate text-xs">
                          {link.value}
                        </div>
                      </div>
                      <ArrowUpRight
                        size={16}
                        className="shrink-0 text-slate-400 dark:text-slate-400"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="theme-card p-6">
              <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                Share Campaign
              </p>
              <h3 className="theme-heading mt-2 text-xl font-semibold">
                Send this campaign with context
              </h3>
              <p className="theme-muted mt-3 text-sm leading-6">
                Open each platform with the campaign title, story, and a contribute
                CTA. Preview cards use the campaign page image and metadata where the
                platform supports them.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="theme-card-soft flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition hover:border-emerald-400 hover:bg-white dark:hover:bg-slate-900"
                >
                  <Share2 size={16} />
                  Share
                </button>
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="theme-card-soft flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition hover:border-emerald-400 hover:bg-white dark:hover:bg-slate-900"
                >
                  <Copy size={16} />
                  Copy Link
                </button>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {shareLinks.map(({ label, icon: Icon, href }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="theme-card-soft flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition hover:border-emerald-400 hover:bg-white dark:hover:bg-slate-900"
                  >
                    <Icon size={16} />
                    {label}
                  </a>
                ))}
              </div>
            </div>

            <div className="theme-card p-6">
              <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                Verification
              </p>
              <h3 className="theme-heading mt-2 text-xl font-semibold">
                Onchain reference points
              </h3>
              <div className="mt-5 space-y-4 text-sm">
                <div>
                  <div className="theme-muted">Network</div>
                  <div className="theme-heading mt-1 font-semibold">
                    {getChainLabel(campaignChainId)}
                  </div>
                </div>

                <div>
                  <div className="theme-muted">Campaign Address</div>
                  <div className="theme-heading mt-1 break-all font-medium">
                    {address}
                  </div>
                </div>

                {metadataMeta.uri && (
                  <div>
                    <div className="theme-muted">Metadata Source</div>
                    <div className="theme-heading mt-1 break-all font-medium">
                      {metadataMeta.uri}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <DonationMomentModal
      isOpen={donationMomentOpen}
      moment={donationMoment}
      onClose={handleCloseDonationMoment}
    />
    </>
  );
}
