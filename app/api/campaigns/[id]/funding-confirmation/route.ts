import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { campaigns, transactions } from "@/db/schema";
import { requireAuth } from "@/lib/server/auth";
import { fundingConfirmationSchema } from "@/lib/validations";

/**
 * POST /api/campaigns/:id/funding-confirmation
 *
 * Called after the brand deposits USDC to the escrow contract.
 * Verifies the transaction and updates campaign status to OPEN.
 */
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

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, id))
    .limit(1);

  if (!campaign) {
    return NextResponse.json(
      { error: "Campaign not found" },
      { status: 404 },
    );
  }

  if (campaign.brandId !== currentUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (campaign.status !== "AWAITING_FUNDING") {
    return NextResponse.json(
      { error: "Campaign is not awaiting funding" },
      { status: 400 },
    );
  }

  const body = await request.json();
  const parsed = fundingConfirmationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // TODO: In Tahap 6, verify the transaction receipt on-chain via Viem
  // For now, trust the client-provided txHash

  // Update campaign status to OPEN
  const [updated] = await db
    .update(campaigns)
    .set({
      status: "OPEN",
      fundingTxHash: parsed.data.txHash,
      onchainCampaignId: parsed.data.onchainCampaignId,
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, id))
    .returning();

  // Record the funding transaction
  await db.insert(transactions).values({
    txHash: parsed.data.txHash,
    type: "FUND",
    campaignId: id,
    userId: currentUser.id,
    amount: campaign.totalDeposit,
    status: "CONFIRMED",
  });

  return NextResponse.json(updated);
}
