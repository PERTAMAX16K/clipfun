import { NextRequest, NextResponse } from "next/server";
import { eq, desc, and } from "drizzle-orm";
import { db } from "@/db";
import { campaigns, users, submissions } from "@/db/schema";
import { requireAuth, requireBrand } from "@/lib/server/auth";
import { createCampaignSchema } from "@/lib/validations";

function generateCampaignCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "CF-";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const VISUALS = ["blue", "orange", "lime", "purple"] as const;

/**
 * POST /api/campaigns — Create a new draft campaign
 */
export async function POST(request: NextRequest) {
  let currentUser;
  try {
    currentUser = await requireBrand(request);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createCampaignSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const rewardPool = data.rewardPerSubmission * data.maxWinners;
  const platformFee = Math.ceil(rewardPool * 0.05);
  const totalDeposit = rewardPool + platformFee;

  const [campaign] = await db
    .insert(campaigns)
    .values({
      brandId: currentUser.id,
      title: data.title,
      summary: data.summary,
      brief: data.brief,
      contentRequirements: data.contentRequirements,
      prohibitedContent: data.prohibitedContent,
      category: data.category,
      platform: data.platform,
      referenceAttachment: data.referenceAttachment || null,
      rewardPerSubmission: data.rewardPerSubmission,
      maxWinners: data.maxWinners,
      platformFee,
      totalDeposit,
      deadline: new Date(data.deadline),
      campaignCode: generateCampaignCode(),
      visual: VISUALS[Math.floor(Math.random() * VISUALS.length)],
      status: "AWAITING_FUNDING",
    })
    .returning();

  return NextResponse.json(campaign, { status: 201 });
}

/**
 * GET /api/campaigns — List campaigns
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const brandId = searchParams.get("brandId");

  const conditions = [];
  if (status) {
    conditions.push(
      eq(campaigns.status, status as typeof campaigns.status.enumValues[number]),
    );
  }
  if (brandId) {
    conditions.push(eq(campaigns.brandId, brandId));
  }

  const rows = await db
    .select({
      campaign: campaigns,
      brandName: users.displayName,
      brandAvatar: users.avatar,
    })
    .from(campaigns)
    .leftJoin(users, eq(campaigns.brandId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(campaigns.createdAt))
    .limit(50);

  // Count submissions per campaign
  const result = await Promise.all(
    rows.map(async (row) => {
      const subs = await db
        .select()
        .from(submissions)
        .where(eq(submissions.campaignId, row.campaign.id));
      return {
        ...row.campaign,
        brandName: row.brandName ?? "Unknown Brand",
        brandAvatar: row.brandAvatar,
        submissionCount: subs.length,
      };
    }),
  );

  return NextResponse.json(result);
}
