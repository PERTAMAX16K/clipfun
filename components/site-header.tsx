"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  CircleUserRound,
  Copy,
  LogOut,
  Menu,
  RotateCcw,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useApi } from "@/lib/hooks/use-api";
import type { ActiveUser } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, shortAddress } from "@/lib/utils";

const publicLinks = [
  { href: "/explore", label: "Explore" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#for-brands", label: "For brands" },
];

const brandLinks = [
  { href: "/explore", label: "Explore" },
  { href: "/brand", label: "My campaigns" },
  { href: "/activity", label: "Activity" },
];

const clipperLinks = [
  { href: "/explore", label: "Explore" },
  { href: "/clipper", label: "My submissions" },
  { href: "/activity", label: "Activity" },
];

const adminLinks = [
  { href: "/admin", label: "Overview" },
  { href: "/admin#queue", label: "Submission queue" },
  { href: "/explore", label: "Public marketplace" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    ready,
    user,
    login,
    logout,
    authenticated,
    getAccessToken,
  } = usePrivy();
  const { data: activeUser, mutate } =
    useApi<ActiveUser>(
      ready && authenticated ? "/api/users/me" : null,
    );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const syncedPrivyUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !authenticated || !user?.id) {
      syncedPrivyUserId.current = null;
      return;
    }

    if (syncedPrivyUserId.current === user.id) return;
    syncedPrivyUserId.current = user.id;

    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const response = await fetch("/api/auth/sync", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          throw new Error("Failed to synchronize account role");
        }
        await mutate();
        router.refresh();
      } catch (syncError) {
        syncedPrivyUserId.current = null;
        console.error("Failed to sync auth:", syncError);
      }
    })();
  }, [
    authenticated,
    getAccessToken,
    mutate,
    ready,
    router,
    user?.id,
  ]);

  useEffect(() => {
    if (
      authenticated &&
      activeUser &&
      activeUser.role === null &&
      pathname !== "/onboarding"
    ) {
      router.replace("/onboarding");
    }
  }, [activeUser, authenticated, pathname, router]);

  const isAdminArea = pathname.startsWith("/admin");
  const links =
    activeUser?.role === "admin"
      ? adminLinks
      : activeUser?.role === "brand"
        ? brandLinks
        : activeUser?.role === "clipper"
          ? clipperLinks
        : publicLinks;

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      await logout();
      await mutate(undefined, { revalidate: false });
      setAccountOpen(false);
      setMobileOpen(false);
      router.replace("/");
      router.refresh();
    }
  }

  async function copyWalletAddress() {
    if (!activeUser?.walletAddress) return;

    await navigator.clipboard.writeText(activeUser.walletAddress);
    setCopiedAddress(true);
    window.setTimeout(() => setCopiedAddress(false), 1800);
  }

  return (
    <>
      <div className="border-b-2 border-ink bg-blue px-4 py-2 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 text-center text-[10px] font-black uppercase tracking-[0.12em] sm:text-xs">
          <span className="h-2 w-2 animate-pulse rounded-full bg-lime" />
          Privy Auth · Base Sepolia · Fully Integrated Onchain
        </div>
      </div>
      <header
        className={cn(
          "sticky top-0 z-40 border-b-2 border-ink backdrop-blur",
          isAdminArea && activeUser?.role === "admin"
            ? "bg-ink text-white"
            : "bg-cream/95",
        )}
      >
        <div className="mx-auto flex h-[76px] max-w-7xl items-center px-4 sm:px-6">
          <Link href={activeUser?.role === "admin" ? "/admin" : "/"} className="mr-8">
            <span className="flex items-center gap-2">
              <span className="font-display text-2xl uppercase tracking-[-0.08em]">
                CLIP
              </span>
              <span className="grid h-7 w-7 -rotate-6 place-items-center bg-lime font-display text-lg text-ink">
                F
              </span>
              <span className="-ml-2 font-display text-2xl uppercase tracking-[-0.08em]">
                UN
              </span>
              {isAdminArea && activeUser?.role === "admin" && (
                <Badge tone="lime" className="ml-2 hidden sm:inline-flex">
                  Admin
                </Badge>
              )}
            </span>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex">
            {links.map((link) => (
              <Link
                key={`${link.href}-${link.label}`}
                href={link.href}
                className={cn(
                  "text-[11px] font-black uppercase tracking-[0.1em] transition-colors",
                  isAdminArea && activeUser?.role === "admin"
                    ? "text-white/70 hover:text-lime"
                    : "hover:text-blue",
                  pathname === link.href &&
                    (isAdminArea && activeUser?.role === "admin"
                      ? "text-lime"
                      : "text-blue underline decoration-2 underline-offset-8"),
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="relative ml-auto hidden items-center gap-3 sm:flex">
            {!activeUser ? (
              <>
                <Button variant="ghost" onClick={login}>
                  Sign in
                </Button>
                <Button asChild>
                  <Link href="/brand/create">Launch campaign</Link>
                </Button>
              </>
            ) : (
              <>
                {activeUser.role === "admin" && (
                  <Badge tone="lime" className="hidden xl:inline-flex">
                    Database role: admin
                  </Badge>
                )}
                <button
                  onClick={() => setAccountOpen((open) => !open)}
                  className={cn(
                    "flex items-center gap-3 border-2 px-3 py-2 shadow-brutal-sm",
                    isAdminArea && activeUser.role === "admin"
                      ? "border-white bg-white text-ink"
                      : "border-ink bg-white",
                  )}
                >
                  <span className="grid h-8 w-8 place-items-center bg-blue text-[10px] font-black text-white">
                    {activeUser.avatar}
                  </span>
                  <span className="hidden text-left md:block">
                    <span className="block text-[11px] font-black">
                      {activeUser.displayName}
                    </span>
                    <span className="block text-[9px] font-bold text-ink/50">
                      {activeUser.walletAddress
                        ? shortAddress(activeUser.walletAddress)
                        : "No wallet"}
                    </span>
                  </span>
                  <ChevronDown size={14} />
                </button>
              </>
            )}

            {accountOpen && activeUser && (
              <div className="absolute right-0 top-[calc(100%+10px)] w-72 border-2 border-ink bg-white p-3 text-ink shadow-brutal-lg">
                <div className="flex items-center gap-3 border-b border-ink/20 p-2 pb-4">
                  <span className="grid h-11 w-11 place-items-center border border-ink bg-blue text-xs font-black text-white">
                    {activeUser.avatar}
                  </span>
                  <div>
                    <p className="text-xs font-black">{activeUser.displayName}</p>
                    <p className="mt-1 text-[9px] font-bold uppercase text-ink/45">
                      {activeUser.role === "admin"
                        ? "Clipfun administrator"
                        : activeUser.role === null
                          ? "Onboarding required"
                          : `${activeUser.role} account`}
                    </p>
                  </div>
                </div>
                <div className="py-2">
                  {activeUser.role === "admin" && (
                    <Link
                      href="/admin"
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center gap-2 p-2 text-[10px] font-black uppercase hover:bg-cream"
                    >
                      <ShieldCheck size={14} /> Admin console
                    </Link>
                  )}
                  <Link
                    href={
                      activeUser.role === "admin"
                        ? "/explore"
                        : activeUser.role === null
                          ? "/onboarding"
                          : activeUser.role === "brand"
                            ? "/brand"
                            : "/clipper"
                    }
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-2 p-2 text-[10px] font-black uppercase hover:bg-cream"
                  >
                    <CircleUserRound size={14} />
                    {activeUser.role === "admin"
                      ? "Open marketplace"
                      : activeUser.role === null
                        ? "Choose account type"
                        : "Private dashboard"}
                  </Link>
                  <Link
                    href={`/profile/${activeUser.id}`}
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-2 p-2 text-[10px] font-black uppercase hover:bg-cream"
                  >
                    <CircleUserRound size={14} />
                    Public profile
                  </Link>
                  {activeUser.walletAddress ? (
                    <button
                      type="button"
                      onClick={copyWalletAddress}
                      className="flex w-full items-center gap-2 p-2 text-left text-[10px] font-black uppercase hover:bg-cream"
                      title={activeUser.walletAddress}
                    >
                      <WalletCards size={14} />
                      <span className="flex-1">
                        {shortAddress(activeUser.walletAddress)}
                      </span>
                      {copiedAddress ? (
                        <>
                          <Check size={13} className="text-blue" />
                          <span className="text-blue">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 p-2 text-[10px] font-black uppercase">
                      <WalletCards size={14} /> No wallet linked
                    </div>
                  )}
                </div>
                <div className="border-t border-ink/20 pt-2">
                  <button
                    onClick={async () => {
                      await signOut();
                      login();
                    }}
                    className="flex w-full items-center gap-2 p-2 text-[10px] font-black uppercase text-blue hover:bg-cream"
                  >
                    <RotateCcw size={13} /> Switch Privy account
                  </button>
                  <button
                    onClick={signOut}
                    className="flex w-full items-center gap-2 p-2 text-[10px] font-black uppercase text-orange hover:bg-cream"
                  >
                    <LogOut size={13} /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>

          <Button
            aria-label="Open menu"
            variant="ghost"
            size="icon"
            className={cn(
              "ml-auto sm:hidden",
              isAdminArea && activeUser?.role === "admin" && "text-white",
            )}
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
          </Button>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-cream p-5 sm:hidden">
          <div className="flex items-center justify-between border-b-2 border-ink pb-5">
            <span className="font-display text-2xl">
              CLIPFUN {activeUser?.role === "admin" ? "ADMIN" : ""}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(false)}
            >
              <X />
            </Button>
          </div>
          {activeUser ? (
            <div className="mt-5 flex items-center gap-3 border-2 border-ink bg-white p-3 shadow-brutal">
              <span className="grid h-11 w-11 place-items-center bg-blue text-xs font-black text-white">
                {activeUser.avatar}
              </span>
              <div>
                <p className="font-black">{activeUser.displayName}</p>
                <p className="text-xs uppercase text-ink/50">{activeUser.role}</p>
              </div>
              <WalletCards className="ml-auto" size={19} />
            </div>
          ) : (
            <Button
              className="mt-5 w-full"
              onClick={() => {
                setMobileOpen(false);
                login();
              }}
            >
              Sign in
            </Button>
          )}
          <nav className="mt-8 flex flex-col">
            {links.map((link, index) => (
              <Link
                key={`${link.href}-${link.label}`}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-between border-b border-ink py-4 font-display text-4xl uppercase"
              >
                {link.label}
                <span className="font-sans text-xs">0{index + 1}</span>
              </Link>
            ))}
          </nav>
          {activeUser && (
            <button
              onClick={async () => {
                await signOut();
                setMobileOpen(false);
              }}
              className="mt-8 flex items-center gap-2 text-xs font-black uppercase text-orange"
            >
              <LogOut size={15} /> Sign out
            </button>
          )}
        </div>
      )}

    </>
  );
}
