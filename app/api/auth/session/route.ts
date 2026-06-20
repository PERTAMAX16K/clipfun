import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, socialProfiles } from "@/db/schema";
import { verifyPrivyToken } from "@/lib/server/privy";

/**
 * GET /api/auth/session
 *
 * Returns the current user's session data from the database.
 */
export async function GET(request: NextRequest) {
  let verified;
  try {
    verified = await verifyPrivyToken(
      request.headers.get("Authorization"),
    );
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.privyDid, verified.privyDid))
    .limit(1);

  if (!user) {
    return NextResponse.json(
      { error: "User not found. Call POST /api/auth/sync first." },
      { status: 404 },
    );
  }

  // Fetch social profiles
  const profiles = await db
    .select()
    .from(socialProfiles)
    .where(eq(socialProfiles.userId, user.id));

  return NextResponse.json({
    id: user.id,
    privyDid: user.privyDid,
    walletAddress: user.walletAddress,
    displayName: user.displayName,
    avatar: user.avatar,
    role: user.role,
    bio: user.bio,
    socialProfiles: profiles.map((p) => ({
      id: p.id,
      provider: p.provider,
      username: p.username,
      profileUrl: p.profileUrl,
      verified: p.verificationStatus === "verified",
    })),
    createdAt: user.createdAt,
  });
}
