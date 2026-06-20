import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  submissions,
  campaigns,
  users,
  payoutAuthorizations,
} from "@/db/schema";
import { requireAdmin } from "@/lib/server/auth";
import { generatePayoutSignature } from "@/lib/server/payout-signer";

/**
 * POST /api/admin/submissions/:id/approve
 *
 * Approve a submission and generate payout authorization signature.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let adminUser;
  try {
    adminUser = await requireAdmin(request);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  if (
    submission.status !== "SUBMITTED" &&
    submission.status !== "UNDER_REVIEW"
  ) {
    return NextResponse.json(
      { error: "Submission cannot be approved in current status" },
      { status: 400 },
    );
  }

  // Get campaign for reward info
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, submission.campaignId))
    .limit(1);

  if (!campaign) {
    return NextResponse.json(
      { error: "Campaign not found" },
      { status: 404 },
    );
  }

  // Check maxWinners
  if (campaign.paidWinners >= campaign.maxWinners) {
    return NextResponse.json(
      { error: "Maximum winners reached for this campaign" },
      { status: 400 },
    );
  }

  // Get clipper wallet address
  const [clipper] = await db
    .select()
    .from(users)
    .where(eq(users.id, submission.clipperId))
    .limit(1);

  if (!clipper?.walletAddress) {
    return NextResponse.json(
      { error: "Clipper does not have a wallet address" },
      { status: 400 },
    );
  }

  // Calculate fee per submission
  const feePerSubmission = campaign.rewardPerSubmission * 0.05;

  const { parseUnits } = await import("viem");
  const rewardUnits = parseUnits(campaign.rewardPerSubmission.toString(), 6);
  const feeUnits = parseUnits(feePerSubmission.toString(), 6);

  const { randomBytes } = await import("crypto");
  const nonce = randomBytes(4).readUInt32BE(0);

  // Generate EIP-712 payout signature
  const payoutData = await generatePayoutSignature({
    campaignId: campaign.onchainCampaignId ?? 0,
    submissionId: id,
    clipperWallet: clipper.walletAddress as `0x${string}`,
    rewardAmount: rewardUnits,
    platformFee: feeUnits,
    nonce,
  });

  // Update submission status
  await db
    .update(submissions)
    .set({
      status: "CLAIMABLE",
      reviewedAt: new Date(),
      reviewedBy: adminUser.id,
    })
    .where(eq(submissions.id, id));

  // Create payout authorization record
  const [payout] = await db
    .insert(payoutAuthorizations)
    .values({
      submissionId: id,
      walletAddress: clipper.walletAddress,
      rewardAmount: Number(rewardUnits),
      feeAmount: Number(feeUnits),
      nonce: payoutData.nonce,
      expiry: new Date(payoutData.expiry * 1000),
      signature: payoutData.signature,
    })
    .returning();

  return NextResponse.json({
    submission: { id, status: "CLAIMABLE" },
    payout,
  });
}
