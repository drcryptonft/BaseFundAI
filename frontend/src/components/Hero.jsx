import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export default function Hero() {
  return (
    <div className="theme-shell relative overflow-hidden px-6 py-14 shadow-[0_0_80px_rgba(16,185,129,0.08)] md:px-12 md:py-20">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/10 blur-2xl opacity-40" />

      <div className="relative grid items-center gap-10 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-8 text-left"
        >
          <div className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-200">
            On-chain Funding Infrastructure
          </div>

          <div className="text-xs text-emerald-500 dark:text-emerald-400">
            Live campaigns powered by smart contracts
          </div>

          <h1 className="text-3xl font-black leading-tight sm:text-4xl md:text-4xl">
            <span className="theme-heading block">Fund real-life needs</span>
            <span className="block bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
              without intermediaries
            </span>
          </h1>

          <p className="text-base font-medium text-emerald-700 dark:text-emerald-300">
            Let&apos;s make someone&apos;s life better today.
          </p>

          <p className="theme-muted max-w-xl text-lg leading-relaxed">
            Create and support campaigns using transparent, non-custodial smart
            contracts. All contributions are on-chain, verifiable, and fully
            controlled by users.
          </p>

          <div className="flex flex-col gap-4 pt-2 sm:flex-row">
            <Link
              to="/create"
              className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-400/30 transition hover:scale-[1.05]"
            >
              Start Campaign
            </Link>

            <Link to="/explore" className="theme-button-secondary">
              Explore Campaigns
            </Link>
          </div>

          <div className="pt-2 text-xs text-slate-500 dark:text-slate-500">
            Base Sepolia + Arc Testnet + Robinhood Testnet | USDC + USDG |
            Transparent | Non-Custodial
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative h-[320px]"
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400/10 via-teal-300/10 to-slate-800 blur-3xl" />
          <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" />

          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
            className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300/40 bg-white/70 shadow-[0_0_80px_rgba(16,185,129,0.18)] dark:border-emerald-500/10 dark:bg-slate-900/50 dark:shadow-[0_0_80px_rgba(16,185,129,0.18)]"
          />

          <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-200/40 bg-emerald-500/12 dark:border-emerald-500/10 dark:bg-emerald-500/5" />

          <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-4xl font-black text-emerald-500 shadow-lg shadow-emerald-500/20 dark:bg-slate-900 dark:text-emerald-300">
            $
          </div>

          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="absolute left-10 top-12 flex h-14 w-14 items-center justify-center rounded-full border border-white/60 bg-white/85 text-lg font-bold text-slate-900 shadow-lg shadow-slate-900/5 dark:border-white/10 dark:bg-white/10 dark:text-white dark:shadow-none"
          >
            USD
          </motion.div>

          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 2.5 }}
            className="absolute right-6 top-20 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/20 text-sm font-semibold text-emerald-700 dark:text-emerald-100"
          >
            LIVE
          </motion.div>

          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute bottom-10 left-16 flex h-12 w-12 items-center justify-center rounded-full bg-teal-400/20 text-sm font-semibold text-teal-700 dark:text-teal-100"
          >
            WEB3
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
