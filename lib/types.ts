export type UserRole = "user" | "admin";
export type SocialProvider = "youtube" | "tiktok" | "instagram";
export type CampaignStatus =
  | "DRAFT"
  | "AWAITING_FUNDING"
  | "OPEN"
  | "COMPLETED"
  | "REFUNDED";
export type SubmissionStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "REJECTED"
  | "CLAIMABLE"
  | "PAID";
export type TransactionStatus = "PENDING" | "CONFIRMED" | "FAILED";
export type TransactionType = "FUND" | "CLAIM" | "REFUND";

export interface User {
  id: string;
  displayName: string;
  handle: string;
  avatar: string;
  walletAddress: string;
  role: UserRole;
  bio: string;
}

export interface SocialProfile {
  id: string;
  userId: string;
  provider: SocialProvider;
  username: string;
  profileUrl: string;
  verified: boolean;
}

export interface Campaign {
  id: string;
  brandId: string;
  brandName: string;
  brandAvatar: string;
  title: string;
  summary: string;
  brief: string;
  requirements: string[];
  prohibited: string[];
  category: string;
  platform: SocialProvider | "all";
  rewardPerSubmission: number;
  maxWinners: number;
  paidWinners: number;
  submissionCount: number;
  deadline: string;
  status: CampaignStatus;
  campaignCode: string;
  visual: "blue" | "orange" | "lime" | "purple";
  createdAt: string;
  fundingTxHash?: string;
}

export interface Submission {
  id: string;
  campaignId: string;
  campaignTitle: string;
  clipperId: string;
  clipperName: string;
  clipperAvatar: string;
  platform: SocialProvider;
  postUrl: string;
  status: SubmissionStatus;
  submittedAt: string;
  rejectionReason?: string;
  payoutId?: string;
}

export interface PayoutAuthorization {
  id: string;
  submissionId: string;
  walletAddress: string;
  rewardAmount: number;
  feeAmount: number;
  nonce: number;
  expiry: string;
  signature: string;
  status: "ISSUED" | "CLAIMED";
}

export interface Transaction {
  id: string;
  type: TransactionType;
  campaignId: string;
  campaignTitle: string;
  amount: number;
  status: TransactionStatus;
  hash: string;
  createdAt: string;
}

export interface DemoState {
  activeUserId: string | null;
  users: User[];
  socialProfiles: SocialProfile[];
  campaigns: Campaign[];
  submissions: Submission[];
  payouts: PayoutAuthorization[];
  transactions: Transaction[];
}

export interface CampaignDraft {
  title: string;
  summary: string;
  brief: string;
  requirements: string[];
  prohibited: string[];
  category: string;
  platform: Campaign["platform"];
  rewardPerSubmission: number;
  maxWinners: number;
  deadline: string;
}

export interface AuthService {
  signOut(): Promise<void>;
  linkWallet(): void;
  addSocialProfile(
    provider: SocialProvider,
    username: string,
    profileUrl: string,
  ): Promise<SocialProfile>;
}

export interface CampaignService {
  createCampaign(draft: CampaignDraft): Promise<Campaign>;
  fundCampaign(
    campaignId: string,
    simulateFailure?: boolean,
  ): Promise<Transaction>;
  refundCampaign(campaignId: string): Promise<Transaction>;
}

export interface SubmissionService {
  createSubmission(
    campaignId: string,
    platform: SocialProvider,
    postUrl: string,
  ): Promise<Submission>;
  reviewSubmission(
    submissionId: string,
    decision: "approve" | "reject",
    reason?: string,
  ): Promise<Submission>;
  claimReward(submissionId: string): Promise<Transaction>;
}

export interface TransactionService {
  retryTransaction(transactionId: string): Promise<Transaction>;
}
