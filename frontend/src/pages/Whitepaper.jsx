import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Database,
  FileText,
  Globe2,
  Layers3,
  Lock,
  Network,
  Server,
  Share2,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import SeoMeta from "../components/SeoMeta";

const sections = [
  { id: "summary", title: "Executive Summary" },
  { id: "principles", title: "Design Principles" },
  { id: "lifecycle", title: "User and Campaign Lifecycle" },
  { id: "networks", title: "Network and Asset Strategy" },
  { id: "contracts", title: "Smart-Contract and Settlement Model" },
  { id: "trust", title: "Trust and Verification" },
  { id: "metadata", title: "Metadata Integrity and Profile Assembly" },
  { id: "architecture", title: "System Architecture" },
  { id: "security", title: "Security, Privacy, and Risk Boundaries" },
  { id: "growth", title: "Social Proof and Growth Layer" },
  { id: "economics", title: "Economics and Product Boundaries" },
  { id: "conclusion", title: "Conclusion" },
];

const summaryStats = [
  {
    value: "3",
    label: "Supported networks",
    body: "Base Sepolia, Arc Testnet, and Robinhood Testnet are reflected in the current product surface.",
  },
  {
    value: "0",
    label: "Mandatory platform fees",
    body: "The fundraising model is built around direct contributions, with an optional voluntary support tip.",
  },
  {
    value: "Direct",
    label: "Custody model",
    body: "Funds move through campaign contracts rather than through a platform-held balance layer.",
  },
];

const readingGuideCards = [
  {
    label: "Product lens",
    body: "How campaigns are created, discovered, supported, and settled from the user’s point of view.",
  },
  {
    label: "Trust lens",
    body: "How verification context, storytelling quality, and metadata integrity shape contributor confidence.",
  },
  {
    label: "System lens",
    body: "How contracts, indexing, and service layers come together to support the public experience.",
  },
];

const principleCards = [
  {
    icon: ShieldCheck,
    title: "Non-custodial by default",
    body:
      "The product is designed so that contribution and settlement logic runs through campaign contracts rather than discretionary platform custody.",
  },
  {
    icon: Sparkles,
    title: "Trust assistance without gatekeeping",
    body:
      "BaseFundAI uses trust signals and contributor-facing context, but does not turn campaign launch into a closed approval process.",
  },
  {
    icon: Wallet,
    title: "Stable-asset fundraising",
    body:
      "Campaign goals are framed in stable assets so real-world fundraising targets stay easier to interpret and less distorted by volatility.",
  },
  {
    icon: Globe2,
    title: "Human-scale global support",
    body:
      "The product direction is intentionally focused on direct help, small-scale needs, and transparent support rather than speculative finance.",
  },
];

const lifecycleCards = [
  {
    eyebrow: "1. Create",
    title: "Campaign launch",
    body:
      "Creators connect a wallet, prepare a campaign story, optionally run a trust preview, upload media-backed metadata, and create the campaign through the factory contract.",
  },
  {
    eyebrow: "2. Discover",
    title: "Campaign review",
    body:
      "Contributors browse campaigns through a combined view of indexed data, direct chain reads, trust context, and metadata-backed storytelling.",
  },
  {
    eyebrow: "3. Support",
    title: "Contribution flow",
    body:
      "The app validates network context, checks token balance, handles approval and contribution, and can optionally attach a voluntary support tip.",
  },
  {
    eyebrow: "4. Settle",
    title: "Claims and refunds",
    body:
      "Successful campaigns expose creator claims. Unsuccessful campaigns expose contributor refunds. Both flows are represented directly in the product experience.",
  },
];

const networkCards = [
  {
    title: "Base Sepolia",
    asset: "USDC",
    body:
      "The default user path and primary testnet footing for the current multi-network product experience.",
  },
  {
    title: "Arc Testnet",
    asset: "USDC",
    body:
      "An additional supported chain that extends the same fundraising and trust-aware flows to a second public test environment.",
  },
  {
    title: "Robinhood Testnet",
    asset: "USDG",
    body:
      "A third supported testnet in the UI, reflecting the product's multi-chain direction and stable-asset-first approach.",
  },
];

const trustCards = [
  {
    icon: BadgeCheck,
    title: "Identity and reputation signals",
    body:
      "The trust model can incorporate public identity and reputation-style inputs when configured, such as Gitcoin Passport-like signals.",
  },
  {
    icon: FileText,
    title: "Content review",
    body:
      "Campaign story quality, suspicious language patterns, and narrative completeness influence contributor-facing trust context.",
  },
  {
    icon: Activity,
    title: "Wallet history",
    body:
      "Wallet age and activity on the selected network contribute to the overall trust posture presented to users.",
  },
  {
    icon: Network,
    title: "Behavioral heuristics",
    body:
      "The system applies anti-abuse and anti-duplication heuristics so repeated or suspicious campaign patterns can be flagged for contributor attention.",
  },
];

const architectureCards = [
  {
    icon: Layers3,
    title: "Frontend experience layer",
    body:
      "React and Vite power the browsing, creation, contribution, dashboard, trust presentation, and document surfaces.",
  },
  {
    icon: Wallet,
    title: "Wallet and chain layer",
    body:
      "Wagmi, Viem, and RainbowKit handle network-aware wallet connection, contract reads, and contract writes.",
  },
  {
    icon: ShieldCheck,
    title: "Contract layer",
    body:
      "Factory and campaign contracts coordinate creation, contribution, settlement, creator claims, and contributor refunds.",
  },
  {
    icon: FileText,
    title: "Metadata layer",
    body:
      "Campaign story content, media references, and socials are organized as metadata and tied back to an onchain integrity model.",
  },
  {
    icon: Database,
    title: "Registry and profile layer",
    body:
      "A backend registry helps assemble profiles, trust snapshots, metadata-backed campaign views, and resilient read paths.",
  },
  {
    icon: Server,
    title: "Service and indexing layer",
    body:
      "The stack uses backend services and Graph-based indexing together with direct chain fallbacks to improve reliability.",
  },
];

const securityCards = [
  {
    title: "Security controls visible in the product stack",
    items: [
      "server-side media handling and metadata validation",
      "request-size boundaries and rate limiting",
      "contract membership verification before profile registration",
      "network-aware transaction flow and settlement checks",
    ],
  },
  {
    title: "Privacy and user caution",
    items: [
      "onchain activity remains publicly visible because blockchain data is public",
      "the backend uses privacy-aware anti-abuse and profile assembly logic",
      "trust context helps contributors review campaigns but does not guarantee outcomes",
      "users still need to evaluate campaigns carefully before supporting them",
    ],
  },
];

const growthCards = [
  {
    icon: Share2,
    title: "Donation moments",
    body:
      "After a confirmed contribution, the product can generate a receipt-like support moment that is easier to share externally.",
  },
  {
    icon: Sparkles,
    title: "Crawler-readable sharing",
    body:
      "The social layer is designed so contribution moments can resolve into preview-friendly pages instead of dead-end wallet interactions.",
  },
  {
    icon: ArrowRight,
    title: "Trust amplification",
    body:
      "A visible support moment can help the next viewer understand that a campaign has already earned real backing.",
  },
];

function jumpToSection(id, setActive) {
  setActive(id);
  window.history.replaceState(null, "", `#${id}`);

  const element = document.getElementById(id);

  if (!element) {
    return;
  }

  element.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function Section({ id, title, children }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      id={id}
      className="scroll-mt-28 space-y-5"
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-emerald-400/60 via-teal-400/30 to-transparent" />
        <span className="rounded-full border border-emerald-300/50 bg-emerald-50/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100">
          Section
        </span>
      </div>

      <div>
        <h2 className="theme-heading text-2xl font-semibold md:text-3xl">{title}</h2>
      </div>

      <div className="space-y-5">{children}</div>
    </motion.section>
  );
}

function Callout({ title, tone = "emerald", children }) {
  const toneClass = {
    emerald:
      "border-emerald-300/60 bg-emerald-50/90 text-emerald-900 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100",
    sky:
      "border-sky-300/60 bg-sky-50/90 text-sky-900 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-100",
    amber:
      "border-amber-300/60 bg-amber-50/90 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100",
    rose:
      "border-rose-300/60 bg-rose-50/90 text-rose-900 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-100",
  };

  return (
    <div className={`rounded-[28px] border p-5 ${toneClass[tone] || toneClass.emerald}`}>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-2 text-sm leading-7">{children}</div>
    </div>
  );
}

function EditorialCard({ icon: Icon, title, body }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="theme-card group h-full rounded-[28px] p-5"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/50 bg-emerald-50 text-emerald-700 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100">
        <Icon size={20} />
      </div>
      <h3 className="theme-heading mt-5 text-lg font-semibold">{title}</h3>
      <p className="theme-soft mt-3 text-sm leading-7">{body}</p>
    </motion.div>
  );
}

function ListCard({ title, items }) {
  return (
    <div className="theme-card rounded-[28px] p-5">
      <h3 className="theme-heading text-lg font-semibold">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={item}
            className="theme-card-soft flex items-start gap-3 rounded-2xl px-4 py-3"
          >
            <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" />
            <div className="theme-soft text-sm leading-7">{item}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Whitepaper() {
  const [active, setActive] = useState(sections[0].id);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const elements = sections
      .map((section) => document.getElementById(section.id))
      .filter(Boolean);

    if (elements.length === 0) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);

        if (visible[0]?.target?.id) {
          setActive(visible[0].target.id);
        }
      },
      {
        rootMargin: "-16% 0px -62% 0px",
        threshold: [0.15, 0.35, 0.55],
      }
    );

    elements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const hash = String(window.location.hash || "").replace(/^#/, "");

    if (!hash || !sections.some((section) => section.id === hash)) {
      return;
    }

    const timer = window.setTimeout(() => {
      jumpToSection(hash, setActive);
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="space-y-8 pb-8">
      <SeoMeta
        title="Whitepaper"
        description="Read the public edition of the BaseFundAI whitepaper covering product design, trust-aware fundraising, metadata integrity, multi-network support, and non-custodial settlement."
        path="/whitepaper"
        keywords={[
          "basefundai whitepaper",
          "non-custodial crowdfunding",
          "trust-aware fundraising",
          "stable asset crowdfunding",
          "metadata integrity",
          "base sepolia",
          "arc testnet",
          "robinhood testnet",
        ]}
      />

      <section className="theme-shell relative overflow-hidden px-6 py-8 md:px-10 md:py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0.44))] dark:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_30%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_26%),linear-gradient(180deg,rgba(2,6,23,0.82),rgba(2,6,23,0.62))]" />
        <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute right-0 top-12 h-48 w-48 rounded-full bg-sky-400/15 blur-3xl" />

        <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.12fr)_340px]">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            <div className="inline-flex items-center rounded-full border border-emerald-300/50 bg-emerald-50/85 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100">
              Public Edition
            </div>

            <div className="space-y-4">
              <h1 className="theme-heading max-w-4xl text-4xl font-black leading-[1.04] md:text-6xl">
                BaseFundAI Whitepaper
              </h1>
              <p className="theme-soft max-w-4xl text-base leading-8 md:text-lg">
                A trust-aware, non-custodial crowdfunding system built for real-world
                needs, stable-asset fundraising, and contributor-facing transparency
                across multiple public test networks.
              </p>
            </div>

            <div className="rounded-[30px] border border-white/70 bg-white/70 p-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-slate-950/45">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300">
                Editorial focus
              </div>
              <p className="theme-heading mt-3 max-w-3xl text-xl font-semibold leading-8">
                This edition is written to explain the product experience, trust model,
                and onchain mechanics in a way that is useful to creators, supporters,
                and ecosystem partners evaluating how BaseFundAI works in practice.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {summaryStats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    delay: reduceMotion ? 0 : index * 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="theme-card rounded-[28px] p-5"
                >
                  <div className="theme-heading text-3xl font-black">{stat.value}</div>
                  <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
                    {stat.label}
                  </div>
                  <p className="theme-soft mt-3 text-sm leading-7">{stat.body}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, x: 20 }}
            animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="theme-card h-fit rounded-[32px] p-6 xl:sticky xl:top-24"
          >
            <div className="space-y-4">
              <div>
                <div className="theme-muted text-xs uppercase tracking-[0.24em]">
                  Reading guide
                </div>
                <div className="theme-heading mt-3 text-xl font-semibold">
                  How this document unfolds
                </div>
                <p className="theme-soft mt-3 text-sm leading-7">
                  It moves from product thesis into campaign flow, settlement logic,
                  trust presentation, metadata integrity, and system design so readers
                  can connect the experience with the mechanics behind it.
                </p>
              </div>

              <div className="space-y-3">
                {readingGuideCards.map((card) => (
                  <div
                    key={card.label}
                    className="rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-4 dark:border-slate-800 dark:bg-slate-900/80"
                  >
                    <div className="theme-muted text-[11px] uppercase tracking-[0.22em]">
                      {card.label}
                    </div>
                    <p className="theme-soft mt-2 text-sm leading-7">{card.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="xl:hidden">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => jumpToSection(section.id, setActive)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${
                active === section.id
                  ? "border-emerald-400 bg-emerald-500 text-slate-950"
                  : "border-slate-300 bg-white/90 text-slate-700 dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-200"
              }`}
            >
              {section.title}
            </button>
          ))}
        </div>
      </div>

      <div className="grid items-start gap-8 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden xl:block">
          <div className="theme-card sticky top-24 rounded-[30px] p-4">
            <div className="px-2">
              <p className="theme-muted text-xs uppercase tracking-[0.24em]">Contents</p>
              <h2 className="theme-heading mt-2 text-lg font-semibold">Whitepaper map</h2>
            </div>

            <div className="mt-4 space-y-1">
              {sections.map((section, index) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => jumpToSection(section.id, setActive)}
                  className={`block w-full rounded-2xl px-3 py-3 text-left transition ${
                    active === section.id
                      ? "bg-emerald-500 text-slate-950"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
                  }`}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] opacity-70">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="mt-1 text-sm font-medium">{section.title}</div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="space-y-14">
          <Section id="summary" title="Executive Summary">
            <p className="theme-soft text-base leading-8 md:text-lg">
              BaseFundAI is a non-custodial crowdfunding product that combines direct
              contract-based fundraising, metadata-backed storytelling, contributor-facing
              trust context, multi-network support, and social proof after successful
              contributions. The goal is not to recreate a traditional fundraising
              platform onchain, but to reduce mediation while improving clarity and
              reviewability for the people using it.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="theme-card rounded-[28px] p-5">
                <h3 className="theme-heading text-lg font-semibold">What users experience</h3>
                <div className="mt-4 space-y-3">
                  {[
                    "Wallet-based campaign creation and contribution",
                    "Trust badges and richer campaign review context",
                    "Stable-asset fundraising on supported public testnets",
                    "Creator claims and contributor refunds based on campaign outcome",
                  ].map((item) => (
                    <div
                      key={item}
                      className="theme-card-soft flex items-start gap-3 rounded-2xl px-4 py-3"
                    >
                      <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" />
                      <div className="theme-soft text-sm leading-7">{item}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="theme-card rounded-[28px] p-5">
                <h3 className="theme-heading text-lg font-semibold">What makes the stack distinct</h3>
                <div className="mt-4 space-y-3">
                  {[
                    "Hashed campaign metadata tied back to onchain commitments",
                    "Hybrid reads that combine indexers, chain data, and profile assembly",
                    "Trust-aware presentation without a centralized approval gate",
                    "Shareable post-support moments that act as public proof of backing",
                  ].map((item) => (
                    <div
                      key={item}
                      className="theme-card-soft flex items-start gap-3 rounded-2xl px-4 py-3"
                    >
                      <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-r from-sky-400 to-teal-500" />
                      <div className="theme-soft text-sm leading-7">{item}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Callout title="How to read this whitepaper" tone="sky">
              The document begins with the product thesis and user journey, then moves
              into settlement design, trust presentation, metadata integrity, and
              system architecture so readers can follow the platform from experience to
              implementation model.
            </Callout>
          </Section>

          <Section id="principles" title="Design Principles">
            <div className="grid gap-4 md:grid-cols-2">
              {principleCards.map((card) => (
                <EditorialCard key={card.title} icon={card.icon} title={card.title} body={card.body} />
              ))}
            </div>
          </Section>

          <Section id="lifecycle" title="User and Campaign Lifecycle">
            <div className="grid gap-4 md:grid-cols-2">
              {lifecycleCards.map((card) => (
                <motion.div
                  key={card.title}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="theme-card rounded-[28px] p-5"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300">
                    {card.eyebrow}
                  </div>
                  <h3 className="theme-heading mt-3 text-lg font-semibold">{card.title}</h3>
                  <p className="theme-soft mt-3 text-sm leading-7">{card.body}</p>
                </motion.div>
              ))}
            </div>

            <Callout title="Contribution-quality note" tone="sky">
              The current contribution flow is more than a single contract write. It is
              designed to validate network context, confirm user balance, process
              approval and contribution carefully, and reflect settlement back into the
              campaign experience with stronger post-transaction feedback.
            </Callout>
          </Section>

          <Section id="networks" title="Network and Asset Strategy">
            <p className="theme-soft leading-8">
              BaseFundAI currently presents a multi-network product experience across
              public test environments. The fundraising model is built around stable
              assets rather than volatile native tokens so campaigns remain easier to
              understand and compare.
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              {networkCards.map((card) => (
                <motion.div
                  key={card.title}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="theme-card rounded-[28px] p-5"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
                    Funding asset
                  </div>
                  <div className="theme-heading mt-2 text-2xl font-black">{card.asset}</div>
                  <h3 className="theme-heading mt-4 text-lg font-semibold">{card.title}</h3>
                  <p className="theme-soft mt-3 text-sm leading-7">{card.body}</p>
                </motion.div>
              ))}
            </div>

            <div className="theme-card rounded-[30px] p-6">
              <h3 className="theme-heading text-lg font-semibold">Why the stable-asset model matters</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  "clearer fundraising targets",
                  "less price-volatility distortion",
                  "cleaner contributor expectations",
                  "stronger fit for small real-world needs",
                ].map((item) => (
                  <div
                    key={item}
                    className="theme-card-soft rounded-2xl px-4 py-3 text-sm leading-7"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section id="contracts" title="Smart-Contract and Settlement Model">
            <p className="theme-soft leading-8">
              The current product model centers on a factory contract that creates
              fundraising campaigns and campaign contracts that manage contribution and
              settlement logic. From a user perspective, this means the application can
              expose direct contributor support, creator claims after success, and
              contributor refunds after failure.
            </p>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="theme-card rounded-[28px] p-5">
                <h3 className="theme-heading text-lg font-semibold">Factory responsibilities</h3>
                <div className="mt-4 space-y-3">
                  {[
                    "launch campaigns from structured campaign input",
                    "act as the source of valid campaign membership",
                    "support campaign discovery at the contract layer",
                    "anchor campaign creation to metadata references",
                  ].map((item) => (
                    <div
                      key={item}
                      className="theme-card-soft flex items-start gap-3 rounded-2xl px-4 py-3"
                    >
                      <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" />
                      <div className="theme-soft text-sm leading-7">{item}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="theme-card rounded-[28px] p-5">
                <h3 className="theme-heading text-lg font-semibold">Campaign responsibilities</h3>
                <div className="mt-4 space-y-3">
                  {[
                    "track goal, deadline, creator, and fundraising state",
                    "accept stable-asset contributions from supporters",
                    "allow creator claims when a campaign succeeds",
                    "allow refunds when a campaign does not reach its goal",
                  ].map((item) => (
                    <div
                      key={item}
                      className="theme-card-soft flex items-start gap-3 rounded-2xl px-4 py-3"
                    >
                      <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-r from-sky-400 to-teal-500" />
                      <div className="theme-soft text-sm leading-7">{item}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Callout title="Implementation takeaway" tone="amber">
              The product experience is intentionally aligned with a clear state model:
              active fundraising, successful fundraising, failed fundraising, and
              post-settlement completion.
            </Callout>
          </Section>

          <Section id="trust" title="Trust and Verification">
            <p className="theme-soft leading-8">
              Trust in BaseFundAI is presented as a layered contributor aid rather than a
              binary guarantee. The purpose is to give supporters more context, not to
              imply certainty or replace their judgment.
            </p>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {trustCards.map((card) => (
                <EditorialCard key={card.title} icon={card.icon} title={card.title} body={card.body} />
              ))}
            </div>

            <div className="theme-card rounded-[30px] p-6">
              <h3 className="theme-heading text-lg font-semibold">How trust is expressed</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="theme-card-soft rounded-2xl p-4">
                  <div className="theme-heading text-base font-semibold">Badge-based summary</div>
                  <p className="theme-soft mt-2 text-sm leading-7">
                    Campaigns can surface concise trust states that make review faster
                    for contributors.
                  </p>
                </div>
                <div className="theme-card-soft rounded-2xl p-4">
                  <div className="theme-heading text-base font-semibold">Signal-level breakdown</div>
                  <p className="theme-soft mt-2 text-sm leading-7">
                    Users can inspect a campaign through multiple lenses instead of a
                    single opaque score.
                  </p>
                </div>
                <div className="theme-card-soft rounded-2xl p-4">
                  <div className="theme-heading text-base font-semibold">Coverage-aware scoring</div>
                  <p className="theme-soft mt-2 text-sm leading-7">
                    The product reduces overconfidence when too little signal data is
                    available.
                  </p>
                </div>
              </div>
            </div>
          </Section>

          <Section id="metadata" title="Metadata Integrity and Profile Assembly">
            <p className="theme-soft leading-8">
              BaseFundAI separates campaign storytelling from onchain storage cost. A
              campaign story, media references, and socials are treated as metadata and
              tied back to an integrity model so that the user-facing campaign can stay
              rich without giving up auditability.
            </p>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="theme-card rounded-[28px] p-5">
                <h3 className="theme-heading text-lg font-semibold">What metadata carries</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    "headline",
                    "campaign story",
                    "impact plan",
                    "media references",
                    "social links",
                    "trust-adjacent profile context",
                  ].map((item) => (
                    <div
                      key={item}
                      className="theme-card-soft rounded-2xl px-4 py-3 text-sm leading-7"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="theme-card rounded-[28px] p-5">
                <h3 className="theme-heading text-lg font-semibold">How integrity is preserved</h3>
                <div className="mt-4 space-y-3">
                  {[
                    "campaign metadata is normalized and hashed",
                    "the contract stores a reference and integrity commitment",
                    "profile assembly can reconcile story content with onchain state",
                    "registry-backed profile views improve resilience and presentation",
                  ].map((item) => (
                    <div
                      key={item}
                      className="theme-card-soft flex items-start gap-3 rounded-2xl px-4 py-3"
                    >
                      <Lock size={16} className="mt-1 shrink-0 text-emerald-600 dark:text-emerald-300" />
                      <div className="theme-soft text-sm leading-7">{item}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Callout title="Why this matters" tone="emerald">
              The result is a campaign profile that feels editorial and media-rich for
              the user, while still being grounded in a verifiable integrity path.
            </Callout>
          </Section>

          <Section id="architecture" title="System Architecture">
            <div className="theme-card rounded-[32px] p-6">
              <div className="theme-muted text-xs uppercase tracking-[0.24em]">
                High-level flow
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
                {[
                  "Creator or contributor",
                  "BaseFundAI frontend",
                  "Contracts, profiles, and indexing",
                  "Trust and social proof",
                ].map((item, index) => (
                  <div key={item} className="relative">
                    <div className="theme-card-soft rounded-[24px] px-4 py-5 text-sm font-medium leading-7">
                      {item}
                    </div>
                    {index < 3 ? (
                      <div className="pointer-events-none absolute -right-2 top-1/2 hidden -translate-y-1/2 lg:block">
                        <ArrowRight size={18} className="text-emerald-500" />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {architectureCards.map((card) => (
                <EditorialCard key={card.title} icon={card.icon} title={card.title} body={card.body} />
              ))}
            </div>
          </Section>

          <Section id="security" title="Security, Privacy, and Risk Boundaries">
            <div className="grid gap-4 lg:grid-cols-2">
              {securityCards.map((card) => (
                <ListCard key={card.title} title={card.title} items={card.items} />
              ))}
            </div>

            <Callout title="Contributor safety boundary" tone="rose">
              Trust signals, profile assembly, and campaign transparency improve the
              review experience, but they do not remove smart-contract risk, creator
              execution risk, or the need for contributor caution.
            </Callout>
          </Section>

          <Section id="growth" title="Social Proof and Growth Layer">
            <p className="theme-soft leading-8">
              BaseFundAI is not limited to fundraising mechanics. The current product
              also turns contributions into shareable support moments so a confirmed act
              of backing can become a visible trust signal for the next person who sees
              the campaign.
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              {growthCards.map((card) => (
                <EditorialCard key={card.title} icon={card.icon} title={card.title} body={card.body} />
              ))}
            </div>
          </Section>

          <Section id="economics" title="Economics and Product Boundaries">
            <div className="grid gap-4 lg:grid-cols-2">
              <ListCard
                title="Current product economics"
                items={[
                  "no mandatory platform fee",
                  "optional voluntary support tip",
                  "no native token required for the current experience",
                  "no speculative finance layer required for campaign usage",
                ]}
              />
              <ListCard
                title="Current public product boundaries"
                items={[
                  "public-testnet oriented today",
                  "focused on user-visible fundraising and trust flows",
                  "not presented as an investment product",
                  "best understood as non-custodial support infrastructure",
                ]}
              />
            </div>

            <Callout title="Forward-looking direction" tone="sky">
              The next premium step for the project would be deeper production hardening:
              audits, stronger legal alignment, richer observability, fuller end-to-end
              testing, and continued refinement of the contributor review experience.
            </Callout>
          </Section>

          <Section id="conclusion" title="Conclusion">
            <p className="theme-soft text-base leading-8 md:text-lg">
              BaseFundAI is building a trust-aware, non-custodial crowdfunding system for
              real-world needs. Its strength is not any one isolated feature, but the
              way the user experience, metadata integrity model, trust presentation,
              multi-network support, and contract-based settlement fit together.
            </p>

            <p className="theme-soft text-base leading-8 md:text-lg">
              The public whitepaper page now reflects that story in a more premium,
              editorial format. It is designed to help users understand what the
              product does, why it matters, and where its current boundaries still are.
            </p>
          </Section>
        </main>
      </div>
    </div>
  );
}
