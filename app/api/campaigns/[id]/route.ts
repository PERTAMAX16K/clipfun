import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { campaigns, users, submissions } from "@/db/schema";
import { requireAuth, requireBrand } from "@/lib/server/auth";
import { updateCampaignSchema } from "@/lib/validations";

/**
 * GET /api/campaigns/:id — Get campaign detail
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [row] = await db
    .select({
      campaign: campaigns,
      brandName: users.displayName,
      brandAvatar: users.avatar,
    })
    .from(campaigns)
    .leftJoin(users, eq(campaigns.brandId, users.id))
    .where(eq(campaigns.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json(
      { error: "Campaign not found" },
      { status: 404 },
    );
  }

  const subs = await db
    .select()
    .from(submissions)
    .where(eq(submissions.campaignId, id));

  return NextResponse.json({
    ...row.campaign,
    brandName: row.brandName ?? "Unknown Brand",
    brandAvatar: row.brandAvatar,
    submissionCount: subs.length,
    submissions: subs,
  });
}

/**
 * PATCH /api/campaigns/:id — Update a draft campaign
 */
export async function PATCH(
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

  const [existing] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json(
      { error: "Campaign not found" },
      { status: 404 },
    );
  }

  if (existing.brandId !== currentUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (existing.status !== "DRAFT" && existing.status !== "AWAITING_FUNDING") {
    return NextResponse.json(
      { error: "Only drafts can be edited" },
      { status: 400 },
    );
  }

  const body = await request.json();
  const parsed = updateCampaignSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (data.title) updateData.title = data.title;
  if (data.summary) updateData.summary = data.summary;
  if (data.brief) updateData.brief = data.brief;
  if (data.contentRequirements)
    updateData.contentRequirements = data.contentRequirements;
  if (data.prohibitedContent)
    updateData.prohibitedContent = data.prohibitedContent;
  if (data.category) updateData.category = data.category;
  if (data.platform) updateData.platform = data.platform;
  if (data.deadline) updateData.deadline = new Date(data.deadline);

  if (data.rewardPerSubmission || data.maxWinners) {
    const reward = data.rewardPerSubmission ?? existing.rewardPerSubmission;
    const winners = data.maxWinners ?? existing.maxWinners;
    const pool = reward * winners;
    const fee = Math.ceil(pool * 0.05);

    updateData.rewardPerSubmission = reward;
    updateData.maxWinners = winners;
    updateData.platformFee = fee;
    updateData.totalDeposit = pool + fee;
  }

  const [updated] = await db
    .update(campaigns)
    .set(updateData)
    .where(eq(campaigns.id, id))
    .returning();

  return NextResponse.json(updated);
}
