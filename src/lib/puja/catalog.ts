import "server-only";

import { PujaMode, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

/**
 * Puja catalogue reads.
 *
 * Every public query filters on `active`, so an unpublished ritual is invisible
 * to customers by construction rather than by each page remembering to check.
 *
 * Samagri and vidhi are structured rather than prose embedded in a component:
 * an operator editing the ritual steps should not need a deploy, and a list of
 * materials should be renderable as a list rather than as a paragraph somebody
 * formatted by hand.
 */
export const samagriItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.string().trim().max(60).nullable().optional(),
  /** True when the customer must supply it rather than the practitioner. */
  providedByCustomer: z.boolean().default(false),
});

export const vidhiStepSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(600).nullable().optional(),
});

export type SamagriItem = z.infer<typeof samagriItemSchema>;
export type VidhiStep = z.infer<typeof vidhiStepSchema>;

/**
 * Parses stored structured content.
 *
 * A row written before a field existed, or by an older shape, renders as a gap
 * rather than throwing - the catalogue has to keep working while its shape
 * evolves.
 */
export function parseSamagri(value: Prisma.JsonValue | null): SamagriItem[] {
  const parsed = z.array(samagriItemSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function parseVidhi(value: Prisma.JsonValue | null): VidhiStep[] {
  const parsed = z.array(vidhiStepSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export type PujaCardData = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  purpose: string | null;
  pricePaise: number;
  currency: string;
  imageUrl: string | null;
  durationMinutes: number | null;
  modes: PujaMode[];
};

const CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  shortDescription: true,
  description: true,
  purpose: true,
  pricePaise: true,
  currency: true,
  imageUrls: true,
  durationMinutes: true,
  modes: true,
} satisfies Prisma.PujaSelect;

function toCard(row: Prisma.PujaGetPayload<{ select: typeof CARD_SELECT }>): PujaCardData {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    // Falls back to a trimmed description rather than showing an empty card for
    // a ritual entered before the short form existed.
    shortDescription: row.shortDescription || `${row.description.slice(0, 140)}…`,
    purpose: row.purpose,
    pricePaise: row.pricePaise,
    currency: row.currency,
    imageUrl: row.imageUrls[0] ?? null,
    durationMinutes: row.durationMinutes,
    modes: row.modes,
  };
}

export async function listPujas(input?: { limit?: number }): Promise<PujaCardData[]> {
  const rows = await prisma.puja.findMany({
    where: { active: true },
    select: CARD_SELECT,
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    take: input?.limit ?? 60,
  });

  return rows.map(toCard);
}

export type PujaDetailData = PujaCardData & {
  description: string;
  benefits: string[];
  requirements: string[];
  samagri: SamagriItem[];
  vidhi: VidhiStep[];
  images: string[];
};

/** One published ritual, by slug. Returns null for an inactive one. */
export async function getPuja(slug: string): Promise<PujaDetailData | null> {
  const row = await prisma.puja.findFirst({
    where: { slug, active: true },
    select: {
      ...CARD_SELECT,
      benefits: true,
      requirements: true,
      samagri: true,
      vidhi: true,
    },
  });

  if (!row) return null;

  return {
    ...toCard(row),
    description: row.description,
    benefits: row.benefits,
    requirements: row.requirements,
    samagri: parseSamagri(row.samagri),
    vidhi: parseVidhi(row.vidhi),
    images: row.imageUrls,
  };
}

/** Resolves a ritual for booking. Re-checks `active` rather than trusting the page. */
export async function getBookablePuja(slug: string): Promise<{
  id: string;
  title: string;
  pricePaise: number;
  currency: string;
  modes: PujaMode[];
} | null> {
  return prisma.puja.findFirst({
    where: { slug, active: true },
    select: { id: true, title: true, pricePaise: true, currency: true, modes: true },
  });
}

export const PUJA_MODE_LABEL: Record<PujaMode, string> = {
  [PujaMode.ONLINE]: "Online, streamed to you",
  [PujaMode.IN_PERSON]: "At your home",
  [PujaMode.TEMPLE]: "At a temple on your behalf",
};
