// GET /api/rankings?period=daily|weekly|monthly&limit=20
import { NextResponse } from "next/server";
import { getRankings } from "@/lib/ranker";
import type { RankingPeriod } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = (searchParams.get("period") ?? "daily") as RankingPeriod;
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  if (!["daily", "weekly", "monthly"].includes(period)) {
    return NextResponse.json({ error: "invalid period" }, { status: 400 });
  }

  const data = await getRankings(period, Math.min(100, limit));
  return NextResponse.json({ period, count: data.length, items: data });
}
