import { ArrowUpRight, Play } from "lucide-react";
import type { Campaign } from "@/lib/types";
import { cn } from "@/lib/utils";

const styles = {
  blue: "bg-blue text-white",
  orange: "bg-orange text-white",
  lime: "bg-lime text-ink",
  purple: "bg-[#8b5cf6] text-white",
};

export function CampaignVisual({
  campaign,
  compact = false,
}: {
  campaign: Campaign;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative isolate flex overflow-hidden border-b-2 border-ink p-5",
        compact ? "h-52" : "h-80",
        styles[campaign.visual],
      )}
    >
      <div className="absolute -right-12 -top-16 h-56 w-56 rounded-full border-[24px] border-current opacity-20" />
      <div className="absolute -bottom-16 -left-12 h-48 w-48 rotate-12 border-[18px] border-current opacity-20" />
      <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-ink bg-cream shadow-brutal-lg">
        <div className="grid h-full -rotate-45 place-items-center">
          <Play className="fill-ink" size={34} />
        </div>
      </div>
      <span className="relative z-10 self-start border border-ink bg-cream px-3 py-1 text-[10px] font-black uppercase text-ink">
        {campaign.category}
      </span>
      <ArrowUpRight className="relative z-10 ml-auto" />
      <p className="relative z-10 mt-auto max-w-[60%] font-display text-3xl uppercase leading-[0.88]">
        {campaign.brandName}
      </p>
    </div>
  );
}
