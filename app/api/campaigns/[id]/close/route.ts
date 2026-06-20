import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { campaigns, transactions } from "@/db/schema";
import { requireAuth } from "@/lib/server/auth";

/**
 * POST /api/campaigns/:id/close
 *
 * Brand closes a campaign. Status changes to COMPLETED.
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

  if (campaign.brandId !== currentUser.id && currentUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (currentUser.role !== "brand" && currentUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden. Brand or admin access required." }, { status: 403 });
  }

  if (campaign.status !== "OPEN") {
    return NextResponse.json(
      { error: "Only OPEN campaigns can be closed" },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(campaigns)
    .set({
      status: "COMPLETED",
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, id))
    .returning();

  return NextResponse.json(updated);
}
