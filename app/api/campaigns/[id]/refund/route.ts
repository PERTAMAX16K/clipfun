import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { campaigns, transactions } from "@/db/schema";
import { requireAuth } from "@/lib/server/auth";
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
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (campaign.brandId !== currentUser.id && currentUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (currentUser.role !== "brand" && currentUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden. Brand or admin access required." }, { status: 403 });
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
      if (decoded.eventName === "CampaignRefunded") {
        foundEvent = true;
        break;
      }
    } catch (e) { }
  }

  if (!foundEvent) {
    return NextResponse.json({ error: "CampaignRefunded event not found in transaction" }, { status: 400 });
  }

  const [updated] = await db
    .update(campaigns)
    .set({
      status: "REFUNDED",
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, id))
    .returning();

  if (body.txHash) {
    await db.insert(transactions).values({
      txHash: body.txHash,
      type: "REFUND",
      campaignId: id,
      userId: currentUser.id,
      amount: campaign.totalDeposit - (campaign.paidWinners * campaign.rewardPerSubmission),
      status: "CONFIRMED",
    });
  }

  return NextResponse.json(updated);
}
