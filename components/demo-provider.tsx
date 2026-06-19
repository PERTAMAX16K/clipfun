"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePrivySession } from "@/app/providers";
import { initialState } from "@/lib/fixtures";
import type {
  AuthService,
  Campaign,
  CampaignDraft,
  CampaignService,
  DemoState,
  Submission,
  SubmissionService,
  SocialProvider,
  SocialProfile,
  Transaction,
  TransactionService,
} from "@/lib/types";
import { wait } from "@/lib/utils";

const STORAGE_KEY = "clipfun-demo-state-v2";

interface DemoContextValue {
  state: DemoState;
  hydrated: boolean;
  activeUser: DemoState["users"][number] | null;
  loginOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
  auth: AuthService;
  campaigns: CampaignService;
  submissions: SubmissionService;
  transactions: TransactionService;
  resetDemo: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

const randomHash = () =>
  `0x${Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("")}`;

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const stateRef = useRef(state);
  const privy = usePrivySession();

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setState(JSON.parse(saved) as DemoState);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    stateRef.current = state;
    if (hydrated) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, hydrated]);

  const updateState = useCallback((updater: (current: DemoState) => DemoState) => {
    setState((current) => {
      const next = updater(current);
      stateRef.current = next;
      return next;
    });
  }, []);

  const signOut = useCallback(async () => {
    await privy.logout();
    updateState((current) => ({ ...current, activeUserId: null }));
  }, [privy, updateState]);

  useEffect(() => {
    if (!hydrated || !privy.ready) return;

    if (!privy.authenticated || !privy.privyUserId) {
      updateState((current) =>
        current.activeUserId
          ? { ...current, activeUserId: null }
          : current,
      );
      return;
    }

    const privyUserId = privy.privyUserId;
    const displayName = privy.displayName || "Clipfun User";
    const initials = displayName
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    updateState((current) => {
      const existing = current.users.find((user) => user.id === privyUserId);
      const syncedUser = {
        id: privyUserId,
        displayName,
        handle: privy.email ? `@${privy.email.split("@")[0]}` : "@clipfun",
        avatar: initials || "CF",
        walletAddress:
          privy.walletAddress ||
          existing?.walletAddress ||
          "0x0000000000000000000000000000000000000000",
        role: privy.isAdmin ? ("admin" as const) : ("user" as const),
        bio:
          existing?.bio ??
          "Clipfun marketplace member authenticated with Privy.",
      };

      const isFirstMarketplaceAccount =
        !privy.isAdmin &&
        !current.users.some(
          (user) =>
            user.id.startsWith("did:privy:") && user.id !== privyUserId,
        );

      return {
        ...current,
        activeUserId: privyUserId,
        users: existing
          ? current.users.map((user) =>
              user.id === privyUserId ? syncedUser : user,
            )
          : [syncedUser, ...current.users],
        campaigns: isFirstMarketplaceAccount
          ? current.campaigns.map((campaign) =>
              campaign.brandId === "user-brand"
                ? {
                    ...campaign,
                    brandId: privyUserId,
                    brandName: displayName,
                    brandAvatar: syncedUser.avatar,
                  }
                : campaign,
            )
          : current.campaigns,
        submissions: isFirstMarketplaceAccount
          ? current.submissions.map((submission) =>
              submission.clipperId === "user-clipper"
                ? {
                    ...submission,
                    clipperId: privyUserId,
                    clipperName: displayName,
                    clipperAvatar: syncedUser.avatar,
                  }
                : submission,
            )
          : current.submissions,
        socialProfiles: isFirstMarketplaceAccount
          ? current.socialProfiles.map((profile) =>
              profile.userId === "user-clipper"
                ? { ...profile, userId: privyUserId }
                : profile,
            )
          : current.socialProfiles,
      };
    });
  }, [
    hydrated,
    privy.authenticated,
    privy.displayName,
    privy.email,
    privy.isAdmin,
    privy.privyUserId,
    privy.ready,
    privy.walletAddress,
    updateState,
  ]);

  const addSocialProfile = useCallback(async (
    provider: SocialProvider,
    username: string,
    profileUrl: string,
  ) => {
    if (!stateRef.current.activeUserId) {
      throw new Error("Sign in before adding a social profile.");
    }
    await wait(600);
    const profile: SocialProfile = {
      id: `social-${Date.now()}`,
      userId: stateRef.current.activeUserId,
      provider,
      username,
      profileUrl,
      verified: false,
    };
    updateState((current) => ({
      ...current,
      socialProfiles: [profile, ...current.socialProfiles],
    }));
    return profile;
  }, [updateState]);

  const createCampaign = useCallback(async (draft: CampaignDraft) => {
    await wait(800);
    const brand = stateRef.current.users.find(
      (user) => user.id === stateRef.current.activeUserId,
    );
    if (!brand || brand.role === "admin") {
      throw new Error("Sign in with a marketplace account.");
    }
    const campaign: Campaign = {
      id: `camp-${Date.now()}`,
      brandId: brand.id,
      brandName: brand.displayName,
      brandAvatar: brand.avatar,
      ...draft,
      status: "AWAITING_FUNDING",
      paidWinners: 0,
      submissionCount: 0,
      campaignCode: `CF-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      visual: "blue",
      createdAt: new Date().toISOString(),
    };
    updateState((current) => ({
      ...current,
      campaigns: [campaign, ...current.campaigns],
    }));
    return campaign;
  }, [updateState]);

  const fundCampaign = useCallback(
    async (campaignId: string, simulateFailure = false) => {
      const campaign = stateRef.current.campaigns.find(
        (item) => item.id === campaignId,
      );
      if (!campaign) throw new Error("Campaign not found");
      await wait(900);
      const transaction: Transaction = {
        id: `tx-${Date.now()}`,
        type: "FUND",
        campaignId,
        campaignTitle: campaign.title,
        amount:
          campaign.rewardPerSubmission * campaign.maxWinners * 1.05,
        status: simulateFailure ? "FAILED" : "PENDING",
        hash: randomHash(),
        createdAt: new Date().toISOString(),
      };
      updateState((current) => ({
        ...current,
        transactions: [transaction, ...current.transactions],
      }));
      if (simulateFailure) return transaction;
      await wait(1000);
      const confirmed = { ...transaction, status: "CONFIRMED" as const };
      updateState((current) => ({
        ...current,
        campaigns: current.campaigns.map((item) =>
          item.id === campaignId
            ? {
                ...item,
                status: "OPEN",
                fundingTxHash: transaction.hash,
              }
            : item,
        ),
        transactions: current.transactions.map((item) =>
          item.id === transaction.id ? confirmed : item,
        ),
      }));
      return confirmed;
    },
    [updateState],
  );

  const refundCampaign = useCallback(async (campaignId: string) => {
    const campaign = stateRef.current.campaigns.find(
      (item) => item.id === campaignId,
    );
    if (!campaign) throw new Error("Campaign not found");
    await wait(700);
    const amount =
      campaign.rewardPerSubmission *
      Math.max(campaign.maxWinners - campaign.paidWinners, 0);
    const transaction: Transaction = {
      id: `tx-${Date.now()}`,
      type: "REFUND",
      campaignId,
      campaignTitle: campaign.title,
      amount,
      status: "PENDING",
      hash: randomHash(),
      createdAt: new Date().toISOString(),
    };
    updateState((current) => ({
      ...current,
      transactions: [transaction, ...current.transactions],
    }));
    await wait(900);
    const confirmed = { ...transaction, status: "CONFIRMED" as const };
    updateState((current) => ({
      ...current,
      campaigns: current.campaigns.map((item) =>
        item.id === campaignId ? { ...item, status: "REFUNDED" } : item,
      ),
      transactions: current.transactions.map((item) =>
        item.id === transaction.id ? confirmed : item,
      ),
    }));
    return confirmed;
  }, [updateState]);

  const createSubmission = useCallback(
    async (
      campaignId: string,
      platform: Submission["platform"],
      postUrl: string,
    ) => {
      const duplicate = stateRef.current.submissions.some(
        (submission) => submission.postUrl.toLowerCase() === postUrl.toLowerCase(),
      );
      if (duplicate) throw new Error("This video URL has already been submitted.");
      const campaign = stateRef.current.campaigns.find(
        (item) => item.id === campaignId,
      );
      const clipper = stateRef.current.users.find(
        (user) => user.id === stateRef.current.activeUserId,
      );
      if (!campaign || !clipper || clipper.role === "admin") {
        throw new Error("Sign in with a marketplace account.");
      }
      await wait(800);
      const submission: Submission = {
        id: `sub-${Date.now()}`,
        campaignId,
        campaignTitle: campaign.title,
        clipperId: clipper.id,
        clipperName: clipper.displayName,
        clipperAvatar: clipper.avatar,
        platform,
        postUrl,
        status: "SUBMITTED",
        submittedAt: new Date().toISOString(),
      };
      updateState((current) => ({
        ...current,
        campaigns: current.campaigns.map((item) =>
          item.id === campaignId
            ? { ...item, submissionCount: item.submissionCount + 1 }
            : item,
        ),
        submissions: [submission, ...current.submissions],
      }));
      await wait(500);
      const reviewing = {
        ...submission,
        status: "UNDER_REVIEW" as const,
      };
      updateState((current) => ({
        ...current,
        submissions: current.submissions.map((item) =>
          item.id === submission.id ? reviewing : item,
        ),
      }));
      return reviewing;
    },
    [updateState],
  );

  const reviewSubmission = useCallback(
    async (
      submissionId: string,
      decision: "approve" | "reject",
      reason?: string,
    ) => {
      const submission = stateRef.current.submissions.find(
        (item) => item.id === submissionId,
      );
      if (!submission) throw new Error("Submission not found");
      await wait(700);
      if (decision === "reject") {
        const rejected: Submission = {
          ...submission,
          status: "REJECTED",
          rejectionReason: reason || "The content does not match the brief.",
        };
        updateState((current) => ({
          ...current,
          submissions: current.submissions.map((item) =>
            item.id === submissionId ? rejected : item,
          ),
        }));
        return rejected;
      }
      const campaign = stateRef.current.campaigns.find(
        (item) => item.id === submission.campaignId,
      )!;
      const clipper = stateRef.current.users.find(
        (user) => user.id === submission.clipperId,
      );
      const payoutId = `payout-${Date.now()}`;
      const approved: Submission = {
        ...submission,
        status: "CLAIMABLE",
        payoutId,
      };
      updateState((current) => ({
        ...current,
        submissions: current.submissions.map((item) =>
          item.id === submissionId ? approved : item,
        ),
        payouts: [
          {
            id: payoutId,
            submissionId,
            walletAddress:
              clipper?.walletAddress ?? "0x0000000000000000000000000000000000000000",
            rewardAmount: campaign.rewardPerSubmission,
            feeAmount: campaign.rewardPerSubmission * 0.05,
            nonce: Date.now(),
            expiry: new Date(Date.now() + 3 * 86400000).toISOString(),
            signature: `0xdemo_signature_${submissionId}`,
            status: "ISSUED",
          },
          ...current.payouts,
        ],
      }));
      return approved;
    },
    [updateState],
  );

  const claimReward = useCallback(async (submissionId: string) => {
    const submission = stateRef.current.submissions.find(
      (item) => item.id === submissionId,
    );
    if (!submission || submission.status !== "CLAIMABLE") {
      throw new Error("This reward is not claimable.");
    }
    const campaign = stateRef.current.campaigns.find(
      (item) => item.id === submission.campaignId,
    )!;
    await wait(900);
    const transaction: Transaction = {
      id: `tx-${Date.now()}`,
      type: "CLAIM",
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      amount: campaign.rewardPerSubmission,
      status: "PENDING",
      hash: randomHash(),
      createdAt: new Date().toISOString(),
    };
    updateState((current) => ({
      ...current,
      transactions: [transaction, ...current.transactions],
    }));
    await wait(1100);
    const confirmed = { ...transaction, status: "CONFIRMED" as const };
    updateState((current) => ({
      ...current,
      submissions: current.submissions.map((item) =>
        item.id === submissionId ? { ...item, status: "PAID" } : item,
      ),
      payouts: current.payouts.map((item) =>
        item.submissionId === submissionId
          ? { ...item, status: "CLAIMED" }
          : item,
      ),
      campaigns: current.campaigns.map((item) =>
        item.id === campaign.id
          ? { ...item, paidWinners: item.paidWinners + 1 }
          : item,
      ),
      transactions: current.transactions.map((item) =>
        item.id === transaction.id ? confirmed : item,
      ),
    }));
    return confirmed;
  }, [updateState]);

  const retryTransaction = useCallback(async (transactionId: string) => {
    const transaction = stateRef.current.transactions.find(
      (item) => item.id === transactionId,
    );
    if (!transaction) throw new Error("Transaction not found");
    updateState((current) => ({
      ...current,
      transactions: current.transactions.map((item) =>
        item.id === transactionId ? { ...item, status: "PENDING" } : item,
      ),
    }));
    await wait(1100);
    const confirmed = { ...transaction, status: "CONFIRMED" as const };
    updateState((current) => ({
      ...current,
      campaigns: current.campaigns.map((campaign) =>
        transaction.type === "FUND" && campaign.id === transaction.campaignId
          ? { ...campaign, status: "OPEN", fundingTxHash: transaction.hash }
          : campaign,
      ),
      transactions: current.transactions.map((item) =>
        item.id === transactionId ? confirmed : item,
      ),
    }));
    return confirmed;
  }, [updateState]);

  const resetDemo = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setState(initialState);
  }, []);

  const value = useMemo<DemoContextValue>(() => ({
    state,
    hydrated: hydrated && privy.ready,
    loginOpen,
    openLogin: () => {
      if (privy.configured) {
        privy.login();
      } else {
        setLoginOpen(true);
      }
    },
    closeLogin: () => setLoginOpen(false),
    activeUser:
      state.users.find((user) => user.id === state.activeUserId) ?? null,
    auth: {
      signOut,
      linkWallet: privy.linkWallet,
      addSocialProfile,
    },
    campaigns: { createCampaign, fundCampaign, refundCampaign },
    submissions: {
      createSubmission,
      reviewSubmission,
      claimReward,
    },
    transactions: { retryTransaction },
    resetDemo,
  }), [
    state,
    hydrated,
    loginOpen,
    privy,
    signOut,
    addSocialProfile,
    createCampaign,
    fundCampaign,
    refundCampaign,
    createSubmission,
    reviewSubmission,
    claimReward,
    retryTransaction,
    resetDemo,
  ]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("useDemo must be used inside DemoProvider");
  return context;
}
