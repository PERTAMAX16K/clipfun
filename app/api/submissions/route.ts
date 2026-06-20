import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { submissions, campaigns } from "@/db/schema";
import { withClipper } from "@/lib/server/auth";
import { z } from "zod";

const submitSchema = z.object({
  campaignId: z.string().uuid(),
  postUrl: z.string().url(),
  platform: z.enum(["youtube", "tiktok", "instagram"]),
});

export const POST = withClipper<any>(async (request: NextRequest, user) => {
  const body = await request.json();
  const parsed = submitSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, data.campaignId))
    .limit(1);

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (campaign.status !== "OPEN") {
    return NextResponse.json({ error: "Campaign is not open for submissions" }, { status: 400 });
  }

  // Check if clipper has already submitted
  const existingSub = await db
    .select()
    .from(submissions)
    .where(eq(submissions.clipperId, user.id))
    .limit(1);

  // We allow multiple submissions conceptually, but let's just insert
  const [submission] = await db
    .insert(submissions)
    .values({
      campaignId: data.campaignId,
      clipperId: user.id,
      postUrl: data.postUrl,
      platform: data.platform,
      campaignCode: campaign.campaignCode,
      status: "SUBMITTED",
    })
    .returning();

  return NextResponse.json(submission, { status: 201 });
});

export const GET = withClipper(async (request: NextRequest, user) => {
  const userSubmissions = await db
    .select()
    .from(submissions)
    .where(eq(submissions.clipperId, user.id));

  return NextResponse.json(userSubmissions);
});
