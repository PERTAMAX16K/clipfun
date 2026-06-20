"use client";

import Link from "next/link";
import { LockKeyhole, ShieldX } from "lucide-react";
import type { ReactNode } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useApi } from "@/lib/hooks/use-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function AuthGate({
  children,
  adminOnly = false,
  memberOnly = false,
}: {
  children: ReactNode;
  adminOnly?: boolean;
  memberOnly?: boolean;
}) {
  const { ready, login, authenticated } = usePrivy();
  const { data: activeUser, isLoading } = useApi<any>("/api/users/me");

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

  if (
    (adminOnly && activeUser.role !== "admin") ||
    (memberOnly && activeUser.role === "admin")
  ) {
    return (
      <section className="page-shell grid min-h-[560px] place-items-center py-16">
        <div className="w-full max-w-xl border-2 border-ink bg-white p-8 text-center shadow-brutal-lg">
          <div className="mx-auto grid h-20 w-20 place-items-center border-2 border-ink bg-orange text-white shadow-brutal">
            <ShieldX size={34} />
          </div>
          <Badge tone="red" className="mt-7">403 · Restricted</Badge>
          <h1 className="mt-4 font-display text-5xl uppercase leading-none">
            Admin access only
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-ink/55">
            {adminOnly
              ? "Your Privy identity is valid, but the Clipfun database does not assign this account the admin role."
              : "This workspace belongs to marketplace members. Use the public marketplace or return to the Admin Console."}
          </p>
          <Button asChild className="mt-7" variant="outline">
            <Link href="/explore">Return to marketplace</Link>
          </Button>
        </div>
      </section>
    );
  }

  return children;
}
