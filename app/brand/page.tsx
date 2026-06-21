"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  FilePlus2,
  LoaderCircle,
  RotateCcw,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo, useState, useRef } from "react";
import { AuthGate } from "@/components/auth-gate";
import { useApi, useApiMutation } from "@/lib/hooks/use-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { ActiveUser, Campaign, Transaction } from "@/lib/types";
import { formatDate, formatUsdc, shortAddress } from "@/lib/utils";
import { useWallets, usePrivy } from "@privy-io/react-auth";
import { createWalletClient, custom, publicActions, parseUnits, stringToHex, pad } from "viem";
import { baseSepolia } from "viem/chains";
import { USDC_ADDRESS, erc20Abi } from "@/lib/contracts/usdc";
import { CAMPAIGN_ESCROW_ADDRESS, campaignEscrowAbi } from "@/lib/contracts/campaign-escrow";
import { getErrorMessage } from "@/lib/hooks/use-api";

type CampaignCreatedArgs = {
  campaignId: bigint | number;
};

export default function BrandDashboardPage() {
  return (
    <AuthGate memberOnly>
      <BrandDashboardContent />
    </AuthGate>
  );
}

function BrandDashboardContent() {
  const { ready, authenticated } = usePrivy();
  const { data: currentUser } = useApi<ActiveUser>(ready && authenticated ? "/api/users/me" : null);
  const { data: allCampaigns, mutate: mutateCampaigns } = useApi<Campaign[]>("/api/campaigns");
  const { data: allTransactions, mutate: mutateTransactions } = useApi<Transaction[]>("/api/transactions");
  const { mutate: postFunding } = useApiMutation<Transaction>();
  const { mutate: postRefund } = useApiMutation<Transaction>();
  const { mutate: retryTx } = useApiMutation<Transaction>();

  const brandUser = currentUser;
  const brandCampaigns = (allCampaigns || []).filter(
    (campaign) => Boolean(brandUser?.id) && campaign.brandId === brandUser?.id,
  );
  const [fundTarget, setFundTarget] = useState<Campaign | null>(null);
  const [refundTarget, setRefundTarget] = useState<Campaign | null>(null);
  const [busy, setBusy] = useState(false);
  const isBusyRef = useRef(false);
  const [result, setResult] = useState<Transaction | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const stats = useMemo(() => {
    const open = brandCampaigns.filter((item) => item.status === "OPEN");
    return {
      open: open.length,
      committed: open.reduce(
        (sum, item) => sum + item.rewardPerSubmission * item.maxWinners,
        0,
      ),
      submissions: brandCampaigns.reduce(
        (sum, item) => sum + item.submissionCount,
        0,
      ),
      paid: brandCampaigns.reduce(
        (sum, item) => sum + item.paidWinners * item.rewardPerSubmission,
        0,
      ),
    };
  }, [brandCampaigns]);

  const { wallets } = useWallets();

  async function handleFund() {
    if (!fundTarget || isBusyRef.current) return;
    setBusy(true);
    isBusyRef.current = true;

    try {
      const wallet = wallets.find((w) => w.walletClientType === "privy" || w.walletClientType === "privy-v2") ?? wallets[0];
      if (!wallet) throw new Error("No wallet connected");

      if (wallet.chainId !== `eip155:${baseSepolia.id}`) {
        await wallet.switchChain(baseSepolia.id);
      }

      const provider = await wallet.getEthereumProvider();
      const client = createWalletClient({
        account: wallet.address as `0x${string}`,
        chain: baseSepolia,
        transport: custom(provider)
      }).extend(publicActions);

      const rewardAmount = parseUnits(fundTarget.rewardPerSubmission.toString(), 6);
      const feeAmount = parseUnits((fundTarget.rewardPerSubmission * 0.05).toString(), 6);
      
      const totalReward = rewardAmount * BigInt(fundTarget.maxWinners);
      const totalFee = feeAmount * BigInt(fundTarget.maxWinners);
      const totalDeposit = totalReward + totalFee;

      const allowance = await client.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [wallet.address as `0x${string}`, CAMPAIGN_ESCROW_ADDRESS]
      }) as bigint;

      if (allowance < totalDeposit) {
        const { request: approveReq } = await client.simulateContract({
          account: wallet.address as `0x${string}`,
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: 'approve',
          args: [CAMPAIGN_ESCROW_ADDRESS, totalDeposit]
        });
        const approveTx = await client.writeContract(approveReq);
        await client.waitForTransactionReceipt({ hash: approveTx });
      }

      const metadataHash = `0x${fundTarget.id.replace(/-/g, "").padEnd(64, "0")}` as `0x${string}`;
      const deadline = BigInt(Math.floor(new Date(fundTarget.deadline).getTime() / 1000));

      const { request: fundReq } = await client.simulateContract({
        account: wallet.address as `0x${string}`,
        address: CAMPAIGN_ESCROW_ADDRESS,
        abi: campaignEscrowAbi,
        functionName: 'createCampaign',
        args: [metadataHash, totalReward, totalFee, deadline, BigInt(fundTarget.maxWinners)]
      });
      const fundTx = await client.writeContract(fundReq);
      const receipt = await client.waitForTransactionReceipt({ hash: fundTx });

      if (!fundTx) {
        throw new Error("No tx hash");
      }
      
      let onchainCampaignId = 1;
      try {
        const { decodeEventLog } = await import("viem");
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: campaignEscrowAbi,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName === 'CampaignCreated') {
              onchainCampaignId = Number((decoded.args as CampaignCreatedArgs).campaignId);
              break;
            }
          } catch {}
        }
      } catch(err) {
        console.error("Failed to parse logs", err);
      }
      
      await postFunding(`/api/campaigns/${fundTarget.id}/funding-confirmation`, {
        method: "POST",
        body: { txHash: fundTx, onchainCampaignId }
      });
      await mutateCampaigns();
      await mutateTransactions();
      setResult({
        id: "fund-success",
        type: "FUND",
        campaignId: fundTarget.id,
        campaignTitle: fundTarget.title,
        amount: fundTarget.rewardPerSubmission * fundTarget.maxWinners * 1.05,
        status: "CONFIRMED",
        hash: fundTx,
        createdAt: new Date().toISOString()
      });
    } catch (err: unknown) {
      let errorMessage = "An unknown error occurred during transaction.";
      const message = getErrorMessage(err, "");
      const shortMessage =
        typeof err === "object" &&
        err !== null &&
        "shortMessage" in err &&
        typeof err.shortMessage === "string"
          ? err.shortMessage
          : "";

      if (message.includes("User rejected")) {
        errorMessage = "You rejected the transaction in your wallet.";
      } else if (message.includes("insufficient funds") || message.includes("exceeds balance")) {
        errorMessage = "You don't have enough testnet ETH or USDC for this transaction.";
      } else if (shortMessage) {
        errorMessage = shortMessage;
      } else if (message) {
        errorMessage = message.slice(0, 100);
      }

      setResult({
        id: "err-fund",
        type: "FUND",
        campaignId: fundTarget.id,
        campaignTitle: fundTarget.title,
        amount: fundTarget.rewardPerSubmission * fundTarget.maxWinners * 1.05,
        status: "FAILED",
        hash: "",
        createdAt: new Date().toISOString(),
        errorMessage,
      });
    } finally {
      setBusy(false);
      isBusyRef.current = false;
    }
  }

  async function handleRetry() {
    if (!result) return;
    setBusy(true);
    try {
      if (result.type === "FUND") {
        await handleFund();
      } else {
        // Real retry endpoint in future
        await new Promise(r => setTimeout(r, 1000));
        setResult(result);
      }
    } finally {
      setBusy(false);
      isBusyRef.current = false;
    }
  }

  async function handleRefund() {
    if (!refundTarget || isBusyRef.current) return;
    setBusy(true);
    isBusyRef.current = true;

    try {
      const wallet = wallets.find((w) => w.walletClientType === "privy" || w.walletClientType === "privy-v2") ?? wallets[0];
      if (!wallet) throw new Error("No wallet connected");

      const provider = await wallet.getEthereumProvider();
      const client = createWalletClient({
        account: wallet.address as `0x${string}`,
        chain: baseSepolia,
        transport: custom(provider)
      }).extend(publicActions);

      const contractCampaignId = BigInt(refundTarget.onchainCampaignId || 1); 

      const { request: refundReq } = await client.simulateContract({
        account: wallet.address as `0x${string}`,
        address: CAMPAIGN_ESCROW_ADDRESS,
        abi: campaignEscrowAbi,
        functionName: 'refundRemaining',
        args: [contractCampaignId]
      });
      const refundTx = await client.writeContract(refundReq);
      await client.waitForTransactionReceipt({ hash: refundTx });

      await postRefund(`/api/campaigns/${refundTarget.id}/refund`, {
        method: "POST",
        body: { txHash: refundTx }
      });
      await mutateCampaigns();
      await mutateTransactions();
      setResult({
        id: "refund-success",
        type: "REFUND",
        campaignId: refundTarget.id,
        campaignTitle: refundTarget.title,
        amount: (refundTarget.maxWinners - refundTarget.paidWinners) * refundTarget.rewardPerSubmission,
        status: "CONFIRMED",
        hash: refundTx,
        createdAt: new Date().toISOString()
      });
    } catch (err: unknown) {
      console.error(err);
      let errorMessage = "An unknown error occurred during transaction.";
      const message = getErrorMessage(err, "");
      const shortMessage =
        typeof err === "object" &&
        err !== null &&
        "shortMessage" in err &&
        typeof err.shortMessage === "string"
          ? err.shortMessage
          : "";

      if (message.includes("User rejected")) {
        errorMessage = "You rejected the transaction in your wallet.";
      } else if (message.includes("CampaignNotEnded")) {
        errorMessage = "Campaign has not ended yet. You can only refund after the deadline.";
      } else if (shortMessage) {
        errorMessage = shortMessage;
      } else if (message) {
        errorMessage = message.slice(0, 100);
      }

      setResult({
        id: "err-refund",
        type: "REFUND",
        campaignId: refundTarget.id,
        campaignTitle: refundTarget.title,
        amount: (refundTarget.maxWinners - refundTarget.paidWinners) * refundTarget.rewardPerSubmission,
        status: "FAILED",
        hash: "",
        createdAt: new Date().toISOString(),
        errorMessage,
      });
    } finally {
      setBusy(false);
      isBusyRef.current = false;
    }
  }

  return (
    <>
      <section className="border-b-2 border-ink bg-white overflow-hidden">
        <div className="page-shell flex flex-col justify-between gap-6 py-10 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <Badge tone="blue" className="mb-4">Brand workspace</Badge>
            <h1 className="font-display text-4xl uppercase leading-[0.9] tracking-tight sm:text-7xl break-words break-all">
              Good morning,
              <br />
              <span className="font-editorial text-orange">
                {brandUser?.displayName ?? "Brand"}.
              </span>
            </h1>
          </div>
          <Button asChild size="lg" className="relative z-10 shadow-brutal w-full sm:w-auto">
            <Link href="/brand/create">
              <FilePlus2 size={18} /> Create campaign
            </Link>
          </Button>
        </div>
      </section>

      <section className="page-shell py-8">
        <div className="mb-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Open campaigns", value: stats.open, icon: Clock3, bg: "bg-white" },
            {
              label: "USDC committed",
              value: formatUsdc(stats.committed),
              icon: Wallet,
              bg: "bg-orange",
            },
            { label: "Submissions", value: stats.submissions, icon: Users, bg: "bg-cream" },
            {
              label: "Rewards paid",
              value: formatUsdc(stats.paid),
              icon: CircleDollarSign,
              bg: "bg-lime",
            },
          ].map((stat) => {
            const IconComponent = stat.icon;
            return (
              <div
                key={stat.label}
                className={`flex flex-col justify-between border-2 border-ink ${stat.bg} p-6 shadow-brutal transition-transform hover:-translate-y-1 hover:shadow-brutal-lg`}
              >
                <IconComponent size={24} className="mb-8 text-ink" />
                <div>
                  <p className="font-display text-4xl uppercase tracking-tight">{stat.value}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-ink/60">
                    {stat.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="page-shell pb-16">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue">
              Portfolio
            </p>
            <h2 className="font-display text-4xl uppercase">Your campaigns</h2>
          </div>
        </div>

        <div className="space-y-6">
          {brandCampaigns.map((campaign) => {
            const remaining = campaign.maxWinners - campaign.paidWinners;
            return (
              <article
                key={campaign.id}
                className="grid border-2 border-ink bg-white shadow-brutal transition-all hover:shadow-brutal-lg md:grid-cols-[1fr_auto] min-w-0"
              >
                <div className="p-6 sm:p-8 min-w-0">
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <Badge
                      tone={
                        campaign.status === "OPEN"
                          ? "lime"
                          : campaign.status === "REFUNDED"
                            ? "cream"
                            : "orange"
                      }
                    >
                      {campaign.status.replaceAll("_", " ")}
                    </Badge>
                    <Badge tone="cream">{campaign.campaignCode}</Badge>
                  </div>
                  <h3 className="font-display text-3xl uppercase leading-none tracking-tight sm:text-4xl truncate">
                    {campaign.title}
                  </h3>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/65 truncate">
                    {campaign.summary}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-[10px] font-black uppercase tracking-wider text-ink/60">
                    <span className="flex items-center gap-1.5"><CircleDollarSign size={14} className="text-blue shrink-0" /> {formatUsdc(campaign.rewardPerSubmission)} / clip</span>
                    <span className="flex items-center gap-1.5"><Users size={14} className="text-blue shrink-0" /> {campaign.submissionCount} submissions</span>
                    <span className="flex items-center gap-1.5"><Check size={14} className="text-blue shrink-0" /> {remaining} spots remaining</span>
                    <span className="flex items-center gap-1.5"><Clock3 size={14} className="text-blue shrink-0" /> Ends {formatDate(campaign.deadline)}</span>
                  </div>
                </div>
                <div className="flex flex-col justify-center gap-3 border-t-2 border-ink bg-cream p-6 md:w-64 md:border-l-2 md:border-t-0">
                  {campaign.status === "AWAITING_FUNDING" && (
                    <Button
                      onClick={() => {
                        setFundTarget(campaign);
                        setResult(null);
                      }}
                      className="shadow-brutal-sm relative w-full"
                      disabled={busy}
                    >
                      <Wallet size={16} /> Fund & publish
                    </Button>
                  )}
                  {campaign.status === "OPEN" && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRefundTarget(campaign);
                        setResult(null);
                      }}
                      className="shadow-brutal-sm w-full"
                      disabled={busy}
                    >
                      Close & refund
                    </Button>
                  )}
                  <Button asChild variant="ghost" className="hover:underline w-full">
                    <Link href={`/campaigns/${campaign.id}`}>
                      View campaign <ArrowRight size={15} />
                    </Link>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <Modal
        open={Boolean(fundTarget)}
        onClose={() => {
          setFundTarget(null);
          setResult(null);
        }}
        eyebrow="Wallet transaction"
        title={
          result?.status === "CONFIRMED"
            ? "Campaign is live"
            : result?.status === "FAILED"
              ? "Transaction failed"
              : "Fund & publish"
        }
      >
        {fundTarget && result?.status === "CONFIRMED" ? (
          <TransactionSuccess transaction={result} />
        ) : fundTarget && result?.status === "FAILED" ? (
          <div className="text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center border-2 border-ink bg-orange text-white shadow-brutal">
              <AlertTriangle size={34} />
            </div>
            <p className="mt-6 text-sm leading-6 text-ink/60">
              {result.errorMessage || "The wallet rejected this transaction. Your campaign remains hidden and no state was lost."}
            </p>
            <Button className="mt-6 w-full" onClick={handleRetry} disabled={busy}>
              {busy ? (
                <LoaderCircle className="animate-spin" size={17} />
              ) : (
                <RotateCcw size={17} />
              )}
              {busy ? "Confirming..." : "Retry transaction"}
            </Button>
          </div>
        ) : fundTarget ? (
          <div>
            <div className="border-2 border-ink bg-white">
              <div className="flex justify-between border-b border-ink/20 p-4 text-xs">
                <span className="font-bold text-ink/50">Reward pool</span>
                <strong>
                  {formatUsdc(
                    fundTarget.rewardPerSubmission * fundTarget.maxWinners,
                  )}
                </strong>
              </div>
              <div className="flex justify-between border-b border-ink/20 p-4 text-xs">
                <span className="font-bold text-ink/50">Platform fee (5%)</span>
                <strong>
                  {formatUsdc(
                    fundTarget.rewardPerSubmission *
                      fundTarget.maxWinners *
                      0.05,
                  )}
                </strong>
              </div>
              <div className="flex justify-between bg-lime p-4">
                <span className="text-xs font-black uppercase">Total deposit</span>
                <strong className="font-display text-xl">
                  {formatUsdc(
                    fundTarget.rewardPerSubmission *
                      fundTarget.maxWinners *
                      1.05,
                  )}
                </strong>
              </div>
            </div>

            <Button
              className="mt-5 w-full"
              size="lg"
              onClick={handleFund}
              disabled={busy}
            >
              {busy ? (
                <>
                  <LoaderCircle className="animate-spin" size={17} />
                  Waiting for confirmation...
                </>
              ) : (
                <>
                  <Wallet size={17} /> Confirm deposit
                </>
              )}
            </Button>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(refundTarget)}
        onClose={() => {
          setRefundTarget(null);
          setResult(null);
        }}
        eyebrow="Campaign lifecycle"
        title={result?.status === "CONFIRMED" ? "Refund confirmed" : "Close campaign"}
      >
        {result?.status === "CONFIRMED" ? (
          <TransactionSuccess transaction={result} />
        ) : refundTarget ? (
          <div>
            <p className="text-sm leading-6 text-ink/65">
              This demo action closes the campaign and returns its unused reward
              pool. New submissions will no longer be accepted.
            </p>
            <div className="mt-5 border-2 border-ink bg-lime p-5">
              <p className="text-[10px] font-black uppercase">Refund</p>
              <p className="font-display text-4xl text-blue">
                {formatUsdc(
                  (refundTarget.maxWinners - refundTarget.paidWinners) *
                    refundTarget.rewardPerSubmission,
                )}
              </p>
            </div>
            {new Date(refundTarget.deadline).getTime() > Date.now() && (
              <div className="mt-4 flex items-center gap-2 text-xs font-bold text-orange">
                <Clock3 size={14} />
                <span>Available after deadline ({formatDate(refundTarget.deadline)})</span>
              </div>
            )}
            <Button
              className="mt-5 w-full"
              variant="orange"
              size="lg"
              onClick={handleRefund}
              disabled={busy || new Date(refundTarget.deadline).getTime() > Date.now()}
            >
              {busy ? "Confirming refund..." : "Close & refund remaining"}
            </Button>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function TransactionSuccess({ transaction }: { transaction: Transaction }) {
  return (
    <div className="text-center">
      <div className="mx-auto grid h-20 w-20 place-items-center border-2 border-ink bg-lime shadow-brutal">
        <Check size={36} />
      </div>
      <p className="mt-5 font-display text-3xl text-blue">
        {transaction.type === "FUND" ? "FUNDED" : "REFUNDED"} ·{" "}
        {formatUsdc(transaction.amount)}
      </p>
      <p className="mt-2 text-sm text-ink/55">
        Transaction confirmed on Base Sepolia.
      </p>
      <a
        href={`https://sepolia.basescan.org/tx/${transaction.hash}`}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-flex items-center gap-2 text-[10px] font-black uppercase text-blue underline"
      >
        View transaction <ExternalLink size={13} />
      </a>
    </div>
  );
}
