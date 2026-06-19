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
import { useDemo } from "@/components/demo-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { Campaign, Transaction } from "@/lib/types";
import { formatDate, formatUsdc } from "@/lib/utils";

export default function BrandDashboardPage() {
  return (
    <AuthGate memberOnly>
      <BrandDashboardContent />
    </AuthGate>
  );
}

function BrandDashboardContent() {
  const { state, activeUser, campaigns, transactions } = useDemo();
  const brandUser = activeUser!;
  const brandCampaigns = state.campaigns.filter(
    (campaign) => campaign.brandId === brandUser.id,
  );
  const [fundTarget, setFundTarget] = useState<Campaign | null>(null);
  const [refundTarget, setRefundTarget] = useState<Campaign | null>(null);
  const [simulateFailure, setSimulateFailure] = useState(false);
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

  async function handleFund() {
    if (!fundTarget) return;
    setBusy(true);
    const transaction = await campaigns.fundCampaign(
      fundTarget.id,
      simulateFailure,
    );
    setResult(transaction);
    setBusy(false);
  }

  async function handleRetry() {
    if (!result) return;
    setBusy(true);
    const transaction = await transactions.retryTransaction(result.id);
    setResult(transaction);
    setBusy(false);
  }

  async function handleRefund() {
    if (!refundTarget) return;
    setBusy(true);
    const transaction = await campaigns.refundCampaign(refundTarget.id);
    setResult(transaction);
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
        eyebrow="Mock wallet transaction"
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
              The mock wallet rejected this transaction. Your campaign remains
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
            <label className="mt-5 flex cursor-pointer items-start gap-3 border-2 border-dashed border-orange bg-orange/10 p-4">
              <input
                type="checkbox"
                checked={simulateFailure}
                onChange={(event) => setSimulateFailure(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-xs font-black uppercase">
                  Simulate first transaction failure
                </span>
                <span className="mt-1 block text-[10px] leading-4 text-ink/55">
                  Demonstrates the retry state without opening a real wallet.
                </span>
              </span>
            </label>
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
                  <Wallet size={17} /> Confirm mock deposit
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
              <p className="text-[10px] font-black uppercase">Mock refund</p>
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
        Mock transaction confirmed on Base Sepolia.
      </p>
      <a
        href={`https://sepolia.basescan.org/tx/${transaction.hash}`}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-flex items-center gap-2 text-[10px] font-black uppercase text-blue underline"
      >
        View mock explorer link <ExternalLink size={13} />
      </a>
    </div>
  );
}
