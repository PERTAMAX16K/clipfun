import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payoutAuthorizations, submissions } from "@/db/schema";

/**
 * GET /api/submissions/:id/payout — Get payout signature for claiming
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Verify submission exists and is claimable
  const [submission] = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, id))
    .limit(1);

  if (!submission) {
    return NextResponse.json(
      { error: "Submission not found" },
      { status: 404 },
    );
  }

  if (submission.status !== "CLAIMABLE") {
    return NextResponse.json(
      { error: "Submission is not claimable" },
      { status: 400 },
    );
  }

  const [payout] = await db
    .select()
    .from(payoutAuthorizations)
    .where(eq(payoutAuthorizations.submissionId, id))
    .limit(1);

  if (!payout) {
    return NextResponse.json(
      { error: "Payout authorization not found" },
      { status: 404 },
    );
  }

  if (payout.status !== "ISSUED") {
    return NextResponse.json(
      { error: "Payout has already been claimed" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    submissionId: payout.submissionId,
    walletAddress: payout.walletAddress,
    rewardAmount: payout.rewardAmount,
    feeAmount: payout.feeAmount,
    nonce: payout.nonce,
    expiry: payout.expiry,
    signature: payout.signature,
  });
}
