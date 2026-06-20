import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPrivyToken } from "@/lib/server/privy";
import { syncAuthSchema } from "@/lib/validations";

/**
 * POST /api/auth/sync
 *
 * Called after Privy login on the client.
 * Verifies the access token, then upserts the user into PostgreSQL.
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

  // 2. Parse optional body fields
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine — we'll use data from the token
  }

  const parsed = syncAuthSchema.safeParse(body);
  const walletAddress =
    parsed.data?.walletAddress ?? verified.walletAddress ?? null;
  const displayName =
    parsed.data?.displayName ?? verified.displayName ?? "Clipfun User";

  // 3. Check admin allowlist (temporary — later from DB seed)
  const adminIds = (process.env.ADMIN_PRIVY_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const isAdmin = adminIds.includes(verified.privyDid);

  // 4. Upsert user
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.privyDid, verified.privyDid))
    .limit(1);

  let user;

  if (existing.length > 0) {
    // Update
    const [updated] = await db
      .update(users)
      .set({
        walletAddress: walletAddress ?? existing[0].walletAddress,
        displayName: displayName || existing[0].displayName,
        role: isAdmin ? "admin" : existing[0].role,
        updatedAt: new Date(),
      })
      .where(eq(users.privyDid, verified.privyDid))
      .returning();
    user = updated;
  } else {
    // Insert
    const [inserted] = await db
      .insert(users)
      .values({
        privyDid: verified.privyDid,
        walletAddress,
        displayName,
        role: isAdmin ? "admin" : "user",
      })
      .returning();
    user = inserted;
  }

  return NextResponse.json({
    id: user.id,
    privyDid: user.privyDid,
    walletAddress: user.walletAddress,
    displayName: user.displayName,
    avatar: user.avatar,
    role: user.role,
    createdAt: user.createdAt,
  });
}
