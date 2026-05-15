import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SeoMeta from "../components/SeoMeta";
import {
  clearMonitoringToken,
  getSavedMonitoringToken,
  requestMonitoringHealth,
  requestMonitoringSummary,
  saveMonitoringToken,
} from "../utils/monitoringApi";

const WINDOW_OPTIONS = [
  { label: "1H", value: 1 },
  { label: "24H", value: 24 },
  { label: "7D", value: 168 },
];

const METRIC_LABELS = {
  create_campaign: "Create Campaign",
  contribute: "Contribute",
};

const STATUS_LABELS = {
  started: "Started",
  success: "Success",
  failed: "Failed",
  cancelled: "Cancelled",
};

function formatDateTime(value) {
  if (!value) {
    return "Unavailable";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatUptime(totalSeconds) {
  const seconds = Number(totalSeconds || 0);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0s";
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${seconds}s`;
}

function formatMetricLabel(metricKey) {
  return METRIC_LABELS[metricKey] || metricKey.replace(/_/g, " ");
}

function formatStatusLabel(statusKey) {
  return STATUS_LABELS[statusKey] || statusKey.replace(/_/g, " ");
}

function formatMetadata(metadata = {}) {
  return Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${key}: ${String(value)}`);
}

function SummaryStat({ label, value, tone = "default" }) {
  const toneClass =
    tone === "good"
      ? "text-emerald-600 dark:text-emerald-300"
      : tone === "danger"
        ? "text-rose-600 dark:text-rose-300"
        : "text-slate-950 dark:text-white";

  return (
    <div className="theme-card-soft rounded-2xl p-4">
      <div className="theme-muted text-xs uppercase tracking-[0.22em]">{label}</div>
      <div className={`mt-3 text-2xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function MetricCard({ label, stats = {} }) {
  const entries = ["started", "success", "failed", "cancelled"].map((status) => ({
    status,
    count: Number(stats?.[status] || 0),
  }));

  return (
    <div className="theme-card rounded-3xl p-5">
      <div className="theme-heading text-base font-semibold">{label}</div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {entries.map((entry) => (
          <div
            key={entry.status}
            className="rounded-2xl border border-slate-200/80 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/60"
          >
            <div className="theme-muted text-[11px] uppercase tracking-[0.18em]">
              {formatStatusLabel(entry.status)}
            </div>
            <div className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
              {entry.count}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MonitoringDashboard() {
  const [tokenInput, setTokenInput] = useState(() => getSavedMonitoringToken());
  const [activeToken, setActiveToken] = useState(() => getSavedMonitoringToken());
  const [windowHours, setWindowHours] = useState(24);
  const [health, setHealth] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(Boolean(getSavedMonitoringToken()));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadMonitoring({ isRefresh = false, tokenOverride = "" } = {}) {
    const resolvedToken = String(tokenOverride || activeToken || "").trim();

    if (!resolvedToken) {
      setLoading(false);
      setRefreshing(false);
      setHealth(null);
      setSummary(null);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [nextHealth, nextSummary] = await Promise.all([
        requestMonitoringHealth({ token: resolvedToken }),
        requestMonitoringSummary({ windowHours, token: resolvedToken }),
      ]);

      setHealth(nextHealth);
      setSummary(nextSummary);
      setError("");
    } catch (requestError) {
      if (requestError?.status === 401 || requestError?.status === 403) {
        clearMonitoringToken();
        setActiveToken("");
        setHealth(null);
        setSummary(null);
        setError("Monitoring access denied. Check the admin token and try again.");
        return;
      }

      setError(requestError?.message || "Monitoring data could not be loaded");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!activeToken) {
      setLoading(false);
      return undefined;
    }

    void loadMonitoring({ tokenOverride: activeToken });

    const intervalId = window.setInterval(() => {
      void loadMonitoring({ isRefresh: true, tokenOverride: activeToken });
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [activeToken, windowHours]);

  async function unlockMonitoring(event) {
    event.preventDefault();

    const normalizedToken = String(tokenInput || "").trim();

    if (!normalizedToken) {
      setError("Enter the monitoring admin token to continue.");
      return;
    }

    saveMonitoringToken(normalizedToken);
    setActiveToken(normalizedToken);
    setError("");
    await loadMonitoring({ tokenOverride: normalizedToken });
  }

  function lockMonitoring() {
    clearMonitoringToken();
    setActiveToken("");
    setTokenInput("");
    setHealth(null);
    setSummary(null);
    setError("");
    setLoading(false);
    setRefreshing(false);
  }

  const metricEntries = useMemo(
    () => Object.entries(summary?.metrics || {}),
    [summary]
  );
  const recentErrors = summary?.errors?.recent || [];
  const monitoringEnabled = Boolean(health?.monitoring?.enabled);
  const isUnlocked = Boolean(activeToken);

  return (
    <div className="space-y-8">
      <SeoMeta
        title="Monitoring"
        description="View BaseFundAI public testnet health, errors, and critical create or contribute metrics."
        path="/dashboard/monitoring"
        noIndex
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">
            Monitoring
          </h2>
          <p className="theme-muted mt-1 text-sm">
            First-party health, errors, and create or contribute metrics for the
            public testnet. No invasive user profiling.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full border border-slate-200/80 bg-white/80 p-1 dark:border-slate-800 dark:bg-slate-950/80">
            {WINDOW_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setWindowHours(option.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  windowHours === option.value
                    ? "bg-emerald-500 text-white"
                    : "text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void loadMonitoring({ isRefresh: true })}
            disabled={refreshing || !isUnlocked}
            className="theme-button-secondary rounded-xl px-4 py-2 text-sm font-semibold"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          {isUnlocked ? (
            <button
              type="button"
              onClick={lockMonitoring}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500"
            >
              Lock
            </button>
          ) : null}
        </div>
      </div>

      {!isUnlocked ? (
        <div className="theme-card rounded-3xl p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-2">
              <h3 className="theme-heading text-lg font-semibold">
                Monitoring Access Required
              </h3>
              <p className="theme-muted text-sm">
                Enter the server-side admin token to read monitoring health,
                metrics, and recent errors. The token is not bundled into the app
                and is stored only in this browser session.
              </p>
            </div>

            <form onSubmit={unlockMonitoring} className="flex w-full max-w-lg flex-col gap-3 sm:flex-row">
              <input
                type="password"
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
                placeholder="Enter monitoring admin token"
                className="theme-input flex-1 px-4 py-3"
              />
              <button
                type="submit"
                className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
              >
                Unlock
              </button>
            </form>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-300/70 bg-rose-50/90 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
              {error}
            </div>
          ) : null}
        </div>
      ) : null}

      {isUnlocked ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryStat
          label="Monitoring"
          value={monitoringEnabled ? "Enabled" : "Disabled"}
          tone={monitoringEnabled ? "good" : "danger"}
        />
        <SummaryStat
          label="Runtime Uptime"
          value={formatUptime(health?.runtime?.uptimeSeconds)}
        />
        <SummaryStat
          label="Events Last 24H"
          value={Number(health?.monitoring?.eventsLast24h || 0)}
        />
        <SummaryStat
          label="Errors Last 24H"
          value={Number(health?.monitoring?.errorsLast24h || 0)}
          tone={Number(health?.monitoring?.errorsLast24h || 0) > 0 ? "danger" : "good"}
        />
        </div>
      ) : null}

      {isUnlocked ? (
      <div className="grid gap-4 lg:grid-cols-[1.35fr,1fr]">
        <div className="theme-card rounded-3xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="theme-heading text-lg font-semibold">Service Health</h3>
              <p className="theme-muted mt-1 text-sm">
                Current backend status from the live `health` endpoint.
              </p>
            </div>
            <Link
              to="/dashboard"
              className="text-sm font-medium text-emerald-600 transition hover:text-emerald-500 dark:text-emerald-300"
            >
              Back to Overview
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="theme-muted text-xs uppercase tracking-[0.18em]">Service</div>
              <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                {health?.service || "Unavailable"}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="theme-muted text-xs uppercase tracking-[0.18em]">
                Last Health Ping
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                {formatDateTime(health?.time)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="theme-muted text-xs uppercase tracking-[0.18em]">
                Memory RSS
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                {Number(health?.runtime?.memory?.rssMb || 0).toFixed(1)} MB
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="theme-muted text-xs uppercase tracking-[0.18em]">
                Heap Used
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                {Number(health?.runtime?.memory?.heapUsedMb || 0).toFixed(1)} MB
              </div>
            </div>
          </div>
        </div>

        <div className="theme-card rounded-3xl p-5">
          <h3 className="theme-heading text-lg font-semibold">Summary Window</h3>
          <p className="theme-muted mt-1 text-sm">
            Selected range and current data readiness for the dashboard view.
          </p>

          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="theme-muted text-xs uppercase tracking-[0.18em]">Window</div>
              <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                {summary?.windowHours || windowHours} hours
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="theme-muted text-xs uppercase tracking-[0.18em]">
                Generated At
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                {formatDateTime(summary?.generatedAt)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="theme-muted text-xs uppercase tracking-[0.18em]">
                Errors Tracked
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                {recentErrors.length}
              </div>
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {error && isUnlocked ? (
        <div className="rounded-2xl border border-rose-300/70 bg-rose-50/90 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {loading && isUnlocked ? (
        <div className="theme-card rounded-3xl p-8 text-center">
          <p className="theme-heading text-lg font-semibold">Loading monitoring data</p>
          <p className="theme-muted mt-2 text-sm">
            Pulling health, metrics, and recent errors from the live backend.
          </p>
        </div>
      ) : isUnlocked ? (
        <>
          <section className="space-y-4">
            <div>
              <h3 className="theme-heading text-lg font-semibold">Critical Flow Metrics</h3>
              <p className="theme-muted mt-1 text-sm">
                Launch-critical counts for campaign creation and contribution flows.
              </p>
            </div>

            {metricEntries.length === 0 ? (
              <div className="theme-card rounded-3xl p-6">
                <p className="theme-muted text-sm">
                  No tracked create or contribute events yet. This will populate as
                  soon as real user actions hit the app.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {metricEntries.map(([metricKey, stats]) => (
                  <MetricCard
                    key={metricKey}
                    label={formatMetricLabel(metricKey)}
                    stats={stats}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="theme-heading text-lg font-semibold">Recent Errors</h3>
              <p className="theme-muted mt-1 text-sm">
                Sanitized error summaries only. No personal data, no wallet tracking.
              </p>
            </div>

            {recentErrors.length === 0 ? (
              <div className="theme-card rounded-3xl p-6">
                <p className="theme-muted text-sm">
                  No recent errors in the selected time window.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {recentErrors.map((entry, index) => {
                  const metadataItems = formatMetadata(entry.metadata);

                  return (
                    <div key={`${entry.createdAt}-${index}`} className="theme-card rounded-3xl p-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
                              {entry.source}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                              {entry.eventType}
                            </span>
                          </div>
                          <p className="text-base font-semibold text-slate-950 dark:text-white">
                            {entry.message || "Unknown error"}
                          </p>
                          {metadataItems.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {metadataItems.map((item) => (
                                <span
                                  key={item}
                                  className="rounded-full border border-slate-200/80 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="theme-muted text-sm">
                          {formatDateTime(entry.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
