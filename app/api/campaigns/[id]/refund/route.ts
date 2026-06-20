import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { campaigns, transactions } from "@/db/schema";
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

  const body = await request.json();

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
