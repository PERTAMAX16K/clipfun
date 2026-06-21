"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CircleDollarSign,
  FileText,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { getErrorMessage, useApiMutation } from "@/lib/hooks/use-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Campaign, CampaignDraft } from "@/lib/types";
import { cn, formatUsdc } from "@/lib/utils";

const getDefaultDeadline = () => {
  const date = new Date();
  date.setDate(date.getDate() + 10);
  return date.toISOString().slice(0, 10);
};

const initialDraft: CampaignDraft = {
  title: "",
  summary: "",
  brief: "",
  requirements: [""],
  prohibited: [""],
  category: "Web3",
  platform: "all",
  rewardPerSubmission: 25,
  maxWinners: 5,
  deadline: getDefaultDeadline(),
};

const steps = [
  { number: 1, label: "Details", icon: FileText },
  { number: 2, label: "Rewards", icon: CircleDollarSign },
  { number: 3, label: "Review", icon: Check },
];

export default function CreateCampaignPage() {
  return (
    <AuthGate memberOnly>
      <CreateCampaignContent />
    </AuthGate>
  );
}

function CreateCampaignContent() {
  const router = useRouter();
  const { mutate: createCampaign } = useApiMutation<Campaign>();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(initialDraft);
  const [requirementsText, setRequirementsText] = useState(
    "Vertical 9:16 video\nShow the product clearly\nInclude campaign code in caption",
  );
  const [prohibitedText, setProhibitedText] = useState(
    "False or misleading claims\nReused watermarked content",
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const rewardPool = draft.rewardPerSubmission * draft.maxWinners;
  const fee = rewardPool * 0.05;
  const total = rewardPool + fee;

  const validation = useMemo(() => {
    if (step === 1) {
      if (draft.title.trim().length < 5) return "Title must be at least 5 characters.";
      if (draft.title.length > 50) return "Title must be 50 characters or fewer.";
      if (draft.summary.trim().length < 20) return "Add a clearer campaign summary.";
      if (draft.brief.trim().length < 40) return "Brief must explain the creative direction.";
    }
    if (step === 2) {
      if (draft.rewardPerSubmission <= 0) return "Reward must be greater than zero.";
      if (draft.maxWinners < 1) return "Add at least one paid winner.";
      if (new Date(draft.deadline) <= new Date()) return "Deadline must be in the future.";
    }
    return "";
  }, [draft, step]);

  function nextStep(event?: FormEvent) {
    event?.preventDefault();
    if (validation) {
      setError(validation);
      return;
    }
    setError("");
    setDraft((current) => ({
      ...current,
      requirements: requirementsText.split("\n").filter(Boolean),
      prohibited: prohibitedText.split("\n").filter(Boolean),
    }));
    setStep((current) => Math.min(current + 1, 3));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleCreate() {
    setSaving(true);
    try {
      const campaign = await createCampaign("/api/campaigns", {
        method: "POST",
        body: {
          ...draft,
          requirements: requirementsText.split("\n").filter(Boolean),
          prohibited: prohibitedText.split("\n").filter(Boolean),
          deadline: new Date(draft.deadline).toISOString(),
        }
      });
      router.push(`/brand?created=${campaign.id}`);
    } catch (e: unknown) {
      console.error(e);
      alert("Error: " + getErrorMessage(e));
      setSaving(false);
    }
  }

  return (
    <section className="page-shell py-10 sm:py-14">
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <Badge tone="orange" className="mb-4">Campaign builder</Badge>
          <h1 className="font-display text-5xl uppercase leading-none sm:text-7xl">
            Build the
            <br />
            <span className="font-editorial text-blue">perfect brief.</span>
          </h1>
        </div>
        <p className="max-w-sm text-sm leading-6 text-ink/55">
          Draft first, fund second. Your campaign stays private until the full
          deposit is confirmed.
        </p>
      </div>

      <div className="mb-8 grid border-2 border-ink bg-white shadow-brutal sm:grid-cols-3">
        {steps.map((item, index) => (
          <div
            key={item.number}
            className={cn(
              "flex items-center gap-3 p-4",
              index < 2 && "border-b-2 border-ink sm:border-b-0 sm:border-r-2",
              step === item.number ? "bg-lime" : step > item.number ? "bg-blue text-white" : "",
            )}
          >
            <span className="grid h-9 w-9 place-items-center border-2 border-ink bg-cream text-ink">
              {step > item.number ? <Check size={16} /> : item.number}
            </span>
            <div>
              <p className="text-[9px] font-black uppercase opacity-50">
                Step {item.number}
              </p>
              <p className="font-black uppercase">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <form
          onSubmit={nextStep}
          className="border-2 border-ink bg-white p-5 shadow-brutal-lg sm:p-8"
        >
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue">
                  Creative direction
                </p>
                <h2 className="font-display text-4xl uppercase">Campaign details</h2>
              </div>
              <div>
                <label className="label" htmlFor="title">
                  Campaign title · 5-50 characters
                </label>
                <input
                  id="title"
                  className="field"
                  maxLength={50}
                  placeholder="e.g. Make crypto feel human"
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                />
                <p className="mt-2 text-right text-[9px] font-bold text-ink/40">
                  {draft.title.length}/50
                </p>
              </div>
              <div>
                <label className="label" htmlFor="summary">
                  One-line summary · min 20 characters
                </label>
                <input
                  id="summary"
                  className="field"
                  placeholder="What should creators make?"
                  value={draft.summary}
                  onChange={(event) =>
                    setDraft({ ...draft, summary: event.target.value })
                  }
                />
                <p className="mt-2 text-right text-[9px] font-bold text-ink/40">
                  {draft.summary.trim().length}/20 min
                </p>
              </div>
              <div>
                <label className="label" htmlFor="brief">
                  Detailed brief · min 40 characters
                </label>
                <textarea
                  id="brief"
                  className="field min-h-36 resize-y"
                  placeholder="Explain the hook, story, tone, and call to action..."
                  value={draft.brief}
                  onChange={(event) =>
                    setDraft({ ...draft, brief: event.target.value })
                  }
                />
                <p className="mt-2 text-right text-[9px] font-bold text-ink/40">
                  {draft.brief.trim().length}/40 min
                </p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="requirements">
                    Requirements · one per line
                  </label>
                  <textarea
                    id="requirements"
                    className="field min-h-32 resize-y"
                    value={requirementsText}
                    onChange={(event) => setRequirementsText(event.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="prohibited">
                    Prohibited · one per line
                  </label>
                  <textarea
                    id="prohibited"
                    className="field min-h-32 resize-y"
                    value={prohibitedText}
                    onChange={(event) => setProhibitedText(event.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="reference">
                  Reference attachment (optional)
                </label>
                <input
                  id="reference"
                  type="url"
                  className="field"
                  placeholder="e.g. Google Drive link or example TikTok video"
                  value={draft.referenceAttachment || ""}
                  onChange={(event) =>
                    setDraft({ ...draft, referenceAttachment: event.target.value })
                  }
                />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="label">Category</label>
                  <select
                    className="field"
                    value={draft.category}
                    onChange={(event) =>
                      setDraft({ ...draft, category: event.target.value })
                    }
                  >
                    <option>Web3</option>
                    <option>Food & Drink</option>
                    <option>Gaming</option>
                    <option>Lifestyle</option>
                    <option>Technology</option>
                  </select>
                </div>
                <div>
                  <label className="label">Platform</label>
                  <select
                    className="field"
                    value={draft.platform}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        platform: event.target.value as CampaignDraft["platform"],
                      })
                    }
                  >
                    <option value="all">All platforms</option>
                    <option value="tiktok">TikTok</option>
                    <option value="youtube">YouTube Shorts</option>
                    <option value="instagram">Instagram Reels</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-7">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue">
                  Budget & timing
                </p>
                <h2 className="font-display text-4xl uppercase">Set the reward</h2>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="reward">
                    Reward per approved clip
                  </label>
                  <div className="relative">
                    <input
                      id="reward"
                      type="number"
                      min={1}
                      className="field pr-20"
                      value={draft.rewardPerSubmission}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          rewardPerSubmission: Number(event.target.value),
                        })
                      }
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-blue">
                      USDC
                    </span>
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="winners">
                    Maximum paid submissions
                  </label>
                  <input
                    id="winners"
                    type="number"
                    min={1}
                    className="field"
                    value={draft.maxWinners}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        maxWinners: Number(event.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="deadline">
                  Submission deadline
                </label>
                <div className="relative">
                  <CalendarDays
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-blue"
                    size={18}
                  />
                  <input
                    id="deadline"
                    type="date"
                    className="field pl-12"
                    value={draft.deadline}
                    onChange={(event) =>
                      setDraft({ ...draft, deadline: event.target.value })
                    }
                  />
                </div>
              </div>
              <div className="border-2 border-ink">
                <div className="flex justify-between border-b border-ink/20 p-4 text-sm">
                  <span>Reward pool</span>
                  <strong>{formatUsdc(rewardPool)}</strong>
                </div>
                <div className="flex justify-between border-b border-ink/20 p-4 text-sm">
                  <span>Platform fee reserve (5%)</span>
                  <strong>{formatUsdc(fee)}</strong>
                </div>
                <div className="flex items-center justify-between bg-lime p-5">
                  <span className="font-black uppercase">Total deposit</span>
                  <strong className="font-display text-3xl text-blue">
                    {formatUsdc(total)}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue">
                  Final check
                </p>
                <h2 className="font-display text-4xl uppercase">Review campaign</h2>
              </div>
              <div className="mt-7 border-2 border-ink">
                <div className="bg-blue p-6 text-white">
                  <Badge tone="lime">{draft.category}</Badge>
                  <h3 className="mt-4 font-display text-4xl uppercase leading-none">
                    {draft.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-white/70">
                    {draft.summary}
                  </p>
                </div>
                <div className="grid sm:grid-cols-3">
                  {[
                    ["Reward", formatUsdc(draft.rewardPerSubmission)],
                    ["Paid spots", draft.maxWinners],
                    ["Total deposit", formatUsdc(total)],
                  ].map(([label, value], index) => (
                    <div
                      key={label}
                      className={`p-5 ${
                        index < 2
                          ? "border-b-2 sm:border-b-0 sm:border-r-2"
                          : ""
                      } border-ink`}
                    >
                      <p className="text-[9px] font-black uppercase text-ink/40">
                        {label}
                      </p>
                      <p className="mt-1 font-display text-xl text-blue">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-6 border-2 border-dashed border-ink bg-cream p-5 text-sm leading-6">
                <strong>This creates a private draft.</strong> You will fund and
                publish it from the Brand dashboard. No USDC moves during
                this step.
              </div>
            </div>
          )}

          {error && (
            <p className="mt-6 border-2 border-red-500 bg-red-50 p-3 text-xs font-bold text-red-700">
              {error}
            </p>
          )}

          <div className="mt-8 flex flex-col-reverse justify-between gap-3 border-t-2 border-ink pt-6 sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              onClick={() => (step === 1 ? router.push("/brand") : setStep(step - 1))}
            >
              <ArrowLeft size={16} /> {step === 1 ? "Cancel" : "Back"}
            </Button>
            {step < 3 ? (
              <Button type="submit">
                Continue <ArrowRight size={16} />
              </Button>
            ) : (
              <Button type="button" onClick={handleCreate} disabled={saving}>
                {saving ? (
                  <LoaderCircle size={17} className="animate-spin" />
                ) : (
                  <Sparkles size={17} />
                )}
                {saving ? "Saving draft..." : "Create campaign draft"}
              </Button>
            )}
          </div>
        </form>

        <aside className="h-fit border-2 border-ink bg-blue p-6 text-white shadow-brutal-lg">
          <p className="text-[10px] font-black uppercase tracking-widest text-lime">
            Live preview
          </p>
          <div className="mt-5 border-2 border-ink bg-cream p-4 text-ink shadow-brutal">
            <div className="grid h-44 place-items-center border-2 border-ink bg-orange overflow-hidden px-4">
              <span className="break-all text-center font-display text-3xl uppercase text-white line-clamp-3">
                {draft.title ? draft.title.slice(0, 18) : "Your campaign"}
              </span>
            </div>
            <p className="mt-4 break-words font-display text-2xl uppercase leading-none">
              {draft.title || "Campaign title"}
            </p>
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-ink/55">
              {draft.summary || "A sharp summary will appear here."}
            </p>
            <div className="mt-4 flex justify-between border-t border-ink/20 pt-3 text-[10px] font-black uppercase">
              <span className="text-blue">
                {formatUsdc(draft.rewardPerSubmission)}
              </span>
              <span>{draft.maxWinners} spots</span>
            </div>
          </div>
          <p className="mt-6 text-xs leading-5 text-white/60">
            Strong briefs specify the hook, what must appear on screen, what
            creators should avoid, and one clear call to action.
          </p>
        </aside>
      </div>
    </section>
  );
}
