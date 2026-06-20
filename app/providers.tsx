"use client";

import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { Chain } from "viem";

const baseSepolia = {
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: {
    name: "Sepolia Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://sepolia.base.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "BaseScan",
      url: "https://sepolia.basescan.org",
    },
  },
  testnet: true,
} as const satisfies Chain;

interface PrivySession {
  configured: boolean;
  ready: boolean;
  authenticated: boolean;
  privyUserId: string | null;
  displayName: string;
  email: string;
  walletAddress: string;
  isAdmin: boolean;
  login: () => void;
  logout: () => Promise<void>;
  linkWallet: () => void;
  getAccessToken: () => Promise<string | null>;
}

const missingConfigSession: PrivySession = {
  configured: false,
  ready: true,
  authenticated: false,
  privyUserId: null,
  displayName: "",
  email: "",
  walletAddress: "",
  isAdmin: false,
  login: () => undefined,
  logout: async () => undefined,
  linkWallet: () => undefined,
  getAccessToken: async () => null,
};

const PrivySessionContext =
  createContext<PrivySession>(missingConfigSession);

function PrivySessionBridge({ children }: { children: ReactNode }) {
  const {
    ready,
    authenticated,
    user,
    login,
    logout,
    linkWallet,
    getAccessToken,
  } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();

  const session = useMemo<PrivySession>(() => {
    const embeddedWallet = wallets.find(
      (wallet) =>
        wallet.walletClientType === "privy" ||
        wallet.walletClientType === "privy-v2",
    );
    const activeWallet = embeddedWallet ?? wallets[0];
    const adminIds = (
      process.env.NEXT_PUBLIC_ADMIN_PRIVY_USER_IDS ?? ""
    )
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    return {
      configured: true,
      ready: ready && walletsReady,
      authenticated,
      privyUserId: user?.id ?? null,
      displayName:
        user?.google?.name ??
        user?.email?.address.split("@")[0] ??
        "Clipfun User",
      email: user?.google?.email ?? user?.email?.address ?? "",
      walletAddress:
        activeWallet?.address ?? user?.wallet?.address ?? "",
      isAdmin: user ? adminIds.includes(user.id) : false,
      login: () => login(),
      logout,
      linkWallet: () => linkWallet({ walletChainType: "ethereum-only" }),
      getAccessToken,
    };
  }, [
    authenticated,
    linkWallet,
    login,
    logout,
    ready,
    user,
    wallets,
    walletsReady,
    getAccessToken,
  ]);

  return (
    <PrivySessionContext.Provider value={session}>
      {children}
    </PrivySessionContext.Provider>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const clientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID;

  if (!appId) {
    return (
      <PrivySessionContext.Provider value={missingConfigSession}>
        {children}
      </PrivySessionContext.Provider>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      clientId={clientId || undefined}
      config={{
        defaultChain: baseSepolia,
        supportedChains: [baseSepolia],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
        appearance: {
          theme: "light",
          accentColor: "#304FFE",
          logo: undefined,
        },
      }}
    >
      <PrivySessionBridge>{children}</PrivySessionBridge>
    </PrivyProvider>
  );
}

export function usePrivySession() {
  return useContext(PrivySessionContext);
}
