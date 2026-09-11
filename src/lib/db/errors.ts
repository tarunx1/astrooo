import { Prisma } from "@prisma/client";

/**
 * Recognising a specific unique-constraint violation.
 *
 * Prisma reports which constraint failed in different places depending on
 * version and driver. With the `pg` driver adapter it arrives nested as
 * `meta.driverAdapterError.cause.constraint.index`; older shapes put a field
 * list in `meta.target`. Reading any single path means the check silently stops
 * working on an upgrade - and a retry predicate that silently stops matching is
 * worse than no retry, because the failure it was guarding against comes back
 * looking like a new bug.
 *
 * So the whole metadata object is searched for the constraint name. It is a
 * small, bounded structure, and a substring match on an index name we chose
 * ourselves is specific enough not to produce a false positive.
 */
export function isUniqueConstraintViolation(error: unknown, constraintName: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;

  const haystack = `${JSON.stringify(error.meta ?? {})} ${error.message}`;
  return haystack.includes(constraintName);
}

/** True for any unique-constraint violation, whatever the constraint. */
export function isAnyUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
