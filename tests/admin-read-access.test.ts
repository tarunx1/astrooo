import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import {
  ROLE_DEFAULT_PERMISSIONS,
  hasAnyPermission,
  resolvePermissions,
  type Permission,
} from "@/lib/auth/permissions";

/**
 * Read access to the operations area.
 *
 * Writes were always gated on a specific permission. Reads were not: every
 * admin page used to open on `requireAdmin()`, which admits anyone holding any
 * operations permission - so an employee given tickets could read stock levels,
 * the audit log, coupon pricing and platform revenue.
 *
 * This table is the intended model, asserted rather than described. Each entry
 * is the permission set a page now opens on; the expectations below say which
 * roles that admits. A page whose guard is loosened will fail here.
 */
const PAGE_GUARDS: Record<string, readonly Permission[]> = {
  "/admin/orders": ["orders.view", "orders.manage"],
  "/admin/products": ["products.view", "products.manage"],
  "/admin/inventory": ["inventory.manage", "gemstones.inventory"],
  "/admin/coupons": ["coupons.manage"],
  "/admin/audit": ["audit_logs.view"],
  "/admin/users": ["users.view", "users.manage"],
  "/admin/report-orders": ["reports.view"],
  "/admin/generated-reports": ["reports.view"],
  "/admin/reports": ["reports.view", "reports.manage"],
  "/admin/gemstones": ["gemstones.view", "gemstones.manage"],
  "/admin/tickets": ["tickets.view", "tickets.manage"],
  "/admin/pandits": ["pandits.view"],
  "/admin/analytics": ["analytics.view"],
  "/admin/earnings": ["payouts.view"],
  "/admin/payouts": ["payouts.view", "payouts.process"],
  "/admin/consultations": ["consultations.view"],
  "/admin/puja/bookings": ["puja.manage"],
};

/** Sections on the shared Overview page, and what each one needs. */
const OVERVIEW_SECTIONS: Record<string, readonly Permission[]> = {
  "Store fulfilment": ["orders.view", "orders.manage"],
  Stock: ["inventory.manage", "gemstones.inventory", "products.view", "products.manage"],
  Reports: ["reports.view", "reports.manage"],
  "Captured payments": ["analytics.view", "payouts.view"],
};

function can(role: UserRole, needed: readonly Permission[]): boolean {
  return hasAnyPermission(resolvePermissions(role), needed);
}

describe("what a default employee may read", () => {
  const ALLOWED = [
    "/admin/orders",
    "/admin/users",
    "/admin/report-orders",
    "/admin/generated-reports",
    "/admin/reports",
    "/admin/tickets",
    "/admin/pandits",
  ];

  const DENIED = [
    "/admin/products",
    "/admin/inventory",
    "/admin/coupons",
    "/admin/audit",
    "/admin/gemstones",
    "/admin/analytics",
    "/admin/earnings",
    "/admin/payouts",
    "/admin/consultations",
    "/admin/puja/bookings",
  ];

  it.each(ALLOWED)("admits an employee to %s", (page) => {
    expect(can(UserRole.EMPLOYEE, PAGE_GUARDS[page])).toBe(true);
  });

  it.each(DENIED)("keeps an employee out of %s", (page) => {
    expect(can(UserRole.EMPLOYEE, PAGE_GUARDS[page])).toBe(false);
  });

  it("covers every guarded page in one list or the other", () => {
    // Guards against a page being added and quietly escaping this test.
    expect([...ALLOWED, ...DENIED].sort()).toEqual(Object.keys(PAGE_GUARDS).sort());
  });
});

describe("the shared Overview page", () => {
  it("shows an employee only the areas they work in", () => {
    const visible = Object.entries(OVERVIEW_SECTIONS)
      .filter(([, needed]) => can(UserRole.EMPLOYEE, needed))
      .map(([section]) => section);

    expect(visible).toEqual(["Store fulfilment", "Reports"]);
  });

  it("never shows an employee platform revenue", () => {
    expect(can(UserRole.EMPLOYEE, OVERVIEW_SECTIONS["Captured payments"])).toBe(false);
  });

  it("shows an admin and a super admin everything", () => {
    for (const role of [UserRole.ADMIN, UserRole.SUPER_ADMIN]) {
      for (const [section, needed] of Object.entries(OVERVIEW_SECTIONS)) {
        expect(can(role, needed), `${role} should see ${section}`).toBe(true);
      }
    }
  });
});

describe("role reach", () => {
  it("lets an admin read every operations page", () => {
    for (const [page, needed] of Object.entries(PAGE_GUARDS)) {
      expect(can(UserRole.ADMIN, needed), `admin should reach ${page}`).toBe(true);
    }
  });

  it("lets a super admin read everything through full access", () => {
    for (const [page, needed] of Object.entries(PAGE_GUARDS)) {
      expect(can(UserRole.SUPER_ADMIN, needed), `super admin should reach ${page}`).toBe(true);
    }
  });

  it("gives a customer and a pandit no operations reach at all", () => {
    for (const role of [UserRole.CUSTOMER, UserRole.PANDIT]) {
      for (const needed of Object.values(PAGE_GUARDS)) {
        expect(can(role, needed)).toBe(false);
      }
    }
  });

  it("keeps the owner-only capabilities out of every other role", () => {
    // These have no page entry above because they are not permission-gated at
    // all - they require SUPER_ADMIN outright.
    const ownerOnly: Permission[] = ["api_keys.manage", "settings.manage", "employees.manage"];

    for (const role of [UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.PANDIT, UserRole.CUSTOMER]) {
      expect(hasAnyPermission(resolvePermissions(role), ownerOnly)).toBe(false);
    }
  });

  it("is not accidentally satisfied by an empty admin bundle", () => {
    // A sanity check on the fixture itself: if ADMIN's defaults were emptied,
    // most assertions above would pass vacuously.
    expect(ROLE_DEFAULT_PERMISSIONS[UserRole.ADMIN].length).toBeGreaterThan(10);
    expect(ROLE_DEFAULT_PERMISSIONS[UserRole.EMPLOYEE].length).toBeGreaterThan(0);
  });
});
