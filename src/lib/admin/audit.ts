import "server-only";

import type { AuditAction, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Audit trail.
 *
 * Append-only: there is no update or delete helper here and none in the admin
 * UI. `metadata` must carry only safe descriptive values — never a secret,
 * token, prompt, raw provider payload or payment instrument detail.
 */
export type AuditContext = Pick<PrismaClient, "auditLog"> | Prisma.TransactionClient;

export async function recordAudit(
  client: AuditContext,
  input: {
    actorUserId: string;
    action: AuditAction;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await client.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export type AuditEntry = {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata: unknown;
  createdAt: Date;
  actorName: string;
  actorEmail: string;
};

export async function listAuditLog(input: {
  page: number;
  pageSize: number;
  action?: AuditAction;
  entityType?: string;
}): Promise<{ entries: AuditEntry[]; total: number }> {
  const where: Prisma.AuditLogWhereInput = {
    ...(input.action ? { action: input.action } : {}),
    ...(input.entityType ? { entityType: input.entityType } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        actor: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    total,
    entries: rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      metadata: row.metadata,
      createdAt: row.createdAt,
      actorName: row.actor.name,
      actorEmail: row.actor.email,
    })),
  };
}
