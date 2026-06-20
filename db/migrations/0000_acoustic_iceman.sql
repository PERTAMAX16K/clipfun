CREATE TYPE "public"."campaign_status" AS ENUM('DRAFT', 'AWAITING_FUNDING', 'OPEN', 'COMPLETED', 'EXPIRED', 'REFUNDED', 'CANCELLED', 'PAUSED');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('ISSUED', 'CLAIMED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."social_provider" AS ENUM('youtube', 'tiktok', 'instagram');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CLAIMABLE', 'PAID');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('PENDING', 'CONFIRMED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('FUND', 'CLAIM', 'REFUND');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('clipper', 'brand', 'admin');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('unverified', 'pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"onchain_campaign_id" integer,
	"brand_id" uuid NOT NULL,
	"title" varchar(50) NOT NULL,
	"summary" text NOT NULL,
	"brief" text NOT NULL,
	"content_requirements" text[] DEFAULT '{}' NOT NULL,
	"prohibited_content" text[] DEFAULT '{}' NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"platform" text DEFAULT 'all' NOT NULL,
	"campaign_code" varchar(10),
	"reference_attachment" text,
	"metadata_hash" varchar(66),
	"reward_per_submission" bigint NOT NULL,
	"max_winners" integer NOT NULL,
	"paid_winners" integer DEFAULT 0 NOT NULL,
	"platform_fee" bigint DEFAULT 0 NOT NULL,
	"total_deposit" bigint DEFAULT 0 NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"status" "campaign_status" DEFAULT 'DRAFT' NOT NULL,
	"funding_tx_hash" varchar(66),
	"contract_address" varchar(42),
	"visual" text DEFAULT 'blue' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_campaign_code_unique" UNIQUE("campaign_code")
);
--> statement-breakpoint
CREATE TABLE "payout_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"reward_amount" bigint NOT NULL,
	"fee_amount" bigint NOT NULL,
	"nonce" bigint NOT NULL,
	"expiry" timestamp with time zone NOT NULL,
	"signature" text NOT NULL,
	"claim_tx_hash" varchar(66),
	"status" "payout_status" DEFAULT 'ISSUED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payout_authorizations_submission_id_unique" UNIQUE("submission_id")
);
--> statement-breakpoint
CREATE TABLE "social_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "social_provider" NOT NULL,
	"username" text NOT NULL,
	"profile_url" text NOT NULL,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"clipper_id" uuid NOT NULL,
	"post_url" text NOT NULL,
	"platform" "social_provider" NOT NULL,
	"platform_content_id" text,
	"campaign_code" varchar(10),
	"status" "submission_status" DEFAULT 'SUBMITTED' NOT NULL,
	"rejection_reason" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tx_hash" varchar(66),
	"type" "transaction_type" NOT NULL,
	"campaign_id" uuid,
	"user_id" uuid,
	"amount" bigint NOT NULL,
	"status" "transaction_status" DEFAULT 'PENDING' NOT NULL,
	"block_number" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_tx_hash_unique" UNIQUE("tx_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"privy_did" text NOT NULL,
	"wallet_address" varchar(42),
	"display_name" text DEFAULT 'Clipfun User' NOT NULL,
	"avatar_url" text,
	"role" "user_role",
	"bio" text,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_privy_did_unique" UNIQUE("privy_did")
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_brand_id_users_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_authorizations" ADD CONSTRAINT "payout_authorizations_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_profiles" ADD CONSTRAINT "social_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_profiles" ADD CONSTRAINT "social_profiles_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_clipper_id_users_id_fk" FOREIGN KEY ("clipper_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_campaign_brand" ON "campaigns" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_status" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_campaign_code" ON "campaigns" USING btree ("campaign_code");--> statement-breakpoint
CREATE INDEX "idx_payout_submission" ON "payout_authorizations" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "idx_payout_wallet" ON "payout_authorizations" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "idx_social_user" ON "social_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_social_provider" ON "social_profiles" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "idx_sub_campaign" ON "submissions" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_sub_clipper" ON "submissions" USING btree ("clipper_id");--> statement-breakpoint
CREATE INDEX "idx_sub_status" ON "submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sub_post_url" ON "submissions" USING btree ("post_url");--> statement-breakpoint
CREATE INDEX "idx_tx_campaign" ON "transactions" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_tx_user" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tx_hash" ON "transactions" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "idx_users_privy_did" ON "users" USING btree ("privy_did");--> statement-breakpoint
CREATE INDEX "idx_users_wallet" ON "users" USING btree ("wallet_address");