import { NextRequest, NextResponse } from "next/server";
import { eq, or, desc } from "drizzle-orm";
import { db } from "@/db";
import { submissions, users, campaigns } from "@/db/schema";
import { requireAdmin } from "@/lib/server/auth";

/**
 * GET /api/admin/submissions — List submissions for admin review
 */
export async function GET(request: NextRequest) {
  let adminUser;
  try {
    adminUser = await requireAdmin(request);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const rows = await db
    .select({
      submission: submissions,
      clipperName: users.displayName,
      clipperAvatar: users.avatar,
      campaignTitle: campaigns.title,
    })
    .from(submissions)
    .leftJoin(users, eq(submissions.clipperId, users.id))
    .leftJoin(campaigns, eq(submissions.campaignId, campaigns.id))
    .where(
      status
        ? eq(submissions.status, status as typeof submissions.status.enumValues[number])
        : or(
            eq(submissions.status, "SUBMITTED"),
            eq(submissions.status, "UNDER_REVIEW"),
          ),
    )
    .orderBy(desc(submissions.submittedAt))
    .limit(100);

  return NextResponse.json(
    rows.map((row) => ({
      ...row.submission,
      clipperName: row.clipperName ?? "Unknown",
      clipperAvatar: row.clipperAvatar,
      campaignTitle: row.campaignTitle ?? "Unknown Campaign",
    })),
  );
}
