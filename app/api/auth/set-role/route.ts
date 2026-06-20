import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPrivyToken } from "@/lib/server/privy";
import { z } from "zod";

const setRoleSchema = z.object({
  role: z.enum(["clipper", "brand"]),
});

/**
 * POST /api/auth/set-role
 *
 * Called once during onboarding to permanently assign a role.
 * User must be authenticated but not yet have a role assigned.
 */
export async function POST(request: NextRequest) {
  // 1. Verify Privy token
  let verified;
  try {
    verified = await verifyPrivyToken(
      request.headers.get("Authorization"),
    );
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse and validate body
  const body = await request.json();
  const parsed = setRoleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid role. Must be 'clipper' or 'brand'." },
      { status: 400 },
    );
  }

  // 3. Look up user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.privyDid, verified.privyDid))
    .limit(1);

  if (!user) {
    return NextResponse.json(
      { error: "User not found. Please sync your account first." },
      { status: 404 },
    );
  }

  // 4. Prevent re-onboarding — role is permanent
  if (user.role !== null) {
    return NextResponse.json(
      { error: "Role already assigned. Cannot change role." },
      { status: 409 },
    );
  }

  // 5. Set role and mark onboarding complete
  const [updated] = await db
    .update(users)
    .set({
      role: parsed.data.role,
      onboardedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .returning();

  // 6. Set cookie for middleware route protection
  const response = NextResponse.json({
    id: updated.id,
    privyDid: updated.privyDid,
    walletAddress: updated.walletAddress,
    displayName: updated.displayName,
    avatar: updated.avatar,
    role: updated.role,
    onboardedAt: updated.onboardedAt,
  });

  response.cookies.set("x-user-role", updated.role!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return response;
}
