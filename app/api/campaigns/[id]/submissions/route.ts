import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { submissions, campaigns, users } from "@/db/schema";
import { requireAuth, requireClipper } from "@/lib/server/auth";
import { createSubmissionSchema } from "@/lib/validations";

/**
 * POST /api/campaigns/:id/submissions — Submit a clip URL
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: campaignId } = await params;

  let currentUser;
  try {
    currentUser = await requireClipper(request);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  if (!campaign) {
    return NextResponse.json(
      { error: "Campaign not found" },
      { status: 404 },
    );
  }

  if (campaign.status !== "OPEN") {
    return NextResponse.json(
      { error: "Campaign is not accepting submissions" },
      { status: 400 },
    );
  }

  // Check deadline
  if (new Date() > campaign.deadline) {
    return NextResponse.json(
      { error: "Submission deadline has passed" },
      { status: 400 },
    );
  }

  const body = await request.json();
  const parsed = createSubmissionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Check duplicate URL
  const [existingSub] = await db
    .select()
    .from(submissions)
    .where(eq(submissions.postUrl, parsed.data.postUrl))
    .limit(1);

  if (existingSub) {
    return NextResponse.json(
      { error: "This URL has already been submitted" },
      { status: 409 },
    );
  }

  const [submission] = await db
    .insert(submissions)
    .values({
      campaignId,
      clipperId: currentUser.id,
      platform: parsed.data.platform,
      postUrl: parsed.data.postUrl,
      campaignCode: parsed.data.campaignCode ?? campaign.campaignCode,
      status: "UNDER_REVIEW",
    })
    .returning();

  return NextResponse.json(submission, { status: 201 });
}

/**
 * GET /api/campaigns/:id/submissions — List submissions for a campaign
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: campaignId } = await params;

  const subs = await db
    .select({
      submission: submissions,
      clipperName: users.displayName,
      clipperAvatar: users.avatar,
    })
    .from(submissions)
    .leftJoin(users, eq(submissions.clipperId, users.id))
    .where(eq(submissions.campaignId, campaignId));

  return NextResponse.json(
    subs.map((row) => ({
      ...row.submission,
      clipperName: row.clipperName ?? "Unknown",
      clipperAvatar: row.clipperAvatar,
    })),
  );
}
