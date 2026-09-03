import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { rankingDateKey } from "@/lib/ranker";
import { trafficDaily } from "@/lib/schema";
import { SITE_ORIGINS } from "@/lib/site";
import {
  classifyTrafficSource,
  isAutomatedUserAgent,
  isTrustedTrafficFetchSite,
  isTrustedTrafficOrigin,
  normalizeTrafficPath,
  TRAFFIC_EVENTS,
} from "@/lib/traffic";

export const dynamic = "force-dynamic";

const eventSchema = z.object({
  event: z.enum(TRAFFIC_EVENTS),
  path: z.string().min(1).max(160),
  source: z.enum(["direct", "internal", "organic", "github", "community", "referral"]).optional(),
});

interface RateBucket { count: number; resetAt: number }
const MAX_BUCKETS = 10_000;
const MAX_EVENTS_PER_HOUR = 120;
const globalForTraffic = globalThis as unknown as {
  trafficRateLimits?: Map<string, RateBucket>;
  trafficRateLimitLastSweep?: number;
};
const rateLimits = globalForTraffic.trafficRateLimits ?? new Map<string, RateBucket>();
globalForTraffic.trafficRateLimits = rateLimits;

function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = request.headers.get("x-real-ip") || forwarded || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  return createHash("sha256").update(`${ip}:${userAgent}`).digest("hex").slice(0, 24);
}

function rateLimitAllows(key: string): boolean {
  const now = Date.now();
  if (now - (globalForTraffic.trafficRateLimitLastSweep ?? 0) >= 60_000) {
    for (const [bucketKey, bucket] of rateLimits) if (bucket.resetAt <= now) rateLimits.delete(bucketKey);
    globalForTraffic.trafficRateLimitLastSweep = now;
  }
  if (rateLimits.size >= MAX_BUCKETS && !rateLimits.has(key)) return false;
  const bucket = rateLimits.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + 60 * 60_000 });
    return true;
  }
  if (bucket.count >= MAX_EVENTS_PER_HOUR) return false;
  bucket.count += 1;
  return true;
}

export async function POST(request: Request) {
  const userAgent = request.headers.get("user-agent");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (
    !isTrustedTrafficOrigin(request.headers.get("origin"), request.url, SITE_ORIGINS)
    || !isTrustedTrafficFetchSite(fetchSite)
    || isAutomatedUserAgent(userAgent)
  ) {
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }
  if (Number(request.headers.get("content-length") ?? 0) > 1024 || !rateLimitAllows(getClientKey(request))) {
    return new NextResponse(null, { status: 429, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const parsed = eventSchema.safeParse(await request.json());
    const path = parsed.success ? normalizeTrafficPath(parsed.data.path) : null;
    if (!parsed.success || !path) return new NextResponse(null, { status: 400 });

    // Browser fetch Referer points at the current page rather than the document's
    // acquisition referrer. The client sends only the already-coarsened category;
    // older clients fall back to the request header classification.
    const source = parsed.data.source
      ?? classifyTrafficSource(request.headers.get("referer"), new URL(request.url).hostname);
    const pageViewIncrement = parsed.data.event === "page_view" ? 1 : 0;
    const ctaIncrement = parsed.data.event === "evaluation_cta_click" ? 1 : 0;
    const guideContinuationIncrement = parsed.data.event === "guide_continuation_click" ? 1 : 0;
    await db.insert(trafficDaily).values({
      date: rankingDateKey(),
      path,
      source,
      pageViews: pageViewIncrement,
      evaluationCtaClicks: ctaIncrement,
      guideContinuationClicks: guideContinuationIncrement,
    }).onConflictDoUpdate({
      target: [trafficDaily.date, trafficDaily.path, trafficDaily.source],
      set: {
        pageViews: sql`${trafficDaily.pageViews} + ${pageViewIncrement}`,
        evaluationCtaClicks: sql`${trafficDaily.evaluationCtaClicks} + ${ctaIncrement}`,
        guideContinuationClicks: sql`${trafficDaily.guideContinuationClicks} + ${guideContinuationIncrement}`,
        updatedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[traffic] aggregate write failed", error);
    return new NextResponse(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
