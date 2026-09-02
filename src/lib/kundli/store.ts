import type { KundliResult, NormalizedBirthDetails } from "@/lib/kundli/types";

export type StoredKundliCalculation = {
  id: string;
  birthProfileId: string;
  inputHash: string;
  result: KundliResult;
  createdAt: Date;
};

type StoredBirthProfile = {
  id: string;
  userId?: string;
  input: NormalizedBirthDetails;
  createdAt: Date;
};

type MemoryStore = {
  profiles: Map<string, StoredBirthProfile>;
  calculations: Map<string, StoredKundliCalculation>;
  calculationIdsByHash: Map<string, string>;
  prisma?: unknown;
};

const globalForKundli = globalThis as typeof globalThis & {
  ravishKundliStore?: MemoryStore;
};

const memoryStore: MemoryStore =
  globalForKundli.ravishKundliStore ??
  (globalForKundli.ravishKundliStore = {
    profiles: new Map(),
    calculations: new Map(),
    calculationIdsByHash: new Map(),
  });

export async function findKundliByHash(inputHash: string) {
  const prisma = await getPrisma();
  if (prisma) {
    const record = await prisma.astrologyCalculation.findFirst({
      where: {
        calculationType: "JANAM_KUNDLI",
        inputHash,
      },
    });
    return record ? mapPrismaCalculation(record) : null;
  }

  const stored = memoryStore.calculationIdsByHash.get(inputHash);
  return stored ? memoryStore.calculations.get(stored) ?? null : null;
}

export async function findKundliById(id: string) {
  const prisma = await getPrisma();
  if (prisma) {
    const record = await prisma.astrologyCalculation.findUnique({ where: { id } });
    return record ? mapPrismaCalculation(record) : null;
  }

  return memoryStore.calculations.get(id) ?? null;
}

export async function canAccessKundliResult(id: string, userId?: string) {
  const prisma = await getPrisma();
  if (prisma) {
    const calculation = await prisma.astrologyCalculation.findUnique({
      where: { id },
      include: { birthProfile: { select: { userId: true } } },
    });
    if (!calculation) return false;
    const ownerId = calculation.birthProfile?.userId;
    return !ownerId || ownerId === userId;
  }

  const calculation = await findKundliById(id);
  if (!calculation) return false;

  const profile = memoryStore.profiles.get(calculation.birthProfileId);
  if (!profile?.userId) return true;

  return profile.userId === userId;
}

export async function persistKundliCalculation({
  input,
  result,
  userId,
}: {
  input: NormalizedBirthDetails;
  result: KundliResult;
  userId?: string;
}) {
  const existing = await findKundliByHash(result.metadata.inputHash);
  if (existing) return existing;

  const prisma = await getPrisma();
  if (prisma) {
    const profile = await prisma.birthProfile.create({
      data: {
        userId,
        name: input.name,
        gender: input.gender,
        dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00.000Z`),
        timeOfBirth: input.timeOfBirth,
        timeAccuracy: input.timeAccuracy,
        placeName: input.location.displayName,
        placeOfBirth: input.location.displayName,
        city: input.location.city,
        region: input.location.region,
        country: input.location.country,
        latitude: input.location.latitude,
        longitude: input.location.longitude,
        timezone: input.location.timezone,
      },
    });
    const record = await prisma.astrologyCalculation.create({
      data: {
        birthProfileId: profile.id,
        calculationType: "JANAM_KUNDLI",
        provider: result.calculationMetadata.provider,
        providerVersion: result.calculationMetadata.providerVersion,
        calculationVersion: result.calculationMetadata.calculationVersion,
        ayanamsa: result.calculationMetadata.ayanamsa,
        houseSystem: result.calculationMetadata.houseSystem,
        calculatedAt: new Date(result.calculationMetadata.calculatedAt),
        inputHash: result.metadata.inputHash,
        input: input,
        result: result,
        status: "READY",
      },
    });
    return mapPrismaCalculation(record);
  }

  const birthProfileId = crypto.randomUUID();
  const calculationId = crypto.randomUUID();
  const createdAt = new Date();
  const profile: StoredBirthProfile = {
    id: birthProfileId,
    userId,
    input,
    createdAt,
  };
  const calculation: StoredKundliCalculation = {
    id: calculationId,
    birthProfileId,
    inputHash: result.metadata.inputHash,
    result: {
      ...result,
      metadata: {
        ...result.metadata,
        id: calculationId,
      },
    },
    createdAt,
  };

  memoryStore.profiles.set(birthProfileId, profile);
  memoryStore.calculations.set(calculationId, calculation);
  memoryStore.calculationIdsByHash.set(result.metadata.inputHash, calculationId);

  return calculation;
}

type PrismaLike = {
  astrologyCalculation: {
    findFirst(args: unknown): Promise<PrismaCalculationRecord | null>;
    findUnique(args: unknown): Promise<PrismaCalculationRecord | null>;
    create(args: unknown): Promise<PrismaCalculationRecord>;
  };
  birthProfile: {
    create(args: unknown): Promise<{ id: string }>;
  };
};

type PrismaCalculationRecord = {
  id: string;
  birthProfileId: string | null;
  birthProfile?: { userId: string | null } | null;
  inputHash: string;
  result: unknown;
  createdAt: Date;
};

async function getPrisma(): Promise<PrismaLike | null> {
  if (!process.env.DATABASE_URL) return null;
  if (memoryStore.prisma) return memoryStore.prisma as PrismaLike;

  // Prisma 7 requires an explicit driver adapter, so the shared client in
  // "@/lib/db/prisma" is the single place a PrismaClient is constructed.
  // Imported lazily so this module still works with no DATABASE_URL set.
  const { prisma } = (await import("@/lib/db/prisma")) as unknown as { prisma: PrismaLike };
  if (!prisma) {
    throw new Error("PrismaClient is unavailable. Run prisma generate before enabling DATABASE_URL-backed Kundli storage.");
  }

  memoryStore.prisma = prisma;
  return memoryStore.prisma as PrismaLike;
}

function mapPrismaCalculation(record: PrismaCalculationRecord): StoredKundliCalculation {
  const result = record.result as KundliResult;
  return {
    id: record.id,
    birthProfileId: record.birthProfileId ?? "",
    inputHash: record.inputHash,
    result: {
      ...result,
      metadata: {
        ...result.metadata,
        id: record.id,
      },
    },
    createdAt: record.createdAt,
  };
}
