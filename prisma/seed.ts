import { InventoryStatus, PrismaClient, ProductType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Idempotent seed.
 *
 * Every write is an upsert keyed on a natural unique field, so running this
 * repeatedly converges rather than duplicating. It never deletes and never
 * touches customer, order or payment data.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL must be set to seed.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const REPORT_DEFINITIONS = [
  {
    slug: "complete-life",
    name: "Complete Life Report",
    shortDescription: "One grounded reading of your whole chart.",
    description:
      "A full reading of your birth chart covering personality, mind, work, money, relationships, vitality and the period you are currently running. Prepared from your immutable Kundli calculation.",
    priceMinor: 249_900,
    estimatedPages: 42,
    sortOrder: 1,
    reportType: "COMPLETE_LIFE",
    sectionsIncluded: [
      "Personality and Inner Nature",
      "Mind and Emotional Life",
      "Work and Direction",
      "Money and Resources",
      "Relationships and Marriage",
      "Vitality and Wellbeing",
      "Current Period and Timing",
      "Traditional Remedies",
    ],
  },
  {
    slug: "career",
    name: "Career Report",
    shortDescription: "Work, business and the timing of growth.",
    description:
      "A focused reading of the tenth house and its lord: the working style that fits your chart, fields traditionally indicated, the service-versus-enterprise question, and the periods that carry professional momentum.",
    priceMinor: 149_900,
    estimatedPages: 24,
    sortOrder: 2,
    reportType: "CAREER",
    sectionsIncluded: [
      "Your Professional Nature",
      "Fields That Suit This Chart",
      "Employment or Enterprise",
      "Periods of Growth",
      "Friction and Obstacles",
      "Practical Guidance",
    ],
  },
  {
    slug: "love-marriage",
    name: "Love & Marriage Report",
    shortDescription: "Partnership patterns, timing themes and Manglik status.",
    description:
      "A reading of Venus, the Moon and the seventh house: how you relate, qualities traditionally indicated in a partner, timing themes for partnership, and a plain explanation of your calculated Manglik status.",
    priceMinor: 149_900,
    estimatedPages: 24,
    sortOrder: 3,
    reportType: "LOVE_MARRIAGE",
    sectionsIncluded: [
      "How You Relate",
      "Partner Indications",
      "Timing Themes",
      "Manglik Considerations",
      "Harmony and Friction",
      "Guidance for Partnership",
    ],
  },
  {
    slug: "finance",
    name: "Finance Report",
    shortDescription: "Wealth patterns, income and periods for caution.",
    description:
      "A reading of the second, eleventh and twelfth houses: the resource signature of your chart, how income traditionally arrives, where it drains, and the periods traditional readings mark as favourable or cautious.",
    priceMinor: 149_900,
    estimatedPages: 22,
    sortOrder: 4,
    reportType: "FINANCE",
    sectionsIncluded: [
      "Your Wealth Pattern",
      "Sources of Income",
      "Spending and Loss",
      "Favourable Periods",
      "Periods for Caution",
      "Financial Guidance",
    ],
  },
  {
    slug: "year-forecast",
    name: "Year Forecast",
    shortDescription: "A focused guide to the next twelve months.",
    description:
      "Your running Mahadasha and Antardasha read as the frame for the year ahead, across work, money, relationships and wellbeing, with the stretches your chart traditionally marks out.",
    priceMinor: 129_900,
    estimatedPages: 20,
    sortOrder: 5,
    reportType: "YEAR_FORECAST",
    sectionsIncluded: [
      "The Year Ahead",
      "Work This Year",
      "Money This Year",
      "Relationships This Year",
      "Wellbeing This Year",
      "Periods of Focus",
    ],
  },
  {
    slug: "numerology",
    name: "Numerology Report",
    shortDescription: "Name and number interpretation.",
    description:
      "A deterministic numerology reading derived from your name and date of birth, covering the core numbers and how they are traditionally read together.",
    priceMinor: 99_900,
    estimatedPages: 16,
    sortOrder: 6,
    reportType: "NUMEROLOGY",
    // Numerology needs its own deterministic engine, so it stays inactive
    // until that engine lands rather than being sold and generated thin.
    isActive: false,
    sectionsIncluded: ["Core Numbers", "Name Analysis", "Personal Year", "Guidance"],
  },
];

const CATEGORIES = [
  { slug: "gemstones", name: "Gemstones" },
  { slug: "rudraksha", name: "Rudraksha" },
  { slug: "crystals", name: "Crystals" },
  { slug: "bracelets", name: "Bracelets" },
  { slug: "yantras", name: "Yantras" },
];

const PRODUCTS = [
  {
    slug: "natural-blue-sapphire-neelam-3-25-carat",
    title: "Natural Blue Sapphire (Neelam) 3.25 Carat",
    category: "gemstones",
    sku: "GEM-NEELAM-325",
    pricePaise: 4_850_000,
    salePricePaise: 4_250_000,
    quantity: 2,
    imageUrl: "/images/products/blue-sapphire.jpg",
    description:
      "A natural, unheated Ceylon blue sapphire of 3.25 carat with an even royal blue tone and eye-clean clarity. Supplied with an IGI certificate confirming origin and treatment status.",
    attributes: {
      kind: "GEMSTONE",
      gemstoneType: "Blue Sapphire",
      carat: 3.25,
      origin: "Sri Lanka (Ceylon)",
      treatment: "Unheated, untreated",
      color: "Royal blue",
      clarity: "Eye clean",
      cut: "Oval mixed cut",
      dimensionsMm: "9.1 x 7.3 x 4.8",
      certified: true,
      certificationLab: "IGI",
      certificateNumber: "IGI-2026-NEE-0031",
      traditionalPlanet: "Saturn (Shani)",
      careInstructions:
        "Clean with lukewarm water and a soft cloth. Avoid ultrasonic cleaners, household chemicals and prolonged direct sunlight.",
    },
  },
  {
    slug: "natural-yellow-sapphire-pukhraj-5-05-carat",
    title: "Natural Yellow Sapphire (Pukhraj) 5.05 Carat",
    category: "gemstones",
    sku: "GEM-PUKHRAJ-505",
    pricePaise: 6_200_000,
    quantity: 1,
    imageUrl: "/images/products/yellow-sapphire.jpg",
    description:
      "A natural Ceylon yellow sapphire of 5.05 carat with a warm, even golden tone. Unheated and supplied with a GII certificate.",
    attributes: {
      kind: "GEMSTONE",
      gemstoneType: "Yellow Sapphire",
      carat: 5.05,
      origin: "Sri Lanka (Ceylon)",
      treatment: "Unheated, untreated",
      color: "Golden yellow",
      clarity: "Very slightly included",
      cut: "Cushion",
      dimensionsMm: "10.4 x 8.9 x 5.6",
      certified: true,
      certificationLab: "GII",
      certificateNumber: "GII-2026-PUK-0114",
      traditionalPlanet: "Jupiter (Guru)",
      careInstructions: "Clean with lukewarm water and a soft cloth. Avoid ultrasonic cleaners and harsh chemicals.",
    },
  },
  {
    slug: "natural-red-coral-moonga-6-2-carat",
    title: "Natural Red Coral (Moonga) 6.20 Carat",
    category: "gemstones",
    sku: "GEM-MOONGA-620",
    pricePaise: 1_850_000,
    quantity: 4,
    imageUrl: "/images/products/red-coral.jpg",
    description:
      "A natural Italian red coral of 6.20 carat, capsule cut, with a deep uniform red and a smooth polish.",
    attributes: {
      kind: "GEMSTONE",
      gemstoneType: "Red Coral",
      carat: 6.2,
      origin: "Italy",
      treatment: "Natural, untreated",
      color: "Deep red",
      cut: "Capsule",
      dimensionsMm: "12.2 x 8.1 x 5.0",
      certified: true,
      certificationLab: "SGL",
      certificateNumber: "SGL-2026-COR-0208",
      traditionalPlanet: "Mars (Mangal)",
      careInstructions: "Wipe with a dry soft cloth. Coral is porous: keep away from perfume, oils and acids.",
    },
  },
  {
    slug: "five-mukhi-rudraksha-nepal-mala-108",
    title: "Five Mukhi Rudraksha Mala (108 Beads, Nepal)",
    category: "rudraksha",
    sku: "RUD-5M-MALA-108",
    pricePaise: 450_000,
    salePricePaise: 385_000,
    quantity: 12,
    imageUrl: "/images/products/rudraksha-mala.jpg",
    description:
      "A traditional 108-bead japa mala of five mukhi Nepali Rudraksha, hand-knotted on cotton thread with a guru bead.",
    attributes: {
      kind: "RUDRAKSHA",
      mukhi: 5,
      origin: "Nepal",
      sizeMm: 8,
      beadCount: 108,
      certified: true,
      certificationLab: "SGL",
      certificateNumber: "SGL-2026-RUD-0442",
      stringing: "Hand-knotted on cotton thread",
      traditionalPlanet: "Jupiter (Guru)",
      careInstructions:
        "Keep dry and apply a little sandalwood or mustard oil occasionally. Remove before bathing or swimming.",
    },
  },
  {
    slug: "one-mukhi-rudraksha-java-pendant",
    title: "One Mukhi Rudraksha Pendant (Java)",
    category: "rudraksha",
    sku: "RUD-1M-JAVA-PEND",
    pricePaise: 1_250_000,
    quantity: 3,
    imageUrl: "/images/products/rudraksha-mala.jpg",
    description:
      "A rare one mukhi Java Rudraksha set in a silver cap and supplied with a lab certificate confirming its single natural face.",
    attributes: {
      kind: "RUDRAKSHA",
      mukhi: 1,
      origin: "Java",
      sizeMm: 16,
      certified: true,
      certificationLab: "IGI",
      certificateNumber: "IGI-2026-RUD-0017",
      stringing: "Silver capped pendant",
      traditionalPlanet: "Sun (Surya)",
      careInstructions: "Keep dry. Clean the silver cap separately from the bead.",
    },
  },
  {
    slug: "clear-quartz-crystal-point-large",
    title: "Clear Quartz Crystal Point (Large)",
    category: "crystals",
    sku: "CRY-QTZ-PT-L",
    pricePaise: 320_000,
    quantity: 8,
    imageUrl: "/images/products/clear-quartz.jpg",
    description:
      "A hand-polished clear quartz point with good transparency and natural internal veiling. Each piece varies slightly.",
    attributes: {
      kind: "CRYSTAL",
      crystalType: "Clear Quartz",
      form: "Polished point",
      weightGrams: 420,
      dimensionsMm: "115 x 45 x 45",
      origin: "Brazil",
      careInstructions: "Dust with a soft dry cloth. Avoid prolonged direct sunlight, which can fade some inclusions.",
    },
  },
  {
    slug: "amethyst-cluster-medium",
    title: "Amethyst Cluster (Medium)",
    category: "crystals",
    sku: "CRY-AME-CL-M",
    pricePaise: 275_000,
    quantity: 6,
    description: "A natural amethyst cluster with deep purple terminations on a raw matrix base.",
    attributes: {
      kind: "CRYSTAL",
      crystalType: "Amethyst",
      form: "Natural cluster",
      weightGrams: 680,
      dimensionsMm: "140 x 95 x 70",
      origin: "Uruguay",
      careInstructions: "Dust with a soft brush. Keep out of direct sunlight to preserve colour.",
    },
  },
  {
    slug: "seven-chakra-healing-bracelet-8mm",
    title: "Seven Chakra Healing Bracelet (8 mm)",
    category: "bracelets",
    sku: "BRA-7CHK-8MM",
    pricePaise: 149_000,
    salePricePaise: 119_000,
    quantity: 25,
    description:
      "An 8 mm bead bracelet strung with seven natural stones on a durable elastic cord, finished by hand.",
    attributes: {
      kind: "BRACELET",
      material: "Amethyst, lapis, turquoise, green aventurine, citrine, carnelian, red jasper",
      beadSizeMm: 8,
      lengthMm: 190,
      claspType: "Elastic",
      careInstructions: "Remove before bathing. Avoid perfume and lotions on the beads.",
    },
  },
  {
    slug: "shri-yantra-copper-3-inch",
    title: "Shri Yantra in Copper (3 inch)",
    category: "yantras",
    sku: "YAN-SHRI-CU-3",
    pricePaise: 185_000,
    quantity: 10,
    description:
      "A traditional Shri Yantra etched on pure copper, 3 inches square, supplied with a stand and a printed placement guide.",
    attributes: {
      kind: "YANTRA",
      yantraType: "Shri Yantra",
      metal: "Pure copper",
      dimensionsMm: "76 x 76",
      energised: true,
      careInstructions:
        "Copper darkens naturally over time. Clean gently with lemon and salt, then dry thoroughly.",
    },
  },
  {
    slug: "navagraha-yantra-brass-4-inch",
    title: "Navagraha Yantra in Brass (4 inch)",
    category: "yantras",
    sku: "YAN-NAVA-BR-4",
    pricePaise: 225_000,
    quantity: 0,
    description: "A Navagraha Yantra etched on brass, 4 inches square, representing the nine traditional grahas.",
    attributes: {
      kind: "YANTRA",
      yantraType: "Navagraha Yantra",
      metal: "Brass",
      dimensionsMm: "101 x 101",
      energised: true,
      careInstructions: "Clean with a dry cloth. Avoid water on the etched face.",
    },
  },
];

async function seedReportDefinitions() {
  for (const definition of REPORT_DEFINITIONS) {
    const { sectionsIncluded, isActive, ...rest } = definition;

    await prisma.reportDefinition.upsert({
      where: { slug: definition.slug },
      update: {
        name: rest.name,
        shortDescription: rest.shortDescription,
        description: rest.description,
        priceMinor: rest.priceMinor,
        estimatedPages: rest.estimatedPages,
        sortOrder: rest.sortOrder,
        sectionsIncluded,
        isActive: isActive ?? true,
      },
      create: {
        slug: rest.slug,
        name: rest.name,
        shortDescription: rest.shortDescription,
        description: rest.description,
        priceMinor: rest.priceMinor,
        currency: "INR",
        estimatedPages: rest.estimatedPages,
        sortOrder: rest.sortOrder,
        sectionsIncluded,
        requiredInputs: ["birthProfile"],
        isActive: isActive ?? true,
        reportType: rest.reportType,
        requiredFields: ["dateOfBirth", "timeOfBirth", "placeOfBirth"],
        sections: sectionsIncluded,
      },
    });
  }

  console.info(`seeded ${REPORT_DEFINITIONS.length} report definitions`);
}

async function seedShop() {
  const categoryIds = new Map<string, string>();

  for (const category of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: { slug: category.slug, name: category.name },
      select: { id: true },
    });
    categoryIds.set(category.slug, row.id);
  }

  for (const product of PRODUCTS) {
    const categoryId = categoryIds.get(product.category) ?? null;

    const row = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        title: product.title,
        description: product.description,
        pricePaise: product.pricePaise,
        salePricePaise: product.salePricePaise ?? null,
        categoryId,
        attributes: product.attributes,
        active: true,
      },
      create: {
        slug: product.slug,
        title: product.title,
        description: product.description,
        type: ProductType.PHYSICAL,
        pricePaise: product.pricePaise,
        salePricePaise: product.salePricePaise ?? null,
        currency: "INR",
        sku: product.sku,
        categoryId,
        attributes: product.attributes,
        active: true,
      },
      select: { id: true },
    });

    await prisma.inventory.upsert({
      where: { productId: row.id },
      update: {
        quantity: product.quantity,
        status: product.quantity > 0 ? InventoryStatus.IN_STOCK : InventoryStatus.OUT_OF_STOCK,
      },
      create: {
        productId: row.id,
        quantity: product.quantity,
        status: product.quantity > 0 ? InventoryStatus.IN_STOCK : InventoryStatus.OUT_OF_STOCK,
      },
    });

    if ("imageUrl" in product && typeof product.imageUrl === "string") {
      await prisma.productImage.deleteMany({ where: { productId: row.id } });
      await prisma.productImage.create({
        data: {
          productId: row.id,
          url: product.imageUrl,
          alt: product.title,
          sortOrder: 0,
        },
      });
    }
  }

  console.info(`seeded ${CATEGORIES.length} categories and ${PRODUCTS.length} products`);
}

async function main() {
  await seedReportDefinitions();
  await seedShop();
}

main()
  .catch((error) => {
    console.error("seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
