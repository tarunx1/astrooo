import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  createBirthProfile,
  deleteOwnedBirthProfile,
  getOwnedBirthProfile,
  listBirthProfiles,
  updateOwnedBirthProfile,
} from "@/lib/account/birth-profiles";
import {
  isKundliSavedByUser,
  listSavedKundlis,
  removeSavedKundli,
  saveKundliToAccount,
} from "@/lib/account/saved-kundlis";
import { DevelopmentAstrologyProvider } from "@/lib/astrology/provider";
import { normalizeBirthDetails } from "@/lib/kundli/normalize";
import type { NormalizedBirthDetails } from "@/lib/kundli/types";

/**
 * Cross-user authorization.
 *
 * These exercise the real Postgres schema. They are the evidence behind any
 * claim that account data is isolated: every one asserts that user B cannot
 * read, edit, delete or unsave anything belonging to user A.
 */
const RUN_ID = `t${Date.now().toString(36)}`;

function details(overrides: Partial<Parameters<typeof normalizeBirthDetails>[0]> = {}): NormalizedBirthDetails {
  return normalizeBirthDetails({
    name: "Tarun Sharma",
    dateOfBirth: "1992-08-14",
    timeOfBirth: "06:35",
    timeAccuracy: "EXACT",
    placeId: "dev:amritsar-in",
    displayName: "Amritsar, Punjab, India",
    city: "Amritsar",
    region: "Punjab",
    country: "India",
    latitude: 31.634,
    longitude: 74.8723,
    timezone: "Asia/Kolkata",
    ...overrides,
  });
}

async function createUser(label: string) {
  return prisma.user.create({
    data: { name: `User ${label}`, email: `${RUN_ID}.${label}@example.test`, emailVerified: true },
    select: { id: true },
  });
}

let userA: { id: string };
let userB: { id: string };
let calculationId: string;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set for account authorization tests.");
  }

  userA = await createUser("a");
  userB = await createUser("b");

  // An anonymous calculation, exactly as the free Kundli flow produces.
  const input = details();
  const result = await new DevelopmentAstrologyProvider().calculateKundli(input);
  const calculation = await prisma.astrologyCalculation.create({
    data: {
      calculationType: "JANAM_KUNDLI",
      provider: result.calculationMetadata.provider,
      providerVersion: result.calculationMetadata.providerVersion,
      calculationVersion: result.calculationMetadata.calculationVersion,
      ayanamsa: result.calculationMetadata.ayanamsa,
      houseSystem: result.calculationMetadata.houseSystem,
      calculatedAt: new Date(result.calculationMetadata.calculatedAt),
      inputHash: `${RUN_ID}-${result.metadata.inputHash}`,
      input: input as unknown as object,
      result: result as unknown as object,
      status: "READY",
    },
    select: { id: true },
  });
  calculationId = calculation.id;
});

afterAll(async () => {
  await prisma.savedKundli.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
  await prisma.astrologyCalculation.deleteMany({ where: { inputHash: { startsWith: RUN_ID } } });
  await prisma.birthProfile.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  await prisma.$disconnect();
});

describe("birth profile ownership", () => {
  it("lets a user read only their own profile", async () => {
    const profileId = await createBirthProfile(userA.id, details());

    await expect(getOwnedBirthProfile(userA.id, profileId)).resolves.toMatchObject({ id: profileId });
    await expect(getOwnedBirthProfile(userB.id, profileId)).resolves.toBeNull();
  });

  it("does not list another user's profiles", async () => {
    const profileId = await createBirthProfile(userA.id, details({ name: "Listed Only For A" }));

    const forA = await listBirthProfiles(userA.id);
    const forB = await listBirthProfiles(userB.id);

    expect(forA.map((profile) => profile.id)).toContain(profileId);
    expect(forB.map((profile) => profile.id)).not.toContain(profileId);
  });

  it("refuses an edit by a non-owner and leaves the record untouched", async () => {
    const profileId = await createBirthProfile(userA.id, details({ name: "Original Name" }));

    const updated = await updateOwnedBirthProfile(userB.id, profileId, details({ name: "Hijacked Name" }));
    expect(updated).toBe(false);

    const stillOwned = await getOwnedBirthProfile(userA.id, profileId);
    expect(stillOwned?.name).toBe("Original Name");
  });

  it("refuses a delete by a non-owner and leaves the record present", async () => {
    const profileId = await createBirthProfile(userA.id, details({ name: "Keep Me" }));

    const deleted = await deleteOwnedBirthProfile(userB.id, profileId);
    expect(deleted).toBe(false);

    await expect(getOwnedBirthProfile(userA.id, profileId)).resolves.not.toBeNull();
  });

  it("allows the owner to edit and delete", async () => {
    const profileId = await createBirthProfile(userA.id, details({ name: "Owner Edits" }));

    expect(await updateOwnedBirthProfile(userA.id, profileId, details({ name: "Edited By Owner" }))).toBe(true);
    expect((await getOwnedBirthProfile(userA.id, profileId))?.name).toBe("Edited By Owner");

    expect(await deleteOwnedBirthProfile(userA.id, profileId)).toBe(true);
    await expect(getOwnedBirthProfile(userA.id, profileId)).resolves.toBeNull();
  });

  it("keeps an anonymous profile out of every user's list", async () => {
    const anonymous = await prisma.birthProfile.create({
      data: {
        userId: null,
        name: "Anonymous Visitor",
        dateOfBirth: new Date("1992-08-14T00:00:00.000Z"),
        timeOfBirth: "06:35",
        timeAccuracy: "EXACT",
        placeName: "Amritsar, Punjab, India",
        placeOfBirth: "Amritsar, Punjab, India",
        city: "Amritsar",
        country: "India",
        latitude: 31.634,
        longitude: 74.8723,
        timezone: "Asia/Kolkata",
      },
      select: { id: true },
    });

    const forA = await listBirthProfiles(userA.id);
    expect(forA.map((profile) => profile.id)).not.toContain(anonymous.id);

    await prisma.birthProfile.delete({ where: { id: anonymous.id } });
  });
});

describe("saved Kundli ownership", () => {
  it("gives each saving user their own profile copy and never re-points another user's", async () => {
    const savedByA = await saveKundliToAccount(userA.id, calculationId);
    const savedByB = await saveKundliToAccount(userB.id, calculationId);

    expect(savedByA.ok).toBe(true);
    expect(savedByB.ok).toBe(true);
    if (!savedByA.ok || !savedByB.ok) return;

    // Same shared calculation, two independent profiles.
    expect(savedByA.profileId).not.toBe(savedByB.profileId);

    const profileOfA = await getOwnedBirthProfile(userA.id, savedByA.profileId);
    const profileOfB = await getOwnedBirthProfile(userB.id, savedByB.profileId);
    expect(profileOfA).not.toBeNull();
    expect(profileOfB).not.toBeNull();

    // Neither can reach the other's copy.
    await expect(getOwnedBirthProfile(userB.id, savedByA.profileId)).resolves.toBeNull();
    await expect(getOwnedBirthProfile(userA.id, savedByB.profileId)).resolves.toBeNull();
  });

  it("is idempotent for the same user", async () => {
    const first = await saveKundliToAccount(userA.id, calculationId);
    const second = await saveKundliToAccount(userA.id, calculationId);

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.alreadySaved).toBe(true);
    expect(second.profileId).toBe(first.profileId);
  });

  it("reports saved state per user", async () => {
    await saveKundliToAccount(userA.id, calculationId);

    expect(await isKundliSavedByUser(userA.id, calculationId)).toBe(true);

    const untouched = await createUser("c");
    expect(await isKundliSavedByUser(untouched.id, calculationId)).toBe(false);
    await prisma.user.delete({ where: { id: untouched.id } });
  });

  it("does not let one user unsave another user's Kundli", async () => {
    await saveKundliToAccount(userA.id, calculationId);
    const [savedForA] = await listSavedKundlis(userA.id);
    expect(savedForA).toBeDefined();

    expect(await removeSavedKundli(userB.id, savedForA.id)).toBe(false);

    const stillThere = await listSavedKundlis(userA.id);
    expect(stillThere.map((entry) => entry.id)).toContain(savedForA.id);
  });

  it("returns not_found for a calculation that does not exist", async () => {
    const outcome = await saveKundliToAccount(userA.id, "00000000-0000-4000-8000-000000000000");
    expect(outcome).toEqual({ ok: false, reason: "not_found" });
  });

  it("projects summary fields without loading the full chart payload", async () => {
    await saveKundliToAccount(userA.id, calculationId);
    const [entry] = await listSavedKundlis(userA.id);

    expect(entry).toBeDefined();
    expect(entry.profileName).toBeTruthy();
    expect(entry.placeName).toBeTruthy();
    expect(entry).not.toHaveProperty("result");
    expect(entry).not.toHaveProperty("planets");
  });
});
