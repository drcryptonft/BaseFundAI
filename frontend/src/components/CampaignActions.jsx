import Countdown from "./Countdown";

export default function CampaignActions({
  goal,
  raised,
  deadline,
  creator,
  finalized,
  successful,
  contribution,
  user,
  finalize,
  claimFunds,
  claimRefund,
}) {
  const now = Math.floor(Date.now() / 1000);
  const goalReached = Number(raised) >= Number(goal);
  const isCreator =
    user?.toLowerCase() === creator?.toLowerCase();

  let status = "";
  let statusColor = "";

  if (!finalized && now < Number(deadline)) {
    status = "Active";
    statusColor = "#16a34a";
  }

  if (!finalized && now >= Number(deadline)) {
    status = "Awaiting Finalization";
    statusColor = "#f59e0b";
  }

  if (finalized && successful) {
    status = "Successful";
    statusColor = "#2563eb";
  }

  if (finalized && !successful) {
    status = "Failed";
    statusColor = "#dc2626";
  }

  return (
    <div style={{ marginTop: "15px" }}>
      <div
        style={{
          padding: "6px 12px",
          borderRadius: "20px",
          backgroundColor: statusColor,
          color: "white",
          display: "inline-block",
          marginBottom: "10px",
          fontSize: "14px",
        }}
      >
        {status}
      </div>

      {!finalized && now < Number(deadline) && (
        <div>
          ⏳ Time Left: <Countdown deadline={deadline} />
        </div>
      )}

      {!finalized && now >= Number(deadline) && (
        <button onClick={finalize}>
          Finalize Campaign
        </button>
      )}

      {finalized && successful && isCreator && (
        <button onClick={claimFunds}>
          Claim Funds
        </button>
      )}

      {finalized &&
        !successful &&
        Number(contribution) > 0 && (
          <button onClick={claimRefund}>
            Claim Refund
          </button>
        )}
    </div>
  );
}