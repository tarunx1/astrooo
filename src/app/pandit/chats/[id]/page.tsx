import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardSection, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { PanditLayout } from "@/components/pandit/pandit-shell";
import { ChatThreadView } from "@/components/consultation/chat-thread";
import { requireApprovedPandit } from "@/lib/pandit/guard";
import { getChatThread, markThreadRead } from "@/lib/support/chat";
import { sendChatMessageAction } from "@/app/chat-actions";

export const metadata: Metadata = { title: "Conversation" };

export default async function PanditChatThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const identity = await requireApprovedPandit("/pandit/chats");
  const { id } = await params;

  const thread = await getChatThread({ consultationId: id, viewerUserId: identity.userId });
  if (!thread) notFound();

  await markThreadRead({ consultationId: id, viewerUserId: identity.userId });

  return (
    <PanditLayout
      currentPath="/pandit/chats"
      description={`Consultation on ${thread.scheduledStart.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`}
      eyebrow="Chats"
      identity={identity}
      title={thread.counterpartName}
    >
      <DashboardSection
        actions={<StatusBadge label={thread.status} tone="neutral" />}
        title="Conversation"
      >
        <ChatThreadView action={sendChatMessageAction} consultationId={thread.consultationId} messages={thread.messages} />
      </DashboardSection>
    </PanditLayout>
  );
}
