import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { socialProfiles } from "@/db/schema";
import { requireAuth } from "@/lib/server/auth";
import { addSocialProfileSchema } from "@/lib/validations";

/**
 * POST /api/users/social-profiles — Add a social profile
 */
export async function POST(request: NextRequest) {
  let currentUser;
  try {
    currentUser = await requireAuth(request);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = addSocialProfileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [profile] = await db
    .insert(socialProfiles)
    .values({
      userId: currentUser.id,
      provider: parsed.data.provider,
      username: parsed.data.username,
      profileUrl: parsed.data.profileUrl,
    })
    .returning();

  return NextResponse.json(profile, { status: 201 });
}

/**
 * GET /api/users/social-profiles — List current user's social profiles
 */
export async function GET(request: NextRequest) {
  let currentUser;
  try {
    currentUser = await requireAuth(request);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profiles = await db
    .select()
    .from(socialProfiles)
    .where(eq(socialProfiles.userId, currentUser.id));

  return NextResponse.json(profiles);
}
