import "server-only";

import { AuditAction, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/admin/audit";
import {
  ASSIGNABLE_EMPLOYEE_PERMISSIONS,
  DEFAULT_EMPLOYEE_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  SUPER_ADMIN_ONLY_PERMISSIONS,
  isPermission,
  resolvePermissions,
  type Permission,
} from "@/lib/auth/permissions";

/**
 * Staff management.
 *
 * Two rules that the UI cannot be the enforcer of:
 *
 *  * Nobody re-permissions themselves. Every write here refuses when the actor
 *    is the target, so a compromised operator session cannot widen its own
 *    access even with a valid CSRF-passing request.
 *
 *  * The owner-level permissions - credentials, commission, payout rules, staff
 *    management itself - cannot be delegated. They are refused on write, not
 *    merely left out of the picker, because a picker is a client.
 */

export class EmployeeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmployeeError";
  }
}

export const employeeInputSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  jobTitle: z.string().trim().max(120).nullable(),
  department: z.string().trim().max(120).nullable(),
});

export type EmployeeRow = {
  id: string;
  userId: string;
  name: string;
  email: string;
  jobTitle: string | null;
  department: string | null;
  active: boolean;
  permissionCount: number;
  assignedTicketCount: number;
  createdAt: Date;
};

export async function listEmployees(input: {
  page: number;
  pageSize: number;
  search?: string;
}): Promise<{ rows: EmployeeRow[]; total: number }> {
  const where: Prisma.EmployeeProfileWhereInput = input.search
    ? {
        user: {
          OR: [
            { name: { contains: input.search, mode: "insensitive" } },
            { email: { contains: input.search, mode: "insensitive" } },
          ],
        },
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.employeeProfile.findMany({
      where,
      select: {
        id: true,
        userId: true,
        jobTitle: true,
        department: true,
        active: true,
        createdAt: true,
        user: {
          select: {
            name: true,
            email: true,
            role: true,
            _count: { select: { permissions: true, ticketsAssigned: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.employeeProfile.count({ where }),
  ]);

  return {
    total,
    rows: rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      name: row.user.name,
      email: row.user.email,
      jobTitle: row.jobTitle,
      department: row.department,
      active: row.active,
      permissionCount: row.user._count.permissions,
      assignedTicketCount: row.user._count.ticketsAssigned,
      createdAt: row.createdAt,
    })),
  };
}

export type EmployeeDetail = {
  id: string;
  userId: string;
  name: string;
  email: string;
  jobTitle: string | null;
  department: string | null;
  active: boolean;
  createdAt: Date;
  /** The bundle their role gives them before any override. */
  roleDefaults: readonly Permission[];
  /** What they actually hold, after overrides. */
  effective: Permission[];
  overrides: Array<{ permission: string; granted: boolean }>;
};

export async function getEmployeeDetail(userId: string): Promise<EmployeeDetail | null> {
  const record = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      permissions: { select: { permission: true, granted: true } },
      employeeProfile: {
        select: { id: true, jobTitle: true, department: true, active: true, createdAt: true },
      },
    },
  });

  if (!record?.employeeProfile) return null;

  return {
    id: record.employeeProfile.id,
    userId: record.id,
    name: record.name,
    email: record.email,
    jobTitle: record.employeeProfile.jobTitle,
    department: record.employeeProfile.department,
    active: record.employeeProfile.active,
    createdAt: record.employeeProfile.createdAt,
    roleDefaults: ROLE_DEFAULT_PERMISSIONS[record.role],
    effective: [...resolvePermissions(record.role, record.permissions)].sort(),
    overrides: record.permissions,
  };
}

/**
 * Makes an existing account a staff account.
 *
 * Deliberately not "create an account": there is no path here that mints
 * credentials or sends an invitation, because that would be a second way into
 * the application alongside Better Auth. The person signs up normally, and a
 * Super Admin then grants the role - which is also why this can never be the
 * step that assigns a role from a browser-supplied field.
 */
export async function createEmployee(input: {
  actorUserId: string;
  email: string;
  jobTitle: string | null;
  department: string | null;
}): Promise<{ ok: true; userId: string } | { ok: false; message: string }> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { email: input.email },
      select: { id: true, email: true, role: true, employeeProfile: { select: { id: true } } },
    });

    if (!user) {
      return {
        ok: false as const,
        message: "No account with that email. Ask them to sign up first, then add them here.",
      };
    }

    if (user.id === input.actorUserId) {
      return { ok: false as const, message: "You cannot add yourself as an employee." };
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      return { ok: false as const, message: "That account is a Super Admin. Change their role first." };
    }

    if (user.role === UserRole.PANDIT) {
      return {
        ok: false as const,
        message: "That account is a Pandit. Staff and practitioner accounts are kept separate.",
      };
    }

    if (user.employeeProfile) {
      return { ok: false as const, message: "That account is already an employee." };
    }

    await tx.employeeProfile.create({
      data: {
        userId: user.id,
        jobTitle: input.jobTitle,
        department: input.department,
        active: true,
        createdById: input.actorUserId,
      },
    });

    const previousRole = user.role;
    await tx.user.update({ where: { id: user.id }, data: { role: UserRole.EMPLOYEE } });

    await recordAudit(tx, {
      actorUserId: input.actorUserId,
      action: AuditAction.EMPLOYEE_CREATED,
      entityType: "User",
      entityId: user.id,
      metadata: {
        email: user.email,
        from: previousRole,
        to: UserRole.EMPLOYEE,
        defaultPermissions: [...DEFAULT_EMPLOYEE_PERMISSIONS],
      },
    });

    return { ok: true as const, userId: user.id };
  });
}

/** Deactivates or reactivates a staff member without touching their account. */
export async function setEmployeeActive(input: {
  actorUserId: string;
  targetUserId: string;
  active: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (input.actorUserId === input.targetUserId) {
    return { ok: false, message: "You cannot change your own employment status." };
  }

  return prisma.$transaction(async (tx) => {
    const profile = await tx.employeeProfile.findUnique({
      where: { userId: input.targetUserId },
      select: { id: true, active: true, user: { select: { email: true } } },
    });

    if (!profile) return { ok: false as const, message: "That employee could not be found." };
    if (profile.active === input.active) return { ok: true as const };

    await tx.employeeProfile.update({
      where: { id: profile.id },
      data: { active: input.active, deactivatedAt: input.active ? null : new Date() },
    });

    await recordAudit(tx, {
      actorUserId: input.actorUserId,
      action: input.active ? AuditAction.EMPLOYEE_REACTIVATED : AuditAction.EMPLOYEE_DEACTIVATED,
      entityType: "User",
      entityId: input.targetUserId,
      metadata: { email: profile.user.email },
    });

    return { ok: true as const };
  });
}

export async function updateEmployee(input: {
  actorUserId: string;
  targetUserId: string;
  jobTitle: string | null;
  department: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const updated = await prisma.employeeProfile.updateMany({
    where: { userId: input.targetUserId },
    data: { jobTitle: input.jobTitle, department: input.department },
  });

  if (updated.count === 0) return { ok: false, message: "That employee could not be found." };

  await recordAudit(prisma, {
    actorUserId: input.actorUserId,
    action: AuditAction.EMPLOYEE_UPDATED,
    entityType: "User",
    entityId: input.targetUserId,
    metadata: { jobTitle: input.jobTitle, department: input.department },
  });

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Permissions                                                         */
/* ------------------------------------------------------------------ */

/**
 * Replaces one staff member's permission set.
 *
 * Takes the whole desired set rather than a diff, because a diff applied to a
 * stale page silently reintroduces a permission somebody just removed. The
 * overrides are then derived: anything wanted that the role does not give is a
 * grant, anything the role gives that is not wanted is a revocation, and rows
 * matching the role default are deleted so the table holds departures rather
 * than a copy of the defaults.
 */
export async function setEmployeePermissions(input: {
  actorUserId: string;
  targetUserId: string;
  permissions: readonly string[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (input.actorUserId === input.targetUserId) {
    return { ok: false, message: "You cannot change your own permissions." };
  }

  const requested: Permission[] = [];
  for (const candidate of input.permissions) {
    if (!isPermission(candidate)) {
      return { ok: false, message: "That permission is not recognised." };
    }
    if (SUPER_ADMIN_ONLY_PERMISSIONS.includes(candidate)) {
      // Refused here, on the server, rather than only omitted from the picker.
      return { ok: false, message: `${candidate} cannot be delegated.` };
    }
    requested.push(candidate);
  }

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: input.targetUserId },
      select: { id: true, email: true, role: true, employeeProfile: { select: { id: true } } },
    });

    if (!target?.employeeProfile) return { ok: false as const, message: "That employee could not be found." };

    if (target.role === UserRole.SUPER_ADMIN) {
      return { ok: false as const, message: "A Super Admin's permissions are not editable." };
    }

    const defaults = new Set(ROLE_DEFAULT_PERMISSIONS[target.role]);
    const wanted = new Set(requested);

    const grants = [...wanted].filter((permission) => !defaults.has(permission));
    const revocations = [...defaults].filter((permission) => !wanted.has(permission));

    await tx.userPermission.deleteMany({ where: { userId: target.id } });

    if (grants.length > 0 || revocations.length > 0) {
      await tx.userPermission.createMany({
        data: [
          ...grants.map((permission) => ({
            userId: target.id,
            permission,
            granted: true,
            grantedById: input.actorUserId,
          })),
          ...revocations.map((permission) => ({
            userId: target.id,
            permission,
            granted: false,
            grantedById: input.actorUserId,
          })),
        ],
      });
    }

    await recordAudit(tx, {
      actorUserId: input.actorUserId,
      action:
        revocations.length > 0 && grants.length === 0
          ? AuditAction.USER_PERMISSION_REVOKED
          : grants.length > 0
            ? AuditAction.USER_PERMISSION_GRANTED
            : AuditAction.USER_PERMISSION_RESET,
      entityType: "User",
      entityId: target.id,
      metadata: {
        email: target.email,
        effective: [...wanted].sort(),
        granted: grants.sort(),
        revoked: revocations.sort(),
      },
    });

    return { ok: true as const };
  });
}

/** The permissions a Super Admin may hand out, for the picker. */
export function assignablePermissions(): readonly Permission[] {
  return ASSIGNABLE_EMPLOYEE_PERMISSIONS;
}
