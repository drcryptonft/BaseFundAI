import { motion } from "framer-motion";

export default function CTASection() {
  return (
    <section className="px-6 py-24 md:px-12">
      <div className="theme-shell mx-auto flex max-w-5xl items-center justify-center px-8 py-16 text-center md:px-14">
        <div className="max-w-4xl">
          <p className="mb-4 text-sm tracking-[0.25em] text-emerald-600 dark:text-emerald-400">
            GET STARTED
          </p>

          <h2 className="theme-heading mb-6 text-4xl font-bold leading-tight md:text-6xl">
            Ready to Fund or Create?
          </h2>

          <p className="theme-muted mx-auto mb-10 max-w-2xl text-lg leading-relaxed md:text-xl">
            Experience transparent, non-custodial micro-funding on BaseFundAI.
            Support real people or launch your own campaign, fully on-chain.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <motion.a
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              href="/create"
              className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-8 py-3 font-semibold text-slate-900 shadow-lg shadow-emerald-400/25 transition-all duration-300 hover:shadow-xl"
            >
              Start a Campaign
            </motion.a>

            <motion.a
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              href="/explore"
              className="theme-button-secondary px-8"
            >
              Explore Campaigns
            </motion.a>
          </div>
        </div>
      </div>
    </section>
  );
}
