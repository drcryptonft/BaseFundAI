import { useEffect, useState } from "react";
import { decodeEventLog, formatUnits, parseAbiItem, parseUnits } from "viem";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";
import toast from "react-hot-toast";
import {
  CAMPAIGN_ABI,
  ERC20_ABI,
  getFundingTokenDecimals,
  getFundingTokenSymbol,
  getPlatformWallet,
  getUsdcAddress,
} from "../contracts";
import { getChainLabel, isSupportedChain } from "../config/networks";
import { loadCampaignCache, saveCampaignCache } from "../utils/campaignCache";
import {
  buildFallbackDonationMoment,
  isDonationMomentEnabled,
  requestDonationMoment,
} from "../utils/donationMoment";
import { trackAppError, trackAppMetric } from "../utils/appMonitoring";

const CONTRIBUTED_EVENT = parseAbiItem(
  "event Contributed(address indexed user, uint256 amount, uint256 totalRaised)"
);

function toFundingTokenValue(amount, decimals) {
  return Number(formatUnits(BigInt(amount || 0n), decimals));
}

export default function ContributeBox({
  address,
  campaignChainId,
  campaignHeadline,
  campaignImage,
  onContributionSuccess,
  onDonationMoment,
}) {
  const { address: user } = useAccount();
  const walletChainId = useChainId();
  const resolvedChainId = Number(campaignChainId || walletChainId || 0);
  const publicClient = usePublicClient({ chainId: resolvedChainId });
  const { data: walletClient } = useWalletClient({ chainId: resolvedChainId });
  const tokenDecimals = getFundingTokenDecimals(resolvedChainId);
  const tokenSymbol = getFundingTokenSymbol(resolvedChainId);

  const [amount, setAmount] = useState("");
  const [support, setSupport] = useState(true);
  const [supportAmount, setSupportAmount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [minimumContributionRaw, setMinimumContributionRaw] = useState(0n);
  const quickAmounts = ["10", "25", "50", "100"];

  function buildContributionMetricMetadata() {
    return {
      hasMinimumContribution: minimumContributionRaw > 0n,
      supportEnabled: Boolean(support && Number(supportAmount) > 0),
    };
  }

  useEffect(() => {
    let cancelled = false;

    async function loadMinimumContribution() {
      if (!publicClient || !address) {
        if (!cancelled) {
          setMinimumContributionRaw(0n);
        }
        return;
      }

      try {
        const minimumContribution = await publicClient.readContract({
          address,
          abi: CAMPAIGN_ABI,
          functionName: "MIN_CONTRIBUTION",
        });

        if (!cancelled) {
          setMinimumContributionRaw(BigInt(minimumContribution || 0n));
        }
      } catch {
        if (!cancelled) {
          setMinimumContributionRaw(0n);
        }
      }
    }

    void loadMinimumContribution();

    return () => {
      cancelled = true;
    };
  }, [address, publicClient]);

  function updateCampaignCache(nextRaised) {
    const cached = loadCampaignCache(resolvedChainId);

    if (!Array.isArray(cached) || cached.length === 0) {
      return;
    }

    const updated = cached.map((campaign) =>
      campaign.address?.toLowerCase() === address.toLowerCase()
        ? { ...campaign, raised: nextRaised }
        : campaign
    );

    saveCampaignCache(updated, resolvedChainId);
  }

  function getCachedRaised() {
    const cached = loadCampaignCache(resolvedChainId);

    if (!Array.isArray(cached) || cached.length === 0) {
      return null;
    }

    const cachedCampaign = cached.find(
      (campaign) => campaign.address?.toLowerCase() === address.toLowerCase()
    );

    return cachedCampaign ? Number(cachedCampaign.raised || 0) : null;
  }

  function queueDonationMoment(momentPayload) {
    if (!isDonationMomentEnabled() || typeof onDonationMoment !== "function") {
      return;
    }

    if (!momentPayload?.txHash) {
      return;
    }

    const fallbackMoment = buildFallbackDonationMoment(momentPayload);
    onDonationMoment(fallbackMoment);

    void requestDonationMoment(momentPayload)
      .then((moment) => {
        if (moment) {
          onDonationMoment(moment);
        }
      })
      .catch((error) => {
        console.log("Donation moment request error:", error);
      });
  }

  async function waitForSuccessfulReceipt(hash, failureMessage) {
    let lastError = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const receipt =
          attempt === 0
            ? await publicClient.waitForTransactionReceipt({
                hash,
                confirmations: 1,
              })
            : await publicClient.getTransactionReceipt({ hash });

        if (receipt?.status === "success") {
          return receipt;
        }

        if (receipt) {
          throw new Error(failureMessage);
        }
      } catch (error) {
        lastError = error;
      }

      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    throw lastError || new Error(failureMessage);
  }

  async function ensureCorrectNetwork() {
    if (!walletClient) {
      throw new Error("Connect wallet");
    }

    const connectedChainId = await walletClient.getChainId();

    if (connectedChainId !== resolvedChainId) {
      throw new Error(`Switch wallet to ${getChainLabel(resolvedChainId)}`);
    }

    if (!isSupportedChain(connectedChainId)) {
      throw new Error(`Unsupported network: ${getChainLabel(connectedChainId)}`);
    }
  }

  async function contribute() {
    if (!user) return toast.error("Connect wallet");
    if (!publicClient) return toast.error("Wallet not ready");
    if (!walletClient) return toast.error("Wallet not ready");
    if (!amount || Number(amount) <= 0) return toast.error("Enter contribution");
    if (!isSupportedChain(resolvedChainId)) {
      return toast.error(
        `Switch to a supported network. Current: ${getChainLabel(resolvedChainId)}`
      );
    }
    if (walletChainId !== resolvedChainId) {
      return toast.error(`Switch wallet to ${getChainLabel(resolvedChainId)}`);
    }

    try {
      setLoading(true);
      trackAppMetric({
        eventType: "contribute",
        status: "started",
        chainId: resolvedChainId,
        metadata: buildContributionMetricMetadata(),
      });
      await ensureCorrectNetwork();

      const requestedContributionAmount = parseUnits(String(amount), tokenDecimals);
      const donationAmountValue =
        support && Number(supportAmount) > 0
          ? parseUnits(String(supportAmount), tokenDecimals)
          : 0n;
      const usdcAddress = await getUsdcAddress(publicClient, resolvedChainId, address);
      const platformWallet = getPlatformWallet(resolvedChainId);

      if (!usdcAddress || !platformWallet) {
        setLoading(false);
        toast.error("Network configuration is unavailable");
        return;
      }

      const [goal, totalRaisedBefore, resolvedMinimumContribution] = await Promise.all([
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
          functionName: "MIN_CONTRIBUTION",
        }),
      ]);
      const remainingContributionAmount =
        BigInt(goal || 0n) > BigInt(totalRaisedBefore || 0n)
          ? BigInt(goal || 0n) - BigInt(totalRaisedBefore || 0n)
          : 0n;

      if (remainingContributionAmount <= 0n) {
        setLoading(false);
        toast.error("This campaign has already reached its goal");
        return;
      }

      const contributionAmount =
        requestedContributionAmount > remainingContributionAmount
          ? remainingContributionAmount
          : requestedContributionAmount;
      const minimumContributionAmount = BigInt(
        resolvedMinimumContribution || minimumContributionRaw || 0n
      );

      if (
        minimumContributionAmount > 0n &&
        contributionAmount < minimumContributionAmount &&
        remainingContributionAmount >= minimumContributionAmount
      ) {
        setLoading(false);
        toast.error(
          `Minimum contribution is ${tokenSymbol} ${toFundingTokenValue(
            minimumContributionAmount,
            tokenDecimals
          ).toFixed(2)}`
        );
        return;
      }

      const approveAmount = contributionAmount + donationAmountValue;

      // Pre-check funding-token balance to avoid failing contribute
      const balance = await publicClient.readContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [user],
      });
      if (balance < approveAmount) {
        setLoading(false);
        toast.error(`Insufficient ${tokenSymbol} for contribution + donation`);
        return;
      }

      const existingAllowance = await publicClient.readContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [user, address],
      });

      if (BigInt(existingAllowance || 0n) < approveAmount) {
        const approveHash = await walletClient.writeContract({
          address: usdcAddress,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [address, approveAmount],
          account: walletClient.account,
        });

        await waitForSuccessfulReceipt(approveHash, "Approve failed");
      }

      const contributeHash = await walletClient.writeContract({
        address,
        abi: CAMPAIGN_ABI,
        functionName: "contribute",
        args: [contributionAmount],
        account: walletClient.account,
      });

      const contributeReceipt = await waitForSuccessfulReceipt(
        contributeHash,
        "Contribution failed"
      );

      if (donationAmountValue > 0n) {
        try {
          const donationHash = await walletClient.writeContract({
            address: usdcAddress,
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [platformWallet, donationAmountValue],
            account: walletClient.account,
          });

          await publicClient.waitForTransactionReceipt({ hash: donationHash });
        } catch (donationErr) {
          console.warn("Donation failed, but contribution succeeded:", donationErr);
        }
      }

      let acceptedContributionAmount = contributionAmount;
      let totalRaisedAfter = BigInt(totalRaisedBefore || 0n) + contributionAmount;
      const cachedRaised = getCachedRaised();

      try {
        const contributionLog = contributeReceipt.logs
          .map((log) => {
            try {
              return decodeEventLog({
                abi: [CONTRIBUTED_EVENT],
                data: log.data,
                topics: log.topics,
              });
            } catch {
              return null;
            }
          })
          .find(
            (log) =>
              log?.eventName === "Contributed" &&
              String(log.args?.user || "").toLowerCase() === user.toLowerCase()
          );

        if (contributionLog) {
          acceptedContributionAmount = BigInt(
            contributionLog.args?.amount || acceptedContributionAmount
          );
          totalRaisedAfter = BigInt(contributionLog.args?.totalRaised || totalRaisedAfter);
        }
      } catch (decodeError) {
        console.log("Contribution decode error:", decodeError);
      }

      try {
        const totalRaised = await publicClient.readContract({
          address,
          abi: CAMPAIGN_ABI,
          functionName: "totalRaised",
        });

        totalRaisedAfter = BigInt(totalRaised || totalRaisedAfter);

        if (acceptedContributionAmount <= 0n && totalRaisedAfter > BigInt(totalRaisedBefore || 0n)) {
          acceptedContributionAmount =
            totalRaisedAfter - BigInt(totalRaisedBefore || 0n);
        }
      } catch (syncErr) {
        console.log("Raised sync error:", syncErr);
      }

      const acceptedContributionValue = toFundingTokenValue(
        acceptedContributionAmount,
        tokenDecimals
      );
      const nextRaised = toFundingTokenValue(totalRaisedAfter, tokenDecimals);

      if (nextRaised !== null) {
        updateCampaignCache(nextRaised);
      }

      const contributionDetail = {
        address,
        chainId: resolvedChainId,
        raised: nextRaised,
        contributionDelta: acceptedContributionValue,
        contributionAmountRaw: acceptedContributionAmount.toString(),
        contributorAddress: user,
        txHash: contributeHash,
        contributed: true,
      };
      const donationMomentPayload = {
        txHash: contributeHash,
        chainId: resolvedChainId,
        campaignAddress: address,
        donorAddress: user,
        amountRaw: acceptedContributionAmount.toString(),
        totalRaisedRaw: totalRaisedAfter.toString(),
        goalRaw: BigInt(goal || 0n).toString(),
        campaignHeadline,
        campaignImage,
      };

      if (typeof onContributionSuccess === "function") {
        onContributionSuccess(contributionDetail);
      }

      trackAppMetric({
        eventType: "contribute",
        status: "success",
        chainId: resolvedChainId,
        metadata: buildContributionMetricMetadata(),
      });
      queueDonationMoment(donationMomentPayload);

      window.dispatchEvent(
        new CustomEvent("campaign-updated", {
          detail: contributionDetail,
        })
      );
      if (acceptedContributionAmount < requestedContributionAmount) {
        toast.success(
          `Contribution successful. Only $${acceptedContributionValue.toFixed(
            2
          )} was needed to reach the goal.`
        );
      } else {
        toast.success("Contribution successful");
      }
      setAmount("");
    } catch (err) {
      console.error(err);

      if (err?.name === "UserRejectedRequestError") {
        trackAppMetric({
          eventType: "contribute",
          status: "cancelled",
          chainId: resolvedChainId,
          metadata: buildContributionMetricMetadata(),
        });
        toast.error("Transaction cancelled");
      } else {
        trackAppMetric({
          eventType: "contribute",
          status: "failed",
          chainId: resolvedChainId,
          metadata: buildContributionMetricMetadata(),
        });
        trackAppError({
          eventType: "contribute_error",
          chainId: resolvedChainId,
          message: err?.shortMessage || err?.message || "Contribution failed",
          metadata: {
            area: "contribute_box",
            errorName: String(err?.name || "unknown"),
          },
        });
        toast.error(err?.shortMessage || err?.message || "Contribution failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="theme-muted text-xs uppercase tracking-[0.24em]">
          Contribution Amount
        </label>
        <input
          className="theme-input mt-2 w-full px-4 py-3 text-base"
          placeholder={`Amount in ${tokenSymbol}`}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {quickAmounts.map((quickAmount) => (
          <button
            key={quickAmount}
            type="button"
            onClick={() => setAmount(quickAmount)}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
              amount === quickAmount
                ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"
                : "border-slate-300 bg-white text-slate-700 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            }`}
          >
            ${quickAmount}
          </button>
        ))}
      </div>

      <div className="theme-card-soft rounded-2xl p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={support}
            onChange={() => setSupport(!support)}
            className="mt-1"
          />
          <div className="min-w-0 flex-1">
            <div className="theme-heading text-sm font-semibold">
              Add a platform tip
            </div>
            <p className="theme-muted mt-1 text-xs leading-5">
              Helps keep BaseFundAI running while your contribution still goes directly
              to the campaign.
            </p>
          </div>
        </label>

        {support && (
          <input
            type="number"
            min="0"
            value={supportAmount}
            onChange={(event) => setSupportAmount(event.target.value)}
            className="theme-input mt-3 w-full px-4 py-3"
            placeholder={`Tip amount in ${tokenSymbol}`}
          />
        )}
      </div>

      <div className="rounded-2xl border border-emerald-400/25 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100">
        Contributions are confirmed onchain and reflected in the campaign once the
        transaction settles.
      </div>

      {minimumContributionRaw > 0n && (
        <div className="theme-muted text-xs">
          Minimum contribution: {tokenSymbol}{" "}
          {toFundingTokenValue(minimumContributionRaw, tokenDecimals).toFixed(2)}
        </div>
      )}

      <button
        onClick={contribute}
        disabled={loading}
        className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(16,185,129,0.25)] transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Processing..." : "Contribute Securely"}
      </button>
    </div>
  );
}
