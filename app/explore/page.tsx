"use client";

import { Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { CampaignCard } from "@/components/campaign-card";
import { useApi } from "@/lib/hooks/use-api";
import type { Campaign } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const categories = ["All", "Web3", "Food & Drink", "Gaming", "Lifestyle"];

export default function ExplorePage() {
  const { data: allCampaigns, isLoading } = useApi<Campaign[]>("/api/campaigns");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [platform, setPlatform] = useState("all");

  const campaigns = useMemo(
    () =>
      (allCampaigns || []).filter((campaign) => {
        const matchesSearch =
          campaign.title.toLowerCase().includes(search.toLowerCase()) ||
          campaign.brandName.toLowerCase().includes(search.toLowerCase());
        const matchesCategory =
          category === "All" || campaign.category === category;
        const matchesPlatform =
          platform === "all" ||
          campaign.platform === "all" ||
          campaign.platform === platform;
        return campaign.status === "OPEN" && matchesSearch && matchesCategory && matchesPlatform;
      }),
    [allCampaigns, search, category, platform],
  );

  return (
    <>
      <section className="border-b-2 border-ink bg-blue text-white">
        <div className="page-shell py-14 sm:py-20">
          <Badge tone="lime" className="mb-5">Creator marketplace</Badge>
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <h1 className="font-display text-6xl uppercase leading-[0.82] sm:text-8xl">
                Find your
                <br />
                <span className="font-editorial text-lime">next brief.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-white/70">
                Browse funded campaigns, read the rules, make something people
                want to watch, and earn testnet USDC.
              </p>
            </div>
            <div className="border-2 border-ink bg-cream p-5 text-ink shadow-brutal-lg">
              <div className="flex items-center gap-3">
                <Sparkles className="text-orange" />
                <div>
                  <p className="font-display text-3xl">{campaigns.length}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-ink/50">
                    Open opportunities
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="sticky top-[76px] z-30 border-b-2 border-ink bg-cream">
        <div className="page-shell py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <label className="relative block flex-1">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/45"
                size={18}
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search campaign or brand..."
                className="field pl-11"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((item) => (
                <button
                  key={item}
                  onClick={() => setCategory(item)}
                  className={cn(
                    "border-2 border-ink px-3 py-2 text-[10px] font-black uppercase shadow-brutal-sm",
                    category === item ? "bg-lime" : "bg-white",
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 border-2 border-ink bg-white px-3 shadow-brutal-sm">
              <SlidersHorizontal size={15} />
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
                className="h-10 bg-transparent text-[10px] font-black uppercase outline-none"
              >
                <option value="all">All platforms</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="instagram">Instagram</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="page-shell min-h-[550px] py-12">
        {isLoading ? (
          <div className="grid min-h-80 place-items-center border-2 border-ink bg-white p-8">
            <p className="font-display text-4xl uppercase animate-pulse">Loading briefs...</p>
          </div>
        ) : campaigns.length > 0 ? (
          <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        ) : (
          <div className="grid min-h-80 place-items-center border-2 border-dashed border-ink bg-white p-8 text-center">
            <div>
              <p className="font-display text-4xl uppercase">No briefs found</p>
              <p className="mt-2 text-sm text-ink/55">
                Try another search, category, or platform.
              </p>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
