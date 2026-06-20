"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  FilePlus2,
  LoaderCircle,
  RotateCcw,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { useApi, useApiMutation } from "@/lib/hooks/use-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { Campaign, Transaction } from "@/lib/types";
import { formatDate, formatUsdc } from "@/lib/utils";
import { useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom, publicActions, parseUnits, stringToHex, pad } from "viem";
import { baseSepolia } from "viem/chains";
import { USDC_ADDRESS, erc20Abi } from "@/lib/contracts/usdc";
import { CAMPAIGN_ESCROW_ADDRESS, campaignEscrowAbi } from "@/lib/contracts/campaign-escrow";

export default function BrandDashboardPage() {
  return (
    <AuthGate memberOnly>
      <BrandDashboardContent />
    </AuthGate>
  );
}

function BrandDashboardContent() {
  const { data: currentUser } = useApi<any>("/api/users/me");
  const { data: allCampaigns, mutate: mutateCampaigns } = useApi<Campaign[]>("/api/campaigns");
  const { data: allTransactions, mutate: mutateTransactions } = useApi<Transaction[]>("/api/transactions");
  const { mutate: postFunding } = useApiMutation<any>();
  const { mutate: postRefund } = useApiMutation<any>();
  const { mutate: retryTx } = useApiMutation<Transaction>();

  const brandUser = currentUser;
  const brandCampaigns = (allCampaigns || []).filter(
    (campaign) => campaign.brandId === brandUser?.id,
  );
  const [fundTarget, setFundTarget] = useState<Campaign | null>(null);
  const [refundTarget, setRefundTarget] = useState<Campaign | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Transaction | null>(null);

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
    if (!fundTarget) return;
    setBusy(true);

    try {
      const wallet = wallets.find((w) => w.walletClientType === "privy" || w.walletClientType === "privy-v2") ?? wallets[0];
      if (!wallet) throw new Error("No wallet connected");

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

      const { request: approveReq } = await client.simulateContract({
        account: wallet.address as `0x${string}`,
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'approve',
        args: [CAMPAIGN_ESCROW_ADDRESS, totalDeposit]
      });
      const approveTx = await client.writeContract(approveReq);
      await client.waitForTransactionReceipt({ hash: approveTx });

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
              onchainCampaignId = Number((decoded.args as any).campaignId);
              break;
            }
          } catch(e) {}
        }
      } catch(err) {
        console.error("Failed to parse logs", err);
      }
      
      const transaction = await postFunding(`/api/campaigns/${fundTarget.id}/funding-confirmation`, {
        method: "POST",
        body: { txHash: fundTx, onchainCampaignId }
      });
      await mutateCampaigns();
      await mutateTransactions();
      setResult({ ...transaction, hash: fundTx });
    } catch (err: any) {
      console.error(err);
      setResult({
        id: "err-fund",
        type: "FUND",
        campaignId: fundTarget.id,
        campaignTitle: fundTarget.title,
        amount: fundTarget.rewardPerSubmission * fundTarget.maxWinners * 1.05,
        status: "FAILED",
        hash: "",
        createdAt: new Date().toISOString()
      });
    }
    setBusy(false);
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
    }
  }

  async function handleRefund() {
    if (!refundTarget) return;
    setBusy(true);

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

      const transaction = await postRefund(`/api/campaigns/${refundTarget.id}/refund`, {
        method: "POST",
        body: { txHash: refundTx }
      });
      await mutateCampaigns();
      await mutateTransactions();
      setResult({ ...transaction, hash: refundTx });
    } catch (err: any) {
      console.error(err);
      alert("Contract refund failed: " + err.message);
    }
    setBusy(false);
  }

  return (
    <>
      <section className="border-b-2 border-ink bg-white">
        <div className="page-shell flex flex-col justify-between gap-6 py-10 sm:flex-row sm:items-end">
          <div>
            <Badge tone="blue" className="mb-4">Brand workspace</Badge>
            <h1 className="font-display text-5xl uppercase leading-none sm:text-7xl">
              Good morning,
              <br />
              <span className="font-editorial text-orange">
                {brandUser.displayName}.
              </span>
            </h1>
          </div>
          <Button asChild size="lg">
            <Link href="/brand/create">
              <FilePlus2 size={18} /> Create campaign
            </Link>
          </Button>
        </div>
      </section>

      <section className="page-shell py-8">
        <div className="grid border-2 border-ink bg-white shadow-brutal md:grid-cols-4">
          {[
            { label: "Open campaigns", value: stats.open, icon: Clock3 },
            {
              label: "USDC committed",
              value: formatUsdc(stats.committed),
              icon: Wallet,
            },
            { label: "Submissions", value: stats.submissions, icon: Users },
            {
              label: "Rewards paid",
              value: formatUsdc(stats.paid),
              icon: CircleDollarSign,
            },
          ].map((stat, index) => (
            <div
              key={stat.label}
              className={`p-5 ${
                index < 3 ? "border-b-2 md:border-b-0 md:border-r-2" : ""
              } border-ink`}
            >
              <stat.icon size={19} className="mb-5 text-blue" />
              <p className="font-display text-3xl uppercase">{stat.value}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-ink/45">
                {stat.label}
              </p>
            </div>
          ))}
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

        <div className="space-y-5">
          {brandCampaigns.map((campaign) => {
            const remaining = campaign.maxWinners - campaign.paidWinners;
            return (
              <article
                key={campaign.id}
                className="grid border-2 border-ink bg-white shadow-brutal md:grid-cols-[1fr_auto]"
              >
                <div className="p-5 sm:p-7">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
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
                  <h3 className="font-display text-3xl uppercase leading-none sm:text-4xl">
                    {campaign.title}
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/55">
                    {campaign.summary}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-x-7 gap-y-3 text-[10px] font-black uppercase">
                    <span>{formatUsdc(campaign.rewardPerSubmission)} / clip</span>
                    <span>{campaign.submissionCount} submissions</span>
                    <span>{remaining} spots remaining</span>
                    <span>Ends {formatDate(campaign.deadline)}</span>
                  </div>
                </div>
                <div className="flex min-w-52 flex-col justify-center gap-3 border-t-2 border-ink bg-cream p-5 md:border-l-2 md:border-t-0">
                  {campaign.status === "AWAITING_FUNDING" && (
                    <Button
                      onClick={() => {
                        setFundTarget(campaign);
                        setResult(null);
                      }}
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
                    >
                      Close & refund
                    </Button>
                  )}
                  <Button asChild variant="ghost">
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
          setSimulateFailure(false);
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
              The wallet rejected this transaction. Your campaign remains
              hidden and no state was lost.
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
                <span className="font-bold text-ink/50">Fee reserve (5%)</span>
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
            <Button
              className="mt-5 w-full"
              variant="orange"
              size="lg"
              onClick={handleRefund}
              disabled={busy}
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
