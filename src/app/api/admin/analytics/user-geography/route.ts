import { NextResponse } from "next/server";
import { getViewer, viewerCan } from "@/lib/auth/access";
import { getUserGeography } from "@/lib/analytics/geography.server";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }
  if (!viewerCan(viewer, "analytics.view")) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  try {
    const geography = await getUserGeography();
    return NextResponse.json(geography, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=540" },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Geography unavailable." }, { status: 503 });
  }
}
