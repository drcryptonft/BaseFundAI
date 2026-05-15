export default function CampaignAnalytics({ campaign }) {
  if (!campaign) return null;

  const averageSupport =
    campaign.backerCount > 0 ? campaign.raised / campaign.backerCount : 0;
  const viewerMetricLabel = campaign.contribution > 0 ? "Your Support" : "Average Support";
  const viewerMetricValue =
    campaign.contribution > 0 ? campaign.contribution : averageSupport;

  return (
    <div className="space-y-5">
      <div>
        <p className="theme-muted text-xs uppercase tracking-[0.24em]">
          Campaign Analytics
        </p>
        <h3 className="theme-heading mt-2 text-xl font-semibold">
          Participation at a glance
        </h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="theme-card-soft rounded-3xl p-4">
          <div className="theme-muted text-xs uppercase tracking-[0.2em]">
            Backers
          </div>
          <div className="theme-heading mt-2 text-2xl font-black">
            {campaign.backerCount ?? 0}
          </div>
        </div>

        <div className="theme-card-soft rounded-3xl p-4">
          <div className="theme-muted text-xs uppercase tracking-[0.2em]">
            Pledges
          </div>
          <div className="theme-heading mt-2 text-2xl font-black">
            {campaign.contributionCount ?? 0}
          </div>
        </div>

        <div className="theme-card-soft rounded-3xl p-4">
          <div className="theme-muted text-xs uppercase tracking-[0.2em]">
            {viewerMetricLabel}
          </div>
          <div className="theme-heading mt-2 text-2xl font-black">
            ${viewerMetricValue.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="theme-card-soft rounded-3xl p-4">
        <div className="theme-soft flex flex-wrap items-center justify-between gap-3 text-sm">
          <span>Raised so far</span>
          <span className="theme-heading font-semibold">
            ${campaign.raised.toFixed(2)} of ${campaign.goal.toFixed(2)}
          </span>
        </div>
        <p className="theme-muted mt-3 text-sm leading-6">
          Contributors respond faster when the page shows steady participation, clear
          identity signals, and a direct use of funds.
        </p>
      </div>
    </div>
  );
}
