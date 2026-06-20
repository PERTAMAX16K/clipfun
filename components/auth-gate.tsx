"use client";

import Link from "next/link";
import { LockKeyhole, ShieldX } from "lucide-react";
import type { ReactNode } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useApi } from "@/lib/hooks/use-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ActiveUser } from "@/lib/types";

export function AuthGate({
  children,
  adminOnly = false,
  memberOnly = false,
  brandOnly = false,
  clipperOnly = false,
}: {
  children: ReactNode;
  adminOnly?: boolean;
  memberOnly?: boolean;
  brandOnly?: boolean;
  clipperOnly?: boolean;
}) {
  const { ready, login, authenticated } = usePrivy();
  const { data: activeUser, isLoading } = useApi<ActiveUser>(ready && authenticated ? "/api/users/me" : null);

  if (!ready || (authenticated && isLoading)) {
    return (
      <section className="page-shell grid min-h-[560px] place-items-center py-16">
        <p className="text-xs font-black uppercase tracking-widest text-blue">
          Loading session...
        </p>
      </section>
    );
  }

  if (!activeUser) {
    return (
      <section className="page-shell grid min-h-[560px] place-items-center py-16">
        <div className="w-full max-w-xl border-2 border-ink bg-white p-8 text-center shadow-brutal-lg">
          <div className="mx-auto grid h-20 w-20 place-items-center border-2 border-ink bg-lime shadow-brutal">
            <LockKeyhole size={34} />
          </div>
          <Badge tone="blue" className="mt-7">
            Authentication required
          </Badge>
          <h1 className="mt-4 font-display text-5xl uppercase leading-none">
            Sign in to continue
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-ink/55">
            Clipfun uses one login flow for creators, brands, and platform
            administrators.
          </p>
          <Button className="mt-7" size="lg" onClick={login}>
            Sign in with Privy
          </Button>
        </div>
      </section>
    );
  }

  // Determine access denial
  const role = activeUser.role;
  const denied =
    (adminOnly && role !== "admin") ||
    (brandOnly && role !== "brand") ||
    (clipperOnly && role !== "clipper") ||
    (memberOnly && role === "admin");

  if (denied) {
    // Build contextual message
    let title = "Access restricted";
    let message =
      "You don't have permission to view this page.";
    let returnHref = "/explore";
    let returnLabel = "Return to marketplace";

    if (adminOnly) {
      title = "Admin access only";
      message =
        "Your Privy identity is valid, but the Clipfun database does not assign this account the admin role.";
    } else if (brandOnly) {
      title = "Brand access only";
      message =
        "This area is reserved for brand accounts. If you're a content creator, head to your clipper dashboard instead.";
      returnHref = role === "clipper" ? "/clipper" : "/explore";
      returnLabel = role === "clipper" ? "Go to my dashboard" : "Return to marketplace";
    } else if (clipperOnly) {
      title = "Clipper access only";
      message =
        "This area is reserved for content creators. If you're a brand, head to your brand dashboard instead.";
      returnHref = role === "brand" ? "/brand" : "/explore";
      returnLabel = role === "brand" ? "Go to my dashboard" : "Return to marketplace";
    } else if (memberOnly) {
      message =
        "This workspace belongs to marketplace members. Use the public marketplace or return to the Admin Console.";
    }

    return (
      <section className="page-shell grid min-h-[560px] place-items-center py-16">
        <div className="w-full max-w-xl border-2 border-ink bg-white p-8 text-center shadow-brutal-lg">
          <div className="mx-auto grid h-20 w-20 place-items-center border-2 border-ink bg-orange text-white shadow-brutal">
            <ShieldX size={34} />
          </div>
          <Badge tone="red" className="mt-7">403 · Restricted</Badge>
          <h1 className="mt-4 font-display text-5xl uppercase leading-none">
            {title}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-ink/55">
            {message}
          </p>
          <Button asChild className="mt-7" variant="outline">
            <Link href={returnHref}>{returnLabel}</Link>
          </Button>
        </div>
      </section>
    );
  }

  return children;
}
