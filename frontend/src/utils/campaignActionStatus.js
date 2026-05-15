function getActionStatusKey(campaignAddress, walletAddress) {
  if (!campaignAddress || !walletAddress) return "";
  return `${campaignAddress.toLowerCase()}-${walletAddress.toLowerCase()}`;
}

export function getCampaignActionStatus(campaignAddress, walletAddress) {
  const key = getActionStatusKey(campaignAddress, walletAddress);
  if (!key) return {};

  try {
    const map = JSON.parse(localStorage.getItem("campaignActionStatus") || "{}");
    return map[key] || {};
  } catch {
    return {};
  }
}

export function setCampaignActionStatus(
  campaignAddress,
  walletAddress,
  nextStatus
) {
  const key = getActionStatusKey(campaignAddress, walletAddress);
  if (!key) return;

  try {
    const map = JSON.parse(localStorage.getItem("campaignActionStatus") || "{}");

    map[key] = {
      ...(map[key] || {}),
      ...nextStatus,
    };

    localStorage.setItem("campaignActionStatus", JSON.stringify(map));
  } catch (error) {
    console.log("Campaign action status storage error:", error);
  }
}
