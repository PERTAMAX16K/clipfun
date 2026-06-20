import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { transactions, users, campaigns } from "@/db/schema";
import { requireAuth } from "@/lib/server/auth";

/**
 * POST /api/transactions/sync
 *
 * Manual transaction resync. For MVP, this endpoint just returns
 * the current transaction list from the database.
 * In Tahap 6, this will also query the blockchain for missing events.
 */
export async function POST(request: NextRequest) {
  let currentUser;
  try {
    currentUser = await requireAuth(request);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all transactions for the current user
  const txs = await db
    .select({
      transaction: transactions,
      campaignTitle: campaigns.title,
    })
    .from(transactions)
    .leftJoin(campaigns, eq(transactions.campaignId, campaigns.id))
    .where(eq(transactions.userId, currentUser.id))
    .orderBy(desc(transactions.createdAt))
    .limit(50);

  // TODO: In Tahap 6, query blockchain events and reconcile with DB

  return NextResponse.json(
    txs.map((row) => ({
      ...row.transaction,
      campaignTitle: row.campaignTitle ?? "Unknown Campaign",
    })),
  );
}
