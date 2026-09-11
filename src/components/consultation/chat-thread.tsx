"use client";

import { AdminForm, adminInputClass } from "@/components/admin/admin-form";
import { cn } from "@/lib/utils";
import type { AdminActionState } from "@/lib/admin/action-state";

/**
 * One conversation thread.
 *
 * Used by both sides. `mine` is decided on the server from the session user id
 * rather than by comparing ids in the browser, so the alignment of a message
 * cannot be changed by anything the client does.
 */
export function ChatThreadView({
  consultationId,
  messages,
  action,
}: {
  consultationId: string;
  messages: ReadonlyArray<{ id: string; body: string; mine: boolean; createdAt: Date }>;
  action: (state: AdminActionState, formData: FormData) => Promise<AdminActionState>;
}) {
  return (
    <div className="grid gap-4">
      <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
        {messages.length === 0 ? (
          <p className="py-8 text-center body-sm text-slate-500">
            No messages yet. Say hello before the session.
          </p>
        ) : (
          <ol className="grid gap-3">
            {messages.map((message) => (
              <li className={cn("flex", message.mine ? "justify-end" : "justify-start")} key={message.id}>
                <div
                  className={cn(
                    "max-w-[min(32rem,85%)] rounded-2xl px-4 py-2.5",
                    message.mine
                      ? "bg-blue-600 text-white"
                      : "border border-slate-200 bg-slate-50 text-slate-800",
                  )}
                >
                  <p className="body-sm whitespace-pre-wrap break-words">{message.body}</p>
                  <p
                    className={cn(
                      "mt-1 text-[10px]",
                      message.mine ? "text-blue-100" : "text-slate-400",
                    )}
                  >
                    {message.createdAt.toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
        <AdminForm action={action} pendingLabel="Sending..." submitLabel="Send">
          <input name="consultationId" type="hidden" value={consultationId} />
          <label className="sr-only" htmlFor="chat-body">
            Message
          </label>
          <textarea
            className={adminInputClass}
            id="chat-body"
            name="body"
            placeholder="Write a message"
            required
            rows={3}
          />
        </AdminForm>
      </div>
    </div>
  );
}
