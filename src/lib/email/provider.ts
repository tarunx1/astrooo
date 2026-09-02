export type TransactionalEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export interface EmailProvider {
  sendTransactionalEmail(input: TransactionalEmailInput): Promise<{ id: string }>;
}
