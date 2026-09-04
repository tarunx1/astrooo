import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/observability/logger";
import { getRateLimitStore } from "@/lib/security/rate-limit-store";

/**
 * Readiness.
 *
 * Answers whether this instance can actually serve traffic right now, by
 * checking the dependencies a request cannot proceed without.
 *
 * Deliberately excluded: Razorpay, VedAstro and the AI provider. They are
 * rate-limited third parties, and polling them on every readiness probe would
 * consume quota, add their latency to ours, and let someone else's outage pull
 * this app out of the load balancer even though most of it still works.
 *
 * The response names which check failed but never why in detail: no hostname,
 * no connection string, no driver error. That is enough for an operator to know
 * where to look, and useless to anyone else.
 */
export const dynamic = "force-dynamic";

type CheckName = "database" | "rateLimitStore";

async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error("readiness_check_failed", { check: "database", error });
    return false;
  }
}

async function checkRateLimitStore(): Promise<boolean> {
  try {
    // Resolution alone proves configuration is valid; in production this throws
    // when no distributed store is configured, which is the condition worth
    // catching before traffic arrives.
    const store = getRateLimitStore();
    await store.increment("rl:readiness:probe", 60_000);
    return true;
  } catch (error) {
    logger.error("readiness_check_failed", { check: "rateLimitStore", error });
    return false;
  }
}

export async function GET() {
  const [database, rateLimitStore] = await Promise.all([checkDatabase(), checkRateLimitStore()]);

  const checks: Record<CheckName, boolean> = { database, rateLimitStore };
  const failed = (Object.keys(checks) as CheckName[]).filter((name) => !checks[name]);

  if (failed.length > 0) {
    return NextResponse.json(
      { status: "unavailable", failed },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
