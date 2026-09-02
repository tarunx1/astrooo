import "server-only";

import { prisma } from "@/lib/db/prisma";

export type ReportDefinitionSummary = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  priceMinor: number;
  currency: string;
  estimatedPages: number;
  sectionsIncluded: string[];
  requiredInputs: string[];
  isActive: boolean;
  sortOrder: number;
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function mapDefinition(row: {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  priceMinor: number;
  currency: string;
  estimatedPages: number;
  sectionsIncluded: unknown;
  requiredInputs: unknown;
  isActive: boolean;
  sortOrder: number;
}): ReportDefinitionSummary {
  return {
    ...row,
    sectionsIncluded: asStringArray(row.sectionsIncluded),
    requiredInputs: asStringArray(row.requiredInputs),
  };
}

export function formatMoneyMinor(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

export async function listActiveReportDefinitions(): Promise<ReportDefinitionSummary[]> {
  const rows = await prisma.reportDefinition.findMany({
    where: { isActive: true },
    select: {
      id: true,
      slug: true,
      name: true,
      shortDescription: true,
      description: true,
      priceMinor: true,
      currency: true,
      estimatedPages: true,
      sectionsIncluded: true,
      requiredInputs: true,
      isActive: true,
      sortOrder: true,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return rows.map(mapDefinition);
}

export async function getActiveReportDefinitionBySlug(slug: string): Promise<ReportDefinitionSummary | null> {
  const row = await prisma.reportDefinition.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      slug: true,
      name: true,
      shortDescription: true,
      description: true,
      priceMinor: true,
      currency: true,
      estimatedPages: true,
      sectionsIncluded: true,
      requiredInputs: true,
      isActive: true,
      sortOrder: true,
    },
  });

  return row ? mapDefinition(row) : null;
}

export async function listReportSlugs(): Promise<string[]> {
  const rows = await prisma.reportDefinition.findMany({
    where: { isActive: true },
    select: { slug: true },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((row) => row.slug);
}
