import type { Metadata } from "next";
import { brand } from "@/config/brand";

type MetadataInput = {
  title?: string;
  description?: string;
  path?: string;
};

export function canonicalUrl(path = "/") {
  return new URL(path, brand.url).toString();
}

export function createPageMetadata({ title, description, path = "/" }: MetadataInput = {}): Metadata {
  const resolvedTitle = title ?? brand.seo.defaultTitle;
  const resolvedDescription = description ?? brand.seo.defaultDescription;
  const canonical = canonicalUrl(path);

  return {
    title: resolvedTitle,
    description: resolvedDescription,
    alternates: {
      canonical,
    },
    openGraph: {
      title: resolvedTitle,
      description: resolvedDescription,
      url: canonical,
      siteName: brand.name,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description: resolvedDescription,
    },
  };
}
