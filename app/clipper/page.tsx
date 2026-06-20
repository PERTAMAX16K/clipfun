"use client";

import Link from "next/link";
import {
  BadgeCheck,
  Check,
  CircleDollarSign,
  ExternalLink,
  Instagram,
  LoaderCircle,
  Plus,
  Sparkles,
  UserRound,
  Wallet,
  Youtube,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { useApi, useApiMutation } from "@/lib/hooks/use-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { ActiveUser, Campaign, SocialProfile, SocialProvider, Submission, Transaction } from "@/lib/types";
import { formatDate, formatUsdc, shortAddress } from "@/lib/utils";
import { useWallets, usePrivy } from "@privy-io/react-auth";
import { createWalletClient, custom, publicActions, parseUnits, stringToHex, pad } from "viem";
import { baseSepolia } from "viem/chains";
import { CAMPAIGN_ESCROW_ADDRESS, campaignEscrowAbi } from "@/lib/contracts/campaign-escrow";
import { getErrorMessage } from "@/lib/hooks/use-api";

type PayoutResponse = {
  rewardAmount: number | string;
  feeAmount: number | string;
  nonce: number | string;
  expiry: number | string;
  signature: `0x${string}`;
};

const platformIcons = {
  tiktok: Sparkles,
  youtube: Youtube,
  instagram: Instagram,
};

const statusTones = {
  SUBMITTED: "cream",
  UNDER_REVIEW: "orange",
  APPROVED: "lime",
  REJECTED: "red",
  CLAIMABLE: "lime",
  PAID: "blue",
} as const;

export default function ClipperDashboardPage() {
  return (
    <AuthGate memberOnly>
      <ClipperDashboardContent />
    </AuthGate>
  );
}

function ClipperDashboardContent() {
  const { ready, authenticated } = usePrivy();
  const { data: currentUser } = useApi<ActiveUser>(ready && authenticated ? "/api/users/me" : null);
  const { data: allSubmissions, mutate: mutateSubmissions } = useApi<Submission[]>("/api/submissions");
  const { data: allCampaigns } = useApi<Campaign[]>("/api/campaigns");
  const { data: socialProfiles, mutate: mutateProfiles } = useApi<SocialProfile[]>("/api/users/social-profiles");
  const { mutate: postClaimConfirmation } = useApiMutation<Transaction>();
  const { mutate: addProfileMutate } = useApiMutation<SocialProfile>();

  const clipper = currentUser;
  const clipperSubmissions = (allSubmissions || []).filter(
    (submission) => Boolean(clipper?.id) && submission.clipperId === clipper?.id,
  );
  const profiles = socialProfiles || [];
  const [claimTarget, setClaimTarget] = useState<Submission | null>(null);
  const [claimStep, setClaimStep] = useState<"confirm" | "processing" | "done">(
    "confirm",
  );
  const [claimResult, setClaimResult] = useState<Transaction | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [provider, setProvider] = useState<SocialProvider>("instagram");
  const [username, setUsername] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const stats = useMemo(() => {
    const paid = clipperSubmissions.filter((item) => item.status === "PAID");
    return {
      earned: paid.reduce((sum, submission) => {
        const campaign = (allCampaigns || []).find(
          (item) => item.id === submission.campaignId,
        );
        return sum + (campaign?.rewardPerSubmission ?? 0);
      }, 0),
      claimable: clipperSubmissions.filter(
        (item) => item.status === "CLAIMABLE",
      ).length,
      reviewing: clipperSubmissions.filter(
        (item) => item.status === "UNDER_REVIEW",
      ).length,
    };
  }, [clipperSubmissions, allCampaigns]);

  const { wallets } = useWallets();

  async function handleClaim() {
    if (!claimTarget) return;
    setClaimStep("processing");

    try {
      const wallet = wallets.find((w) => w.walletClientType === "privy" || w.walletClientType === "privy-v2") ?? wallets[0];
      if (!wallet) throw new Error("No wallet connected");

      const provider = await wallet.getEthereumProvider();
      const client = createWalletClient({
        account: wallet.address as `0x${string}`,
        chain: baseSepolia,
        transport: custom(provider)
      }).extend(publicActions);

      const campaign = (allCampaigns || []).find((item) => item.id === claimTarget.campaignId);
      if (!campaign) throw new Error("Campaign not found");

      const payoutRes = await fetch(`/api/submissions/${claimTarget.id}/payout`);
      if (!payoutRes.ok) {
        const errData = await payoutRes.json();
        throw new Error(errData.error || "Failed to fetch payout signature");
      }
      const payoutData = (await payoutRes.json()) as PayoutResponse;

      const submissionIdBytes32 = `0x${claimTarget.id.replace(/-/g, "").padEnd(64, "0")}` as `0x${string}`;

      const { request } = await client.simulateContract({
        account: wallet.address as `0x${string}`,
        address: CAMPAIGN_ESCROW_ADDRESS,
        abi: campaignEscrowAbi,
        functionName: 'claimReward',
        args: [
            BigInt(campaign.onchainCampaignId ?? 0),
            submissionIdBytes32,
            BigInt(payoutData.rewardAmount),
            BigInt(payoutData.feeAmount),
            BigInt(payoutData.nonce),
            BigInt(payoutData.expiry),
            payoutData.signature
        ]
      });

      const transactionHash = await client.writeContract(request);
      await client.waitForTransactionReceipt({ hash: transactionHash });

      if (!transactionHash) throw new Error("No tx hash");
      
      const transaction = await postClaimConfirmation(`/api/submissions/${claimTarget.id}/claim-confirmation`, {
        method: "POST",
        body: { txHash: transactionHash, amount: campaign?.rewardPerSubmission ?? 0 }
      });
      
      await mutateSubmissions();
      setClaimResult({ ...transaction, hash: transactionHash });
      setClaimStep("done");
    } catch (err: unknown) {
      console.error("Claim failed:", err);
      alert("Claim failed: " + getErrorMessage(err));
      setClaimStep("confirm");
    }
  }

  async function handleAddProfile() {
    if (!username || !profileUrl) {
      setProfileError("All fields are required.");
      return;
    }
    setSavingProfile(true);
    setProfileError("");
    try {
      await addProfileMutate("/api/users/social-profiles", {
        method: "POST",
        body: { provider, username, profileUrl }
      });
      await mutateProfiles();
      setProfileOpen(false);
      setUsername("");
      setProfileUrl("");
    } catch (e: unknown) {
      console.error(e);
      setProfileError(getErrorMessage(e));
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <>
      <section className="border-b-2 border-ink bg-cream">
        <div className="page-shell relative grid min-h-[320px] gap-8 border-x-2 border-ink px-6 py-12 md:grid-cols-[1fr_auto] md:items-end sm:px-12">
          <div className="absolute inset-0 dot-grid opacity-30 mix-blend-multiply" />
          <div className="relative z-10">
            <Badge tone="blue" className="mb-6 shadow-brutal-sm">Creator workspace</Badge>
            <h1 className="font-display text-6xl uppercase leading-[0.85] tracking-[-0.04em] sm:text-8xl">
              Keep clipping,
              <br />
              <span className="font-editorial text-blue">{clipper?.displayName ?? "Creator"}.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-ink/75 sm:text-lg">
              Track reviews, claim approved rewards, and keep your creator
              profiles ready for the next brief.
            </p>
          </div>
          <Button asChild size="lg" variant="black" className="relative z-10 shadow-brutal">
            <Link href="/explore">Find a campaign</Link>
          </Button>
        </div>
      </section>

      <section className="page-shell py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div>
            <div className="mb-10 grid gap-5 sm:grid-cols-3">
              {[
                {
                  label: "Total earned",
                  value: formatUsdc(stats.earned),
                  icon: CircleDollarSign,
                  bg: "bg-lime",
                },
                {
                  label: "Ready to claim",
                  value: stats.claimable,
                  icon: Wallet,
                  bg: "bg-white",
                },
                {
                  label: "Under review",
                  value: stats.reviewing,
                  icon: Sparkles,
                  bg: "bg-orange",
                },
              ].map((item) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.label}
                    className={`flex flex-col justify-between border-2 border-ink ${item.bg} p-6 shadow-brutal transition-transform hover:-translate-y-1 hover:shadow-brutal-lg`}
                  >
                    <IconComponent size={24} className="mb-8 text-ink" />
                    <div>
                      <p className="font-display text-4xl uppercase tracking-tight">{item.value}</p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-ink/60">
                        {item.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mb-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue">
                Submission tracker
              </p>
              <h2 className="font-display text-4xl uppercase">Your clips</h2>
            </div>
            <div className="space-y-4">
              {clipperSubmissions.map((submission) => {
                const campaign = (allCampaigns || []).find(
                  (item) => item.id === submission.campaignId,
                );
                const Icon = platformIcons[submission.platform as keyof typeof platformIcons];
                return (
                  <article
                    key={submission.id}
                    className="border-2 border-ink bg-white shadow-brutal transition-all hover:shadow-brutal-lg"
                  >
                    <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
                      <div className="grid h-16 w-16 shrink-0 place-items-center border-2 border-ink bg-cream shadow-brutal-sm">
                        <Icon size={28} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-3">
                          <Badge tone={statusTones[submission.status]}>
                            {submission.status.replaceAll("_", " ")}
                          </Badge>
                          <span className="text-[10px] font-black uppercase tracking-wider text-ink/40">
                            {formatDate(submission.submittedAt)}
                          </span>
                        </div>
                        <h3 className="truncate font-display text-2xl uppercase tracking-tight">
                          {submission.campaignTitle}
                        </h3>
                        <a
                          href={submission.postUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 truncate text-xs font-bold text-blue hover:underline"
                        >
                          {submission.postUrl} <ExternalLink size={12} />
                        </a>
                        {submission.rejectionReason && (
                          <p className="mt-3 border-l-2 border-red-600 bg-red-50 py-2 pl-3 text-xs font-bold text-red-700">
                            Reason: {submission.rejectionReason}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <p className="font-display text-2xl text-blue">
                          {formatUsdc(campaign?.rewardPerSubmission ?? 0)}
                        </p>
                        {submission.status === "CLAIMABLE" && (
                          <Button
                            className="mt-2"
                            size="sm"
                            onClick={() => {
                              setClaimTarget(submission);
                              setClaimStep("confirm");
                              setClaimResult(null);
                            }}
                          >
                            Claim now
                          </Button>
                        )}
                        {submission.status === "PAID" && (
                          <p className="mt-2 flex items-center gap-1 text-[9px] font-black uppercase text-blue sm:justify-end">
                            <BadgeCheck size={12} /> Paid onchain
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <aside className="space-y-8">
            <div className="border-2 border-ink bg-blue p-7 text-white shadow-brutal-lg">
              <div className="flex items-center gap-4">
                <span className="grid h-16 w-16 place-items-center border-2 border-ink bg-lime font-display text-2xl text-ink shadow-brutal-sm">
                  {clipper?.avatar ?? "CF"}
                </span>
                <div>
                  <p className="font-display text-2xl uppercase tracking-tight">
                    {clipper?.displayName ?? "Creator"}
                  </p>
                  <p className="text-xs font-bold tracking-widest text-white/70">{clipper?.handle ?? ""}</p>
                </div>
              </div>
              <p className="mt-6 text-sm leading-6 text-white/80">{clipper?.bio}</p>
              <div className="mt-6 border-2 border-ink bg-white p-4 text-ink shadow-brutal-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue">
                  Active payout wallet
                </p>
                <p className="mt-1 font-mono text-xs font-bold">
                  {shortAddress(clipper?.walletAddress ?? "")}
                </p>
              </div>
            </div>

            <div className="border-2 border-ink bg-white p-5 shadow-brutal">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase text-blue">
                    Creator identity
                  </p>
                  <h3 className="font-display text-2xl uppercase">Social profiles</h3>
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setProfileOpen(true)}
                >
                  <Plus size={16} />
                </Button>
              </div>
              <div className="space-y-3">
                {profiles.map((profile) => {
                  const Icon = platformIcons[profile.provider as keyof typeof platformIcons];
                  return (
                    <div
                      key={profile.id}
                      className="flex items-center gap-3 border border-ink p-3"
                    >
                      <Icon size={18} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black">
                          {profile.username}
                        </p>
                        <p className="text-[9px] uppercase text-ink/40">
                          {profile.provider}
                        </p>
                      </div>
                      <Badge tone={profile.verified ? "lime" : "cream"}>
                        {profile.verified ? "Verified" : "Pending"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <Modal
        open={Boolean(claimTarget)}
        onClose={() => {
          setClaimTarget(null);
          setClaimStep("confirm");
        }}
        eyebrow="Escrow claim"
        title={
          claimStep === "done"
            ? "Reward paid"
            : claimStep === "processing"
              ? "Confirming claim"
              : "Claim your reward"
        }
      >
        {claimTarget && claimStep === "confirm" && (
          <div>
            <div className="border-2 border-ink bg-lime p-5">
              <p className="text-[9px] font-black uppercase">You will receive</p>
              <p className="font-display text-5xl text-blue">
                {formatUsdc(
                  (allCampaigns || []).find(
                    (item) => item.id === claimTarget.campaignId,
                  )?.rewardPerSubmission ?? 0,
                )}
              </p>
            </div>
            <div className="mt-4 border-2 border-ink bg-white p-4">
              <p className="text-[9px] font-black uppercase text-ink/40">
                Destination
              </p>
              <p className="mt-1 font-mono text-xs">{clipper?.walletAddress}</p>
            </div>
            <p className="mt-5 text-xs leading-5 text-ink/55">
              The EIP-712 payout authorization is tied to this submission and
              wallet. It can only be claimed once.
            </p>
            <Button className="mt-5 w-full" size="lg" onClick={handleClaim}>
              <Wallet size={18} /> Confirm claim
            </Button>
          </div>
        )}
        {claimStep === "processing" && (
          <div className="py-10 text-center">
            <LoaderCircle className="mx-auto animate-spin text-blue" size={52} />
            <p className="mt-6 font-display text-3xl uppercase">
              Waiting for Base
            </p>
            <p className="mt-2 text-sm text-ink/55">
              Simulating wallet confirmation and transaction receipt.
            </p>
          </div>
        )}
        {claimStep === "done" && claimResult && (
          <div className="text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center border-2 border-ink bg-lime shadow-brutal">
              <Check size={36} />
            </div>
            <p className="mt-6 font-display text-4xl text-blue">
              +{formatUsdc(claimResult.amount)}
            </p>
            <p className="mt-2 text-sm text-ink/55">
              The reward status is now PAID. A second claim is blocked.
            </p>
            <Button asChild className="mt-6 w-full" variant="outline">
              <Link href="/activity">
                View transaction <ExternalLink size={15} />
              </Link>
            </Button>
          </div>
        )}
      </Modal>

      <Modal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        eyebrow="Creator profile"
        title="Add social profile"
      >
        <form onSubmit={handleAddProfile} className="space-y-5">
          <div>
            <label className="label">Platform</label>
            <select
              className="field"
              value={provider}
              onChange={(event) =>
                setProvider(event.target.value as SocialProvider)
              }
            >
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="youtube">YouTube</option>
            </select>
          </div>
          <div>
            <label className="label">Username or channel</label>
            <input
              className="field"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="@yourhandle"
              required
            />
          </div>
          <div>
            <label className="label">Public profile URL</label>
            <input
              className="field"
              value={profileUrl}
              onChange={(event) => setProfileUrl(event.target.value)}
              placeholder={`https://${provider}.com/...`}
              required
            />
          </div>
          {profileError && (
            <p className="border-2 border-red-500 bg-red-50 p-3 text-xs font-bold text-red-700">
              {profileError}
            </p>
          )}
          <Button className="w-full" size="lg" disabled={savingProfile}>
            {savingProfile ? (
              <LoaderCircle className="animate-spin" size={17} />
            ) : (
              <UserRound size={17} />
            )}
            {savingProfile ? "Saving profile..." : "Add for manual verification"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
