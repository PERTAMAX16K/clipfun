"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CircleDollarSign,
  ShieldCheck,
  Sparkles,
  Upload,
  Wallet,
} from "lucide-react";
import { CampaignCard } from "@/components/campaign-card";
import { useApi } from "@/lib/hooks/use-api";
import type { Campaign } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const { data: allCampaigns } = useApi<Campaign[]>("/api/campaigns");
  const featured = (allCampaigns || []).filter((item) => item.status === "OPEN").slice(0, 3);

  return (
    <>
      <section className="border-b-2 border-ink">
        <div className="page-shell grid min-h-[680px] border-x-2 border-ink bg-cream lg:grid-cols-2">
          <div className="flex flex-col justify-center border-b-2 border-ink p-6 sm:p-10 lg:border-b-0 lg:border-r-2">
            <Badge tone="blue" className="mb-6 w-fit">
              Campaigns with proof
            </Badge>
            <h1 className="font-display text-[15vw] uppercase leading-[0.77] tracking-[-0.09em] sm:text-8xl lg:text-[6.7rem]">
              Make
              <br />
              clips.
              <br />
              <span className="font-editorial text-orange">Get paid.</span>
            </h1>
            <p className="mt-8 max-w-lg text-base leading-7 text-ink/65 sm:text-lg">
              Brands lock campaign rewards onchain. Creators make the content.
              Everyone sees the proof.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild size="lg">
                <Link href="/explore">
                  Find a campaign <ArrowRight size={18} />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/brand/create">Launch a campaign</Link>
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-ink/25 pt-5 text-[10px] font-black uppercase tracking-wider">
              <span className="flex items-center gap-2">
                <ShieldCheck size={15} className="text-blue" /> Escrow backed
              </span>
              <span className="flex items-center gap-2">
                <CircleDollarSign size={15} className="text-blue" /> USDC rewards
              </span>
              <span className="flex items-center gap-2">
                <BadgeCheck size={15} className="text-blue" /> Manual review
              </span>
            </div>
          </div>

          <div className="dot-grid relative min-h-[540px] overflow-hidden bg-blue p-6 sm:p-10">
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-ink/20" />
            <div className="relative mx-auto flex h-full max-w-lg items-center justify-center">
              <div className="absolute left-0 top-[12%] rotate-[-8deg] border-2 border-ink bg-lime px-5 py-3 font-display text-xl uppercase shadow-brutal">
                Brief funded ✓
              </div>
              <div className="relative w-[72%] rotate-3 border-2 border-ink bg-cream p-4 shadow-brutal-xl">
                <div className="relative h-72 overflow-hidden border-2 border-ink bg-orange">
                  <div className="absolute -right-12 top-5 h-52 w-52 rounded-full border-[22px] border-cream/40" />
                  <div className="absolute bottom-5 left-5 font-display text-5xl uppercase leading-[0.8] text-white">
                    Make it
                    <br />
                    <span className="font-editorial text-lime">scroll-stop.</span>
                  </div>
                  <Sparkles className="absolute right-6 top-6 text-lime" size={34} />
                </div>
                <div className="flex items-end justify-between gap-4 pt-4">
                  <div>
                    <p className="text-[10px] font-black uppercase text-ink/50">
                      Live reward
                    </p>
                    <p className="font-display text-3xl text-blue">50 USDC</p>
                  </div>
                  <div className="grid h-12 w-12 place-items-center border-2 border-ink bg-lime shadow-brutal-sm">
                    <ArrowRight />
                  </div>
                </div>
              </div>
              <div className="float-card absolute bottom-[8%] right-0 border-2 border-ink bg-white p-4 shadow-brutal-lg">
                <div className="mb-2 flex items-center gap-2">
                  <Wallet size={16} />
                  <span className="text-[10px] font-black uppercase">
                    Reward claimed
                  </span>
                </div>
                <p className="font-display text-2xl text-blue">+50.00 USDC</p>
                <p className="mt-1 text-[9px] font-bold text-ink/45">
                  Base Sepolia · Confirmed
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="ticker border-b-2 border-ink bg-lime py-3 text-xs font-black uppercase tracking-[0.18em]">
        <div>
          <span>Post it ✦ Prove it ✦ Claim it ✦ Repeat it ✦ </span>
          <span>Post it ✦ Prove it ✦ Claim it ✦ Repeat it ✦ </span>
        </div>
      </div>

      <section className="page-shell py-16 sm:py-24">
        <div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-blue">
              Open now
            </p>
            <h2 className="font-display text-5xl uppercase leading-none sm:text-7xl">
              Campaigns
              <br />
              <span className="font-editorial text-orange">worth clipping.</span>
            </h2>
          </div>
          <Link
            href="/explore"
            className="flex items-center gap-2 text-xs font-black uppercase tracking-wider underline decoration-2 underline-offset-8"
          >
            Explore all <ArrowRight size={15} />
          </Link>
        </div>
        <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-28 border-y-2 border-ink bg-white">
        <div className="page-shell grid lg:grid-cols-[0.85fr_1.15fr]">
          <div className="border-b-2 border-ink py-14 pr-0 lg:border-b-0 lg:border-r-2 lg:py-20 lg:pr-12">
            <Badge tone="orange" className="mb-5">How it works</Badge>
            <h2 className="font-display text-5xl uppercase leading-[0.9] sm:text-7xl">
              One brief.
              <br />
              Three moves.
            </h2>
            <p className="mt-6 max-w-md text-base leading-7 text-ink/60">
              A focused campaign workflow with the reward visible before the
              first edit begins.
            </p>
          </div>
          <div className="grid sm:grid-cols-3">
            {[
              {
                icon: Wallet,
                number: "01",
                title: "Fund",
                copy: "Brands lock the full reward pool before going live.",
              },
              {
                icon: Upload,
                number: "02",
                title: "Create",
                copy: "Clippers publish content and submit a verified URL.",
              },
              {
                icon: CircleDollarSign,
                number: "03",
                title: "Claim",
                copy: "Approved creators claim USDC directly from escrow.",
              },
            ].map((step, index) => (
              <article
                key={step.number}
                className={`p-7 lg:p-9 ${
                  index < 2 ? "border-b-2 sm:border-b-0 sm:border-r-2" : ""
                } border-ink`}
              >
                <div className="mb-14 flex items-center justify-between">
                  <step.icon size={28} className="text-blue" />
                  <span className="font-display text-2xl text-ink/25">
                    {step.number}
                  </span>
                </div>
                <h3 className="font-display text-3xl uppercase">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-ink/60">{step.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="for-brands" className="page-shell scroll-mt-28 py-16 sm:py-24">
        <div className="relative overflow-hidden border-2 border-ink bg-blue px-6 py-14 text-white shadow-brutal-lg sm:px-12">
          <div className="absolute -right-20 -top-32 h-96 w-96 rounded-full border-[45px] border-lime/30" />
          <div className="relative z-10 max-w-3xl">
            <p className="mb-4 text-xs font-black uppercase tracking-widest text-lime">
              Your next campaign starts here
            </p>
            <h2 className="font-display text-5xl uppercase leading-[0.9] sm:text-7xl">
              Stop chasing invoices.
              <br />
              Start making impact.
            </h2>
            <Button asChild size="lg" className="mt-8">
              <Link href="/explore">Enter the marketplace <ArrowRight size={18} /></Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
