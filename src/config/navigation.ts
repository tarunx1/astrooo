import {
  BookOpen,
  Gem,
  HeartHandshake,
  LayoutGrid,
  MoonStar,
  ScrollText,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

/**
 * Global navigation.
 *
 * `planned: true` marks a destination that does not exist yet. Those entries
 * render as disabled rather than linking to a 404 — the information
 * architecture is preserved without shipping a dead link. Remove the flag when
 * the route ships.
 */
export const navigation = [
  {
    label: "Astrology",
    href: "/kundli",
    icon: MoonStar,
    items: [
      { label: "Kundli", href: "/kundli", description: "Birth chart and planetary placements" },
      { label: "Kundli Matching", href: "/kundli-matching", description: "Compatibility with Guna Milan" },
      { label: "Panchang", href: "/panchang", description: "Daily tithi, nakshatra, yoga and muhurat" },
      { label: "Horoscope", href: "/horoscope", description: "Daily, weekly, monthly and yearly forecasts" },
      { label: "Transits", href: "/transits", description: "Planet movement and timing windows" },
      { label: "Numerology", href: "/calculators/numerology", description: "Numbers, names and life patterns" },
    ],
  },
  {
    label: "Free Tools",
    href: "/calculators",
    icon: LayoutGrid,
    items: [
      { label: "Calculator Directory", href: "/calculators", description: "All free astrology tools" },
      { label: "Moon Sign", href: "/calculators/moon-sign", description: "Discover your Chandra Rashi" },
      { label: "Nakshatra", href: "/calculators/nakshatra", description: "Find your birth star" },
      { label: "Lagna", href: "/calculators/lagna", description: "Know your ascendant" },
      { label: "Sade Sati", href: "/calculators/sade-sati", description: "Saturn period insights" },
      { label: "Compatibility", href: "/kundli-matching", description: "Relationship compatibility score" },
    ],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: ScrollText,
    items: [
      { label: "Complete Life Report", href: "/reports/complete-life", description: "Career, love, health and timing" },
      { label: "Career", href: "/reports/career", description: "Work, business and growth timing" },
      { label: "Love & Marriage", href: "/reports/love-marriage", description: "Relationship patterns and remedies" },
      { label: "Finance", href: "/reports/finance", description: "Wealth potential and caution periods" },
      { label: "Year Forecast", href: "/reports/year-forecast", description: "A focused 12-month guide" },
      { label: "Numerology", href: "/reports/numerology", description: "Name and number interpretation", planned: true },
    ],
  },
  {
    label: "Consult",
    href: "/consultations",
    icon: HeartHandshake,
    items: [
      { label: "Astrologers", href: "/consultations", description: "Verified experts for life questions" },
      {
        label: "My Consultations",
        href: "/account/consultations",
        description: "Your upcoming and past sessions",
      },
    ],
  },
  {
    label: "Shop",
    href: "/shop",
    icon: ShoppingBag,
    items: [
      { label: "Gemstones", href: "/shop/gemstones", description: "Certified gemstone catalogue" },
      { label: "Rudraksha", href: "/shop/rudraksha", description: "Traditional spiritual beads" },
      { label: "Bracelets", href: "/shop/bracelets", description: "Energized everyday wear" },
      { label: "Crystals", href: "/shop/crystals", description: "Curated crystals and trees" },
      { label: "Yantras", href: "/shop/yantras", description: "Sacred geometry objects" },
    ],
  },
  {
    label: "Puja",
    href: "/puja",
    icon: Sparkles,
    items: [
      { label: "Online Puja", href: "/puja", description: "Book rituals with transparent details" },
      { label: "My Pujas", href: "/account/puja", description: "Rituals you have booked" },
    ],
  },
  {
    label: "Learn",
    href: "/articles",
    icon: BookOpen,
    items: [
      { label: "Articles", href: "/articles", description: "Practical Vedic astrology guides" },
      { label: "Courses", href: "/courses", description: "Guided astrology learning", planned: true },
    ],
  },
  {
    label: "Store Trust",
    href: "/shop/gemstones",
    icon: Gem,
    utilityOnly: true,
    items: [],
  },
] as const;

export const utilityNavigation = [
  { label: "Search", href: "/search" },
  { label: "Account", href: "/account" },
  { label: "Wishlist", href: "/account/wishlist" },
  { label: "Cart", href: "/cart" },
] as const;
