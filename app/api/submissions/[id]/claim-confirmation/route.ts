import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { submissions, transactions, payoutAuthorizations } from "@/db/schema";
import { requireAuth } from "@/lib/server/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let currentUser;
  try {
    currentUser = await requireAuth(request);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  if (submission.clipperId !== currentUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  // Mark submission as PAID
  const [updated] = await db
    .update(submissions)
    .set({
      status: "PAID",
    })
    .where(eq(submissions.id, id))
    .returning();

  // Update payout authorization
  await db
    .update(payoutAuthorizations)
    .set({
      status: "CLAIMED",
      claimTxHash: body.txHash,
    })
    .where(eq(payoutAuthorizations.submissionId, id));

  // Record transaction
  if (body.txHash && body.amount) {
    await db.insert(transactions).values({
      txHash: body.txHash,
      type: "CLAIM",
      campaignId: submission.campaignId,
      userId: currentUser.id,
      amount: body.amount,
      status: "CONFIRMED",
    });
  }

  return NextResponse.json(updated);
}
