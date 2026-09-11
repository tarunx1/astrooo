import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { encryptSecret, hasRootKey } from "@/lib/settings/crypto";

/**
 * A Pandit's payout destination.
 *
 * Bank details are held the same way provider credentials are: AES-256-GCM
 * envelopes produced by `lib/settings/crypto.ts`, under a root key that lives
 * only in the environment. What separates this from the settings table is who
 * may read it - and the answer is nobody, through any path in this
 * application.
 *
 * There is deliberately no decrypt helper here. A Super Admin reviewing payouts
 * does not need to see an account number, and an operator who can read one is
 * an operator who can leak one; the UI works entirely from the masked columns.
 * The envelopes exist so that a future payout provider can be handed a
 * destination server-side without anyone having read it in between - which is
 * the only reason to store the full value at all.
 *
 * Masking is computed here, on write, from the plaintext. Deriving it later
 * from ciphertext would be impossible, and deriving it in the browser would
 * mean the browser had seen the value.
 */

export class PayoutAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayoutAccountError";
  }
}

/**
 * Indian bank details.
 *
 * Validated to the shape the destination actually uses rather than "any
 * non-empty string": an IFSC that is not an IFSC will fail at a bank hours
 * after the operator has moved on, and the person who suffers is the Pandit
 * waiting to be paid.
 */
export const payoutAccountSchema = z
  .object({
    accountHolderName: z.string().trim().min(2).max(120),
    bankName: z.string().trim().max(120).nullable(),
    accountNumber: z
      .string()
      .trim()
      .regex(/^\d{6,20}$/, "An account number is 6 to 20 digits.")
      .nullable(),
    ifsc: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "An IFSC is four letters, a zero, then six characters.")
      .nullable(),
    upiId: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9.\-_]{2,64}@[a-z]{2,32}$/, "A UPI id looks like name@bank.")
      .nullable(),
    taxId: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{5}\d{4}[A-Z]$/, "A PAN is five letters, four digits, then a letter.")
      .nullable(),
  })
  .refine(
    (value) => (value.accountNumber !== null && value.ifsc !== null) || value.upiId !== null,
    {
      message: "Give either a bank account with its IFSC, or a UPI id.",
      path: ["accountNumber"],
    },
  );

export type PayoutAccountInput = z.infer<typeof payoutAccountSchema>;

/** Everything the UI is allowed to know about a stored destination. */
export type PayoutAccountView = {
  accountHolderName: string;
  bankName: string | null;
  accountLast4: string | null;
  ifscMasked: string | null;
  upiMasked: string | null;
  taxIdMasked: string | null;
  verifiedAt: Date | null;
  updatedAt: Date;
};

function maskTail(value: string, visible: number): string {
  if (value.length <= visible) return "*".repeat(value.length);
  return `${"*".repeat(value.length - visible)}${value.slice(-visible)}`;
}

function maskUpi(value: string): string {
  const [name, handle] = value.split("@");
  const head = name.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, name.length - 2))}@${handle}`;
}

/**
 * Saves the acting Pandit's own payout destination.
 *
 * Scoped by `userId` so the row can only ever be their own; there is no
 * parameter naming whose account is being written.
 */
export async function saveOwnPayoutAccount(
  userId: string,
  input: PayoutAccountInput,
): Promise<void> {
  if (!hasRootKey()) {
    // Storing bank details in the clear because a key was missing is worse than
    // refusing. The message names the variable and never its value.
    throw new PayoutAccountError(
      "Payout details cannot be stored: CONFIG_ENCRYPTION_KEY is not configured on this server.",
    );
  }

  const profile = await prisma.panditProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw new PayoutAccountError("No Pandit profile for this account.");

  const data = {
    accountHolderName: input.accountHolderName,
    bankName: input.bankName,

    accountLast4: input.accountNumber ? input.accountNumber.slice(-4) : null,
    ifscMasked: input.ifsc ? maskTail(input.ifsc, 4) : null,
    upiMasked: input.upiId ? maskUpi(input.upiId) : null,
    taxIdMasked: input.taxId ? maskTail(input.taxId, 4) : null,

    accountNumberEnvelope: input.accountNumber ? encryptSecret(input.accountNumber) : null,
    ifscEnvelope: input.ifsc ? encryptSecret(input.ifsc) : null,
    upiEnvelope: input.upiId ? encryptSecret(input.upiId) : null,
    taxIdEnvelope: input.taxId ? encryptSecret(input.taxId) : null,

    // Changing where money goes invalidates any previous verification.
    verifiedAt: null,
  };

  await prisma.payoutAccount.upsert({
    where: { panditProfileId: profile.id },
    update: data,
    create: { panditProfileId: profile.id, ...data },
  });
}

/**
 * Reads the masked view of a destination.
 *
 * The envelope columns are not in the select list, so plaintext cannot leak by
 * a caller forgetting to strip it - it never enters the process to begin with.
 */
export async function getPayoutAccountView(panditProfileId: string): Promise<PayoutAccountView | null> {
  return prisma.payoutAccount.findUnique({
    where: { panditProfileId },
    select: {
      accountHolderName: true,
      bankName: true,
      accountLast4: true,
      ifscMasked: true,
      upiMasked: true,
      taxIdMasked: true,
      verifiedAt: true,
      updatedAt: true,
    },
  });
}

/** Whether a destination exists at all. Used by the completion check. */
export async function hasPayoutAccount(panditProfileId: string): Promise<boolean> {
  const row = await prisma.payoutAccount.findUnique({
    where: { panditProfileId },
    select: { id: true },
  });
  return row !== null;
}
