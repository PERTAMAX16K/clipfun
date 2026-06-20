import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { submissions } from "@/db/schema";
import { requireAdmin } from "@/lib/server/auth";
import { reviewSubmissionSchema } from "@/lib/validations";

/**
 * POST /api/admin/submissions/:id/reject
 *
 * Reject a submission with a reason.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let adminUser;
  try {
    adminUser = await requireAdmin(request);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = reviewSubmissionSchema.safeParse({
    ...body,
    decision: "reject",
  });

  if (!parsed.success || !parsed.data.reason) {
    return NextResponse.json(
      {
        error: "Rejection reason is required (minimum 5 characters)",
        details: parsed.success ? undefined : parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const [submission] = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, id))
    .limit(1);

  if (!submission) {
    return NextResponse.json(
      { error: "Submission not found" },
      { status: 404 },
    );
  }

  if (
    submission.status !== "SUBMITTED" &&
    submission.status !== "UNDER_REVIEW"
  ) {
    return NextResponse.json(
      { error: "Submission cannot be rejected in current status" },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(submissions)
    .set({
      status: "REJECTED",
      rejectionReason: parsed.data.reason,
      reviewedAt: new Date(),
      reviewedBy: adminUser.id,
    })
    .where(eq(submissions.id, id))
    .returning();

  return NextResponse.json(updated);
}
