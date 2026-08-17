// GET /api/rankings?period=daily|weekly|monthly&limit=20
import { NextResponse } from "next/server";
import { getRankings } from "@/lib/ranker";
import type { RankingPeriod } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = (searchParams.get("period") ?? "daily") as RankingPeriod;
  const requestedLimit = Number.parseInt(searchParams.get("limit") ?? "20", 10);

  if (!["daily", "weekly", "monthly"].includes(period)) {
    return NextResponse.json({ error: "invalid period" }, { status: 400 });
  }

  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(100, requestedLimit)) : 20;
  const data = await getRankings(period, limit);
  return NextResponse.json({
    period,
    count: data.items.length,
    snapshotDate: data.snapshotDate,
    ageDays: data.ageDays,
    isStale: data.isStale,
    items: data.items,
  }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}
