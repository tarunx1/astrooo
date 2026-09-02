import { z } from "zod";

/**
 * Typed product attributes.
 *
 * Category-specific facts live in `Product.attributes` as JSON, but they are
 * never read as loose JSON in a component. Each category declares a schema here,
 * so a gemstone page renders a parsed, validated `GemstoneAttributes` rather
 * than poking at arbitrary keys.
 *
 * The distinction that matters commercially: `specifications` are verifiable
 * physical facts about the item, while `traditionalUse` is astrological
 * association. They are modelled separately so the UI can never present a
 * traditional belief as a measured property.
 */
export const CERTIFICATION_LABS = ["IGI", "GIA", "GII", "SGL", "Other"] as const;

export const gemstoneAttributesSchema = z.object({
  kind: z.literal("GEMSTONE"),
  gemstoneType: z.string().trim().min(2).max(60),
  carat: z.number().positive().max(500),
  weightGrams: z.number().positive().max(1000).optional(),
  origin: z.string().trim().min(2).max(80),
  treatment: z.string().trim().min(2).max(120),
  color: z.string().trim().min(2).max(60),
  clarity: z.string().trim().min(1).max(60).optional(),
  cut: z.string().trim().min(2).max(60).optional(),
  dimensionsMm: z.string().trim().min(2).max(60).optional(),
  certified: z.boolean(),
  certificationLab: z.enum(CERTIFICATION_LABS).optional(),
  certificateNumber: z.string().trim().min(2).max(60).optional(),
  /** Traditional association. Never presented as a proven effect. */
  traditionalPlanet: z.string().trim().min(2).max(40).optional(),
  careInstructions: z.string().trim().max(600).optional(),
});

export const rudrakshaAttributesSchema = z.object({
  kind: z.literal("RUDRAKSHA"),
  mukhi: z.number().int().min(1).max(21),
  origin: z.enum(["Nepal", "Java", "India", "Other"]),
  sizeMm: z.number().positive().max(60),
  beadCount: z.number().int().positive().max(1008).optional(),
  certified: z.boolean(),
  certificationLab: z.enum(CERTIFICATION_LABS).optional(),
  certificateNumber: z.string().trim().min(2).max(60).optional(),
  stringing: z.string().trim().max(80).optional(),
  traditionalPlanet: z.string().trim().min(2).max(40).optional(),
  careInstructions: z.string().trim().max(600).optional(),
});

export const crystalAttributesSchema = z.object({
  kind: z.literal("CRYSTAL"),
  crystalType: z.string().trim().min(2).max(60),
  form: z.string().trim().min(2).max(60),
  weightGrams: z.number().positive().max(20_000).optional(),
  dimensionsMm: z.string().trim().min(2).max(60).optional(),
  origin: z.string().trim().min(2).max(80).optional(),
  careInstructions: z.string().trim().max(600).optional(),
});

export const braceletAttributesSchema = z.object({
  kind: z.literal("BRACELET"),
  material: z.string().trim().min(2).max(80),
  beadSizeMm: z.number().positive().max(40).optional(),
  lengthMm: z.number().positive().max(400).optional(),
  claspType: z.string().trim().max(60).optional(),
  careInstructions: z.string().trim().max(600).optional(),
});

export const yantraAttributesSchema = z.object({
  kind: z.literal("YANTRA"),
  yantraType: z.string().trim().min(2).max(80),
  metal: z.string().trim().min(2).max(60),
  dimensionsMm: z.string().trim().min(2).max(60).optional(),
  energised: z.boolean().optional(),
  careInstructions: z.string().trim().max(600).optional(),
});

export const genericAttributesSchema = z.object({
  kind: z.literal("GENERIC"),
  material: z.string().trim().max(80).optional(),
  dimensionsMm: z.string().trim().max(60).optional(),
  careInstructions: z.string().trim().max(600).optional(),
});

export const productAttributesSchema = z.discriminatedUnion("kind", [
  gemstoneAttributesSchema,
  rudrakshaAttributesSchema,
  crystalAttributesSchema,
  braceletAttributesSchema,
  yantraAttributesSchema,
  genericAttributesSchema,
]);

export type GemstoneAttributes = z.infer<typeof gemstoneAttributesSchema>;
export type RudrakshaAttributes = z.infer<typeof rudrakshaAttributesSchema>;
export type ProductAttributes = z.infer<typeof productAttributesSchema>;

/** Unknown or malformed attributes degrade to GENERIC rather than throwing. */
export function parseProductAttributes(value: unknown): ProductAttributes {
  const parsed = productAttributesSchema.safeParse(value);
  return parsed.success ? parsed.data : { kind: "GENERIC" };
}

export type Specification = { label: string; value: string };

/**
 * Verifiable physical specifications only.
 *
 * Traditional astrological associations are deliberately excluded here and
 * surfaced separately, so a spec table never mixes measurement with belief.
 */
export function toSpecifications(attributes: ProductAttributes): Specification[] {
  switch (attributes.kind) {
    case "GEMSTONE": {
      const specs: Specification[] = [
        { label: "Stone", value: attributes.gemstoneType },
        { label: "Weight", value: `${attributes.carat} carat` },
        { label: "Origin", value: attributes.origin },
        { label: "Treatment", value: attributes.treatment },
        { label: "Colour", value: attributes.color },
      ];
      if (attributes.clarity) specs.push({ label: "Clarity", value: attributes.clarity });
      if (attributes.cut) specs.push({ label: "Cut", value: attributes.cut });
      if (attributes.dimensionsMm) specs.push({ label: "Dimensions", value: `${attributes.dimensionsMm} mm` });
      if (attributes.weightGrams) specs.push({ label: "Weight (grams)", value: `${attributes.weightGrams} g` });
      return specs;
    }
    case "RUDRAKSHA": {
      const specs: Specification[] = [
        { label: "Mukhi (faces)", value: String(attributes.mukhi) },
        { label: "Origin", value: attributes.origin },
        { label: "Bead size", value: `${attributes.sizeMm} mm` },
      ];
      if (attributes.beadCount) specs.push({ label: "Beads", value: String(attributes.beadCount) });
      if (attributes.stringing) specs.push({ label: "Stringing", value: attributes.stringing });
      return specs;
    }
    case "CRYSTAL": {
      const specs: Specification[] = [
        { label: "Crystal", value: attributes.crystalType },
        { label: "Form", value: attributes.form },
      ];
      if (attributes.weightGrams) specs.push({ label: "Weight", value: `${attributes.weightGrams} g` });
      if (attributes.dimensionsMm) specs.push({ label: "Dimensions", value: `${attributes.dimensionsMm} mm` });
      if (attributes.origin) specs.push({ label: "Origin", value: attributes.origin });
      return specs;
    }
    case "BRACELET": {
      const specs: Specification[] = [{ label: "Material", value: attributes.material }];
      if (attributes.beadSizeMm) specs.push({ label: "Bead size", value: `${attributes.beadSizeMm} mm` });
      if (attributes.lengthMm) specs.push({ label: "Length", value: `${attributes.lengthMm} mm` });
      if (attributes.claspType) specs.push({ label: "Clasp", value: attributes.claspType });
      return specs;
    }
    case "YANTRA": {
      const specs: Specification[] = [
        { label: "Yantra", value: attributes.yantraType },
        { label: "Metal", value: attributes.metal },
      ];
      if (attributes.dimensionsMm) specs.push({ label: "Dimensions", value: `${attributes.dimensionsMm} mm` });
      return specs;
    }
    default: {
      const specs: Specification[] = [];
      if (attributes.material) specs.push({ label: "Material", value: attributes.material });
      if (attributes.dimensionsMm) specs.push({ label: "Dimensions", value: `${attributes.dimensionsMm} mm` });
      return specs;
    }
  }
}

export type Certification = {
  certified: boolean;
  lab?: string;
  certificateNumber?: string;
};

export function toCertification(attributes: ProductAttributes): Certification | null {
  if (attributes.kind === "GEMSTONE" || attributes.kind === "RUDRAKSHA") {
    return {
      certified: attributes.certified,
      lab: attributes.certificationLab,
      certificateNumber: attributes.certificateNumber,
    };
  }
  return null;
}

/** The traditional association, if any. Always rendered with a caveat. */
export function toTraditionalUse(attributes: ProductAttributes): string | null {
  if ("traditionalPlanet" in attributes && attributes.traditionalPlanet) {
    return attributes.traditionalPlanet;
  }
  return null;
}

export function toCareInstructions(attributes: ProductAttributes): string | null {
  return "careInstructions" in attributes && attributes.careInstructions ? attributes.careInstructions : null;
}
