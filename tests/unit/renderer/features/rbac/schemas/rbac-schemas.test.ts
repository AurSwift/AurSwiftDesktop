import { describe, it, expect } from "vitest";
import {
  roleCreateSchema,
  roleUpdateSchema,
  userRoleAssignSchema,
  permissionGrantSchema,
} from "@/features/rbac/schemas";

describe("rbac schemas", () => {
  describe("roleCreateSchema", () => {
    it("accepts valid complete data", () => {
      const result = roleCreateSchema.safeParse({
        name: "inventory_specialist",
        displayName: "Inventory Specialist",
        description: "Manages inventory and stock.",
        permissions: ["read:products", "write:products"],
      });
      expect(result.success).toBe(true);
    });

    it("rejects name with uppercase", () => {
      const result = roleCreateSchema.safeParse({
        name: "Inventory_Specialist",
        displayName: "Inventory Specialist",
        permissions: ["read:products"],
      });
      expect(result.success).toBe(false);
    });

    it("rejects name with spaces", () => {
      const result = roleCreateSchema.safeParse({
        name: "inventory specialist",
        displayName: "Inventory Specialist",
        permissions: ["read:products"],
      });
      expect(result.success).toBe(false);
    });

    it("rejects name with special characters", () => {
      const result = roleCreateSchema.safeParse({
        name: "inventory-specialist",
        displayName: "Inventory Specialist",
        permissions: ["read:products"],
      });
      expect(result.success).toBe(false);
    });

    it("enforces name min length 3", () => {
      const result = roleCreateSchema.safeParse({
        name: "ab",
        displayName: "Ab",
        permissions: ["read:products"],
      });
      expect(result.success).toBe(false);
    });

    it("enforces name max length 50", () => {
      const result = roleCreateSchema.safeParse({
        name: "a".repeat(51),
        displayName: "Long Name",
        permissions: ["read:products"],
      });
      expect(result.success).toBe(false);
    });

    it("accepts name with lowercase and underscores", () => {
      const result = roleCreateSchema.safeParse({
        name: "custom_role_123",
        displayName: "Custom Role",
        permissions: ["read:products"],
      });
      expect(result.success).toBe(true);
    });

    it("enforces displayName min 3", () => {
      const result = roleCreateSchema.safeParse({
        name: "role",
        displayName: "Ab",
        permissions: ["read:products"],
      });
      expect(result.success).toBe(false);
    });

    it("enforces displayName max 100", () => {
      const result = roleCreateSchema.safeParse({
        name: "role",
        displayName: "a".repeat(101),
        permissions: ["read:products"],
      });
      expect(result.success).toBe(false);
    });

    it("accepts empty description", () => {
      const result = roleCreateSchema.safeParse({
        name: "role",
        displayName: "Role",
        description: "",
        permissions: ["read:products"],
      });
      expect(result.success).toBe(true);
    });

    it("accepts undefined description", () => {
      const result = roleCreateSchema.safeParse({
        name: "role",
        displayName: "Role",
        permissions: ["read:products"],
      });
      expect(result.success).toBe(true);
    });

    it("rejects description shorter than 10 characters when provided", () => {
      const result = roleCreateSchema.safeParse({
        name: "role",
        displayName: "Role",
        description: "Short",
        permissions: ["read:products"],
      });
      expect(result.success).toBe(false);
    });

    it("accepts description with at least 10 characters", () => {
      const result = roleCreateSchema.safeParse({
        name: "role",
        displayName: "Role",
        description: "Ten chars!!",
        permissions: ["read:products"],
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty permissions array", () => {
      const result = roleCreateSchema.safeParse({
        name: "role",
        displayName: "Role",
        permissions: [],
      });
      expect(result.success).toBe(false);
    });

    it("accepts permissions array with one or more strings", () => {
      const result = roleCreateSchema.safeParse({
        name: "role",
        displayName: "Role",
        permissions: ["manage:users"],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("roleUpdateSchema", () => {
    it("accepts empty object (all optional)", () => {
      const result = roleUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("enforces displayName min/max when provided", () => {
      expect(roleUpdateSchema.safeParse({ displayName: "ab" }).success).toBe(false);
      expect(
        roleUpdateSchema.safeParse({ displayName: "a".repeat(101) }).success
      ).toBe(false);
      expect(
        roleUpdateSchema.safeParse({ displayName: "Valid Name" }).success
      ).toBe(true);
    });

    it("enforces description min 10 when provided", () => {
      expect(
        roleUpdateSchema.safeParse({ description: "short" }).success
      ).toBe(false);
      expect(
        roleUpdateSchema.safeParse({ description: "Ten chars!!" }).success
      ).toBe(true);
    });

    it("accepts isActive boolean", () => {
      expect(roleUpdateSchema.safeParse({ isActive: true }).success).toBe(true);
      expect(roleUpdateSchema.safeParse({ isActive: false }).success).toBe(true);
    });

    it("accepts optional permissions array", () => {
      expect(
        roleUpdateSchema.safeParse({ permissions: ["read:products"] }).success
      ).toBe(true);
    });
  });

  describe("userRoleAssignSchema", () => {
    it("accepts valid data", () => {
      const result = userRoleAssignSchema.safeParse({
        userId: "user-1",
        roleId: "role-1",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty userId", () => {
      const result = userRoleAssignSchema.safeParse({
        userId: "",
        roleId: "role-1",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty roleId", () => {
      const result = userRoleAssignSchema.safeParse({
        userId: "user-1",
        roleId: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("permissionGrantSchema", () => {
    it("accepts valid complete data", () => {
      const result = permissionGrantSchema.safeParse({
        userId: "user-1",
        permission: "manage:users",
        grantedBy: "admin-1",
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional reason with min 10 chars", () => {
      const result = permissionGrantSchema.safeParse({
        userId: "user-1",
        permission: "manage:users",
        grantedBy: "admin-1",
        reason: "Temporary access for audit",
      });
      expect(result.success).toBe(true);
    });

    it("rejects reason shorter than 10 when provided", () => {
      const result = permissionGrantSchema.safeParse({
        userId: "user-1",
        permission: "manage:users",
        grantedBy: "admin-1",
        reason: "Short",
      });
      expect(result.success).toBe(false);
    });

    it("rejects reason longer than 500 when provided", () => {
      const result = permissionGrantSchema.safeParse({
        userId: "user-1",
        permission: "manage:users",
        grantedBy: "admin-1",
        reason: "a".repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it("accepts optional expiresAt as Date", () => {
      const result = permissionGrantSchema.safeParse({
        userId: "user-1",
        permission: "manage:users",
        grantedBy: "admin-1",
        expiresAt: new Date(),
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty userId", () => {
      const result = permissionGrantSchema.safeParse({
        userId: "",
        permission: "p",
        grantedBy: "admin-1",
      });
      expect(result.success).toBe(false);
    });
  });
});
