import { PrivyClient } from "@privy-io/server-auth";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;

let _privy: PrivyClient | null = null;

/** Singleton Privy server client. */
export function getPrivyClient(): PrivyClient {
  if (!appId || !appSecret) {
    throw new Error(
      "Missing NEXT_PUBLIC_PRIVY_APP_ID or PRIVY_APP_SECRET environment variables. " +
        "These are required for server-side token verification.",
    );
  }
  if (!_privy) {
    _privy = new PrivyClient(appId, appSecret);
  }
  return _privy;
}

export interface VerifiedUser {
  privyDid: string;
  walletAddress?: string;
  email?: string;
  displayName?: string;
}

/**
 * Verify a Privy access token from the Authorization header.
 * Returns the verified user claims or throws.
 */
export async function verifyPrivyToken(
  authHeader: string | null,
): Promise<VerifiedUser> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const token = authHeader.replace("Bearer ", "");
  const privy = getPrivyClient();

  const verifiedClaims = await privy.verifyAuthToken(token);

  // Fetch full user data to get wallet + profile info
  const user = await privy.getUser(verifiedClaims.userId);

  const embeddedWallet = user.linkedAccounts.find(
    (account) =>
      account.type === "wallet" &&
      (account.walletClientType === "privy" ||
        account.walletClientType === "privy_v2"),
  );
  const externalWallet = user.linkedAccounts.find(
    (account) =>
      account.type === "wallet" && account.walletClientType !== "privy",
  );

  const wallet = embeddedWallet ?? externalWallet;
  const emailAccount = user.linkedAccounts.find(
    (account) => account.type === "email",
  );
  const googleAccount = user.linkedAccounts.find(
    (account) => account.type === "google_oauth",
  );

  return {
    privyDid: verifiedClaims.userId,
    walletAddress:
      wallet && "address" in wallet ? (wallet.address as string) : undefined,
    email:
      emailAccount && "address" in emailAccount
        ? (emailAccount.address as string)
        : googleAccount && "email" in googleAccount
          ? (googleAccount.email as string)
          : undefined,
    displayName:
      googleAccount && "name" in googleAccount
        ? (googleAccount.name as string)
        : emailAccount && "address" in emailAccount
          ? (emailAccount.address as string).split("@")[0]
          : undefined,
  };
}
