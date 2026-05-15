import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";

export default function FAQSection() {
  const [open, setOpen] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const faqs = [
    {
      q: "What is BaseFundAI?",
      a: "BaseFundAI is a decentralized micro-funding protocol running on supported test networks including Base Sepolia, Arc Testnet, and Robinhood Testnet. It enables anyone to create and support campaigns using smart contracts without relying on centralized platforms.",
    },
    {
      q: "Is BaseFundAI a crowdfunding platform?",
      a: "No. BaseFundAI is not a custodial platform. It is open infrastructure where funds move directly between users via smart contracts.",
    },
    {
      q: "Are contributions investments?",
      a: "No. All contributions are donations. There is no equity, profit sharing, or financial return involved.",
    },
    {
      q: "Who controls the funds?",
      a: "No one. BaseFundAI is non-custodial. Funds move directly from contributor to campaign contract to creator without platform control.",
    },
    {
      q: "What are the funding limits?",
      a: "Each campaign has a minimum goal of $50 and a maximum of $1,000. This ensures fair usage and focuses on real, small-scale needs.",
    },
    {
      q: "What happens if a campaign does not reach its goal?",
      a: "If the goal is not reached before the deadline, contributors can claim a full refund directly from the smart contract.",
    },
    {
      q: "What happens if a campaign is successful?",
      a: "If the funding goal is reached, the campaign is marked successful and the creator can claim the funds.",
    },
    {
      q: "Does BaseFundAI charge fees?",
      a: "There are no mandatory fees. Users can optionally add a small support donation to help sustain protocol development.",
    },
    {
      q: "What currency is used?",
      a: "Campaigns use the supported stable asset on each network: USDC on Base Sepolia and Arc Testnet, and USDG on Robinhood Testnet. This keeps funding targets stable without introducing price volatility.",
    },
    {
      q: "Do I need permission to create a campaign?",
      a: "No. BaseFundAI is permissionless. Anyone can create a campaign without approvals or verification.",
    },
    {
      q: "Does BaseFundAI verify campaigns?",
      a: "No. The protocol does not verify claims or guarantee outcomes. Users should evaluate campaigns independently.",
    },
    {
      q: "How does the AI feature work?",
      a: "BaseFundAI includes lightweight AI tools to help creators write better campaign descriptions. It runs client-side only and no data is stored or shared.",
    },
    {
      q: "Is BaseFundAI safe to use?",
      a: "It uses transparent smart contracts and on-chain verification. Users should still review campaigns carefully before contributing.",
    },
    {
      q: "Can BaseFundAI be used globally?",
      a: "Yes. Anyone with a crypto wallet can create or contribute to campaigns from anywhere in the world.",
    },
    {
      q: "Is BaseFundAI regulated?",
      a: "BaseFundAI is software infrastructure, not a financial institution. It does not provide financial services or act as an intermediary.",
    },
  ];

  return (
    <section className="relative px-6 py-20">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:40px_40px] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)]" />

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <div className="mb-4 inline-block rounded-full bg-emerald-500/10 px-4 py-1 text-xs text-emerald-700 dark:text-emerald-400">
          SUPPORT
        </div>

        <h2 className="theme-heading mb-3 text-4xl font-bold">
          Frequently Asked <span className="text-emerald-500">Questions</span>
        </h2>

        <p className="theme-muted mb-10">
          Everything you need to know about funding, security, and using
          BaseFundAI.
        </p>

        <div className="space-y-4 text-left">
          {(showAll ? faqs : faqs.slice(0, 6)).map((item, index) => (
            <div key={index} className="theme-card overflow-hidden">
              <button
                onClick={() => setOpen(open === index ? null : index)}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <span className="theme-heading font-medium">{item.q}</span>

                <motion.span
                  animate={{ rotate: open === index ? 45 : 0 }}
                  className="text-emerald-500 dark:text-emerald-400"
                >
                  <Plus />
                </motion.span>
              </button>

              <AnimatePresence>
                {open === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="theme-muted px-5 pb-4 text-sm"
                  >
                    {item.a}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-6 text-sm text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-white"
        >
          {showAll ? "Show Less" : "View More"}
        </button>
      </div>
    </section>
  );
}
