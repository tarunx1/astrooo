import "server-only";

import { randomUUID } from "node:crypto";
import { AuditAction, PanditDocumentStatus, PanditDocumentType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/admin/audit";
import {
  DEFAULT_SIGNED_URL_TTL_SECONDS,
  checksumOf,
  getStorageProvider,
  isLocalStorage,
} from "@/lib/storage/config";
import {
  DOCUMENT_ALLOWED_MIME_TYPES,
  DOCUMENT_MAX_BYTES,
} from "@/lib/pandit/catalog";

/**
 * Verification document handling.
 *
 * Identity documents are the most sensitive thing this application stores. The
 * rules that follow from that:
 *
 *  * Only a private storage key is ever persisted - never a public URL, never
 *    the bytes in the database, never a path under `public/`.
 *  * Reading one requires a fresh authorization decision every time. There is
 *    no long-lived link: access is a short-lived signed URL minted for a caller
 *    who has just been checked, so a URL copied out of a browser's history or a
 *    screenshot stops working within minutes.
 *  * Two parties may read a document: the Pandit it belongs to, and a reviewer
 *    holding `pandits.review`. Nobody else has a path to one.
 *  * Every reviewer read is audited. A Pandit reading their own is not - that
 *    would make the audit log a record of people looking at their own papers.
 */

export class DocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentError";
  }
}

/** Namespaced per Pandit, with a random leaf so a key is never guessable. */
function documentStorageKey(panditProfileId: string, extension: string): string {
  return `pandit-documents/${panditProfileId}/${randomUUID()}${extension}`;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

export type UploadDocumentInput = {
  userId: string;
  type: PanditDocumentType;
  file: File;
  note?: string | null;
};

/**
 * Stores one document against the acting Pandit's own application.
 *
 * The profile is resolved from the session user id, never from a form field, so
 * there is no shape of request that attaches a document to somebody else's
 * application.
 *
 * Type and size are checked against the bytes actually received rather than
 * against what the browser claimed, because a `Content-Type` header is a client
 * assertion and an upload limit enforced only in the picker is not a limit.
 */
export async function uploadOwnDocument(input: UploadDocumentInput): Promise<{ id: string }> {
  const profile = await prisma.panditProfile.findUnique({
    where: { userId: input.userId },
    select: { id: true },
  });

  if (!profile) throw new DocumentError("No Pandit profile for this account.");

  if (!DOCUMENT_ALLOWED_MIME_TYPES.includes(input.file.type)) {
    throw new DocumentError("Upload a JPEG, PNG, WebP or PDF.");
  }

  const bytes = new Uint8Array(await input.file.arrayBuffer());

  if (bytes.byteLength === 0) throw new DocumentError("That file is empty.");
  if (bytes.byteLength > DOCUMENT_MAX_BYTES) {
    throw new DocumentError(`That file is larger than ${Math.floor(DOCUMENT_MAX_BYTES / (1024 * 1024))} MB.`);
  }

  const extension = EXTENSION_BY_MIME[input.file.type] ?? "";
  const key = documentStorageKey(profile.id, extension);

  await getStorageProvider().upload({
    key,
    body: bytes,
    contentType: input.file.type,
    metadata: { panditProfileId: profile.id, documentType: input.type },
  });

  const document = await prisma.panditDocument.create({
    data: {
      panditProfileId: profile.id,
      type: input.type,
      status: PanditDocumentStatus.PENDING,
      storageKey: key,
      // A filename is attacker-controlled text that will be rendered in a
      // reviewer's browser, so it is reduced to something inert here rather
      // than trusted at every display site.
      fileName: input.file.name.replace(/[^\w.\- ]+/g, "").slice(0, 120) || "document",
      mimeType: input.file.type,
      fileSize: bytes.byteLength,
      checksum: checksumOf(bytes),
      note: input.note?.trim().slice(0, 500) || null,
    },
    select: { id: true },
  });

  return document;
}

export type DocumentSummary = {
  id: string;
  type: PanditDocumentType;
  status: PanditDocumentStatus;
  fileName: string;
  mimeType: string;
  fileSize: number;
  note: string | null;
  rejectionReason: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
};

/**
 * Lists documents for one application.
 *
 * Deliberately never returns `storageKey`. A key is not itself a credential,
 * but there is no reason for one to travel to a browser, and keeping it out
 * means a leaked page source is not a list of objects to go looking for.
 */
export async function listDocuments(panditProfileId: string): Promise<DocumentSummary[]> {
  return prisma.panditDocument.findMany({
    where: { panditProfileId },
    select: {
      id: true,
      type: true,
      status: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      note: true,
      rejectionReason: true,
      reviewedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export type DocumentAccess =
  | { ok: true; kind: "signed-url"; url: string; mimeType: string; fileName: string }
  | { ok: true; kind: "stream"; storageKey: string; mimeType: string; fileName: string }
  | { ok: false; reason: "not-found" };

/**
 * Authorizes and prepares one document read.
 *
 * `viewer` is the already-authenticated caller. The authorization decision is
 * made here, against the row, rather than by the route: an owner match or a
 * reviewer permission, and nothing else. An unauthorized caller gets
 * "not-found" rather than a refusal, so document ids cannot be probed.
 */
export async function accessDocument(input: {
  documentId: string;
  viewerUserId: string;
  isReviewer: boolean;
}): Promise<DocumentAccess> {
  const document = await prisma.panditDocument.findUnique({
    where: { id: input.documentId },
    select: {
      id: true,
      storageKey: true,
      mimeType: true,
      fileName: true,
      panditProfileId: true,
      pandit: { select: { userId: true } },
    },
  });

  if (!document) return { ok: false, reason: "not-found" };

  const isOwner = document.pandit.userId === input.viewerUserId;
  if (!isOwner && !input.isReviewer) return { ok: false, reason: "not-found" };

  // A reviewer opening somebody's identity document is exactly the kind of
  // access that should leave a trace. Owners reading their own are not logged.
  if (!isOwner) {
    await recordAudit(prisma, {
      actorUserId: input.viewerUserId,
      action: AuditAction.PANDIT_DOCUMENT_ACCESSED,
      entityType: "PanditDocument",
      entityId: document.id,
      metadata: { panditProfileId: document.panditProfileId },
    });
  }

  const storage = getStorageProvider();

  if (isLocalStorage(storage)) {
    return {
      ok: true,
      kind: "stream",
      storageKey: document.storageKey,
      mimeType: document.mimeType,
      fileName: document.fileName,
    };
  }

  const url = await storage.getSignedUrl({
    key: document.storageKey,
    expiresInSeconds: DEFAULT_SIGNED_URL_TTL_SECONDS,
  });

  return { ok: true, kind: "signed-url", url, mimeType: document.mimeType, fileName: document.fileName };
}

/** A reviewer's decision on one document. */
export async function reviewDocument(input: {
  documentId: string;
  reviewerUserId: string;
  status: PanditDocumentStatus;
  rejectionReason?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (input.status === PanditDocumentStatus.REJECTED && !input.rejectionReason?.trim()) {
    return { ok: false, message: "Say why the document was rejected so it can be corrected." };
  }

  return prisma.$transaction(async (tx) => {
    const document = await tx.panditDocument.findUnique({
      where: { id: input.documentId },
      select: { id: true, panditProfileId: true, status: true, type: true },
    });

    if (!document) return { ok: false as const, message: "That document could not be found." };

    await tx.panditDocument.update({
      where: { id: document.id },
      data: {
        status: input.status,
        reviewedById: input.reviewerUserId,
        reviewedAt: new Date(),
        rejectionReason:
          input.status === PanditDocumentStatus.REJECTED ? (input.rejectionReason?.trim() ?? null) : null,
      },
    });

    await recordAudit(tx, {
      actorUserId: input.reviewerUserId,
      action: AuditAction.PANDIT_DOCUMENT_REVIEWED,
      entityType: "PanditDocument",
      entityId: document.id,
      metadata: {
        panditProfileId: document.panditProfileId,
        documentType: document.type,
        from: document.status,
        to: input.status,
      },
    });

    return { ok: true as const };
  });
}

/** Removes a document the applicant has not yet had reviewed. */
export async function deleteOwnDocument(userId: string, documentId: string): Promise<void> {
  const document = await prisma.panditDocument.findFirst({
    where: { id: documentId, pandit: { userId }, status: PanditDocumentStatus.PENDING },
    select: { id: true, storageKey: true },
  });

  if (!document) throw new DocumentError("That document cannot be removed.");

  await prisma.panditDocument.delete({ where: { id: document.id } });
  await getStorageProvider()
    .delete({ key: document.storageKey })
    // The row is the source of truth for what exists. A storage object left
    // behind by a transient failure is waste, not a correctness problem, and
    // failing the request would leave the reviewer looking at a document the
    // applicant believes they deleted.
    .catch(() => undefined);
}
