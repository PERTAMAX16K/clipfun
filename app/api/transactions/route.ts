import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, campaigns } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { PrivyClient } from "@privy-io/server-auth";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    await privy.verifyAuthToken(token);

    // Get all transactions for demo activity feed
    // In a real app we might paginate or filter by user, but activity page shows everything
    const results = await db
      .select({
        id: transactions.id,
        type: transactions.type,
        campaignId: transactions.campaignId,
        campaignTitle: campaigns.title,
        amount: transactions.amount,
        status: transactions.status,
        hash: transactions.txHash,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .leftJoin(campaigns, eq(transactions.campaignId, campaigns.id))
      .orderBy(desc(transactions.createdAt))
      .limit(50);

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("Failed to fetch transactions:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
