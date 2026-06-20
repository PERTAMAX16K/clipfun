import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Internal error in /api/users/me:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
