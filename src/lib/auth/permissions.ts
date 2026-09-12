import { UserRole } from "@prisma/client";

/**
 * The permission vocabulary.
 *
 * Authorization in this application is decided by permission, never by
 * comparing a role name at a call site. A role is only a *default bundle*: it
 * says what someone starts with, and a per-user grant or revocation says how
 * they differ from it. That is what lets two employees do genuinely different
 * jobs without inventing a role for each of them.
 *
 * The vocabulary lives in code rather than in a table on purpose. A permission
 * is a name the application must already understand in order to honour it, so a
 * row naming one the code has never heard of could only be dead weight - or a
 * way to get an arbitrary string into an authorization decision. What varies
 * per installation is *who holds what*, and that is in the database.
 *
 * Deliberately free of `server-only` and of any import that touches Prisma's
 * runtime or `next/headers`, so the rules can be unit-tested directly and so a
 * navigation component can import the types without dragging the server in.
 */
export const PERMISSIONS = {
  "admin.full_access": "Unrestricted platform authority",

  "analytics.view": "View platform analytics",

  "api_keys.manage": "Manage integration credentials",

  "users.view": "View customer accounts",
  "users.manage": "Change customer account roles",

  "employees.view": "View staff accounts",
  "employees.manage": "Create, deactivate and re-permission staff",

  "pandits.view": "View Pandit profiles and applications",
  "pandits.review": "Start a review and request corrections",
  "pandits.verify": "Mark an application verified",
  "pandits.approve": "Give final onboarding approval",
  "pandits.suspend": "Suspend or reinstate a Pandit",

  "gemstones.view": "View the gemstone catalogue",
  "gemstones.manage": "Create and edit gemstones",
  "gemstones.inventory": "Adjust gemstone stock",
  "gemstones.orders": "View gemstone orders",

  "products.view": "View the product catalogue",
  "products.manage": "Create and edit products",
  "inventory.manage": "Adjust stock levels",

  "orders.view": "View orders",
  "orders.manage": "Advance order fulfilment",

  "reports.view": "View report orders and generated reports",
  "reports.manage": "Edit the report catalogue and retry generation",

  "coupons.manage": "Create and edit coupons",

  "tickets.view": "View support tickets",
  "tickets.manage": "Respond to and resolve support tickets",

  "consultations.view": "View consultations across the platform",

  "payouts.view": "View Pandit earnings and payouts",
  "payouts.process": "Move a payout through its states",
  "payouts.configure": "Change payout cycle and commission",

  "audit_logs.view": "Read the audit log",

  "settings.view": "View platform settings",
  "settings.manage": "Change platform settings",

  "services.manage": "Configure consultation service types and rate bounds",
  /**
   * Working the puja queue: assigning a practitioner, scheduling, recording
   * completion. Deliberately separate from `services.manage`, which is rate and
   * policy configuration - fulfilling somebody's booking is routine operations,
   * setting what the platform charges is not.
   */
  "puja.manage": "Assign, schedule and fulfil puja bookings",

  "calls.manage": "Configure the calling provider",

  "pricing.manage": "Change platform pricing and commission",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && value in PERMISSIONS;
}

/**
 * The permission that stands for all of them.
 *
 * Holding it is equivalent to holding every entry above, now and after any
 * future entry is added. Only SUPER_ADMIN gets it by default, and it is
 * deliberately not grantable to an employee through the UI.
 */
export const FULL_ACCESS: Permission = "admin.full_access";

/**
 * The standard bundle an employee starts with.
 *
 * Chosen to cover the delegated operational work described in the role model -
 * Pandit enrolment, verification review, tickets, orders, reports - and nothing
 * that touches credentials, money rules, other staff or platform settings. A
 * Super Admin widens or narrows it per person from here.
 */
export const DEFAULT_EMPLOYEE_PERMISSIONS: readonly Permission[] = [
  "pandits.view",
  "pandits.review",
  "tickets.view",
  "tickets.manage",
  "orders.view",
  "reports.view",
  "users.view",
];

/**
 * Permissions an employee may never be given from the admin UI.
 *
 * These are the ones whose whole purpose is that a single person controls them:
 * credentials, the commission and payout rules that decide who is owed what,
 * and the ability to create or re-permission staff. Refused server-side on
 * write, not merely hidden from the picker.
 */
export const SUPER_ADMIN_ONLY_PERMISSIONS: readonly Permission[] = [
  FULL_ACCESS,
  "api_keys.manage",
  "employees.manage",
  "payouts.configure",
  "pricing.manage",
  "settings.manage",
  "calls.manage",
  "users.manage",
];

export const ASSIGNABLE_EMPLOYEE_PERMISSIONS: readonly Permission[] = ALL_PERMISSIONS.filter(
  (permission) => !SUPER_ADMIN_ONLY_PERMISSIONS.includes(permission),
);

/**
 * Default bundles per role.
 *
 * CUSTOMER and PANDIT hold nothing here. That is not an oversight: what a
 * customer or a Pandit may do is decided by ownership of the row in front of
 * them - your own profile, your own earnings, a consultation you are party to -
 * which is a different question from a platform-wide capability, and answering
 * it with a permission would make it look transferable when it is not.
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.SUPER_ADMIN]: [FULL_ACCESS],
  [UserRole.ADMIN]: [
    "analytics.view",
    "users.view",
    "employees.view",
    "pandits.view",
    "pandits.review",
    "pandits.verify",
    "gemstones.view",
    "gemstones.manage",
    "gemstones.inventory",
    "gemstones.orders",
    "products.view",
    "products.manage",
    "inventory.manage",
    "orders.view",
    "orders.manage",
    "reports.view",
    "reports.manage",
    "coupons.manage",
    "tickets.view",
    "tickets.manage",
    "consultations.view",
    "services.manage",
    "puja.manage",
    "payouts.view",
    "audit_logs.view",
    "settings.view",
  ],
  [UserRole.EMPLOYEE]: DEFAULT_EMPLOYEE_PERMISSIONS,
  [UserRole.PANDIT]: [],
  [UserRole.CUSTOMER]: [],
  [UserRole.ASTROLOGER]: [],
  [UserRole.EDITOR]: [],
};

export type PermissionOverride = { permission: string; granted: boolean };

/**
 * Resolves the effective permission set.
 *
 * Order matters: the role default is the starting point, an explicit grant adds
 * to it, and an explicit revocation removes from it and wins over the default.
 * A revocation that names a permission the role never had is simply inert.
 *
 * Overrides naming an unknown permission are ignored rather than trusted, so a
 * stale row left behind by a renamed permission cannot widen anyone's access.
 */
export function resolvePermissions(
  role: UserRole,
  overrides: readonly PermissionOverride[] = [],
): Set<Permission> {
  const effective = new Set<Permission>(ROLE_DEFAULT_PERMISSIONS[role] ?? []);

  for (const override of overrides) {
    if (!isPermission(override.permission)) continue;
    if (override.granted) effective.add(override.permission);
    else effective.delete(override.permission);
  }

  return effective;
}

/** True when the holder may exercise `permission`, directly or via full access. */
export function hasPermission(held: ReadonlySet<Permission>, permission: Permission): boolean {
  return held.has(FULL_ACCESS) || held.has(permission);
}

/** True when the holder may exercise at least one of `permissions`. */
export function hasAnyPermission(
  held: ReadonlySet<Permission>,
  permissions: readonly Permission[],
): boolean {
  if (held.has(FULL_ACCESS)) return true;
  return permissions.some((permission) => held.has(permission));
}

/** Expands full access into the concrete list, for display. */
export function describePermissions(held: ReadonlySet<Permission>): Permission[] {
  return held.has(FULL_ACCESS) ? [...ALL_PERMISSIONS] : [...held].sort();
}

/**
 * Which dashboard a signed-in person belongs in.
 *
 * Presentation only - it decides where sign-in lands someone, never what they
 * may reach once there. Every one of these areas authorizes independently.
 */
export function homePathForRole(role: UserRole): string {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return "/admin/super";
    case UserRole.ADMIN:
      return "/admin";
    case UserRole.EMPLOYEE:
      return "/employee";
    case UserRole.PANDIT:
      return "/pandit";
    default:
      return "/account";
  }
}
