import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConsultationMode } from "@prisma/client";
import { AlertTriangle, MessageSquare, Phone, Video } from "lucide-react";
import { PageContainer, Section } from "@/components/layout/primitives";
import { ChatThreadView } from "@/components/consultation/chat-thread";
import { requireUser } from "@/lib/auth/session";
import { authorizeSessionJoin, markSessionStarted } from "@/lib/consultations/session";
import { getChatThread, markThreadRead } from "@/lib/support/chat";
import { CONSULTATION_POLICY } from "@/lib/consultations/status";
import { sendChatMessageAction } from "@/app/chat-actions";

export const metadata: Metadata = {
  title: "Consultation session",
  robots: { index: false, follow: false, nocache: true },
};

const MODE_META = {
  [ConsultationMode.CHAT]: { label: "Chat consultation", icon: MessageSquare },
  [ConsultationMode.VOICE_CALL]: { label: "Voice consultation", icon: Phone },
  [ConsultationMode.VIDEO_CALL]: { label: "Video consultation", icon: Video },
} as const;

/**
 * The live consultation room.
 *
 * Authorization happens on the server before anything renders: the caller must
 * be a participant, the booking must be joinable, and now must be inside the
 * window. A participant token, where one is needed, is minted here and is
 * short-lived.
 *
 * Where no calling provider is connected the page says so plainly. It does not
 * render a call window that cannot connect.
 */
export default async function ConsultationSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/consultations/session/${id}`);

  const access = await authorizeSessionJoin({ consultationId: id, viewerUserId: user.id });

  if (!access.ok && access.code === "not_found") notFound();

  if (!access.ok) {
    return (
      <Section className="star-field">
        <PageContainer className="px-0">
          <div className="mx-auto max-w-lg rounded-lg border border-border bg-surface p-8 text-center">
            <AlertTriangle aria-hidden="true" className="mx-auto text-warning" size={28} />
            <h1 className="mt-4 heading-lg">Not available yet</h1>
            <p className="mt-3 body-md text-foreground-secondary">{access.reason}</p>
            <Link
              className="mt-6 inline-flex min-h-11 items-center rounded-md border border-border-strong px-5 body-sm font-semibold text-foreground transition hover:bg-surface-hover"
              href="/account/consultations"
            >
              Back to my consultations
            </Link>
          </div>
        </PageContainer>
      </Section>
    );
  }

  // Recorded once the participants are actually in the room.
  await markSessionStarted({ consultationId: id, viewerUserId: user.id });

  const thread = await getChatThread({ consultationId: id, viewerUserId: user.id });
  if (thread) await markThreadRead({ consultationId: id, viewerUserId: user.id });

  const meta = MODE_META[access.mode];
  const Icon = meta.icon;

  return (
    <Section className="star-field">
      <PageContainer className="px-0">
        <header className="mb-6">
          <p className="inline-flex items-center gap-2 caption uppercase tracking-wider text-premium">
            <Icon aria-hidden="true" size={14} />
            {meta.label}
          </p>
          <h1 className="mt-2 heading-xl">{access.counterpartName}</h1>
          <p className="mt-2 body-sm text-foreground-secondary">
            {access.scheduledStart.toLocaleString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {" · "}
            {access.durationMinutes} minutes
          </p>
        </header>

        {access.mode !== ConsultationMode.CHAT ? (
          <div className="mb-6">
            {access.providerConnected ? (
              <div className="rounded-lg border border-border bg-surface p-6">
                <p className="body-sm text-foreground-secondary">
                  Your session is ready. The call window will open below.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-warning/40 bg-warning/5 p-6">
                <p className="inline-flex items-center gap-2 body-sm font-semibold text-warning">
                  <AlertTriangle aria-hidden="true" size={15} />
                  Voice and video calling is not connected on this deployment
                </p>
                <p className="mt-2 body-sm text-foreground-secondary">
                  No calling provider has been configured yet, so this session cannot carry audio or video.
                  You can still use the chat below to talk to your practitioner, and the session remains
                  booked and paid.
                </p>
              </div>
            )}
          </div>
        ) : null}

        <section aria-labelledby="chat-heading">
          <h2 className="mb-4 heading-sm" id="chat-heading">
            Messages
          </h2>
          {thread ? (
            <ChatThreadView
              action={sendChatMessageAction}
              consultationId={access.consultationId}
              messages={thread.messages}
            />
          ) : (
            <p className="body-sm text-foreground-muted">This conversation is not available.</p>
          )}
        </section>

        <p className="mt-6 caption text-foreground-muted">
          This room closes {CONSULTATION_POLICY.joinClosesAfterStartMinutes} minutes after the scheduled
          start.
        </p>
      </PageContainer>
    </Section>
  );
}
