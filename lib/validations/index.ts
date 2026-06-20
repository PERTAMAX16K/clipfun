import { z } from "zod";

export const syncAuthSchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address")
    .optional(),
  displayName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
});

export const createCampaignSchema = z.object({
  title: z.string().min(1).max(50),
  summary: z.string().min(1).max(500),
  brief: z.string().min(1),
  contentRequirements: z.array(z.string()).default([]),
  prohibitedContent: z.array(z.string()).default([]),
  category: z.string().default("general"),
  platform: z.enum(["youtube", "tiktok", "instagram", "all"]).default("all"),
  referenceAttachment: z.union([z.string().url(), z.literal("")]).optional(),
  rewardPerSubmission: z.number().positive(),
  maxWinners: z.number().int().positive(),
  deadline: z.string().datetime(),
});

export const updateCampaignSchema = createCampaignSchema.partial();

export const fundingConfirmationSchema = z.object({
  txHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash"),
  onchainCampaignId: z.number().int().nonnegative(),
});

export const createSubmissionSchema = z.object({
  platform: z.enum(["youtube", "tiktok", "instagram"]),
  postUrl: z.string().url(),
  campaignCode: z.string().optional(),
});

export const reviewSubmissionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().min(5).optional(),
});

export const addSocialProfileSchema = z.object({
  provider: z.enum(["youtube", "tiktok", "instagram"]),
  username: z.string().min(1).max(100),
  profileUrl: z.string().url(),
});
