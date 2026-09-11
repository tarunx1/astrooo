import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import {
  ALL_PERMISSIONS,
  ASSIGNABLE_EMPLOYEE_PERMISSIONS,
  DEFAULT_EMPLOYEE_PERMISSIONS,
  FULL_ACCESS,
  ROLE_DEFAULT_PERMISSIONS,
  SUPER_ADMIN_ONLY_PERMISSIONS,
  hasAnyPermission,
  hasPermission,
  homePathForRole,
  isPermission,
  resolvePermissions,
  type Permission,
} from "@/lib/auth/permissions";

/**
 * The permission rules, tested directly.
 *
 * These are pure functions with no database behind them, which is the point:
 * the rules that decide who may do what should be checkable without standing up
 * a session, so there is no excuse for them to go untested.
 */
describe("permission resolution", () => {
  it("gives a super admin every permission through full access", () => {
    const held = resolvePermissions(UserRole.SUPER_ADMIN);

    expect(held.has(FULL_ACCESS)).toBe(true);
    for (const permission of ALL_PERMISSIONS) {
      expect(hasPermission(held, permission)).toBe(true);
    }
  });

  it("gives a customer nothing", () => {
    const held = resolvePermissions(UserRole.CUSTOMER);
    expect(held.size).toBe(0);
    expect(hasPermission(held, "users.view")).toBe(false);
  });

  it("gives a pandit no platform permissions", () => {
    // A Pandit's authority is ownership of their own account, which is a
    // different thing from a platform-wide capability. If this ever becomes
    // non-empty, something has confused the two.
    const held = resolvePermissions(UserRole.PANDIT);
    expect(held.size).toBe(0);
  });

  it("gives an employee the default bundle and nothing more", () => {
    const held = resolvePermissions(UserRole.EMPLOYEE);

    for (const permission of DEFAULT_EMPLOYEE_PERMISSIONS) {
      expect(held.has(permission)).toBe(true);
    }
    expect(held.has(FULL_ACCESS)).toBe(false);
    expect(hasPermission(held, "api_keys.manage")).toBe(false);
    expect(hasPermission(held, "payouts.configure")).toBe(false);
    expect(hasPermission(held, "employees.manage")).toBe(false);
  });

  it("does not let an employee inherit admin permissions", () => {
    const employee = resolvePermissions(UserRole.EMPLOYEE);
    const admin = resolvePermissions(UserRole.ADMIN);

    const adminOnly = [...admin].filter((permission) => !employee.has(permission));
    expect(adminOnly.length).toBeGreaterThan(0);

    for (const permission of adminOnly) {
      expect(hasPermission(employee, permission)).toBe(false);
    }
  });

  it("applies an explicit grant on top of the role default", () => {
    const held = resolvePermissions(UserRole.EMPLOYEE, [
      { permission: "orders.manage", granted: true },
    ]);

    expect(hasPermission(held, "orders.manage")).toBe(true);
  });

  it("lets a revocation override the role default", () => {
    expect(DEFAULT_EMPLOYEE_PERMISSIONS).toContain("tickets.manage");

    const held = resolvePermissions(UserRole.EMPLOYEE, [
      { permission: "tickets.manage", granted: false },
    ]);

    expect(hasPermission(held, "tickets.manage")).toBe(false);
  });

  it("ignores an override naming a permission the code does not know", () => {
    // A stale row left behind by a renamed permission must not widen access.
    const held = resolvePermissions(UserRole.EMPLOYEE, [
      { permission: "admin.everything", granted: true },
      { permission: "", granted: true },
    ]);

    expect(held.has("admin.everything" as Permission)).toBe(false);
    expect(hasPermission(held, FULL_ACCESS)).toBe(false);
  });

  it("cannot be given full access through an override that names it", () => {
    // The override system itself does not refuse this - `setEmployeePermissions`
    // does, before a row is ever written. This asserts the shape of the rule:
    // full access is real if present, which is exactly why writing it is gated.
    expect(SUPER_ADMIN_ONLY_PERMISSIONS).toContain(FULL_ACCESS);
    expect(ASSIGNABLE_EMPLOYEE_PERMISSIONS).not.toContain(FULL_ACCESS);
  });
});

describe("delegation limits", () => {
  it("keeps credentials, money rules and staff management undelegable", () => {
    for (const permission of [
      "api_keys.manage",
      "employees.manage",
      "payouts.configure",
      "pricing.manage",
      "settings.manage",
      "calls.manage",
      "users.manage",
    ] as const) {
      expect(SUPER_ADMIN_ONLY_PERMISSIONS).toContain(permission);
      expect(ASSIGNABLE_EMPLOYEE_PERMISSIONS).not.toContain(permission);
    }
  });

  it("offers every other permission for delegation", () => {
    const expected = ALL_PERMISSIONS.filter(
      (permission) => !SUPER_ADMIN_ONLY_PERMISSIONS.includes(permission),
    );
    expect([...ASSIGNABLE_EMPLOYEE_PERMISSIONS].sort()).toEqual(expected.sort());
  });

  it("never puts an undelegable permission in the default employee bundle", () => {
    for (const permission of DEFAULT_EMPLOYEE_PERMISSIONS) {
      expect(SUPER_ADMIN_ONLY_PERMISSIONS).not.toContain(permission);
    }
  });
});

describe("permission vocabulary", () => {
  it("recognises only declared permissions", () => {
    expect(isPermission("tickets.manage")).toBe(true);
    expect(isPermission("tickets.destroy")).toBe(false);
    expect(isPermission(null)).toBe(false);
    expect(isPermission(42)).toBe(false);
  });

  it("declares a default bundle for every role", () => {
    for (const role of Object.values(UserRole)) {
      expect(ROLE_DEFAULT_PERMISSIONS[role]).toBeDefined();
    }
  });

  it("never declares a permission the registry does not contain", () => {
    for (const permissions of Object.values(ROLE_DEFAULT_PERMISSIONS)) {
      for (const permission of permissions) {
        expect(isPermission(permission)).toBe(true);
      }
    }
  });
});

describe("hasAnyPermission", () => {
  it("is true when any one is held", () => {
    const held = resolvePermissions(UserRole.EMPLOYEE);
    expect(hasAnyPermission(held, ["api_keys.manage", "tickets.view"])).toBe(true);
  });

  it("is false when none is held", () => {
    const held = resolvePermissions(UserRole.CUSTOMER);
    expect(hasAnyPermission(held, ["api_keys.manage", "tickets.view"])).toBe(false);
  });

  it("is true for a super admin whatever is asked", () => {
    const held = resolvePermissions(UserRole.SUPER_ADMIN);
    expect(hasAnyPermission(held, ["api_keys.manage"])).toBe(true);
  });
});

describe("role landing pages", () => {
  it("sends each role to its own dashboard", () => {
    expect(homePathForRole(UserRole.SUPER_ADMIN)).toBe("/admin/super");
    expect(homePathForRole(UserRole.ADMIN)).toBe("/admin");
    expect(homePathForRole(UserRole.EMPLOYEE)).toBe("/employee");
    expect(homePathForRole(UserRole.PANDIT)).toBe("/pandit");
    expect(homePathForRole(UserRole.CUSTOMER)).toBe("/account");
  });
});
