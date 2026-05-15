import { motion } from "framer-motion";
import { Zap, ShieldCheck, BarChart3, Link2 } from "lucide-react";

const features = [
  {
    icon: <Zap size={28} />,
    title: "Trustless Funding",
    desc: "Contribute directly from your wallet with no intermediaries. Funds move through smart contracts, not platforms.",
  },
  {
    icon: <ShieldCheck size={28} />,
    title: "Transparent & Verifiable",
    desc: "All transactions are recorded on-chain. Contributions and fund flows are publicly verifiable at any time.",
  },
  {
    icon: <BarChart3 size={28} />,
    title: "Outcome-Based Release",
    desc: "Funds are only released when campaign conditions are met, ensuring accountability and efficient capital usage.",
  },
  {
    icon: <Link2 size={28} />,
    title: "Non-Custodial Infrastructure",
    desc: "BaseFundAI never holds funds. Value flows directly between contributors and creators through smart contracts.",
  },
];

export default function WhySection() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-6xl text-center">
        <h2 className="theme-heading mb-4 text-4xl font-bold">
          Why BaseFundAI?
        </h2>

        <p className="theme-muted mx-auto mb-12 max-w-2xl leading-relaxed">
          A non-custodial funding infrastructure where campaigns,
          contributions, and fund flows are executed entirely on-chain.
        </p>

        <div className="grid gap-6 md:grid-cols-4">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
              className="theme-card p-6 text-left transition hover:-translate-y-1 hover:border-emerald-400/40 hover:shadow-[0_24px_60px_rgba(16,185,129,0.14)]"
            >
              <div className="mb-4 text-emerald-500 dark:text-emerald-400">
                {feature.icon}
              </div>

              <h3 className="theme-heading mb-2 text-lg font-semibold">
                {feature.title}
              </h3>

              <p className="theme-muted text-sm leading-relaxed">
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
