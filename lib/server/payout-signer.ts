import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const PAYOUT_SIGNER_KEY = process.env.PAYOUT_SIGNER_PRIVATE_KEY;

// EIP-712 domain for CampaignEscrow
const DOMAIN = {
  name: "CampaignEscrow",
  version: "1",
  chainId: 84532, // Base Sepolia
  verifyingContract: (process.env.NEXT_PUBLIC_CAMPAIGN_ESCROW_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
} as const;

// EIP-712 type definition for payout
const PAYOUT_TYPES = {
  PayoutAuthorization: [
    { name: "campaignId", type: "uint256" },
    { name: "submissionId", type: "bytes32" },
    { name: "clipperWallet", type: "address" },
    { name: "rewardAmount", type: "uint256" },
    { name: "platformFee", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint256" },
  ],
} as const;

interface PayoutParams {
  campaignId: number;
  submissionId: string;
  clipperWallet: `0x${string}`;
  rewardAmount: bigint;
  platformFee: bigint;
  nonce: number;
}

interface PayoutSignatureResult {
  signature: string;
  nonce: number;
  expiry: number;
  campaignId: number;
  submissionId: string;
  clipperWallet: string;
  rewardAmount: string;
  platformFee: string;
}

/**
 * Generate an EIP-712 typed data signature for a payout authorization.
 * Uses the platform's payout signer key (not the user's wallet).
 */
export async function generatePayoutSignature(
  params: PayoutParams,
): Promise<PayoutSignatureResult> {
  if (!PAYOUT_SIGNER_KEY) {
    // In development without a key, return a mock signature
    const expiry = Math.floor(Date.now() / 1000) + 86400; // 24 hours

    return {
      signature: `0x${"00".repeat(65)}`, // Mock signature
      nonce: params.nonce,
      expiry,
      campaignId: params.campaignId,
      submissionId: params.submissionId,
      clipperWallet: params.clipperWallet,
      rewardAmount: params.rewardAmount.toString(),
      platformFee: params.platformFee.toString(),
    };
  }

  const account = privateKeyToAccount(
    PAYOUT_SIGNER_KEY as `0x${string}`,
  );

  const expiry = Math.floor(Date.now() / 1000) + 86400; // 24 hours

  // Convert submission UUID to bytes32
  const submissionIdBytes32 = `0x${params.submissionId.replace(/-/g, "").padEnd(64, "0")}` as `0x${string}`;

  const signature = await account.signTypedData({
    domain: DOMAIN,
    types: PAYOUT_TYPES,
    primaryType: "PayoutAuthorization",
    message: {
      campaignId: BigInt(params.campaignId),
      submissionId: submissionIdBytes32,
      clipperWallet: params.clipperWallet,
      rewardAmount: params.rewardAmount,
      platformFee: params.platformFee,
      nonce: BigInt(params.nonce),
      expiry: BigInt(expiry),
    },
  });

  return {
    signature,
    nonce: params.nonce,
    expiry,
    campaignId: params.campaignId,
    submissionId: params.submissionId,
    clipperWallet: params.clipperWallet,
    rewardAmount: params.rewardAmount.toString(),
    platformFee: params.platformFee.toString(),
  };
}

/**
 * Get the payout signer's address (for contract configuration).
 */
export function getPayoutSignerAddress(): string {
  if (!PAYOUT_SIGNER_KEY) {
    return "0x0000000000000000000000000000000000000000";
  }
  const account = privateKeyToAccount(
    PAYOUT_SIGNER_KEY as `0x${string}`,
  );
  return account.address;
}
