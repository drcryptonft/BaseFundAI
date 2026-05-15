import { useState } from "react";
import { Link } from "react-router-dom";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";
import toast from "react-hot-toast";
import { CAMPAIGN_ABI } from "../contracts";
import SeoMeta from "../components/SeoMeta";
import { useApp } from "../providers/AppProvider";
import useDashboardData from "../hooks/useDashboardData";
import {
  getContributionStatus,
  getCreatorStatus,
} from "../utils/campaignStatus";
import { setCampaignActionStatus } from "../utils/campaignActionStatus";
import { getChainLabel, isSupportedChain } from "../config/networks";

function formatAddress(address = "") {
  if (!address) return "Unknown campaign";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function Dashboard() {
  const {
    userContributions,
    userCampaigns,
    setUserContributions,
    setUserCampaigns,
  } = useApp();
  const { address } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient({ chainId });
  const publicClient = usePublicClient();
  const { loading } = useDashboardData();
  const [busyKey, setBusyKey] = useState("");

  async function ensureCorrectNetwork() {
    if (!walletClient) {
      throw new Error("Connect wallet");
    }

    const chainId = await walletClient.getChainId();

    if (!isSupportedChain(chainId)) {
      throw new Error(
        `Please switch to a supported network. Current: ${getChainLabel(chainId)}`
      );
    }
  }

  function parseError(error) {
    if (error?.shortMessage) return error.shortMessage;
    if (error?.message) return error.message;
    return "Transaction failed";
  }

  async function handleRefund(campaignAddress) {
    if (!walletClient || !publicClient) {
      toast.error("Connect wallet");
      return;
    }

    const nextBusyKey = `${campaignAddress}-refund`;

    try {
      setBusyKey(nextBusyKey);
      await ensureCorrectNetwork();

      const toastId = toast.loading("Claiming refund...");

      const hash = await walletClient.writeContract({
        address: campaignAddress,
        abi: CAMPAIGN_ABI,
        functionName: "refund",
        account: walletClient.account,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status !== "success") {
        throw new Error("Refund failed");
      }

      setCampaignActionStatus(campaignAddress, walletClient.account.address, {
        refundClaimed: true,
      });

      setUserContributions((prev) =>
        prev.map((item) =>
          item.campaign?.toLowerCase() === campaignAddress.toLowerCase()
            ? {
                ...item,
                refunded: true,
                refundClaimed: true,
              }
            : item
        )
      );

      window.dispatchEvent(
        new CustomEvent("campaign-updated", {
          detail: {
            address: campaignAddress,
            chainId,
            refundClaimed: true,
          },
        })
      );

      toast.success("Refund claimed", { id: toastId });
    } catch (error) {
      toast.error(parseError(error));
    } finally {
      setBusyKey("");
    }
  }

  async function handleClaimFunds(campaignAddress) {
    if (!walletClient || !publicClient) {
      toast.error("Connect wallet");
      return;
    }

    const nextBusyKey = `${campaignAddress}-claim`;

    try {
      setBusyKey(nextBusyKey);
      await ensureCorrectNetwork();

      const toastId = toast.loading("Claiming funds...");

      const hash = await walletClient.writeContract({
        address: campaignAddress,
        abi: CAMPAIGN_ABI,
        functionName: "claimFunds",
        account: walletClient.account,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status !== "success") {
        throw new Error("Claim failed");
      }

      setCampaignActionStatus(campaignAddress, walletClient.account.address, {
        fundsClaimed: true,
      });

      setUserCampaigns((prev) =>
        prev.map((campaign) =>
          campaign.address?.toLowerCase() === campaignAddress.toLowerCase()
            ? {
                ...campaign,
                fundsClaimed: true,
                stateCode: 3,
                raised: 0,
              }
            : campaign
        )
      );

      setUserContributions((prev) =>
        prev.map((item) =>
          item.campaign?.toLowerCase() === campaignAddress.toLowerCase()
            ? {
                ...item,
                campaignData: item.campaignData
                  ? {
                      ...item.campaignData,
                      fundsClaimed: true,
                      stateCode: 3,
                      raised: 0,
                    }
                  : item.campaignData,
              }
            : item
        )
      );

      window.dispatchEvent(
        new CustomEvent("campaign-updated", {
          detail: {
            address: campaignAddress,
            chainId,
            fundsClaimed: true,
            stateCode: 3,
            raised: 0,
          },
        })
      );

      toast.success("Funds claimed", { id: toastId });
    } catch (error) {
      toast.error(parseError(error));
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div className="space-y-10">
      <SeoMeta
        title="Dashboard"
        description="Manage your BaseFundAI contributions, refunds, campaign status, and creator claims."
        path="/dashboard"
        noIndex
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">Dashboard</h2>
          <p className="theme-muted mt-1 text-sm">
            Track contribution refunds, creator claims, and settlement status in one place.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 md:items-end">
          <Link
            to="/dashboard/monitoring"
            className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-400 hover:text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
          >
            Open Monitoring
          </Link>
          <span className="theme-muted break-all text-sm">
            {address || "Connect wallet"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href="#contributions"
          className="rounded-full border border-slate-300 bg-white/80 px-4 py-2 text-sm text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:text-white"
        >
          My Contributions
        </a>
        <a
          href="#campaigns"
          className="rounded-full border border-slate-300 bg-white/80 px-4 py-2 text-sm text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:text-white"
        >
          My Campaigns
        </a>
      </div>

      <section id="contributions">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-950 dark:text-white">My Contributions</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {userContributions.length} tracked
          </span>
        </div>

        {loading && userContributions.length === 0 ? (
          <p className="theme-muted">Loading your contributions...</p>
        ) : userContributions.length === 0 ? (
          <p className="theme-muted">No contributions yet.</p>
        ) : (
          <div className="grid gap-4">
            {userContributions.map((contribution) => {
              const status = getContributionStatus(
                contribution.campaignData,
                contribution
              );
              const isRefundBusy =
                busyKey === `${contribution.campaign}-refund`;

              return (
                <div
                  key={contribution.id}
                  className="theme-card p-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="theme-muted text-sm">
                        Campaign: {formatAddress(contribution.campaign)}
                      </div>
                      <div className="text-2xl font-semibold text-slate-950 dark:text-white">
                        ${contribution.amount.toFixed(2)}
                      </div>
                      <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {status.label}
                      </div>
                      <p className="theme-muted max-w-2xl text-sm">
                        {status.message}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 md:min-w-[220px]">
                      {status.canRefund && (
                        <button
                          onClick={() => handleRefund(contribution.campaign)}
                          disabled={isRefundBusy}
                          className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isRefundBusy ? "Processing..." : "Claim Refund"}
                        </button>
                      )}

                      <Link
                        to={`/campaign/${contribution.campaign}?chainId=${chainId}`}
                        className="rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-medium text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
                      >
                        View Campaign
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section id="campaigns">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-950 dark:text-white">My Campaigns</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {userCampaigns.length} tracked
          </span>
        </div>

        {loading && userCampaigns.length === 0 ? (
          <p className="theme-muted">Loading your campaigns...</p>
        ) : userCampaigns.length === 0 ? (
          <p className="theme-muted">No campaigns created.</p>
        ) : (
          <div className="grid gap-4">
            {userCampaigns.map((campaign) => {
              const status = getCreatorStatus(campaign);
              const isClaimBusy = busyKey === `${campaign.address}-claim`;

              return (
                <div
                  key={campaign.address}
                  className="theme-card p-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="theme-muted text-sm">
                        Campaign: {formatAddress(campaign.address)}
                      </div>
                      <div className="theme-soft text-sm">
                        Raised: ${campaign.raised?.toFixed?.(2) ?? campaign.raised}
                      </div>
                      <div className="theme-soft text-sm">
                        Goal: ${campaign.goal?.toFixed?.(2) ?? campaign.goal}
                      </div>
                      <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {status.label}
                      </div>
                      <p className="theme-muted max-w-2xl text-sm">
                        {status.message}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 md:min-w-[220px]">
                      {status.canClaim && (
                        <button
                          onClick={() => handleClaimFunds(campaign.address)}
                          disabled={isClaimBusy}
                          className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isClaimBusy ? "Processing..." : "Claim Funds"}
                        </button>
                      )}

                      <Link
                        to={`/campaign/${campaign.address}?chainId=${chainId}`}
                        className="rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-medium text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
                      >
                        View Campaign
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
