"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Megaphone,
  Scissors,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { getErrorMessage, useApi } from "@/lib/hooks/use-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ActiveUser } from "@/lib/types";

export default function OnboardingPage() {
  const router = useRouter();
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const { data: activeUser, isLoading } = useApi<ActiveUser>(ready && authenticated ? "/api/users/me" : null);
  const [selected, setSelected] = useState<"clipper" | "brand" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!activeUser?.role) return;

    router.replace(
      activeUser.role === "brand"
        ? "/brand"
        : activeUser.role === "admin"
          ? "/admin"
          : "/clipper",
    );
  }, [activeUser?.role, router]);

  // If not logged in, prompt login
  if (!ready || isLoading) {
    return (
      <section className="page-shell grid min-h-[680px] place-items-center py-16">
        <p className="text-xs font-black uppercase tracking-widest text-blue">
          Loading session...
        </p>
      </section>
    );
  }

  if (!authenticated || !activeUser) {
    return (
      <section className="page-shell grid min-h-[680px] place-items-center py-16">
        <div className="w-full max-w-xl border-2 border-ink bg-white p-8 text-center shadow-brutal-lg">
          <Badge tone="blue" className="mb-6">
            Welcome to Clipfun
          </Badge>
          <h1 className="font-display text-5xl uppercase leading-none">
            Sign in first
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-ink/55">
            You need to sign in before choosing your role.
          </p>
          <Button className="mt-7" size="lg" onClick={login}>
            Sign in with Privy
          </Button>
        </div>
      </section>
    );
  }

  // If already onboarded, redirect
  if (activeUser.role) {
    return (
      <section className="page-shell grid min-h-[680px] place-items-center py-16">
        <p className="text-xs font-black uppercase tracking-widest text-blue">
          Opening your dashboard...
        </p>
      </section>
    );
  }

  async function handleConfirm() {
    if (!selected) return;
    setSubmitting(true);
    setError("");

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("No access token");

      const res = await fetch("/api/auth/set-role", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: selected }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to set role");
      }

      // Redirect to the appropriate dashboard
      router.replace(selected === "brand" ? "/brand" : "/clipper");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  const roles = [
    {
      id: "clipper" as const,
      icon: Scissors,
      title: "I'm a Clipper",
      subtitle: "Content Creator",
      description:
        "Browse campaigns, create clips for brands, submit your work, and claim USDC rewards directly from smart contract escrow.",
      features: [
        "Find & join open campaigns",
        "Submit video clips with proof",
        "Claim USDC rewards onchain",
        "Build your creator portfolio",
      ],
      color: "bg-lime",
      selectedBorder: "border-lime",
      selectedBg: "bg-lime/10",
    },
    {
      id: "brand" as const,
      icon: Megaphone,
      title: "I'm a Brand",
      subtitle: "Campaign Manager",
      description:
        "Create campaigns with locked escrow rewards, review creator submissions, and manage your marketing budget transparently onchain.",
      features: [
        "Create & fund campaigns",
        "Set briefs & requirements",
        "Review & approve submissions",
        "Track ROI & payouts",
      ],
      color: "bg-blue",
      selectedBorder: "border-blue",
      selectedBg: "bg-blue/10",
    },
  ];

  return (
    <section className="page-shell grid min-h-[680px] place-items-center py-12 sm:py-16">
      <div className="w-full max-w-4xl">
        <div className="text-center">
          <Badge tone="orange" className="mb-5">
            One-time setup
          </Badge>
          <h1 className="font-display text-5xl uppercase leading-none sm:text-7xl">
            Choose your
            <br />
            <span className="font-editorial text-orange">role.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-sm leading-6 text-ink/55">
            This choice is <strong className="text-ink">permanent</strong> for
            this wallet. Pick the role that matches how you want to use Clipfun.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelected(role.id)}
              disabled={submitting}
              className={cn(
                "group relative border-2 border-ink bg-white p-6 text-left shadow-brutal transition-all hover:-translate-y-1 hover:shadow-brutal-lg sm:p-8",
                selected === role.id &&
                  `${role.selectedBorder} ${role.selectedBg} ring-2 ring-offset-2`,
                selected && selected !== role.id && "opacity-50",
              )}
            >
              <div
                className={cn(
                  "mb-6 grid h-14 w-14 place-items-center border-2 border-ink shadow-brutal-sm",
                  role.color,
                )}
              >
                <role.icon size={26} className={role.id === "brand" ? "text-white" : "text-ink"} />
              </div>
              <h2 className="font-display text-3xl uppercase">{role.title}</h2>
              <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-ink/45">
                {role.subtitle}
              </p>
              <p className="mt-4 text-sm leading-6 text-ink/65">
                {role.description}
              </p>
              <ul className="mt-5 space-y-2">
                {role.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-2 text-xs font-bold"
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0",
                        role.color,
                      )}
                    />
                    {f}
                  </li>
                ))}
              </ul>

              {selected === role.id && (
                <div
                  className={cn(
                    "absolute -right-3 -top-3 grid h-8 w-8 place-items-center border-2 border-ink text-xs font-black text-white shadow-brutal-sm",
                    role.color,
                  )}
                >
                  ✓
                </div>
              )}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-6 text-center text-sm font-bold text-orange">
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-col items-center gap-4">
          <Button
            size="lg"
            disabled={!selected || submitting}
            onClick={handleConfirm}
            className="min-w-[240px]"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Setting up...
              </>
            ) : (
              <>
                Continue as {selected || "..."} <ArrowRight size={18} />
              </>
            )}
          </Button>
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink/40">
            This cannot be changed later · Use a different wallet for the other role
          </p>
        </div>
      </div>
    </section>
  );
}
