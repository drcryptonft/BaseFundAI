import TrustBadge from "./TrustBadge";
import { getTrustToneStyles } from "../utils/trustPresentation";

function SignalRow({ signal }) {
  const percentage = signal.maxScore
    ? Math.round((signal.score / signal.maxScore) * 100)
    : 0;

  return (
    <div className="theme-card-soft flex flex-col rounded-3xl p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="theme-heading text-sm font-semibold leading-5">{signal.label}</span>
        <span className="theme-muted text-xs font-medium">
          {signal.score}/{signal.maxScore}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="theme-muted mt-3 text-xs leading-5">{signal.summary}</p>
    </div>
  );
}

export default function TrustSummary({ trust }) {
  if (!trust) {
    return (
      <div className="theme-card-soft rounded-2xl p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="theme-muted text-xs uppercase tracking-[0.24em]">
              Trust Engine
            </p>
            <h3 className="theme-heading mt-2 text-lg font-semibold">
              Trust review pending
            </h3>
            <p className="theme-muted mt-2 text-sm">
              This campaign has not been reviewed by the shared trust engine yet.
            </p>
          </div>

          <TrustBadge trust={null} compact />
        </div>
      </div>
    );
  }

  const styles = getTrustToneStyles(trust.badge?.tone);
  const signalOrder = new Map([
    ["content", 0],
    ["wallet-activity", 1],
    ["wallet-age", 2],
    ["passport", 3],
    ["social", 4],
    ["behavior", 5],
  ]);
  const topSignals = Array.isArray(trust.signals)
    ? [...trust.signals]
        .sort((left, right) => {
          const leftOrder = signalOrder.get(left.key) ?? 99;
          const rightOrder = signalOrder.get(right.key) ?? 99;
          return leftOrder - rightOrder;
        })
        .slice(0, 4)
    : [];
  const reviewSections = [
    trust.warnings?.length > 0
      ? {
          title: "Contributor checks",
          tone:
            "border-amber-300/60 bg-amber-50/80 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100",
          items: trust.warnings,
        }
      : null,
    trust.flags?.length > 0
      ? {
          title: "Review flags",
          tone:
            "border-rose-300/60 bg-rose-50/80 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100",
          items: trust.flags,
        }
      : null,
  ].filter(Boolean);

  return (
    <div className="theme-card rounded-3xl p-5 md:p-6">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
          <p className="theme-muted text-xs uppercase tracking-[0.24em]">
            Trust Engine
          </p>

            <div className="mt-3 flex flex-wrap items-center gap-3">
            <TrustBadge trust={trust} />
            <div className={`text-4xl font-black leading-none ${styles.accent}`}>
              {trust.trustPoints ?? trust.score}
            </div>
            <div className="theme-muted text-sm">trust points</div>
          </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <div className="theme-card-soft rounded-full px-3 py-2 text-xs font-medium">
                <span className="theme-muted">Coverage</span>
                <span className="theme-heading ml-2">{trust.coverage}%</span>
              </div>
              <div className="theme-card-soft rounded-full px-3 py-2 text-xs font-medium">
                <span className="theme-muted">Signals reviewed</span>
                <span className="theme-heading ml-2">{topSignals.length}</span>
              </div>
              {reviewSections.length > 0 && (
                <div className="theme-card-soft rounded-full px-3 py-2 text-xs font-medium">
                  <span className="theme-muted">Contributor review</span>
                  <span className="theme-heading ml-2">{reviewSections.length} blocks</span>
                </div>
              )}
            </div>
          </div>

          {trust.highlights?.length > 0 && (
            <div className="theme-card-soft rounded-3xl p-4 lg:max-w-sm">
              <div className="theme-heading text-sm font-semibold">
                Confidence signals
              </div>
              <div className="mt-3 space-y-2">
                {trust.highlights.slice(0, 3).map((highlight, index) => (
                  <div
                    key={`${highlight}-${index}`}
                    className="rounded-2xl border border-slate-200/80 bg-white/75 px-3 py-2 text-sm leading-6 dark:border-slate-700 dark:bg-slate-950/40"
                  >
                    {highlight}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {topSignals.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {topSignals.map((signal) => (
              <SignalRow key={signal.key} signal={signal} />
            ))}
          </div>
        )}

        {reviewSections.length > 0 && (
          <div
            className={`grid gap-3 ${
              reviewSections.length > 1 ? "lg:grid-cols-2" : "lg:grid-cols-1"
            }`}
          >
            {reviewSections.map((section) => (
              <div
                key={section.title}
                className={`rounded-2xl border p-4 text-sm ${section.tone}`}
              >
                <div className="font-semibold">{section.title}</div>
                <div className="mt-2 space-y-2">
                  {section.items.map((item, index) => (
                    <p key={`${item}-${index}`} className="leading-6">
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
