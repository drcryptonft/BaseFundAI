export function getBehaviorSignal(insights = {}) {
  const {
    creatorCampaignCount = 0,
    sharedIpCampaignCount = 0,
    sharedIpWalletCount = 0,
    duplicateFingerprintCount = 0,
    duplicateOtherWalletCount = 0,
  } = insights;

  let score = 0;
  const highlights = [];
  const warnings = [];
  const flags = [];

  if (sharedIpCampaignCount <= 1 && sharedIpWalletCount <= 1) {
    score += 6;
    highlights.push("Low shared-network abuse signal on internal checks.");
  } else if (sharedIpCampaignCount <= 3 && sharedIpWalletCount <= 2) {
    score += 4;
    warnings.push("This campaign shares a network fingerprint with other submissions.");
  } else {
    score += 1;
    flags.push(
      "Multiple wallets are submitting campaigns from the same network fingerprint."
    );
  }

  if (creatorCampaignCount === 0) {
    score += 4;
    highlights.push("No duplicate creator registry history was detected.");
  } else if (creatorCampaignCount <= 3) {
    score += 6;
    highlights.push("Creator has a small and consistent launch history.");
  } else if (creatorCampaignCount <= 6) {
    score += 5;
    warnings.push("Creator has launched several campaigns; review details carefully.");
  } else {
    score += 2;
    flags.push("Creator has a high campaign launch volume in the internal registry.");
  }

  if (duplicateOtherWalletCount === 0 && duplicateFingerprintCount === 0) {
    score += 6;
    highlights.push("Campaign copy does not match earlier registry fingerprints.");
  } else if (duplicateOtherWalletCount === 0) {
    score += 3;
    warnings.push("Campaign wording is similar to another draft from the same wallet.");
  } else {
    flags.push("Campaign wording matches submissions from other wallets in the registry.");
  }

  return {
    key: "behavior",
    label: "Behavioral Risk",
    available: true,
    score: Math.min(score, 18),
    maxScore: 18,
    summary:
      flags.length > 0
        ? "Internal duplicate and abuse heuristics found signals that need a manual review."
        : "Internal duplicate and abuse heuristics look healthy so far.",
    warnings,
    highlights,
    flags,
    stats: {
      creatorCampaignCount,
      sharedIpCampaignCount,
      sharedIpWalletCount,
      duplicateFingerprintCount,
      duplicateOtherWalletCount,
    },
  };
}
