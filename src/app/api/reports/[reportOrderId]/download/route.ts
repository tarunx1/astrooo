import { NextResponse } from "next/server";
import { createReportDownload } from "@/lib/reports/delivery";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Secure report download.
 *
 * Never serves a bucket URL. The caller must be signed in and must own the
 * order; ownership is enforced inside the query, so another user's id resolves
 * to "not found" rather than a permission error that confirms it exists.
 */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ reportOrderId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  const { reportOrderId } = await params;
  const grant = await createReportDownload(user.id, reportOrderId);

  if (!grant.ok) {
    const status = grant.reason === "not_ready" ? 409 : 404;
    return NextResponse.json({ ok: false, error: grant.reason }, { status });
  }

  if (grant.mode === "signed") {
    // Short-lived redirect to the signed object URL.
    return NextResponse.redirect(grant.url, {
      status: 302,
      headers: { "Cache-Control": "no-store, private" },
    });
  }

  return new NextResponse(Buffer.from(grant.bytes), {
    status: 200,
    headers: {
      "Content-Type": grant.mimeType,
      "Content-Disposition": `attachment; filename="${grant.fileName}"`,
      "Cache-Control": "no-store, private",
    },
  });
}
