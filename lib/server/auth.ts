import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPrivyToken, type VerifiedUser } from "./privy";

export interface AuthenticatedUser {
  id: string;
  privyDid: string;
  walletAddress: string | null;
  displayName: string;
  avatar: string | null;
  role: "clipper" | "brand" | "admin" | null;
}

/**
 * Verify the request's auth token and return the user from the database.
 * Throws a NextResponse error if unauthorized.
 */
export async function requireAuth(
  request: NextRequest,
): Promise<AuthenticatedUser> {
  let verified: VerifiedUser;

  try {
    verified = await verifyPrivyToken(
      request.headers.get("Authorization"),
    );
  } catch (error) {
    console.error("verifyPrivyToken error:", error);
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.privyDid, verified.privyDid))
    .limit(1);

  if (!user) {
    throw NextResponse.json(
      { error: "User not found. Please sync your account first." },
      { status: 404 },
    );
  }

  return {
    id: user.id,
    privyDid: user.privyDid,
    walletAddress: user.walletAddress,
    displayName: user.displayName,
    avatar: user.avatar,
    role: user.role,
  };
}

/**
 * Verify the request's auth token and ensure the user has admin role.
 * Throws a NextResponse error if unauthorized or not admin.
 */
export async function requireAdmin(
  request: NextRequest,
): Promise<AuthenticatedUser> {
  const user = await requireAuth(request);

  if (user.role !== "admin") {
    throw NextResponse.json(
      { error: "Forbidden. Admin access required." },
      { status: 403 },
    );
  }

  return user;
}

/**
 * Verify the request's auth token and ensure the user has brand role.
 * Throws a NextResponse error if unauthorized or not a brand.
 */
export async function requireBrand(
  request: NextRequest,
): Promise<AuthenticatedUser> {
  const user = await requireAuth(request);

  if (user.role !== "brand") {
    throw NextResponse.json(
      { error: "Forbidden. Brand access required." },
      { status: 403 },
    );
  }

  return user;
}

/**
 * Verify the request's auth token and ensure the user has clipper role.
 * Throws a NextResponse error if unauthorized or not a clipper.
 */
export async function requireClipper(
  request: NextRequest,
): Promise<AuthenticatedUser> {
  const user = await requireAuth(request);

  if (user.role !== "clipper") {
    throw NextResponse.json(
      { error: "Forbidden. Clipper access required." },
      { status: 403 },
    );
  }

  return user;
}

/**
 * Wrapper for route handlers to catch thrown NextResponse errors.
 */
export function withAuth<T>(
  handler: (
    request: NextRequest,
    user: AuthenticatedUser,
    ...args: unknown[]
  ) => Promise<NextResponse<T>>,
) {
  return async (request: NextRequest, context?: unknown) => {
    try {
      const user = await requireAuth(request);
      return await handler(request, user, context);
    } catch (error) {
      if (error instanceof NextResponse) return error;
      console.error("Auth middleware error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  };
}

/**
 * Wrapper for admin-only route handlers.
 */
export function withAdmin<T>(
  handler: (
    request: NextRequest,
    user: AuthenticatedUser,
    ...args: unknown[]
  ) => Promise<NextResponse<T>>,
) {
  return async (request: NextRequest, context?: unknown) => {
    try {
      const user = await requireAdmin(request);
      return await handler(request, user, context);
    } catch (error) {
      if (error instanceof NextResponse) return error;
      console.error("Admin middleware error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  };
}

/**
 * Wrapper for brand-only route handlers.
 */
export function withBrand<T>(
  handler: (
    request: NextRequest,
    user: AuthenticatedUser,
    ...args: unknown[]
  ) => Promise<NextResponse<T>>,
) {
  return async (request: NextRequest, context?: unknown) => {
    try {
      const user = await requireBrand(request);
      return await handler(request, user, context);
    } catch (error) {
      if (error instanceof NextResponse) return error;
      console.error("Brand middleware error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  };
}

/**
 * Wrapper for clipper-only route handlers.
 */
export function withClipper<T>(
  handler: (
    request: NextRequest,
    user: AuthenticatedUser,
    ...args: unknown[]
  ) => Promise<NextResponse<T>>,
) {
  return async (request: NextRequest, context?: unknown) => {
    try {
      const user = await requireClipper(request);
      return await handler(request, user, context);
    } catch (error) {
      if (error instanceof NextResponse) return error;
      console.error("Clipper middleware error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  };
}
