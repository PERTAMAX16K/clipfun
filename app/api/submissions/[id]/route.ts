import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { submissions, users, campaigns, payoutAuthorizations } from "@/db/schema";

/**
 * GET /api/submissions/:id — Get submission detail with payout info
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [row] = await db
    .select({
      submission: submissions,
      clipperName: users.displayName,
      clipperAvatar: users.avatar,
    })
    .from(submissions)
    .leftJoin(users, eq(submissions.clipperId, users.id))
    .where(eq(submissions.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json(
      { error: "Submission not found" },
      { status: 404 },
    );
  }

  // Get campaign title
  const [campaign] = await db
    .select({ title: campaigns.title })
    .from(campaigns)
    .where(eq(campaigns.id, row.submission.campaignId))
    .limit(1);

  // Get payout if exists
  const [payout] = await db
    .select()
    .from(payoutAuthorizations)
    .where(eq(payoutAuthorizations.submissionId, id))
    .limit(1);

  return NextResponse.json({
    ...row.submission,
    clipperName: row.clipperName ?? "Unknown",
    clipperAvatar: row.clipperAvatar,
    campaignTitle: campaign?.title ?? "Unknown Campaign",
    payout: payout ?? null,
  });
}
