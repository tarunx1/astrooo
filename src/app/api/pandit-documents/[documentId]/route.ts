import { NextResponse } from "next/server";
import { getViewer, viewerCan } from "@/lib/auth/access";
import { accessDocument } from "@/lib/pandit/documents";
import { LocalStorageProvider, getStorageProvider, isLocalStorage } from "@/lib/storage/config";

/**
 * Verification document access.
 *
 * Never serves a bucket URL and never exposes a storage key. The caller must be
 * signed in and must either own the document or hold `pandits.review`; the
 * decision is made in `accessDocument` against the row, and an unauthorized
 * caller gets 404 rather than 403 so ids cannot be probed for existence.
 *
 * In object-storage mode the response is a redirect to a URL that expires in
 * minutes. In local development the bytes are streamed by this route, because
 * there is no signed-URL concept on a filesystem and inventing a public path
 * would be exactly the mistake this route exists to avoid.
 */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  const { documentId } = await params;

  const access = await accessDocument({
    documentId,
    viewerUserId: viewer.id,
    isReviewer: viewerCan(viewer, "pandits.review"),
  });

  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  if (access.kind === "signed-url") {
    return NextResponse.redirect(access.url, {
      status: 302,
      headers: { "Cache-Control": "no-store, private" },
    });
  }

  const storage = getStorageProvider();
  if (!isLocalStorage(storage)) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const bytes = await (storage as LocalStorageProvider).read(access.storageKey);

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": access.mimeType,
      // `inline` so a reviewer can read a document without downloading it, but
      // the filename is still declared for when they choose to save it.
      "Content-Disposition": `inline; filename="${access.fileName}"`,
      "Cache-Control": "no-store, private",
      // A document is never framed by another origin.
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    },
  });
}
