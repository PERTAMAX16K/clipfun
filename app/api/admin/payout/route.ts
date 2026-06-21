import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { submissions, payoutAuthorizations, campaigns, users } from "@/db/schema";
import { withAdmin } from "@/lib/server/auth";
import { z } from "zod";

const payoutSchema = z.object({
  submissionId: z.string().uuid(),
});

export const POST = withAdmin<unknown>(async (request: NextRequest, user) => {
  const body = await request.json();
  const parsed = payoutSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { submissionId } = parsed.data;

  // 1. Fetch submission and campaign
  const [submissionData] = await db
    .select({
      submission: submissions,
      campaign: campaigns,
      clipper: users,
    })
    .from(submissions)
    .innerJoin(campaigns, eq(submissions.campaignId, campaigns.id))
    .innerJoin(users, eq(submissions.clipperId, users.id))
    .where(eq(submissions.id, submissionId))
    .limit(1);

  if (!submissionData) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  if (submissionData.submission.status !== "SUBMITTED" && submissionData.submission.status !== "UNDER_REVIEW") {
    return NextResponse.json({ error: "Submission is already processed" }, { status: 400 });
  }

  if (!submissionData.clipper.walletAddress) {
    return NextResponse.json({ error: "Clipper has no linked wallet" }, { status: 400 });
  }

  // 2. Generate payout authorization
  // In a real production scenario, we would use ethers/viem to sign an EIP-712 message here
  // using process.env.PAYOUT_SIGNER_PRIVATE_KEY
  // For this hackathon scope, we'll store the authorization in DB to be claimed.
  
  // Note: True integration requires signing here and passing signature to client,
  // but we are returning a mock signature for the frontend to use in its mock functions,
  // or if we switch to viem, we need to sign. Let's do a dummy signature for now.
  const dummySignature = "0x" + "1".repeat(130);
  const nonce = Math.floor(Math.random() * 1000000);
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Update submission status
  await db
    .update(submissions)
    .set({
      status: "APPROVED",
      reviewedAt: new Date(),
      reviewedBy: user.id,
    })
    .where(eq(submissions.id, submissionId));

  // Create payout authorization
  const [payout] = await db
    .insert(payoutAuthorizations)
    .values({
      submissionId,
      walletAddress: submissionData.clipper.walletAddress,
      rewardAmount: submissionData.campaign.rewardPerSubmission,
      feeAmount: submissionData.campaign.platformFee / submissionData.campaign.maxWinners, // Simplified
      nonce,
      expiry,
      signature: dummySignature,
      status: "ISSUED",
    })
    .returning();

  return NextResponse.json(payout, { status: 201 });
});
