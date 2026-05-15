import { motion } from "framer-motion";
import { FaTwitter, FaTelegram, FaDiscord, FaMedium } from "react-icons/fa";
import { Link } from "react-router-dom";
import logo from "../assets/logo.png";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (index) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: index * 0.08,
      duration: 0.5,
      ease: "easeOut",
    },
  }),
};

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-slate-200/80 bg-slate-50/80 px-6 pb-10 pt-20 text-slate-950 dark:border-slate-800 dark:bg-slate-950/80 dark:text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.08),transparent_40%)]" />

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-10 md:flex-row md:justify-between">
        <motion.div
          className="md:w-[30%]"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          custom={0}
        >
          <div className="mb-4 flex items-center gap-3">
            <img src={logo} className="h-10 w-10 rounded-xl" />
            <h2 className="text-2xl font-bold tracking-tight">BaseFundAI</h2>
          </div>

          <p className="max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Decentralized crowdfunding infrastructure powered by stable assets.
            Launch, fund, and scale campaigns transparently with on-chain trust
            and zero intermediaries.
          </p>

          <p className="mt-3 text-xs text-slate-500">
            Base Sepolia + Arc Testnet + Robinhood Testnet | USDC + USDG | Fully
            On-chain
          </p>
        </motion.div>

        <FooterColumn
          className="md:w-[14%]"
          index={1}
          title="Menu"
          links={[
            { label: "Home", to: "/" },
            { label: "Explore Campaigns", to: "/explore" },
            { label: "Create Campaign", to: "/create" },
            { label: "My Contributions", to: "/dashboard" },
            { label: "FAQ", to: "/faq" },
          ]}
        />

        <FooterColumn
          className="md:w-[14%]"
          index={2}
          title="Products"
          links={[
            { label: "Launch Campaign", to: "/create" },
            { label: "Contribute", to: "/explore" },
            { label: "Campaign Dashboard", to: "/dashboard" },
            {
              label: (
                <>
                  Analytics{" "}
                  <span className="text-xs text-emerald-500 dark:text-emerald-400">
                    (Soon)
                  </span>
                </>
              ),
              to: "#",
            },
          ]}
        />

        <motion.div
          className="md:w-[12%]"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          custom={3}
        >
          <h3 className="mb-4 font-semibold tracking-wide">Follow Us</h3>

          <div className="space-y-3 text-sm">
            <a
              href="https://x.com/basefundai"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Social icon={<FaTwitter />} label="Twitter" />
            </a>

            <div className="flex items-center gap-2">
              <Social icon={<FaTelegram />} label="Telegram" />
              <span className="text-xs text-emerald-500 dark:text-emerald-400">
                (Soon)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Social icon={<FaDiscord />} label="Discord" />
              <span className="text-xs text-emerald-500 dark:text-emerald-400">
                (Soon)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Social icon={<FaMedium />} label="Medium" />
              <span className="text-xs text-emerald-500 dark:text-emerald-400">
                (Soon)
              </span>
            </div>
          </div>
        </motion.div>

        <FooterColumn
          className="md:w-[12%]"
          index={4}
          title="Resources"
          links={[
            { label: "Docs", to: "#" },
            {
              label: "GitHub",
              to: "https://github.com/drcryptonft/BaseFundAI",
              external: true,
            },
            { label: "Whitepaper", to: "/whitepaper" },
            { label: "Media Kit", to: "#" },
            { label: "Why We Are Here", to: "/why" }
          ]}
        />

        <FooterColumn
          className="md:w-[10%]"
          index={5}
          title="Legal"
          links={[
            { label: "Privacy Policy", to: "/privacy" },
            { label: "Terms & Conditions", to: "/terms" },
          ]}
        />
      </div>

      <div className="relative z-10 mt-16 flex flex-col items-center justify-between border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-800 md:flex-row">
        <p>&copy; 2026 BaseFundAI. All rights reserved.</p>

        <div className="mt-2 flex gap-6 md:mt-0">
          <Link
            to="/terms"
            className="transition hover:text-slate-950 dark:hover:text-white"
          >
            Terms
          </Link>
          <Link
            to="/privacy"
            className="transition hover:text-slate-950 dark:hover:text-white"
          >
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links, index, className = "" }) {
  return (
    <motion.div
      className={className}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      custom={index}
    >
      <h3 className="mb-4 font-semibold tracking-wide">{title}</h3>

      <ul className="space-y-2 text-sm">
        {links.map((link, indexKey) => (
          <li key={indexKey}>
            {link.external ? (
              <a
                href={link.to}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative inline-block text-slate-600 transition duration-200 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
              >
                <span className="transition group-hover:translate-x-1">
                  {link.label}
                </span>
                <span className="absolute -bottom-1 left-0 h-[1px] w-0 bg-emerald-400 transition-all group-hover:w-full" />
              </a>
            ) : (
              <Link
                to={link.to}
                className="group relative inline-block text-slate-600 transition duration-200 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
              >
                <span className="transition group-hover:translate-x-1">
                  {link.label}
                </span>
                <span className="absolute -bottom-1 left-0 h-[1px] w-0 bg-emerald-400 transition-all group-hover:w-full" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function Social({ icon, label }) {
  return (
    <div className="group flex cursor-pointer items-center gap-2">
      <span className="text-lg text-slate-500 transition group-hover:scale-110 group-hover:text-emerald-500 dark:text-slate-400 dark:group-hover:text-emerald-400">
        {icon}
      </span>

      <span className="text-slate-600 transition group-hover:translate-x-1 group-hover:text-slate-950 dark:text-slate-400 dark:group-hover:text-white">
        {label}
      </span>
    </div>
  );
}
