import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { users, campaigns, socialProfiles, submissions } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { CampaignCard } from "@/components/campaign-card";
import { shortAddress, formatDate } from "@/lib/utils";
import { Link2, Youtube, Instagram, MonitorPlay, BadgeCheck } from "lucide-react";
import Link from "next/link";
import type { Campaign } from "@/lib/types";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) {
    notFound();
  }

  // Fetch brand data
  const brandCampaigns = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.brandId, id))
    .orderBy(desc(campaigns.createdAt));

  // Fetch clipper data
  const profiles = await db
    .select()
    .from(socialProfiles)
    .where(eq(socialProfiles.userId, id));

  const cliSubmissions = await db
    .select({
      submission: submissions,
      campaignTitle: campaigns.title,
      campaignVisual: campaigns.visual,
    })
    .from(submissions)
    .leftJoin(campaigns, eq(submissions.campaignId, campaigns.id))
    .where(eq(submissions.clipperId, id))
    .orderBy(desc(submissions.submittedAt));

  const approvedSubmissions = cliSubmissions.filter(
    (s) => s.submission.status === "CLAIMABLE" || s.submission.status === "PAID"
  );

  return (
    <main className="page-shell py-10 sm:py-14 min-h-[80vh]">
      <div className="border-2 border-ink bg-white shadow-brutal p-8 mb-10 flex flex-col md:flex-row items-start md:items-center gap-6">
        <div className="grid h-24 w-24 place-items-center border-2 border-ink bg-cream text-3xl font-black uppercase">
          {user.avatar ?? user.displayName.slice(0, 2)}
        </div>
        <div>
          <h1 className="font-display text-4xl uppercase">{user.displayName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Badge tone="lime">Joined {formatDate(user.createdAt.toISOString())}</Badge>
            {user.walletAddress && (
              <Badge tone="cream" className="font-mono">
                {shortAddress(user.walletAddress)}
              </Badge>
            )}
            {user.role === "admin" && (
              <Badge tone="blue">Admin</Badge>
            )}
          </div>
          {user.bio && (
            <p className="mt-4 text-sm text-ink/70 max-w-xl leading-6">
              {user.bio}
            </p>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-10">
        <div className="space-y-12">
          {brandCampaigns.length > 0 && (
            <section>
              <h2 className="font-display text-3xl uppercase mb-6 flex items-center gap-2">
                Brand Campaigns <Badge tone="blue">{brandCampaigns.length}</Badge>
              </h2>
              <div className="grid gap-6 sm:grid-cols-2">
                {brandCampaigns.map((campaign) => (
                  <CampaignCard
                    key={campaign.id}
                    campaign={{
                      id: campaign.id,
                      brandId: campaign.brandId,
                      brandName: user.displayName,
                      brandAvatar: user.avatar ?? "",
                      title: campaign.title,
                      summary: campaign.summary,
                      brief: campaign.brief,
                      requirements: campaign.contentRequirements,
                      prohibited: campaign.prohibitedContent,
                      category: campaign.category,
                      platform: campaign.platform as Campaign["platform"],
                      referenceAttachment: campaign.referenceAttachment ?? undefined,
                      rewardPerSubmission: campaign.rewardPerSubmission,
                      maxWinners: campaign.maxWinners,
                      paidWinners: campaign.paidWinners,
                      submissionCount: 0, // Simplified for profile view
                      campaignCode: campaign.campaignCode ?? "",
                      deadline: campaign.deadline.toISOString(),
                      status: campaign.status as Campaign["status"],
                      visual: campaign.visual as Campaign["visual"],
                      createdAt: campaign.createdAt.toISOString(),
                      fundingTxHash: campaign.fundingTxHash ?? undefined,
                      onchainCampaignId: campaign.onchainCampaignId ?? undefined,
                    } satisfies Campaign}
                  />
                ))}
              </div>
            </section>
          )}

          {cliSubmissions.length > 0 && (
            <section>
              <h2 className="font-display text-3xl uppercase mb-6 flex items-center gap-2">
                Clipper Portfolio <Badge tone="lime">{approvedSubmissions.length} Approved</Badge>
              </h2>
              <div className="grid gap-4">
                {cliSubmissions.map((s) => (
                  <div key={s.submission.id} className="border-2 border-ink bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase text-blue mb-1">
                        {s.submission.platform}
                      </p>
                      <Link href={`/campaigns/${s.submission.campaignId}`} className="font-bold hover:underline">
                        {s.campaignTitle}
                      </Link>
                      <p className="text-xs text-ink/60 mt-1">
                        Submitted on {formatDate(s.submission.submittedAt.toISOString())}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {s.submission.status === "CLAIMABLE" || s.submission.status === "PAID" ? (
                        <Badge tone="lime">Approved</Badge>
                      ) : s.submission.status === "REJECTED" ? (
                        <Badge tone="orange">Rejected</Badge>
                      ) : (
                        <Badge tone="cream">Under Review</Badge>
                      )}
                      <a
                        href={s.submission.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="grid h-8 w-8 place-items-center border-2 border-ink bg-cream hover:bg-lime transition-colors"
                      >
                        <Link2 size={14} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {brandCampaigns.length === 0 && cliSubmissions.length === 0 && (
            <div className="border-2 border-dashed border-ink p-10 text-center text-ink/50 font-bold">
              No public activity found for this user.
            </div>
          )}
        </div>

        <aside>
          {profiles.length > 0 && (
            <div className="border-2 border-ink bg-cream shadow-brutal p-6">
              <h3 className="font-display text-xl uppercase mb-5">Social Links</h3>
              <ul className="space-y-4">
                {profiles.map((profile) => (
                  <li key={profile.id}>
                    <a
                      href={profile.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 place-items-center border-2 border-ink bg-white group-hover:bg-lime transition-colors">
                          {profile.provider === "youtube" && <Youtube size={14} />}
                          {profile.provider === "tiktok" && <MonitorPlay size={14} />}
                          {profile.provider === "instagram" && <Instagram size={14} />}
                        </span>
                        <span className="font-bold text-sm group-hover:underline">
                          @{profile.username}
                        </span>
                      </div>
                      {profile.verificationStatus === "verified" && (
                        <BadgeCheck size={16} className="text-blue" />
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
