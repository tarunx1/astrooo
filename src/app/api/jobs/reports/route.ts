import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { processGenerationQueue } from "@/lib/reports/generation";
import { processRenderQueue } from "@/lib/reports/delivery";

/**
 * Report generation worker.
 *
 * Long model calls must never run inside a customer request, so generation is
 * drained here instead. This endpoint is the seam a real queue (BullMQ,
 * Inngest, Trigger.dev, Cloud Tasks) would replace: the pipeline itself does not
 * care what invokes it.
 *
 * Protected by a shared secret. Without JOBS_SECRET configured the endpoint is
 * disabled rather than open.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const expected = process.env.JOBS_SECRET;
  if (!expected || expected.length < 16) return false;

  const provided = request.headers.get("x-jobs-secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    // Interpretation first, then rendering: a job interpreted in this pass can
    // be rendered in the same invocation.
    const interpreted = await processGenerationQueue(5);
    const rendered = await processRenderQueue(5);

    return NextResponse.json({ ok: true, interpreted: interpreted.processed, rendered: rendered.rendered });
  } catch (error) {
    console.error("report_worker_failed", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
