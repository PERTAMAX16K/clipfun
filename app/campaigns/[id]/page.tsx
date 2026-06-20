"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  Instagram,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  Youtube,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { CampaignVisual } from "@/components/campaign-visual";
import { getErrorMessage, useApi, useApiMutation } from "@/lib/hooks/use-api";
import { usePrivy } from "@privy-io/react-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { ActiveUser, Campaign, SocialProvider, Submission } from "@/lib/types";
import { formatDate, formatUsdc } from "@/lib/utils";

const platformIcons = {
  youtube: Youtube,
  instagram: Instagram,
  tiktok: Sparkles,
};

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { login, ready, authenticated } = usePrivy();
  const { data: currentUser } = useApi<ActiveUser>(ready && authenticated ? "/api/users/me" : null);
  const { data: allCampaigns } = useApi<Campaign[]>("/api/campaigns");
  const { mutate: postSubmission } = useApiMutation<Submission>();
  
  const activeUser = currentUser;
  const campaign = (allCampaigns || []).find((item) => item.id === params.id);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [platform, setPlatform] = useState<SocialProvider>("tiktok");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!campaign) {
    return (
      <section className="page-shell py-24 text-center">
        <h1 className="font-display text-5xl uppercase">Campaign not found</h1>
        <Button asChild className="mt-6">
          <Link href="/explore">Back to explore</Link>
        </Button>
      </section>
    );
  }

  const totalPool = campaign.rewardPerSubmission * campaign.maxWinners;
  const spotsLeft = campaign.maxWinners - campaign.paidWinners;
  const campaignId = campaign.id;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const platformHosts = {
      tiktok: "tiktok.com",
      youtube: "youtube.com",
      instagram: "instagram.com",
    };
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.includes(platformHosts[platform])) {
        throw new Error(`Enter a valid ${platform} video URL.`);
      }
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : "Enter a valid public video URL.",
      );
      return;
    }
    setLoading(true);
    try {
      await postSubmission("/api/submissions", {
        method: "POST",
        body: { campaignId, platform, postUrl: url }
      });
      setSuccess(true);
    } catch (submissionError: unknown) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : getErrorMessage(submissionError, "Submission failed."),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="border-b-2 border-ink bg-white">
        <div className="page-shell py-5">
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-wider"
          >
            <ArrowLeft size={14} /> Back to campaigns
          </Link>
        </div>
      </section>

      <section className="page-shell py-8 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="overflow-hidden border-2 border-ink bg-white shadow-brutal-lg">
              <CampaignVisual campaign={campaign} />
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Badge tone="lime">{campaign.status}</Badge>
              <Badge tone="cream">{campaign.category}</Badge>
              <Badge tone="cream">{campaign.platform}</Badge>
            </div>
            <h1 className="mt-5 max-w-3xl font-display text-5xl uppercase leading-[0.88] sm:text-7xl">
              {campaign.title}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-ink/65">
              {campaign.summary}
            </p>

            <div className="mt-10 border-t-2 border-ink pt-9">
              <h2 className="font-display text-3xl uppercase">The brief</h2>
              <p className="mt-4 max-w-3xl text-base leading-8 text-ink/70 whitespace-pre-wrap">
                {campaign.brief}
              </p>
              {campaign.referenceAttachment && (
                <div className="mt-5">
                  <a
                    href={campaign.referenceAttachment}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 border-2 border-ink bg-lime px-4 py-2 text-sm font-black uppercase hover:bg-white"
                  >
                    View Reference Attachment
                  </a>
                </div>
              )}
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="border-2 border-ink bg-white p-6 shadow-brutal">
                <h3 className="mb-5 flex items-center gap-2 font-display text-2xl uppercase">
                  <Check className="text-blue" /> Must have
                </h3>
                <ul className="space-y-4">
                  {campaign.requirements?.map((item: string) => (
                    <li key={item} className="flex gap-3 text-sm leading-6">
                      <span className="mt-2 h-2 w-2 shrink-0 bg-lime outline outline-1 outline-ink" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border-2 border-ink bg-orange p-6 text-white shadow-brutal">
                <h3 className="mb-5 font-display text-2xl uppercase">
                  Keep it clean
                </h3>
                <ul className="space-y-4">
                  {campaign.prohibited?.map((item: string) => (
                    <li key={item} className="flex gap-3 text-sm leading-6">
                      <span className="mt-2 h-2 w-2 shrink-0 bg-white" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <aside>
            <div className="sticky top-[116px] border-2 border-ink bg-white shadow-brutal-lg">
              <div className="border-b-2 border-ink bg-lime p-6">
                <p className="text-[10px] font-black uppercase tracking-widest">
                  Reward per approved video
                </p>
                <p className="mt-1 font-display text-5xl uppercase text-blue">
                  {formatUsdc(campaign.rewardPerSubmission)}
                </p>
              </div>
              <div className="grid grid-cols-2 border-b-2 border-ink">
                <div className="border-r-2 border-ink p-5">
                  <Users size={19} className="mb-3 text-blue" />
                  <p className="font-display text-2xl">{spotsLeft}</p>
                  <p className="text-[9px] font-black uppercase text-ink/50">
                    Reward spots left
                  </p>
                </div>
                <div className="p-5">
                  <CalendarDays size={19} className="mb-3 text-blue" />
                  <p className="text-sm font-black">
                    {formatDate(campaign.deadline)}
                  </p>
                  <p className="mt-1 text-[9px] font-black uppercase text-ink/50">
                    Submission deadline
                  </p>
                </div>
              </div>
              <div className="p-6">
                <Link href={`/profile/${campaign.brandId}`} className="mb-5 flex items-center gap-3 hover:underline">
                  <span className="grid h-11 w-11 place-items-center border border-ink bg-cream text-xs font-black">
                    {campaign.brandAvatar}
                  </span>
                  <div>
                    <p className="text-sm font-black">{campaign.brandName}</p>
                    <p className="flex items-center gap-1 text-[10px] font-bold text-ink/50">
                      <BadgeCheck size={12} className="text-blue" />
                      Verified brand
                    </p>
                  </div>
                </Link>

                <div className="mb-5 flex items-center justify-between border-2 border-dashed border-ink bg-cream p-3">
                  <div>
                    <p className="text-[9px] font-black uppercase text-ink/45">
                      Campaign code
                    </p>
                    <p className="font-mono text-lg font-black">
                      {campaign.campaignCode}
                    </p>
                  </div>
                  <button
                    aria-label="Copy campaign code"
                    onClick={async () => {
                      await navigator.clipboard.writeText(campaign.campaignCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1400);
                    }}
                    className="grid h-10 w-10 place-items-center border-2 border-ink bg-white shadow-brutal-sm"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={() =>
                    activeUser?.role === "clipper"
                      ? setSubmitOpen(true)
                      : !activeUser ? login() : undefined
                  }
                  disabled={campaign.status !== "OPEN" || activeUser?.role === "admin" || activeUser?.role === "brand"}
                >
                  <Upload size={18} />{" "}
                  {!activeUser ? "Sign in to submit" : activeUser.role === "clipper" ? "Submit your clip" : "Only clippers can submit"}
                </Button>
                <p className="mt-4 flex items-center justify-center gap-2 text-[9px] font-black uppercase text-ink/45">
                  <ShieldCheck size={13} /> {formatUsdc(totalPool)} funded in escrow
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <Modal
        open={submitOpen}
        onClose={() => {
          setSubmitOpen(false);
          setSuccess(false);
          setError("");
        }}
        eyebrow="Clip submission"
        title={success ? "You're in the queue" : "Submit your clip"}
      >
        {success ? (
          <div className="text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border-2 border-ink bg-lime shadow-brutal">
              <Check size={36} />
            </div>
            <p className="mt-6 text-sm leading-6 text-ink/65">
              Your clip is now under review. We will update the reward status
              once the demo admin makes a decision.
            </p>
            <Button className="mt-6 w-full" onClick={() => router.push("/clipper")}>
              View creator dashboard
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="border-2 border-ink bg-lime/40 p-4 text-xs leading-5">
              Make sure <strong>{campaign.campaignCode}</strong> appears in your
              caption or description before submitting.
            </div>
            <div>
              <label className="label">Platform</label>
              <div className="grid grid-cols-3 gap-2">
                {(["tiktok", "youtube", "instagram"] as const).map((item) => {
                  const Icon = platformIcons[item];
                  return (
                    <button
                      type="button"
                      key={item}
                      onClick={() => setPlatform(item)}
                      className={`flex flex-col items-center gap-2 border-2 border-ink p-3 text-[9px] font-black uppercase ${
                        platform === item ? "bg-blue text-white" : "bg-white"
                      }`}
                    >
                      <Icon size={19} /> {item}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="label" htmlFor="post-url">Public video URL</label>
              <input
                id="post-url"
                className="field"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder={`https://${platform}.com/...`}
                required
              />
            </div>
            {error && (
              <p className="border-2 border-red-500 bg-red-50 p-3 text-xs font-bold text-red-700">
                {error}
              </p>
            )}
            <Button className="w-full" size="lg" disabled={loading}>
              {loading ? "Checking & submitting..." : "Submit for review"}
              {!loading && <ExternalLink size={16} />}
            </Button>
            <p className="text-center text-[9px] font-bold uppercase tracking-wider text-ink/40">
              Demo validation only · No social API call
            </p>
          </form>
        )}
      </Modal>
    </>
  );
}
