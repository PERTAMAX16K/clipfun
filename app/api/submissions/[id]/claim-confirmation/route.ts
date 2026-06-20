import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { submissions, transactions, payoutAuthorizations } from "@/db/schema";
import { requireClipper } from "@/lib/server/auth";
import { createPublicClient, http, decodeEventLog } from "viem";
import { baseSepolia } from "viem/chains";
import { campaignEscrowAbi } from "@/lib/contracts/campaign-escrow";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let currentUser;
  try {
    currentUser = await requireClipper(request);
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

  if (submission.status === "PAID") {
    return NextResponse.json({ error: "Already paid" }, { status: 400 });
  }

  const body = await request.json();

  if (!body.txHash) {
    return NextResponse.json({ error: "txHash is required" }, { status: 400 });
  }

  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: body.txHash as `0x${string}` });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch transaction receipt" }, { status: 400 });
  }

  if (receipt.status !== "success") {
    return NextResponse.json({ error: "Transaction reverted onchain" }, { status: 400 });
  }

  let foundEvent = false;
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: campaignEscrowAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "RewardClaimed") {
        foundEvent = true;
        break;
      }
    } catch (e) { }
  }

  if (!foundEvent) {
    return NextResponse.json({ error: "RewardClaimed event not found in transaction" }, { status: 400 });
  }

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
