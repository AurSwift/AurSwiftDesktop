import { describe, it, expect } from "vitest";
import { RBAC_ROUTES } from "@/features/rbac/config/navigation";
import { RBAC_PERMISSIONS } from "@/features/rbac/config/permissions";
import { rbacFeature, rbacViews } from "@/features/rbac/config/feature-config";

describe("rbac config", () => {
  describe("RBAC_ROUTES", () => {
    it("has ROLE_MANAGEMENT with correct value", () => {
      expect(RBAC_ROUTES.ROLE_MANAGEMENT).toBe("rbac:role-management");
    });

    it("has USER_ROLE_ASSIGNMENT with correct value", () => {
      expect(RBAC_ROUTES.USER_ROLE_ASSIGNMENT).toBe(
        "rbac:user-role-assignment"
      );
    });
  });

  describe("RBAC_PERMISSIONS", () => {
    it("MANAGE equals manage:users", () => {
      expect(RBAC_PERMISSIONS.MANAGE).toBe("manage:users");
    });
  });

  describe("rbacFeature", () => {
    it("has correct id", () => {
      expect(rbacFeature.id).toBe("rbac-management");
    });

    it("has category management", () => {
      expect(rbacFeature.category).toBe("management");
    });

    it("has permissions array with MANAGE", () => {
      expect(rbacFeature.permissions).toEqual([RBAC_PERMISSIONS.MANAGE]);
    });

    it("has exactly 2 actions", () => {
      expect(rbacFeature.actions).toHaveLength(2);
    });

    it("has role-permissions and user-role-assignment action ids", () => {
      const ids = rbacFeature.actions.map((a) => a.id);
      expect(ids).toContain("role-permissions");
      expect(ids).toContain("user-role-assignment");
    });
  });

  describe("rbacViews", () => {
    it("has entry for ROLE_MANAGEMENT route", () => {
      expect(rbacViews[RBAC_ROUTES.ROLE_MANAGEMENT]).toBeDefined();
      expect(rbacViews[RBAC_ROUTES.ROLE_MANAGEMENT].id).toBe(
        RBAC_ROUTES.ROLE_MANAGEMENT
      );
      expect(rbacViews[RBAC_ROUTES.ROLE_MANAGEMENT].requiresAuth).toBe(true);
      expect(rbacViews[RBAC_ROUTES.ROLE_MANAGEMENT].permissions).toEqual([
        RBAC_PERMISSIONS.MANAGE,
      ]);
    });

    it("has entry for USER_ROLE_ASSIGNMENT route", () => {
      expect(rbacViews[RBAC_ROUTES.USER_ROLE_ASSIGNMENT]).toBeDefined();
      expect(rbacViews[RBAC_ROUTES.USER_ROLE_ASSIGNMENT].id).toBe(
        RBAC_ROUTES.USER_ROLE_ASSIGNMENT
      );
      expect(rbacViews[RBAC_ROUTES.USER_ROLE_ASSIGNMENT].requiresAuth).toBe(
        true
      );
      expect(rbacViews[RBAC_ROUTES.USER_ROLE_ASSIGNMENT].permissions).toEqual([
        RBAC_PERMISSIONS.MANAGE,
      ]);
    });
  });
});
