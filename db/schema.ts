import {
  pgTable,
  text,
  timestamp,
  integer,
  bigint,
  boolean,
  pgEnum,
  uuid,
  varchar,
  index,
  doublePrecision,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/*  Enums                                                              */
/* ------------------------------------------------------------------ */

export const userRoleEnum = pgEnum("user_role", ["clipper", "brand", "admin"]);

export const socialProviderEnum = pgEnum("social_provider", [
  "youtube",
  "tiktok",
  "instagram",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "unverified",
  "pending",
  "verified",
  "rejected",
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "DRAFT",
  "AWAITING_FUNDING",
  "OPEN",
  "COMPLETED",
  "EXPIRED",
  "REFUNDED",
  "CANCELLED",
  "PAUSED",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "CLAIMABLE",
  "PAID",
]);

export const transactionStatusEnum = pgEnum("transaction_status", [
  "PENDING",
  "CONFIRMED",
  "FAILED",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "FUND",
  "CLAIM",
  "REFUND",
]);

export const payoutStatusEnum = pgEnum("payout_status", [
  "ISSUED",
  "CLAIMED",
  "EXPIRED",
]);

/* ------------------------------------------------------------------ */
/*  Tables                                                             */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    privyDid: text("privy_did").unique().notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }),
    displayName: text("display_name").notNull().default("Clipfun User"),
    avatar: text("avatar_url"),
    role: userRoleEnum("role"),
    bio: text("bio"),
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_users_privy_did").on(table.privyDid),
    index("idx_users_wallet").on(table.walletAddress),
  ],
);

export const socialProfiles = pgTable(
  "social_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: socialProviderEnum("provider").notNull(),
    username: text("username").notNull(),
    profileUrl: text("profile_url").notNull(),
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("unverified"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedBy: uuid("verified_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_social_user").on(table.userId),
    index("idx_social_provider").on(table.userId, table.provider),
  ],
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    onchainCampaignId: integer("onchain_campaign_id"),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => users.id),
    title: varchar("title", { length: 50 }).notNull(),
    summary: text("summary").notNull(),
    brief: text("brief").notNull(),
    contentRequirements: text("content_requirements")
      .array()
      .notNull()
      .default([]),
    prohibitedContent: text("prohibited_content").array().notNull().default([]),
    category: text("category").notNull().default("general"),
    platform: text("platform").notNull().default("all"),
    campaignCode: varchar("campaign_code", { length: 10 }).unique(),
    referenceAttachment: text("reference_attachment"),
    metadataHash: varchar("metadata_hash", { length: 66 }),
    rewardPerSubmission: doublePrecision("reward_per_submission").notNull(),
    maxWinners: integer("max_winners").notNull(),
    paidWinners: integer("paid_winners").notNull().default(0),
    platformFee: doublePrecision("platform_fee")
      .notNull()
      .default(0),
    totalDeposit: doublePrecision("total_deposit")
      .notNull()
      .default(0),
    deadline: timestamp("deadline", { withTimezone: true }).notNull(),
    status: campaignStatusEnum("status").notNull().default("DRAFT"),
    fundingTxHash: varchar("funding_tx_hash", { length: 66 }),
    contractAddress: varchar("contract_address", { length: 42 }),
    visual: text("visual").notNull().default("blue"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_campaign_brand").on(table.brandId),
    index("idx_campaign_status").on(table.status),
    index("idx_campaign_code").on(table.campaignCode),
  ],
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    clipperId: uuid("clipper_id")
      .notNull()
      .references(() => users.id),
    postUrl: text("post_url").notNull(),
    platform: socialProviderEnum("platform").notNull(),
    platformContentId: text("platform_content_id"),
    campaignCode: varchar("campaign_code", { length: 10 }),
    status: submissionStatusEnum("status").notNull().default("SUBMITTED"),
    rejectionReason: text("rejection_reason"),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
  },
  (table) => [
    index("idx_sub_campaign").on(table.campaignId),
    index("idx_sub_clipper").on(table.clipperId),
    index("idx_sub_status").on(table.status),
    index("idx_sub_post_url").on(table.postUrl),
  ],
);

export const payoutAuthorizations = pgTable(
  "payout_authorizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .unique()
      .references(() => submissions.id),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    rewardAmount: doublePrecision("reward_amount").notNull(),
    feeAmount: doublePrecision("fee_amount").notNull(),
    nonce: bigint("nonce", { mode: "number" }).notNull(),
    expiry: timestamp("expiry", { withTimezone: true }).notNull(),
    signature: text("signature").notNull(),
    claimTxHash: varchar("claim_tx_hash", { length: 66 }),
    status: payoutStatusEnum("status").notNull().default("ISSUED"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_payout_submission").on(table.submissionId),
    index("idx_payout_wallet").on(table.walletAddress),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    txHash: varchar("tx_hash", { length: 66 }).unique(),
    type: transactionTypeEnum("type").notNull(),
    campaignId: uuid("campaign_id").references(() => campaigns.id),
    userId: uuid("user_id").references(() => users.id),
    amount: doublePrecision("amount").notNull(),
    status: transactionStatusEnum("status").notNull().default("PENDING"),
    blockNumber: bigint("block_number", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_tx_campaign").on(table.campaignId),
    index("idx_tx_user").on(table.userId),
    index("idx_tx_hash").on(table.txHash),
  ],
);
