"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ExternalLink,
  LoaderCircle,
  RotateCcw,
  WalletCards,
  X,
} from "lucide-react";
import { useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { useApi } from "@/lib/hooks/use-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Transaction } from "@/lib/types";
import { formatDate, formatUsdc } from "@/lib/utils";

const transactionMeta = {
  FUND: { label: "Campaign funded", icon: ArrowUpRight, sign: "-" },
  CLAIM: { label: "Reward claimed", icon: ArrowDownLeft, sign: "+" },
  REFUND: { label: "Campaign refund", icon: ArrowDownLeft, sign: "+" },
};

export default function ActivityPage() {
  return (
    <AuthGate memberOnly>
      <ActivityContent />
    </AuthGate>
  );
}

function ActivityContent() {
  const { data: allTransactions, isLoading } = useApi<Transaction[]>("/api/transactions");
  const transactions = allTransactions || [];
  const [retrying, setRetrying] = useState("");

  async function retry(transaction: Transaction) {
    setRetrying(transaction.id);
    // Real retry logic goes here in the future
    setRetrying("");
  }

  return (
    <>
      <section className="border-b-2 border-ink bg-orange text-white">
        <div className="page-shell py-12 sm:py-16">
          <Badge tone="lime" className="mb-4">Block explorer</Badge>
          <h1 className="font-display text-6xl uppercase leading-[0.85] sm:text-8xl">
            Every move,
            <br />
            <span className="font-editorial text-lime">accounted for.</span>
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-6 text-white/70">
            Funding, rewards, failures, retries, and refunds from this browser’s
            persisted demo state.
          </p>
        </div>
      </section>

      <section className="page-shell min-h-[500px] py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue">
              Transaction history
            </p>
            <h2 className="font-display text-4xl uppercase">Recent activity</h2>
          </div>
          <div className="hidden items-center gap-2 border-2 border-ink bg-white px-4 py-3 text-[10px] font-black uppercase shadow-brutal-sm sm:flex">
            <span className="h-2 w-2 rounded-full bg-lime outline outline-1 outline-ink" />
            Base Sepolia demo
          </div>
        </div>

        {isLoading ? (
          <div className="border-2 border-ink bg-white p-10 text-center">
            <LoaderCircle className="mx-auto animate-spin text-ink/40" />
            <p className="mt-3 text-[10px] font-black uppercase text-ink/50">Loading activity</p>
          </div>
        ) : transactions.length > 0 ? (
          <div className="overflow-hidden border-2 border-ink bg-white shadow-brutal-lg">
            {transactions.map((transaction, index) => {
              const meta = transactionMeta[transaction.type];
              const Icon = meta.icon;
              return (
                <article
                  key={transaction.id}
                  className={`grid gap-4 p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center ${
                    index < transactions.length - 1
                      ? "border-b-2 border-ink"
                      : ""
                  }`}
                >
                  <span
                    className={`grid h-12 w-12 place-items-center border-2 border-ink ${
                      transaction.status === "FAILED"
                        ? "bg-orange text-white"
                        : transaction.type === "FUND"
                          ? "bg-blue text-white"
                          : "bg-lime"
                    }`}
                  >
                    {transaction.status === "FAILED" ? <X /> : <Icon />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-xl uppercase">{meta.label}</p>
                      <Badge
                        tone={
                          transaction.status === "CONFIRMED"
                            ? "lime"
                            : transaction.status === "FAILED"
                              ? "red"
                              : "orange"
                        }
                      >
                        {transaction.status}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-xs font-bold text-ink/55">
                      {transaction.campaignTitle}
                    </p>
                    <p className="mt-1 font-mono text-[9px] text-ink/35">
                      {transaction.hash.slice(0, 22)}...{transaction.hash.slice(-10)}
                    </p>
                  </div>
                  <div className="flex items-end justify-between gap-4 sm:block sm:text-right">
                    <p
                      className={`font-display text-2xl ${
                        transaction.type === "FUND"
                          ? "text-ink"
                          : "text-blue"
                      }`}
                    >
                      {meta.sign}
                      {formatUsdc(transaction.amount)}
                    </p>
                    <p className="mt-1 text-[9px] font-bold uppercase text-ink/40">
                      {formatDate(transaction.createdAt)}
                    </p>
                    {transaction.status === "FAILED" ? (
                      <Button
                        className="mt-3"
                        size="sm"
                        variant="outline"
                        disabled={retrying === transaction.id}
                        onClick={() => retry(transaction)}
                      >
                        {retrying === transaction.id ? (
                          <LoaderCircle className="animate-spin" size={13} />
                        ) : (
                          <RotateCcw size={13} />
                        )}
                        Retry
                      </Button>
                    ) : (
                      <a
                        href={`https://sepolia.basescan.org/tx/${transaction.hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-[9px] font-black uppercase text-blue underline"
                      >
                        Explorer <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-80 place-items-center border-2 border-dashed border-ink bg-white text-center">
            <div>
              <WalletCards className="mx-auto text-blue" size={38} />
              <p className="mt-4 font-display text-3xl uppercase">
                No transactions yet
              </p>
              <p className="mt-2 text-sm text-ink/50">
                Fund a campaign or claim a reward to populate this view.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-start gap-3 border-2 border-ink bg-lime/40 p-4 text-xs leading-5">
          <Check className="mt-0.5 shrink-0 text-blue" size={17} />
          Explorer links demonstrate the final navigation pattern. Generated
          transactions. In the MVP phase, these are recorded on the Base Sepolia testnet.
        </div>
      </section>
    </>
  );
}
