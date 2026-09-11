import type { Metadata } from "next";
import Link from "next/link";
import { ConsultationStatus } from "@prisma/client";
import { DataTable, EmptyState, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { PanditLayout } from "@/components/pandit/pandit-shell";
import { requireApprovedPandit } from "@/lib/pandit/guard";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Chats" };

/**
 * Conversation threads.
 *
 * A thread is tied to a consultation, which is what makes authorization
 * answerable: you may read it if you are the customer or the Pandit on that
 * consultation. There is no way to open a conversation with someone who has not
 * booked you, and no inbox of arbitrary users.
 */
export default async function PanditChatsPage() {
  const identity = await requireApprovedPandit("/pandit/chats");

  const threads = await prisma.consultation.findMany({
    where: {
      panditProfileId: identity.profileId,
      status: { notIn: [ConsultationStatus.CANCELLED] },
    },
    select: {
      id: true,
      status: true,
      scheduledStart: true,
      user: { select: { name: true, email: true } },
      messages: {
        select: { body: true, createdAt: true, senderId: true, readAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: { select: { messages: true } },
    },
    orderBy: { scheduledStart: "desc" },
    take: 50,
  });

  const withMessages = threads.filter((thread) => thread._count.messages > 0);

  return (
    <PanditLayout
      currentPath="/pandit/chats"
      description="One thread per consultation. Only people who have booked you can message you."
      eyebrow="Chats"
      identity={identity}
      title="Conversations"
    >
      {withMessages.length === 0 ? (
        <EmptyState
          description="A thread opens for each consultation. Messages sent there will appear here."
          title="No messages yet"
        />
      ) : (
        <DataTable
          caption="Conversations"
          columns={[
            { key: "client", label: "Client" },
            { key: "latest", label: "Latest message" },
            { key: "when", label: "Consultation" },
            { key: "open", label: "", align: "right" },
          ]}
          emptyMessage="No messages yet."
          getKey={(row) => row.id}
          renderCard={(row) => (
            <div className="grid gap-1.5">
              <p className="body-sm font-semibold text-slate-900">{row.user.name || row.user.email}</p>
              <p className="caption text-slate-600">{row.messages[0]?.body.slice(0, 120)}</p>
              <Link className="caption font-semibold text-blue-700 underline" href={`/pandit/chats/${row.id}`}>
                Open thread
              </Link>
            </div>
          )}
          renderCell={(row, key) => {
            switch (key) {
              case "client":
                return (
                  <span className="grid">
                    <span className="font-semibold text-slate-800">{row.user.name || "Client"}</span>
                    <StatusBadge label={row.status} tone="neutral" />
                  </span>
                );
              case "latest":
                return <span className="line-clamp-1">{row.messages[0]?.body.slice(0, 140) ?? "—"}</span>;
              case "when":
                return row.scheduledStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
              default:
                return (
                  <Link
                    className="text-sm font-semibold text-blue-700 underline"
                    href={`/pandit/chats/${row.id}`}
                  >
                    Open
                  </Link>
                );
            }
          }}
          rows={withMessages}
        />
      )}
    </PanditLayout>
  );
}
