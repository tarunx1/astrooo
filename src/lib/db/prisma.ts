import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/**
 * Shared Prisma client.
 *
 * Prisma 7 requires an explicit driver adapter, so the connection string is
 * bound here once and reused. A single instance is cached on globalThis in
 * development so hot reloads do not open a new pool per reload.
 */
const globalForPrisma = globalThis as typeof globalThis & {
  ravishPrisma?: PrismaClient;
};

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set to use the database.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.ravishPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.ravishPrisma = prisma;
}
