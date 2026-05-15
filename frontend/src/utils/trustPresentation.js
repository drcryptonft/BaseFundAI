const toneMap = {
  emerald: {
    badge: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
    dot: "bg-emerald-500 dark:bg-emerald-300",
    accent: "text-emerald-700 dark:text-emerald-200",
  },
  sky: {
    badge: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
    dot: "bg-sky-500 dark:bg-sky-300",
    accent: "text-sky-700 dark:text-sky-200",
  },
  amber: {
    badge: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
    dot: "bg-amber-500 dark:bg-amber-300",
    accent: "text-amber-700 dark:text-amber-200",
  },
  rose: {
    badge: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
    dot: "bg-rose-500 dark:bg-rose-300",
    accent: "text-rose-700 dark:text-rose-200",
  },
  slate: {
    badge: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
    dot: "bg-slate-500 dark:bg-slate-300",
    accent: "text-slate-700 dark:text-slate-200",
  },
};

export function getTrustToneStyles(tone = "slate") {
  return toneMap[tone] || toneMap.slate;
}
