import "server-only";

import { ConsultationStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Consultation chat.
 *
 * A thread belongs to a consultation, not to a pair of users. That is the whole
 * authorization model: you may read and write a thread when you are the
 * customer or the Pandit on that consultation, which is expressed as a `where`
 * clause rather than as a comparison after fetching. A request naming a thread
 * you are not party to resolves to "not found" - there is no arbitrary
 * messaging surface to abuse.
 */

export type ChatParticipant = { kind: "customer" | "pandit"; userId: string };

export type ChatThread = {
  consultationId: string;
  status: ConsultationStatus;
  scheduledStart: Date;
  counterpartName: string;
  messages: Array<{ id: string; body: string; senderId: string; mine: boolean; createdAt: Date }>;
};

/**
 * Loads a thread for a participant.
 *
 * The same function serves both sides; which side is asking only changes whose
 * name is shown as the counterpart and which messages are marked as their own.
 */
export async function getChatThread(input: {
  consultationId: string;
  viewerUserId: string;
}): Promise<ChatThread | null> {
  const consultation = await prisma.consultation.findFirst({
    where: {
      id: input.consultationId,
      OR: [{ userId: input.viewerUserId }, { pandit: { userId: input.viewerUserId } }],
    },
    select: {
      id: true,
      status: true,
      scheduledStart: true,
      userId: true,
      user: { select: { name: true, email: true } },
      pandit: { select: { userId: true, displayName: true } },
      messages: {
        select: { id: true, body: true, senderId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
        take: 500,
      },
    },
  });

  if (!consultation) return null;

  const viewerIsCustomer = consultation.userId === input.viewerUserId;

  return {
    consultationId: consultation.id,
    status: consultation.status,
    scheduledStart: consultation.scheduledStart,
    counterpartName: viewerIsCustomer
      ? consultation.pandit.displayName
      : consultation.user.name || consultation.user.email,
    messages: consultation.messages.map((message) => ({
      id: message.id,
      body: message.body,
      senderId: message.senderId,
      mine: message.senderId === input.viewerUserId,
      createdAt: message.createdAt,
    })),
  };
}

/**
 * Sends one message.
 *
 * Membership is re-checked here rather than inherited from whatever page
 * rendered the form, so the action is safe on its own terms. A cancelled
 * consultation closes its thread: there is no relationship left to justify the
 * message.
 */
export async function sendChatMessage(input: {
  consultationId: string;
  senderUserId: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const body = input.body.trim();
  if (!body) return { ok: false, message: "Write a message first." };
  if (body.length > 4_000) return { ok: false, message: "That message is too long." };

  const consultation = await prisma.consultation.findFirst({
    where: {
      id: input.consultationId,
      OR: [{ userId: input.senderUserId }, { pandit: { userId: input.senderUserId } }],
    },
    select: { id: true, status: true },
  });

  if (!consultation) return { ok: false, message: "That conversation could not be found." };

  if (consultation.status === ConsultationStatus.CANCELLED) {
    return { ok: false, message: "That consultation was cancelled, so its thread is closed." };
  }

  await prisma.chatMessage.create({
    data: { consultationId: consultation.id, senderId: input.senderUserId, body },
  });

  return { ok: true };
}

/** Marks the counterpart's messages in one thread as read. */
export async function markThreadRead(input: {
  consultationId: string;
  viewerUserId: string;
}): Promise<void> {
  await prisma.chatMessage.updateMany({
    where: {
      consultationId: input.consultationId,
      readAt: null,
      NOT: { senderId: input.viewerUserId },
      // Scoped through the consultation so this cannot mark messages read on a
      // thread the caller is not part of.
      consultation: {
        OR: [{ userId: input.viewerUserId }, { pandit: { userId: input.viewerUserId } }],
      },
    },
    data: { readAt: new Date() },
  });
}
