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
import type { SocialProvider, Submission, Transaction } from "@/lib/types";
import { formatDate, formatUsdc, shortAddress } from "@/lib/utils";
import { useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom, publicActions, parseUnits, stringToHex, pad } from "viem";
import { baseSepolia } from "viem/chains";
import { CAMPAIGN_ESCROW_ADDRESS, campaignEscrowAbi } from "@/lib/contracts/campaign-escrow";

const platformIcons = {
  tiktok: Sparkles,
  youtube: Youtube,
  instagram: Instagram,
};

const statusTones = {
  SUBMITTED: "cream",
  UNDER_REVIEW: "orange",
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
  const { data: currentUser } = useApi<any>("/api/users/me");
  const { data: allSubmissions, mutate: mutateSubmissions } = useApi<Submission[]>("/api/submissions");
  const { data: allCampaigns } = useApi<any[]>("/api/campaigns");
  const { data: socialProfiles, mutate: mutateProfiles } = useApi<any[]>("/api/users/social-profiles");
  const { mutate: postClaimConfirmation } = useApiMutation<any>();
  const { mutate: addProfileMutate } = useApiMutation<any>();

  const clipper = currentUser;
  const clipperSubmissions = (allSubmissions || []).filter(
    (submission) => submission.clipperId === clipper?.id,
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

      const campaign = (allCampaigns || []).find(c => c.id === claimTarget.campaignId);
      if (!campaign) throw new Error("Campaign not found");

      const payoutRes = await fetch(`/api/submissions/${claimTarget.id}/payout`);
      if (!payoutRes.ok) {
        const errData = await payoutRes.json();
        throw new Error(errData.error || "Failed to fetch payout signature");
      }
      const payoutData = await payoutRes.json();

      const submissionIdBytes32 = `0x${claimTarget.id.replace(/-/g, "").padEnd(64, "0")}` as `0x${string}`;

      const { request } = await client.simulateContract({
        account: wallet.address as `0x${string}`,
        address: CAMPAIGN_ESCROW_ADDRESS,
        abi: campaignEscrowAbi,
        functionName: 'claimReward',
        args: [
            BigInt(campaign.onchainCampaignId),
            submissionIdBytes32,
            BigInt(payoutData.rewardAmount),
            BigInt(payoutData.feeAmount),
            BigInt(payoutData.nonce),
            BigInt(payoutData.expiry),
            payoutData.signature as `0x${string}`
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
    } catch (err: any) {
      console.error("Claim failed:", err);
      alert("Claim failed: " + err.message);
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
    } catch (e: any) {
      console.error(e);
      setProfileError(e.message);
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <>
      <section className="border-b-2 border-ink bg-lime">
        <div className="page-shell grid gap-8 py-10 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <Badge tone="blue" className="mb-4">Creator workspace</Badge>
            <h1 className="font-display text-5xl uppercase leading-[0.88] sm:text-7xl">
              Keep clipping,
              <br />
              <span className="font-editorial text-blue">{clipper.displayName}.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-6 text-ink/65">
              Track reviews, claim approved rewards, and keep your creator
              profiles ready for the next brief.
            </p>
          </div>
          <Button asChild size="lg" variant="black">
            <Link href="/explore">Find a campaign</Link>
          </Button>
        </div>
      </section>

      <section className="page-shell py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div>
            <div className="mb-7 grid border-2 border-ink bg-white shadow-brutal sm:grid-cols-3">
              {[
                {
                  label: "Total earned",
                  value: formatUsdc(stats.earned),
                  icon: CircleDollarSign,
                },
                {
                  label: "Ready to claim",
                  value: stats.claimable,
                  icon: Wallet,
                },
                {
                  label: "Under review",
                  value: stats.reviewing,
                  icon: Sparkles,
                },
              ].map((item, index) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.label}
                    className={`p-5 ${
                      index < 2
                        ? "border-b-2 sm:border-b-0 sm:border-r-2"
                        : ""
                    } border-ink`}
                  >
                    <IconComponent size={19} className="mb-5 text-blue" />
                    <p className="font-display text-3xl uppercase">{item.value}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-ink/45">
                      {item.label}
                    </p>
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
                  (item: any) => item.id === submission.campaignId,
                );
                const Icon = platformIcons[submission.platform as keyof typeof platformIcons];
                return (
                  <article
                    key={submission.id}
                    className="border-2 border-ink bg-white shadow-brutal"
                  >
                    <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
                      <div className="grid h-14 w-14 shrink-0 place-items-center border-2 border-ink bg-cream">
                        <Icon size={23} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge tone={statusTones[submission.status]}>
                            {submission.status.replaceAll("_", " ")}
                          </Badge>
                          <span className="text-[9px] font-bold uppercase text-ink/40">
                            {formatDate(submission.submittedAt)}
                          </span>
                        </div>
                        <h3 className="truncate font-display text-2xl uppercase">
                          {submission.campaignTitle}
                        </h3>
                        <a
                          href={submission.postUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 flex items-center gap-1 truncate text-[10px] font-bold text-blue"
                        >
                          {submission.postUrl} <ExternalLink size={11} />
                        </a>
                        {submission.rejectionReason && (
                          <p className="mt-2 text-xs font-bold text-red-600">
                            {submission.rejectionReason}
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

          <aside className="space-y-6">
            <div className="border-2 border-ink bg-blue p-6 text-white shadow-brutal-lg">
              <div className="flex items-center gap-3">
                <span className="grid h-14 w-14 place-items-center border-2 border-ink bg-lime font-display text-lg text-ink">
                  {clipper.avatar}
                </span>
                <div>
                  <p className="font-display text-2xl uppercase">
                    {clipper.displayName}
                  </p>
                  <p className="text-xs text-white/60">{clipper.handle}</p>
                </div>
              </div>
              <p className="mt-5 text-sm leading-6 text-white/65">{clipper.bio}</p>
              <div className="mt-5 border border-white/30 p-3">
                <p className="text-[9px] font-black uppercase text-white/45">
                  Active payout wallet
                </p>
                <p className="mt-1 font-mono text-xs">
                  {shortAddress(clipper.walletAddress)}
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
                    (item: any) => item.id === claimTarget.campaignId,
                  )?.rewardPerSubmission ?? 0,
                )}
              </p>
            </div>
            <div className="mt-4 border-2 border-ink bg-white p-4">
              <p className="text-[9px] font-black uppercase text-ink/40">
                Destination
              </p>
              <p className="mt-1 font-mono text-xs">{clipper.walletAddress}</p>
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
