import { BirthTimeAccuracy, PanditOnboardingStatus, PrismaClient, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import fs from "node:fs";
import path from "node:path";

if (!process.env.DATABASE_URL) {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      }
    }
  } catch {}
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL must be set.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

export const DEFAULT_DEV_PASSWORD = "Password123!";

export type AccountDefinition = {
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  description: string;
  employeeProfile?: {
    jobTitle: string;
    department: string;
  };
  panditProfile?: {
    displayName: string;
    slug: string;
    headline: string;
    bio: string;
    yearsOfExperience: number;
    languages: string[];
    expertise: string[];
    city: string;
    state: string;
  };
  birthProfile?: {
    name: string;
    dateOfBirth: Date;
    timeOfBirth: string;
    placeName: string;
    placeOfBirth: string;
    city: string;
    country: string;
    latitude: number;
    longitude: number;
    timezone: string;
  };
};

export const ACCOUNTS: AccountDefinition[] = [
  // Super Admin Accounts
  {
    email: "superadmin@tarunastro.com",
    name: "Tarun Super Admin",
    role: UserRole.SUPER_ADMIN,
    description: "Super Admin with full platform authority and control centre access",
  },
  {
    email: "superadmin@example.com",
    name: "Platform Super Admin",
    role: UserRole.SUPER_ADMIN,
    description: "Super Admin (demo alias) for /admin/super control centre testing",
  },
  // Admin Accounts
  {
    email: "admin@tarunastro.com",
    name: "Tarun Admin",
    role: UserRole.ADMIN,
    description: "Administrator with catalog, orders, reports, inventory & pandit operations",
  },
  {
    email: "admin@example.com",
    name: "Store Administrator",
    role: UserRole.ADMIN,
    description: "Administrator (demo alias) for /admin operations testing",
  },
  {
    email: "dev@example.com",
    name: "Dev Administrator",
    role: UserRole.ADMIN,
    description: "Default dev administrator account",
  },
  // Employee / Staff Accounts
  {
    email: "employee@tarunastro.com",
    name: "Aman Verma",
    role: UserRole.EMPLOYEE,
    description: "Operations Staff with review and support permissions",
    employeeProfile: {
      jobTitle: "Operations Lead",
      department: "Customer Operations & Verification",
    },
  },
  {
    email: "employee@example.com",
    name: "Staff Member",
    role: UserRole.EMPLOYEE,
    description: "Staff employee (demo alias) for /employee portal testing",
    employeeProfile: {
      jobTitle: "Support Specialist",
      department: "Customer Support",
    },
  },
  // Pandit / Astrologer Accounts
  {
    email: "pandit@tarunastro.com",
    name: "Pandit Rajesh Sharma",
    role: UserRole.PANDIT,
    phone: "+919876543210",
    description: "Verified and Active Vedic Pandit with consultations & rituals",
    panditProfile: {
      displayName: "Pandit Rajesh Sharma",
      slug: "pandit-rajesh-sharma",
      headline: "Senior Vedic Astrologer & Vastu Consultant (15+ yrs experience)",
      bio: "Master in Parashari Vedic Astrology, KP System, and Muhurta calculation. Guided over 10,000 clients across India and globally.",
      yearsOfExperience: 15,
      languages: ["Hindi", "English", "Sanskrit"],
      expertise: ["Vedic Astrology", "Kundli Reading", "Vastu Shastra", "Gemology", "Mahadasha Analysis"],
      city: "Varanasi",
      state: "Uttar Pradesh",
    },
  },
  {
    email: "pandit@example.com",
    name: "Pandit Dev Astrologer",
    role: UserRole.PANDIT,
    phone: "+919876543211",
    description: "Active Pandit (demo alias) for /pandit portal testing",
    panditProfile: {
      displayName: "Pandit Dev Astrologer",
      slug: "pandit-dev-astrologer",
      headline: "KP Astrologer & Remedial Specialist",
      bio: "Practicing KP and Vedic Astrology with focus on career transitions, marriage matching, and gemstone consultations.",
      yearsOfExperience: 10,
      languages: ["Hindi", "English"],
      expertise: ["KP Astrology", "Kundli Matching", "Prashna Kundli"],
      city: "New Delhi",
      state: "Delhi",
    },
  },
  // Customer Accounts
  {
    email: "customer@tarunastro.com",
    name: "Tarun Customer",
    role: UserRole.CUSTOMER,
    phone: "+919876543220",
    description: "Standard customer with pre-configured birth profile for kundli & reports",
    birthProfile: {
      name: "Tarun Customer",
      dateOfBirth: new Date("1995-05-15T04:00:00.000Z"), // 09:30 AM IST
      timeOfBirth: "09:30",
      placeName: "New Delhi, Delhi, India",
      placeOfBirth: "New Delhi",
      city: "New Delhi",
      country: "India",
      latitude: 28.6139,
      longitude: 77.209,
      timezone: "Asia/Kolkata",
    },
  },
  {
    email: "customer@example.com",
    name: "Sample Customer",
    role: UserRole.CUSTOMER,
    description: "Customer (demo alias) for /account portal testing",
    birthProfile: {
      name: "Sample Customer",
      dateOfBirth: new Date("1998-08-20T08:45:00.000Z"), // 14:15 IST
      timeOfBirth: "14:15",
      placeName: "Mumbai, Maharashtra, India",
      placeOfBirth: "Mumbai",
      city: "Mumbai",
      country: "India",
      latitude: 19.076,
      longitude: 72.8777,
      timezone: "Asia/Kolkata",
    },
  },
];

async function seedUserAccount(account: AccountDefinition, passwordHash: string) {
  const email = account.email.trim().toLowerCase();

  // 1. Upsert user
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: account.name,
      role: account.role,
      phone: account.phone ?? null,
      emailVerified: true,
    },
    create: {
      email,
      name: account.name,
      role: account.role,
      phone: account.phone ?? null,
      emailVerified: true,
    },
  });

  // 2. Upsert credential account for Better Auth
  await prisma.account.upsert({
    where: {
      issuer_accountId: {
        issuer: "local:credential",
        accountId: user.id,
      },
    },
    update: {
      password: passwordHash,
      providerId: "credential",
      userId: user.id,
    },
    create: {
      issuer: "local:credential",
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: passwordHash,
    },
  });

  // 3. Employee profile if applicable
  if (account.employeeProfile && account.role === UserRole.EMPLOYEE) {
    await prisma.employeeProfile.upsert({
      where: { userId: user.id },
      update: {
        jobTitle: account.employeeProfile.jobTitle,
        department: account.employeeProfile.department,
        active: true,
        deactivatedAt: null,
      },
      create: {
        userId: user.id,
        jobTitle: account.employeeProfile.jobTitle,
        department: account.employeeProfile.department,
        active: true,
      },
    });
  }

  // 4. Pandit profile if applicable
  if (account.panditProfile && account.role === UserRole.PANDIT) {
    const p = account.panditProfile;
    await prisma.panditProfile.upsert({
      where: { userId: user.id },
      update: {
        displayName: p.displayName,
        slug: p.slug,
        headline: p.headline,
        bio: p.bio,
        yearsOfExperience: p.yearsOfExperience,
        languages: p.languages,
        expertise: p.expertise,
        city: p.city,
        state: p.state,
        status: PanditOnboardingStatus.ACTIVE,
        approvedAt: new Date(),
        activatedAt: new Date(),
        verifiedAt: new Date(),
      },
      create: {
        userId: user.id,
        displayName: p.displayName,
        slug: p.slug,
        headline: p.headline,
        bio: p.bio,
        yearsOfExperience: p.yearsOfExperience,
        languages: p.languages,
        expertise: p.expertise,
        city: p.city,
        state: p.state,
        status: PanditOnboardingStatus.ACTIVE,
        approvedAt: new Date(),
        activatedAt: new Date(),
        verifiedAt: new Date(),
      },
    });
  }

  // 5. Birth profile if applicable
  if (account.birthProfile) {
    const bp = account.birthProfile;
    const existingBp = await prisma.birthProfile.findFirst({
      where: { userId: user.id, name: bp.name },
    });

    if (!existingBp) {
      await prisma.birthProfile.create({
        data: {
          userId: user.id,
          name: bp.name,
          dateOfBirth: bp.dateOfBirth,
          timeOfBirth: bp.timeOfBirth,
          timeAccuracy: BirthTimeAccuracy.EXACT,
          placeName: bp.placeName,
          placeOfBirth: bp.placeOfBirth,
          city: bp.city,
          country: bp.country,
          latitude: bp.latitude,
          longitude: bp.longitude,
          timezone: bp.timezone,
        },
      });
    }
  }

  // 6. Audit log for superadmin or admin
  if (account.role === UserRole.SUPER_ADMIN || account.role === UserRole.ADMIN) {
    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: account.role === UserRole.SUPER_ADMIN ? "SUPER_ADMIN_PROMOTED" : "USER_ROLE_CHANGED",
        entityType: "User",
        entityId: user.id,
        metadata: { role: account.role, via: "seed-accounts-script" },
      },
    });
  }

  console.info(`✓ [${account.role.padEnd(11)}] ${account.email} (${account.name})`);
}

async function main() {
  console.info("----------------------------------------------------------------");
  console.info("Seeding platform user accounts with Better Auth credentials...");
  console.info(`Default Password: ${DEFAULT_DEV_PASSWORD}`);
  console.info("----------------------------------------------------------------");

  const passwordHash = await hashPassword(DEFAULT_DEV_PASSWORD);

  // Promote primary personal account to SUPER_ADMIN if it exists
  const primaryOwnerEmail = "navishmehta1313@gmail.com";
  const primaryOwner = await prisma.user.findUnique({ where: { email: primaryOwnerEmail } });
  if (primaryOwner) {
    await prisma.user.update({
      where: { id: primaryOwner.id },
      data: { role: UserRole.SUPER_ADMIN },
    });
    // Ensure password is set
    await prisma.account.upsert({
      where: {
        issuer_accountId: {
          issuer: "local:credential",
          accountId: primaryOwner.id,
        },
      },
      update: { password: passwordHash },
      create: {
        issuer: "local:credential",
        accountId: primaryOwner.id,
        providerId: "credential",
        userId: primaryOwner.id,
        password: passwordHash,
      },
    });
    console.info(`✓ [SUPER_ADMIN] ${primaryOwnerEmail} (Tarundeep Singh - Owner)`);
  }

  for (const account of ACCOUNTS) {
    await seedUserAccount(account, passwordHash);
  }

  console.info("----------------------------------------------------------------");
  console.info("All user accounts successfully created and verified!");
  console.info("----------------------------------------------------------------");
}

main()
  .catch((error) => {
    console.error("Account seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
