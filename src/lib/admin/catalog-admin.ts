import "server-only";

import { AuditAction, ReportStatus, UserRole, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/admin/audit";
import { ADMIN_ROLES } from "@/lib/auth/admin";

/**
 * Report definitions, coupons and users.
 *
 * Two invariants run through this file: historical snapshots are never touched,
 * and no operator action can create a payment fact. Editing a report definition
 * changes future purchases only; editing a coupon leaves every recorded
 * redemption and order discount exactly as it was.
 */

/* ------------------------------------------------------------------ */
/* Report definitions                                                  */
/* ------------------------------------------------------------------ */

export const reportDefinitionSchema = z.object({
  name: z.string().trim().min(3).max(120),
  shortDescription: z.string().trim().min(10).max(300),
  description: z.string().trim().min(20).max(5000),
  priceMinor: z.number().int().min(0).max(10_000_000_00),
  estimatedPages: z.number().int().min(1).max(500),
  sortOrder: z.number().int().min(0).max(999),
  isActive: z.boolean(),
  sectionsIncluded: z.array(z.string().trim().min(1).max(160)).max(40),
});

export type ReportDefinitionInput = z.infer<typeof reportDefinitionSchema>;

/**
 * Updates a report definition.
 *
 * The slug is intentionally not editable: `ReportOrder.reportSlugSnapshot` and
 * the generation pipeline's prompt specs are both keyed on it, so changing it
 * would orphan history and break generation.
 */
export async function updateReportDefinition(
  adminUserId: string,
  definitionId: string,
  input: ReportDefinitionInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const current = await prisma.reportDefinition.findUnique({
    where: { id: definitionId },
    select: { id: true, slug: true, isActive: true, priceMinor: true },
  });

  if (!current) return { ok: false, message: "That report definition could not be found." };

  await prisma.$transaction(async (tx) => {
    await tx.reportDefinition.update({
      where: { id: definitionId },
      data: {
        name: input.name,
        shortDescription: input.shortDescription,
        description: input.description,
        priceMinor: input.priceMinor,
        estimatedPages: input.estimatedPages,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
        sectionsIncluded: input.sectionsIncluded as Prisma.InputJsonValue,
      },
    });

    await recordAudit(tx, {
      actorUserId: adminUserId,
      action: AuditAction.REPORT_DEFINITION_UPDATED,
      entityType: "ReportDefinition",
      entityId: definitionId,
      metadata: {
        slug: current.slug,
        fromPriceMinor: current.priceMinor,
        toPriceMinor: input.priceMinor,
      },
    });

    if (current.isActive !== input.isActive) {
      await recordAudit(tx, {
        actorUserId: adminUserId,
        action: input.isActive
          ? AuditAction.REPORT_DEFINITION_ACTIVATED
          : AuditAction.REPORT_DEFINITION_DEACTIVATED,
        entityType: "ReportDefinition",
        entityId: definitionId,
        metadata: { slug: current.slug },
      });
    }
  });

  return { ok: true };
}

export async function listReportDefinitions() {
  return prisma.reportDefinition.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      priceMinor: true,
      currency: true,
      estimatedPages: true,
      sortOrder: true,
      isActive: true,
      _count: { select: { reportOrders: true } },
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getReportDefinition(definitionId: string) {
  return prisma.reportDefinition.findUnique({
    where: { id: definitionId },
    select: {
      id: true,
      slug: true,
      name: true,
      shortDescription: true,
      description: true,
      priceMinor: true,
      currency: true,
      estimatedPages: true,
      sortOrder: true,
      isActive: true,
      sectionsIncluded: true,
    },
  });
}

/* ------------------------------------------------------------------ */
/* Coupons                                                             */
/* ------------------------------------------------------------------ */

export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(40)
      .regex(/^[A-Z0-9-]+$/, "Use capitals, digits and hyphens only."),
    description: z.string().trim().max(200).nullable().optional(),
    percentOff: z.number().int().min(1).max(100).nullable().optional(),
    amountOffPaise: z.number().int().min(1).max(10_000_000_00).nullable().optional(),
    minOrderPaise: z.number().int().min(0).max(10_000_000_00).nullable().optional(),
    maxDiscountPaise: z.number().int().min(1).max(10_000_000_00).nullable().optional(),
    usageLimit: z.number().int().min(1).max(1_000_000).nullable().optional(),
    perUserLimit: z.number().int().min(1).max(1000).nullable().optional(),
    startsAt: z.string().trim().nullable().optional(),
    endsAt: z.string().trim().nullable().optional(),
    active: z.boolean(),
  })
  .superRefine((value, context) => {
    const hasPercent = value.percentOff != null;
    const hasAmount = value.amountOffPaise != null;

    if (hasPercent === hasAmount) {
      context.addIssue({
        code: "custom",
        path: ["percentOff"],
        message: "Set exactly one of a percentage or a fixed amount.",
      });
    }

    if (hasAmount && value.maxDiscountPaise != null) {
      context.addIssue({
        code: "custom",
        path: ["maxDiscountPaise"],
        message: "A maximum discount only applies to a percentage coupon.",
      });
    }

    if (value.startsAt && value.endsAt && new Date(value.startsAt) >= new Date(value.endsAt)) {
      context.addIssue({ code: "custom", path: ["endsAt"], message: "The end date must be after the start date." });
    }
  });

export type CouponInput = z.infer<typeof couponSchema>;

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createCoupon(
  adminUserId: string,
  input: CouponInput,
): Promise<{ ok: true; couponId: string } | { ok: false; message: string }> {
  const existing = await prisma.coupon.findUnique({ where: { code: input.code }, select: { id: true } });
  if (existing) return { ok: false, message: "That coupon code already exists." };

  const coupon = await prisma.$transaction(async (tx) => {
    const created = await tx.coupon.create({
      data: {
        code: input.code,
        description: input.description ?? null,
        percentOff: input.percentOff ?? null,
        amountOffPaise: input.amountOffPaise ?? null,
        minOrderPaise: input.minOrderPaise ?? null,
        maxDiscountPaise: input.maxDiscountPaise ?? null,
        usageLimit: input.usageLimit ?? null,
        perUserLimit: input.perUserLimit ?? null,
        startsAt: toDate(input.startsAt),
        endsAt: toDate(input.endsAt),
        active: input.active,
      },
      select: { id: true },
    });

    await recordAudit(tx, {
      actorUserId: adminUserId,
      action: AuditAction.COUPON_CREATED,
      entityType: "Coupon",
      entityId: created.id,
      metadata: { code: input.code, active: input.active },
    });

    return created;
  });

  return { ok: true, couponId: coupon.id };
}

/**
 * Updates a coupon.
 *
 * `timesRedeemed` and every `CouponRedemption` are deliberately untouched, and
 * the code itself is immutable once created because orders snapshot it.
 */
export async function updateCoupon(
  adminUserId: string,
  couponId: string,
  input: CouponInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const current = await prisma.coupon.findUnique({
    where: { id: couponId },
    select: { id: true, code: true, active: true },
  });

  if (!current) return { ok: false, message: "That coupon could not be found." };
  if (current.code !== input.code) {
    return { ok: false, message: "A coupon code cannot be changed once orders may reference it." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.coupon.update({
      where: { id: couponId },
      data: {
        description: input.description ?? null,
        percentOff: input.percentOff ?? null,
        amountOffPaise: input.amountOffPaise ?? null,
        minOrderPaise: input.minOrderPaise ?? null,
        maxDiscountPaise: input.maxDiscountPaise ?? null,
        usageLimit: input.usageLimit ?? null,
        perUserLimit: input.perUserLimit ?? null,
        startsAt: toDate(input.startsAt),
        endsAt: toDate(input.endsAt),
        active: input.active,
      },
    });

    await recordAudit(tx, {
      actorUserId: adminUserId,
      action: AuditAction.COUPON_UPDATED,
      entityType: "Coupon",
      entityId: couponId,
      metadata: { code: current.code },
    });

    if (current.active !== input.active) {
      await recordAudit(tx, {
        actorUserId: adminUserId,
        action: input.active ? AuditAction.COUPON_ACTIVATED : AuditAction.COUPON_DEACTIVATED,
        entityType: "Coupon",
        entityId: couponId,
        metadata: { code: current.code },
      });
    }
  });

  return { ok: true };
}

export async function listCoupons() {
  return prisma.coupon.findMany({
    select: {
      id: true,
      code: true,
      percentOff: true,
      amountOffPaise: true,
      minOrderPaise: true,
      maxDiscountPaise: true,
      usageLimit: true,
      perUserLimit: true,
      timesRedeemed: true,
      startsAt: true,
      endsAt: true,
      active: true,
      _count: { select: { redemptions: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCoupon(couponId: string) {
  return prisma.coupon.findUnique({
    where: { id: couponId },
    select: {
      id: true,
      code: true,
      description: true,
      percentOff: true,
      amountOffPaise: true,
      minOrderPaise: true,
      maxDiscountPaise: true,
      usageLimit: true,
      perUserLimit: true,
      timesRedeemed: true,
      startsAt: true,
      endsAt: true,
      active: true,
    },
  });
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  orderCount: number;
  reportOrderCount: number;
};

/**
 * User search.
 *
 * Selects only what operations needs. Session tokens, OAuth tokens, password
 * hashes, verification records and birth profile contents are never selected.
 */
export async function listUsers(input: {
  page: number;
  pageSize: number;
  search?: string;
}): Promise<{ rows: AdminUserRow[]; total: number }> {
  const search = input.search?.trim();

  const where: Prisma.UserWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { orders: true, reportOrders: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    total,
    rows: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      createdAt: row.createdAt,
      orderCount: row._count.orders,
      reportOrderCount: row._count.reportOrders,
    })),
  };
}

export type RoleChangeOutcome = { ok: true } | { ok: false; message: string };

/**
 * Changes another user's role.
 *
 * Three protections: the target id comes from the form but the actor comes from
 * the session, so nobody can change their own role through a crafted request;
 * self-changes are refused outright; and the last remaining admin cannot be
 * demoted, which would lock everyone out.
 */
export async function changeUserRole(input: {
  adminUserId: string;
  targetUserId: string;
  role: UserRole;
}): Promise<RoleChangeOutcome> {
  if (input.adminUserId === input.targetUserId) {
    return { ok: false, message: "You cannot change your own role." };
  }

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: input.targetUserId },
      select: { id: true, email: true, role: true },
    });

    if (!target) return { ok: false as const, message: "That user could not be found." };
    if (target.role === input.role) return { ok: false as const, message: "That user already has this role." };

    const isDemotingAnAdmin = ADMIN_ROLES.includes(target.role) && !ADMIN_ROLES.includes(input.role);

    if (isDemotingAnAdmin) {
      // A plain count would not be safe here. Under READ COMMITTED two
      // concurrent demotions of the last two admins each observe one other
      // admin still standing, both pass the check, and the site is left with
      // none. Locking the admin rows serialises the two transactions: the
      // second blocks, then re-evaluates the rows against the committed state,
      // where the first target no longer matches an admin role and so drops out
      // of the locked set. The count is taken from that locked set, not from a
      // separate unlocked read.
      const lockedAdmins = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "User" WHERE "role"::text = ANY(${ADMIN_ROLES.map(String)}) FOR UPDATE
      `;

      const remainingAdmins = lockedAdmins.filter((row) => row.id !== target.id).length;

      if (remainingAdmins === 0) {
        return { ok: false as const, message: "This is the last admin. Promote someone else before demoting them." };
      }
    }

    // A second, stricter invariant. System settings are SUPER_ADMIN-only, so a
    // site with admins but no super admin can still be locked out of its own
    // provider credentials and site configuration with no way back except shell
    // access. Losing the last super admin is therefore its own failure, and it
    // can happen while the admin count above stays healthy - demoting a super
    // admin to ADMIN passes that check entirely.
    const isLosingASuperAdmin =
      target.role === UserRole.SUPER_ADMIN && input.role !== UserRole.SUPER_ADMIN;

    if (isLosingASuperAdmin) {
      // Locked and counted exactly like the admin check above, and for the same
      // reason: two concurrent demotions of the last two super admins would each
      // see the other still standing.
      const lockedSuperAdmins = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "User" WHERE "role"::text = ${UserRole.SUPER_ADMIN} FOR UPDATE
      `;

      const remainingSuperAdmins = lockedSuperAdmins.filter((row) => row.id !== target.id).length;

      if (remainingSuperAdmins === 0) {
        return {
          ok: false as const,
          message:
            "This is the last super admin. Promote someone else to super admin before changing this role.",
        };
      }
    }

    await tx.user.update({ where: { id: target.id }, data: { role: input.role } });

    const action =
      input.role === UserRole.SUPER_ADMIN
        ? AuditAction.SUPER_ADMIN_PROMOTED
        : target.role === UserRole.SUPER_ADMIN
          ? AuditAction.SUPER_ADMIN_DEMOTED
          : AuditAction.USER_ROLE_CHANGED;

    await recordAudit(tx, {
      actorUserId: input.adminUserId,
      action,
      entityType: "User",
      entityId: target.id,
      metadata: { email: target.email, from: target.role, to: input.role },
    });

    return { ok: true as const };
  });
}

/* ------------------------------------------------------------------ */
/* Report orders and generated reports                                 */
/* ------------------------------------------------------------------ */

export async function listReportOrders(input: { page: number; pageSize: number; status?: ReportStatus }) {
  const where: Prisma.ReportOrderWhereInput = input.status ? { status: input.status } : {};

  const [rows, total] = await Promise.all([
    prisma.reportOrder.findMany({
      where,
      select: {
        id: true,
        reportNameSnapshot: true,
        status: true,
        priceMinor: true,
        currency: true,
        createdAt: true,
        paidAt: true,
        user: { select: { name: true, email: true } },
        generatedReport: { select: { id: true, status: true, attemptCount: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.reportOrder.count({ where }),
  ]);

  return { rows, total };
}

/**
 * Generated report listing.
 *
 * `lastError` is mapped to a coarse category rather than surfaced raw: the
 * underlying string can contain provider detail that does not belong in an
 * operations screen.
 */
export type FailureCategory =
  | "provider unavailable"
  | "invalid structured output"
  | "render failure"
  | "storage failure"
  | "configuration"
  | "unknown";

export function categoriseFailure(lastErrorCategory: string | null): FailureCategory | null {
  if (!lastErrorCategory) return null;

  switch (lastErrorCategory) {
    case "transient":
      return "provider unavailable";
    case "invalid_output":
      return "invalid structured output";
    case "render":
      return "render failure";
    case "storage":
      return "storage failure";
    case "configuration":
      return "configuration";
    default:
      return "unknown";
  }
}

export async function listGeneratedReports(input: { page: number; pageSize: number; status?: ReportStatus }) {
  const where: Prisma.GeneratedReportWhereInput = input.status ? { status: input.status } : {};

  const [rows, total] = await Promise.all([
    prisma.generatedReport.findMany({
      where,
      select: {
        id: true,
        status: true,
        attemptCount: true,
        lastErrorCategory: true,
        lastErrorAt: true,
        readyAt: true,
        pageCount: true,
        aiProvider: true,
        aiModel: true,
        promptVersion: true,
        createdAt: true,
        reportOrder: {
          select: { id: true, reportNameSnapshot: true, user: { select: { email: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.generatedReport.count({ where }),
  ]);

  return { rows, total };
}
