import { PrismaClient, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Admin bootstrap.
 *
 * The only way to create the first admin. Run from a trusted shell with
 * database access:
 *
 *   ADMIN_EMAIL=someone@example.com pnpm admin:promote
 *
 * Deliberately not automatic: no email is hard-coded in application code, the
 * first registered user is not promoted, and no browser request can assign a
 * role. Once one admin exists, further role changes go through the audited
 * admin UI.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL must be set.");

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
if (!email) {
  throw new Error("ADMIN_EMAIL must be set, e.g. ADMIN_EMAIL=you@example.com pnpm admin:promote");
}

const role = process.env.ADMIN_ROLE === "SUPER_ADMIN" ? UserRole.SUPER_ADMIN : UserRole.ADMIN;

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, role: true } });

  if (!user) {
    throw new Error(`No user with email ${email}. Ask them to sign in once first, then re-run.`);
  }

  if (user.role === role) {
    console.info(`${email} is already ${role}. Nothing to do.`);
    return;
  }

  const previousRole = user.role;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { role } });

    // The bootstrap is audited too, with the promoted user recorded as actor
    // because no admin exists yet to attribute it to.
    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "USER_ROLE_CHANGED",
        entityType: "User",
        entityId: user.id,
        metadata: { from: previousRole, to: role, via: "bootstrap-script" },
      },
    });
  });

  console.info(`Promoted ${email} from ${previousRole} to ${role}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
