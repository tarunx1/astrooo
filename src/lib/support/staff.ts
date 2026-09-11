import "server-only";

import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Staff who can hold a ticket.
 *
 * Deactivated employees are excluded: assigning work to someone whose access
 * has been withdrawn would park the ticket where nobody can pick it up.
 */
export async function listAssignableStaff(): Promise<
  Array<{ id: string; name: string; email: string }>
> {
  return prisma.user.findMany({
    where: {
      role: { in: [UserRole.EMPLOYEE, UserRole.ADMIN, UserRole.SUPER_ADMIN] },
      OR: [{ employeeProfile: { active: true } }, { employeeProfile: null }],
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
    take: 200,
  });
}
