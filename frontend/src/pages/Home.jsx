import { useEffect, useState } from "react";
import { useChainId } from "wagmi";

import Hero from "../components/Hero";
import CampaignList from "../components/CampaignList";
import WhySection from "../components/WhySection";
import FAQSection from "../components/FAQSection";
import CTASection from "../components/CTASection";
import SeoMeta from "../components/SeoMeta";

import { requestCampaignSummary } from "../utils/campaignFeed";

const STATS_CACHE_PREFIX = "homeStatsCacheV1";
const STATS_CACHE_TTL_MS = 60000;

function getEmptyStats() {
  return {
    raised: 0,
    campaigns: 0,
    backers: 0,
  };
}

function formatCompactNumber(value, options = {}) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
    ...options,
  }).format(value);
}

function getStatsCacheKey(chainId) {
  return `${STATS_CACHE_PREFIX}:${Number(chainId || 0)}`;
}

function readStatsCache(chainId) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const cached = JSON.parse(
      localStorage.getItem(getStatsCacheKey(chainId)) || "null"
    );

    if (!cached?.stats || !cached?.timestamp) {
      return null;
    }

    if (Date.now() - Number(cached.timestamp) > STATS_CACHE_TTL_MS) {
      return null;
    }

    return cached.stats;
  } catch {
    return null;
  }
}

function writeStatsCache(chainId, stats) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(
      getStatsCacheKey(chainId),
      JSON.stringify({
        timestamp: Date.now(),
        stats,
      })
    );
  } catch {
    // Ignore storage failures and continue with in-memory state.
  }
}

function getInitialStats(chainId) {
  const cachedStats = readStatsCache(chainId);

  if (cachedStats) {
    return cachedStats;
  }

  return getEmptyStats();
}

export default function Home() {
  const chainId = useChainId();
  const [stats, setStats] = useState(() => getInitialStats(chainId));

  useEffect(() => {
    let cancelled = false;

    setStats(getInitialStats(chainId));

    async function refreshStats() {
      try {
        const response = await requestCampaignSummary({ chainId });
        const nextStats = response?.summary || getEmptyStats();

        if (cancelled) {
          return;
        }

        setStats(nextStats);
        writeStatsCache(chainId, nextStats);
      } catch (err) {
        if (!cancelled) {
          console.log("Stats error:", err);
        }
      }
    }

    void refreshStats();

    const interval = setInterval(() => {
      void refreshStats();
    }, 30000);

    const handleUpdate = (event) => {
      if (
        event?.detail?.chainId &&
        Number(event.detail.chainId) !== Number(chainId)
      ) {
        return;
      }

      void refreshStats();
    };

    window.addEventListener("campaign-updated", handleUpdate);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("campaign-updated", handleUpdate);
    };
  }, [chainId]);

  return (
    <div className="space-y-16">
      <SeoMeta
        title="BaseFundAI | Transparent crowdfunding on Base, Arc, and Robinhood"
        description="Launch and support transparent crowdfunding campaigns on Base Sepolia, Arc Testnet, and Robinhood Testnet with non-custodial smart contracts."
        path="/"
        keywords={[
          "crowdfunding",
          "web3 fundraising",
          "base sepolia",
          "arc testnet",
          "robinhood testnet",
        ]}
      />

      <Hero stats={stats} />

      <div className="theme-shell grid grid-cols-3 gap-4 px-4 py-10 text-center">
        <div>
          <h3 className="theme-heading text-2xl font-bold">
            ${formatCompactNumber(stats.raised)}
          </h3>
          <p className="theme-muted">Raised</p>
        </div>

        <div>
          <h3 className="theme-heading text-2xl font-bold">
            {formatCompactNumber(stats.campaigns)}
          </h3>
          <p className="theme-muted">Campaigns</p>
        </div>

        <div>
          <h3 className="theme-heading text-2xl font-bold">
            {formatCompactNumber(stats.backers)}
          </h3>
          <p className="theme-muted">Backers</p>
        </div>
      </div>

      <WhySection />
      <FAQSection />
      <CTASection />

      <div>
        <h2 className="theme-heading mb-6 text-2xl font-semibold">
          Trending Campaigns{" "}
          <span className="theme-muted text-sm">(Top performing)</span>
        </h2>

        <CampaignList sort="TRENDING" limit={3} hideFilters />
      </div>
    </div>
  );
}
