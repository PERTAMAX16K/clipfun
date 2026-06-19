import Link from "next/link";
import { ArrowRight, CalendarDays, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CampaignVisual } from "@/components/campaign-visual";
import type { Campaign } from "@/lib/types";
import { formatDate, formatUsdc } from "@/lib/utils";

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  return (
    <article className="group flex h-full flex-col border-2 border-ink bg-white shadow-brutal transition-transform hover:-translate-y-1">
      <CampaignVisual campaign={campaign} compact />
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center border border-ink bg-cream text-[10px] font-black">
              {campaign.brandAvatar}
            </span>
            <span className="text-xs font-bold">{campaign.brandName}</span>
          </div>
          <Badge tone="lime">{campaign.status}</Badge>
        </div>
        <h3 className="mb-2 font-display text-3xl uppercase leading-[0.92]">
          {campaign.title}
        </h3>
        <p className="mb-5 line-clamp-2 text-sm leading-6 text-ink/65">
          {campaign.summary}
        </p>
        <div className="mb-5 mt-auto grid grid-cols-2 gap-3 border-y border-ink/20 py-3 text-xs">
          <div>
            <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-ink/50">
              Reward
            </p>
            <p className="font-black text-blue">
              {formatUsdc(campaign.rewardPerSubmission)}
            </p>
          </div>
          <div>
            <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-ink/50">
              Spots left
            </p>
            <p className="font-black">
              {campaign.maxWinners - campaign.paidWinners}
            </p>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-3 text-[10px] font-bold uppercase">
          <span className="flex items-center gap-1">
            <CalendarDays size={13} /> {formatDate(campaign.deadline)}
          </span>
          <span className="flex items-center gap-1">
            <Users size={13} /> {campaign.submissionCount} submissions
          </span>
        </div>
        <Link
          href={`/campaigns/${campaign.id}`}
          className="flex items-center justify-between border-t-2 border-ink pt-4 text-xs font-black uppercase tracking-wider"
        >
          View campaign
          <ArrowRight
            size={17}
            className="transition-transform group-hover:translate-x-1"
          />
        </Link>
      </div>
    </article>
  );
}
