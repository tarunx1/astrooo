import { NextResponse } from "next/server";

/**
 * Liveness.
 *
 * Answers one question: is this process running and able to serve? It performs
 * no dependency work, so a database or Redis outage does not cause an
 * orchestrator to kill and restart otherwise-healthy instances -- restarting a
 * process never fixes a dependency, and doing so during an incident removes
 * capacity exactly when it is needed.
 *
 * The body is deliberately a constant. Version numbers, hostnames, environment
 * names and dependency detail all belong in readiness or in the logs, not on an
 * endpoint that is typically reachable without authentication.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
