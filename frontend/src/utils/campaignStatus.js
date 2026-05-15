import { getFundingTokenDecimals } from "../config/contracts";

export function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value.toString());
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value.toString === "function") {
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function toBool(value) {
  return value === true || value === "true";
}

export function toUsdc(value, chainId) {
  const decimals = getFundingTokenDecimals(chainId);
  return toNumber(value) / 10 ** decimals;
}

export function toSeconds(value) {
  const parsed = toNumber(value);
  return parsed > 1e12 ? Math.floor(parsed / 1000) : parsed;
}

export function getCampaignState(campaign, now = Math.floor(Date.now() / 1000)) {
  const code = toNumber(campaign?.stateCode);
  const raised = toNumber(campaign?.raised);
  const goal = toNumber(campaign?.goal);
  const deadline = toSeconds(campaign?.deadline);
  const finalized = toBool(campaign?.finalized);
  const successful = toBool(campaign?.successful);
  const fundsClaimed = toBool(campaign?.fundsClaimed);
  const goalReached = goal > 0 && raised >= goal;
  const hasEnded = deadline > 0 && deadline <= now;

  if (code === 3 || fundsClaimed) return "SETTLED";
  if (code === 1) return "SUCCESSFUL";
  if (code === 2) return "FAILED";
  if (finalized) return successful ? "SUCCESSFUL" : "FAILED";
  if (successful || goalReached) return "SUCCESSFUL";
  if (hasEnded) return goalReached ? "SUCCESSFUL" : "FAILED";
  return "ACTIVE";
}

export function getCampaignStateLabel(state) {
  if (state === "SUCCESSFUL") return "Successful";
  if (state === "FAILED") return "Failed";
  if (state === "SETTLED") return "Settled";
  return "Active";
}

export function getContributionStatus(campaign, contribution = {}) {
  const state = getCampaignState(campaign);
  const refundClaimed = toBool(
    contribution?.refundClaimed ?? contribution?.refunded
  );
  const hasContribution =
    toNumber(contribution?.amount) > 0 ||
    toNumber(contribution?.contributionCount) > 0 ||
    contribution?.hasUserContributed === true;

  if (state === "FAILED") {
    if (refundClaimed) {
      return {
        state,
        label: "Refund Claimed",
        message: "This failed campaign has already been refunded to you.",
        canRefund: false,
      };
    }

    if (hasContribution) {
      return {
        state,
        label: "Refund Available",
        message: "This campaign failed. You can claim your refund now.",
        canRefund: true,
      };
    }

    return {
      state,
      label: "Failed",
      message: "This campaign failed.",
      canRefund: false,
    };
  }

  if (state === "SETTLED") {
    return {
      state,
      label: "Settled",
      message: "This campaign succeeded and the creator has already claimed the funds.",
      canRefund: false,
    };
  }

  if (state === "SUCCESSFUL") {
    return {
      state,
      label: "Successful",
      message: toBool(campaign?.fundsClaimed)
        ? "The creator has already claimed the funds."
        : "The campaign succeeded. The creator has not claimed the funds yet.",
      canRefund: false,
    };
  }

  return {
    state,
    label: "Active",
    message: "This campaign is still live.",
    canRefund: false,
  };
}

export function getCreatorStatus(campaign) {
  const state = getCampaignState(campaign);
  const fundsClaimed = toBool(campaign?.fundsClaimed);

  if (state === "SETTLED" || fundsClaimed) {
    return {
      state: "SETTLED",
      label: "Settled",
      message: "You have already claimed this campaign's funds.",
      canClaim: false,
    };
  }

  if (state === "SUCCESSFUL") {
    return {
      state,
      label: "Successful",
      message: "This campaign succeeded and the funds are ready to claim.",
      canClaim: true,
    };
  }

  if (state === "FAILED") {
    return {
      state,
      label: "Failed",
      message: "This campaign ended without reaching its goal.",
      canClaim: false,
    };
  }

  return {
    state,
    label: "Active",
    message: "This campaign is still accepting contributions.",
    canClaim: false,
  };
}
