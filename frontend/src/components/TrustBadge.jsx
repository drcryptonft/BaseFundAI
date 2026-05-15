import { getTrustToneStyles } from "../utils/trustPresentation";

export default function TrustBadge({
  trust,
  compact = false,
  showScore = true,
  pendingLabel = "Trust Pending",
}) {
  const badge = trust?.badge || {
    label: pendingLabel,
    tone: "slate",
  };
  const styles = getTrustToneStyles(badge.tone);

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border font-medium ${styles.badge} ${
        compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
      <span>{badge.label}</span>
      {showScore && typeof trust?.score === "number" && (
        <span className="opacity-80">{trust.score}/100</span>
      )}
    </span>
  );
}
