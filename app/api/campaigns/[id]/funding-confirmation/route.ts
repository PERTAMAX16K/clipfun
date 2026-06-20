import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { campaigns, transactions } from "@/db/schema";
import { requireBrand } from "@/lib/server/auth";
import { fundingConfirmationSchema } from "@/lib/validations";
import { createPublicClient, http, decodeEventLog } from "viem";
import { baseSepolia } from "viem/chains";
import { campaignEscrowAbi } from "@/lib/contracts/campaign-escrow";

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
    currentUser = await requireBrand(request);
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

  // Verify the transaction receipt on-chain via Viem
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: parsed.data.txHash as `0x${string}` });
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
      if (decoded.eventName === "CampaignCreated") {
        foundEvent = true;
        break;
      }
    } catch {
      // ignore decode error for other logs
    }
  }

  if (!foundEvent) {
    return NextResponse.json({ error: "CampaignCreated event not found in transaction" }, { status: 400 });
  }

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
