import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js Middleware — runs at the Edge before every matched route.
 *
 * Uses the `x-user-role` cookie (set during login/onboarding) to gate
 * routes without hitting the database on every request.
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role = request.cookies.get("x-user-role")?.value; // "clipper" | "brand" | "admin" | undefined

  // Helper to redirect
  function redirect(path: string) {
    return NextResponse.redirect(new URL(path, request.url));
  }

  // Helper: determine the "home" dashboard for a role
  function dashboardFor(r: string) {
    switch (r) {
      case "brand":
        return "/brand";
      case "clipper":
        return "/clipper";
      case "admin":
        return "/admin";
      default:
        return "/";
    }
  }

  // --- Rule 1: Onboarding page ---
  // If user already has a role, don't let them visit /onboarding
  if (pathname === "/onboarding") {
    if (role) {
      return redirect(dashboardFor(role));
    }
    return NextResponse.next();
  }

  // --- Rule 2: Brand routes (/brand, /brand/*) ---
  if (pathname.startsWith("/brand")) {
    if (!role) {
      // Not logged in or not onboarded → redirect to home
      return redirect("/");
    }
    if (role !== "brand" && role !== "admin") {
      return redirect(dashboardFor(role));
    }
    return NextResponse.next();
  }

  // --- Rule 3: Clipper routes (/clipper, /clipper/*) ---
  if (pathname.startsWith("/clipper")) {
    if (!role) {
      return redirect("/");
    }
    if (role !== "clipper" && role !== "admin") {
      return redirect(dashboardFor(role));
    }
    return NextResponse.next();
  }

  // --- Rule 4: Admin routes (/admin, /admin/*) ---
  if (pathname.startsWith("/admin")) {
    if (role !== "admin") {
      return redirect(role ? dashboardFor(role) : "/");
    }
    return NextResponse.next();
  }

  // --- Rule 5: Activity page (authenticated only) ---
  if (pathname === "/activity") {
    if (!role) {
      return redirect("/");
    }
    return NextResponse.next();
  }

  // Everything else (/, /explore, /campaigns/*, /api/*, static assets) → pass through
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files, _next, and api routes
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
