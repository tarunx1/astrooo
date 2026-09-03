import { CalendarDays, Compass, Hash, Moon, Sparkles, Star, Sunrise, Users } from "lucide-react";

/**
 * The public tool catalogue.
 *
 * One source of truth for the hub, the sitemap and internal linking, so a tool
 * can never appear in one place and be missing from another.
 */
export type ToolEntry = {
  slug: string;
  href: string;
  title: string;
  shortDescription: string;
  icon: typeof Moon;
  /** Only listed tools are indexable and appear in the sitemap. */
  isPublic: boolean;
};

export const ASTROLOGY_TOOLS: readonly ToolEntry[] = [
  {
    slug: "kundli-matching",
    href: "/kundli-matching",
    title: "Kundli Matching",
    shortDescription: "Traditional Ashtakoota compatibility for two birth charts.",
    icon: Users,
    isPublic: true,
  },
  {
    slug: "panchang",
    href: "/panchang",
    title: "Panchang",
    shortDescription: "Tithi, Nakshatra, Yoga, Karana and sunrise for any date and place.",
    icon: Sunrise,
    isPublic: true,
  },
  {
    slug: "moon-sign",
    href: "/calculators/moon-sign",
    title: "Moon Sign Calculator",
    shortDescription: "Find your Chandra Rashi and birth Nakshatra.",
    icon: Moon,
    isPublic: true,
  },
  {
    slug: "nakshatra",
    href: "/calculators/nakshatra",
    title: "Nakshatra Calculator",
    shortDescription: "Your birth star, its pada and its traditional ruler.",
    icon: Star,
    isPublic: true,
  },
  {
    slug: "lagna",
    href: "/calculators/lagna",
    title: "Lagna Calculator",
    shortDescription: "Your rising sign and its exact degree.",
    icon: Compass,
    isPublic: true,
  },
  {
    slug: "sade-sati",
    href: "/calculators/sade-sati",
    title: "Sade Sati Calculator",
    shortDescription: "Whether Saturn is currently transiting your Moon sign.",
    icon: Sparkles,
    isPublic: true,
  },
  {
    slug: "numerology",
    href: "/calculators/numerology",
    title: "Numerology Calculator",
    shortDescription: "Life Path and Birth Number from the Chaldean system.",
    icon: Hash,
    isPublic: true,
  },
  {
    slug: "horoscope",
    href: "/horoscope",
    title: "Horoscope",
    shortDescription: "Zodiac sign guides and how transits are read.",
    icon: CalendarDays,
    isPublic: true,
  },
] as const;

export const CALCULATOR_HUB_TOOLS = ASTROLOGY_TOOLS.filter((tool) => tool.href.startsWith("/calculators/"));

export const PUBLIC_TOOL_PATHS = ASTROLOGY_TOOLS.filter((tool) => tool.isPublic).map((tool) => tool.href);
