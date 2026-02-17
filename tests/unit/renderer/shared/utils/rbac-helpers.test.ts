import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getUserRoleName,
  getUserRoleDisplayName,
  userHasRole,
  userHasAnyRole,
  userHasPermission,
  getRoleBadgeVariant,
  userRequiresShift,
  hasRBACData,
} from "@/shared/utils/rbac-helpers";

describe("rbac-helpers", () => {
  describe("getUserRoleName", () => {
    it("returns cashier for null user", () => {
      expect(getUserRoleName(null)).toBe("cashier");
    });

    it("returns cashier for undefined user", () => {
      expect(getUserRoleName(undefined)).toBe("cashier");
    });

    it("reads primaryRole.name when present", () => {
      expect(
        getUserRoleName({ primaryRole: { name: "admin" } } as any)
      ).toBe("admin");
    });

    it("falls back to roleName and lowercases", () => {
      expect(getUserRoleName({ roleName: "ADMIN" } as any)).toBe("admin");
    });

    it("falls back to deprecated role and lowercases", () => {
      expect(getUserRoleName({ role: "Manager" } as any)).toBe("manager");
    });

    it("returns cashier when no role data", () => {
      expect(getUserRoleName({} as any)).toBe("cashier");
    });
  });

  describe("getUserRoleDisplayName", () => {
    it("returns Cashier for null user", () => {
      expect(getUserRoleDisplayName(null)).toBe("Cashier");
    });

    it("reads primaryRole.displayName when present", () => {
      expect(
        getUserRoleDisplayName({
          primaryRole: { name: "admin", displayName: "Administrator" },
        } as any)
      ).toBe("Administrator");
    });

    it("maps known role manager to Store Manager", () => {
      expect(getUserRoleDisplayName({ roleName: "manager" } as any)).toBe(
        "Store Manager"
      );
    });

    it("capitalizes unknown role", () => {
      expect(
        getUserRoleDisplayName({ primaryRole: { name: "custom" } } as any)
      ).toBe("Custom");
    });

    it("returns Cashier when no role data", () => {
      expect(getUserRoleDisplayName({} as any)).toBe("Cashier");
    });
  });

  describe("userHasRole", () => {
    it("returns false for null user", () => {
      expect(userHasRole(null, "admin")).toBe(false);
    });

    it("returns true when role matches case-insensitively", () => {
      expect(
        userHasRole({ primaryRole: { name: "admin" } } as any, "ADMIN")
      ).toBe(true);
    });

    it("returns false when role does not match", () => {
      expect(
        userHasRole({ primaryRole: { name: "cashier" } } as any, "admin")
      ).toBe(false);
    });

    it("returns true for manager", () => {
      expect(
        userHasRole({ roleName: "manager" } as any, "manager")
      ).toBe(true);
    });
  });

  describe("userHasAnyRole", () => {
    it("returns false for null user", () => {
      expect(userHasAnyRole(null, ["admin", "manager"])).toBe(false);
    });

    it("returns true when user has one of the roles", () => {
      expect(
        userHasAnyRole(
          { primaryRole: { name: "manager" } } as any,
          ["admin", "manager"]
        )
      ).toBe(true);
    });

    it("returns false when user has none of the roles", () => {
      expect(
        userHasAnyRole(
          { primaryRole: { name: "cashier" } } as any,
          ["admin", "manager"]
        )
      ).toBe(false);
    });

    it("matches case-insensitively", () => {
      expect(
        userHasAnyRole(
          { primaryRole: { name: "admin" } } as any,
          ["ADMIN"]
        )
      ).toBe(true);
    });
  });

  describe("userHasPermission", () => {
    beforeEach(() => {
      vi.mocked((window as any).authStore.get).mockResolvedValue("test-token");
      vi.mocked(
        (window as any).rbacAPI.userPermissions.getUserPermissions
      ).mockResolvedValue({ success: true, data: ["manage:users", "read:products"] });
    });

    it("returns false when no session token", async () => {
      vi.mocked((window as any).authStore.get).mockResolvedValue(null);
      expect(await userHasPermission("user-1", "manage:users")).toBe(false);
    });

    it("calls API with session token and userId", async () => {
      await userHasPermission("user-123", "manage:users");
      expect((window as any).authStore.get).toHaveBeenCalledWith("token");
      expect(
        (window as any).rbacAPI.userPermissions.getUserPermissions
      ).toHaveBeenCalledWith("test-token", "user-123");
    });

    it("returns true when permission is in response", async () => {
      expect(await userHasPermission("user-1", "manage:users")).toBe(true);
    });

    it("returns false when permission is not in response", async () => {
      expect(await userHasPermission("user-1", "write:admin")).toBe(false);
    });

    it("returns false on API error", async () => {
      vi.mocked(
        (window as any).rbacAPI.userPermissions.getUserPermissions
      ).mockRejectedValue(new Error("Network error"));
      expect(await userHasPermission("user-1", "manage:users")).toBe(false);
    });
  });

  describe("getRoleBadgeVariant", () => {
    it("returns default for admin", () => {
      expect(getRoleBadgeVariant("admin")).toBe("default");
    });

    it("returns default for owner", () => {
      expect(getRoleBadgeVariant("owner")).toBe("default");
    });

    it("returns secondary for manager", () => {
      expect(getRoleBadgeVariant("manager")).toBe("secondary");
    });

    it("returns secondary for supervisor", () => {
      expect(getRoleBadgeVariant("supervisor")).toBe("secondary");
    });

    it("returns outline for cashier", () => {
      expect(getRoleBadgeVariant("cashier")).toBe("outline");
    });

    it("returns secondary for unknown role", () => {
      expect(getRoleBadgeVariant("custom")).toBe("secondary");
    });

    it("handles case-insensitive role name", () => {
      expect(getRoleBadgeVariant("ADMIN")).toBe("default");
    });
  });

  describe("userRequiresShift", () => {
    it("returns false for null user", () => {
      expect(userRequiresShift(null)).toBe(false);
    });

    it("honors explicit shiftRequired true", () => {
      expect(
        userRequiresShift({
          shiftRequired: true,
          primaryRole: { name: "admin" },
        } as any)
      ).toBe(true);
    });

    it("honors explicit shiftRequired false", () => {
      expect(
        userRequiresShift({
          shiftRequired: false,
          primaryRole: { name: "cashier" },
        } as any)
      ).toBe(false);
    });

    it("returns true for cashier when shiftRequired not set", () => {
      expect(
        userRequiresShift({ primaryRole: { name: "cashier" } } as any)
      ).toBe(true);
    });

    it("returns true for supervisor when shiftRequired not set", () => {
      expect(
        userRequiresShift({ primaryRole: { name: "supervisor" } } as any)
      ).toBe(true);
    });

    it("returns false for admin when shiftRequired not set", () => {
      expect(
        userRequiresShift({ primaryRole: { name: "admin" } } as any)
      ).toBe(false);
    });

    it("returns false for manager when shiftRequired not set", () => {
      expect(
        userRequiresShift({ primaryRole: { name: "manager" } } as any)
      ).toBe(false);
    });
  });

  describe("hasRBACData", () => {
    it("returns false for null", () => {
      expect(hasRBACData(null)).toBe(false);
    });

    it("returns false for user without primaryRole", () => {
      expect(hasRBACData({ id: "1" } as any)).toBe(false);
    });

    it("returns true for user with primaryRole", () => {
      expect(
        hasRBACData({ id: "1", primaryRole: { name: "admin" } } as any)
      ).toBe(true);
    });
  });
});
