import { useState } from "react";
import CampaignList from "../components/CampaignList";
import FeaturedSlider from "../components/FeaturedSlider";
import SeoMeta from "../components/SeoMeta";

export default function Explore() {
  const [sort, setSort] = useState("TRENDING");

  return (
    <div className="space-y-10">
      <SeoMeta
        title="Explore Campaigns"
        description="Browse active, trending, and ending-soon campaigns across BaseFundAI's supported public testnet networks."
        path="/explore"
        keywords={[
          "explore campaigns",
          "crypto donations",
          "onchain support",
          "public testnet crowdfunding",
        ]}
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="theme-muted text-xs uppercase tracking-[0.24em]">
            Discover campaigns worth backing
          </p>
          <h1 className="theme-heading text-2xl font-bold sm:text-3xl">
            Explore Campaigns
          </h1>
        </div>

        <select
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          className="theme-input bg-white/90 px-4 py-2 text-sm dark:bg-slate-900/90"
        >
          <option value="TRENDING">Trending</option>
          <option value="NEW">Newest</option>
          <option value="ENDING">Ending Soon</option>
        </select>
      </div>

      <div className="mb-4">
        <FeaturedSlider />
      </div>

      <CampaignList sort={sort} />
    </div>
  );
}
