"use client";

import {
  Check,
  ExternalLink,
  Instagram,
  LoaderCircle,
  Search,
  Sparkles,
  X,
  Youtube,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { useDemo } from "@/components/demo-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { Submission } from "@/lib/types";
import { formatDate, formatUsdc } from "@/lib/utils";

const platformIcons = {
  tiktok: Sparkles,
  youtube: Youtube,
  instagram: Instagram,
};

export default function AdminPage() {
  return (
    <AuthGate adminOnly>
      <AdminContent />
    </AuthGate>
  );
}

function AdminContent() {
  const { state, submissions } = useDemo();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Submission | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const queue = useMemo(
    () =>
      state.submissions.filter(
        (submission) =>
          ["SUBMITTED", "UNDER_REVIEW"].includes(submission.status) &&
          (submission.campaignTitle
            .toLowerCase()
            .includes(query.toLowerCase()) ||
            submission.clipperName.toLowerCase().includes(query.toLowerCase())),
      ),
    [state.submissions, query],
  );

  async function handleReview() {
    if (!selected) return;
    setBusy(true);
    await submissions.reviewSubmission(selected.id, decision, reason);
    setBusy(false);
    setDone(true);
  }

  return (
    <>
      <section className="border-b-2 border-ink bg-ink text-white">
        <div className="page-shell flex flex-col justify-between gap-6 py-10 sm:flex-row sm:items-end">
          <div>
            <Badge tone="lime" className="mb-4">Platform operations</Badge>
            <h1 className="font-display text-5xl uppercase leading-none sm:text-7xl">
              Review
              <br />
              <span className="font-editorial text-lime">with context.</span>
            </h1>
          </div>
          <div className="border-2 border-white bg-white/10 p-5">
            <p className="font-display text-4xl text-lime">{queue.length}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/50">
              Awaiting decision
            </p>
          </div>
        </div>
      </section>

      <section id="queue" className="page-shell scroll-mt-28 py-8">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue">
              Moderation queue
            </p>
            <h2 className="font-display text-4xl uppercase">Fresh submissions</h2>
          </div>
          <label className="relative block w-full sm:w-80">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40"
              size={17}
            />
            <input
              className="field pl-11"
              placeholder="Search creator or campaign..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        <div className="overflow-x-auto border-2 border-ink bg-white shadow-brutal-lg">
          <table className="w-full min-w-[800px] border-collapse text-left">
            <thead className="bg-lime">
              <tr className="border-b-2 border-ink text-[9px] font-black uppercase tracking-widest">
                <th className="p-4">Creator</th>
                <th className="p-4">Campaign</th>
                <th className="p-4">Platform</th>
                <th className="p-4">Submitted</th>
                <th className="p-4">Reward</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((submission) => {
                const campaign = state.campaigns.find(
                  (item) => item.id === submission.campaignId,
                );
                const Icon = platformIcons[submission.platform];
                return (
                  <tr key={submission.id} className="border-b border-ink/20 last:border-b-0">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 place-items-center border border-ink bg-blue text-[10px] font-black text-white">
                          {submission.clipperAvatar}
                        </span>
                        <div>
                          <p className="text-xs font-black">
                            {submission.clipperName}
                          </p>
                          <p className="text-[9px] text-ink/45">Profile checked</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="max-w-56 truncate text-xs font-black">
                        {submission.campaignTitle}
                      </p>
                      <p className="mt-1 text-[9px] text-ink/45">
                        {campaign?.campaignCode}
                      </p>
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-2 text-[10px] font-black uppercase">
                        <Icon size={15} /> {submission.platform}
                      </span>
                    </td>
                    <td className="p-4 text-xs">{formatDate(submission.submittedAt)}</td>
                    <td className="p-4 font-display text-xl text-blue">
                      {formatUsdc(campaign?.rewardPerSubmission ?? 0)}
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelected(submission);
                          setDecision("approve");
                          setReason("");
                          setDone(false);
                        }}
                      >
                        Review
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {queue.length === 0 && (
            <div className="p-16 text-center">
              <Check className="mx-auto text-blue" size={34} />
              <p className="mt-4 font-display text-3xl uppercase">Queue cleared</p>
              <p className="mt-2 text-sm text-ink/50">
                No matching submissions need review.
              </p>
            </div>
          )}
        </div>
      </section>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        eyebrow="Manual moderation"
        title={done ? "Decision recorded" : "Review submission"}
      >
        {selected && done ? (
          <div className="text-center">
            <div
              className={`mx-auto grid h-20 w-20 place-items-center border-2 border-ink shadow-brutal ${
                decision === "approve" ? "bg-lime" : "bg-orange text-white"
              }`}
            >
              {decision === "approve" ? <Check size={36} /> : <X size={36} />}
            </div>
            <p className="mt-6 font-display text-3xl uppercase">
              {decision === "approve"
                ? "Payout authorization issued"
                : "Submission rejected"}
            </p>
            <p className="mt-3 text-sm leading-6 text-ink/55">
              {decision === "approve"
                ? "The creator can now claim the reward from their dashboard."
                : "The creator can see the rejection reason in their dashboard."}
            </p>
            <Button className="mt-6 w-full" onClick={() => setSelected(null)}>
              Return to queue
            </Button>
          </div>
        ) : selected ? (
          <div>
            <div className="border-2 border-ink bg-blue p-5 text-white">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[9px] font-black uppercase text-lime">
                    Campaign
                  </p>
                  <p className="font-display text-2xl uppercase">
                    {selected.campaignTitle}
                  </p>
                </div>
                <Badge tone="lime">
                  {
                    state.campaigns.find(
                      (item) => item.id === selected.campaignId,
                    )?.campaignCode
                  }
                </Badge>
              </div>
              <div className="mt-5 border border-white/30 p-3">
                <p className="text-[9px] font-black uppercase text-white/45">
                  Public video
                </p>
                <a
                  href={selected.postUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 flex items-center gap-2 break-all text-xs font-bold text-lime underline"
                >
                  {selected.postUrl} <ExternalLink size={13} />
                </a>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setDecision("approve")}
                className={`border-2 border-ink p-4 text-xs font-black uppercase shadow-brutal-sm ${
                  decision === "approve" ? "bg-lime" : "bg-white"
                }`}
              >
                <Check className="mx-auto mb-2" size={20} /> Approve
              </button>
              <button
                onClick={() => setDecision("reject")}
                className={`border-2 border-ink p-4 text-xs font-black uppercase shadow-brutal-sm ${
                  decision === "reject" ? "bg-orange text-white" : "bg-white"
                }`}
              >
                <X className="mx-auto mb-2" size={20} /> Reject
              </button>
            </div>
            {decision === "reject" && (
              <div className="mt-5">
                <label className="label">Rejection reason</label>
                <textarea
                  className="field min-h-24"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Explain what needs to change..."
                />
              </div>
            )}
            <div className="mt-5 border-2 border-dashed border-ink bg-cream p-4 text-xs leading-5">
              {decision === "approve"
                ? "Approval creates a mock EIP-712 payout authorization bound to the creator wallet."
                : "Rejection does not consume a paid winner slot or create a payout."}
            </div>
            <Button
              className="mt-5 w-full"
              size="lg"
              variant={decision === "approve" ? "primary" : "orange"}
              onClick={handleReview}
              disabled={busy || (decision === "reject" && reason.trim().length < 5)}
            >
              {busy ? (
                <LoaderCircle className="animate-spin" size={17} />
              ) : decision === "approve" ? (
                <Check size={17} />
              ) : (
                <X size={17} />
              )}
              {busy
                ? "Recording decision..."
                : decision === "approve"
                  ? "Approve & authorize payout"
                  : "Reject submission"}
            </Button>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
