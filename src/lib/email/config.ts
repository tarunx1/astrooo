import "server-only";

import type { EmailProvider, TransactionalEmailInput } from "@/lib/email/provider";

/**
 * Transactional email.
 *
 * No provider is configured yet. Rather than pretend a message was sent, this
 * returns null when unconfigured and callers skip notification. Nothing in the
 * product reports "email sent" unless an provider actually accepted it.
 */
export function getEmailProvider(env: NodeJS.ProcessEnv = process.env): EmailProvider | null {
  const apiKey = env.EMAIL_PROVIDER_API_KEY;
  const from = env.EMAIL_FROM;

  if (!apiKey || !from) return null;

  // Intentionally unimplemented: wiring a vendor here is a follow-up task.
  // Returning a provider that silently dropped mail would be worse than none.
  throw new Error(
    "EMAIL_PROVIDER_API_KEY is set but no transactional email provider is implemented yet. " +
      "Implement EmailProvider before enabling email delivery.",
  );
}

export type ReportReadyNotification = {
  to: string;
  customerName: string;
  reportName: string;
  reportUrl: string;
};

/**
 * Sends the "your report is ready" message when email is configured.
 *
 * Returns the delivery state honestly so callers never log a success that did
 * not happen.
 */
export async function notifyReportReady(
  notification: ReportReadyNotification,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ sent: boolean; reason?: "not_configured" | "failed" }> {
  let provider: EmailProvider | null;
  try {
    provider = getEmailProvider(env);
  } catch {
    return { sent: false, reason: "failed" };
  }

  if (!provider) return { sent: false, reason: "not_configured" };

  const input: TransactionalEmailInput = {
    to: notification.to,
    subject: `Your ${notification.reportName} is ready`,
    text: [
      `Namaste ${notification.customerName},`,
      "",
      `Your ${notification.reportName} has been prepared and is ready to download.`,
      "",
      notification.reportUrl,
      "",
      "Tarun Astro",
    ].join("\n"),
    html: `<p>Namaste ${notification.customerName},</p><p>Your ${notification.reportName} has been prepared and is ready to download.</p><p><a href="${notification.reportUrl}">View your report</a></p><p>Tarun Astro</p>`,
  };

  try {
    await provider.sendTransactionalEmail(input);
    return { sent: true };
  } catch {
    return { sent: false, reason: "failed" };
  }
}
