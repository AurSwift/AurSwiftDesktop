/**
 * RBAC Test Fixtures
 *
 * Factory functions for creating test role, user-role, and permission data.
 */

export interface MockRole {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  permissions: string[];
  businessId: string;
  isSystemRole: boolean;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MockUserRole {
  id: string;
  userId: string;
  roleId: string;
  assignedBy: string;
  assignedAt: number;
  expiresAt: number | null;
  isActive: boolean;
  role?: {
    id: string;
    name: string;
    displayName: string;
    permissions: string[];
  };
}

/** Test permission strings for use in fixtures and mocks */
export const TEST_PERMISSIONS = [
  "manage:users",
  "read:products",
  "write:products",
  "read:sales",
  "write:sales",
] as const;

/**
 * Create a single mock role with optional overrides
 */
export function createMockRole(overrides?: Partial<MockRole>): MockRole {
  const id =
    overrides?.id ||
    `role-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = Date.now();
  return {
    id,
    name: overrides?.name ?? "custom_role",
    displayName: overrides?.displayName ?? "Custom Role",
    description: overrides?.description ?? "A custom role for testing",
    permissions: overrides?.permissions ?? [TEST_PERMISSIONS[0]],
    businessId: overrides?.businessId ?? "business-test-1",
    isSystemRole: overrides?.isSystemRole ?? false,
    isActive: overrides?.isActive ?? true,
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
    ...overrides,
  };
}

/**
 * Create a system role (isSystemRole: true)
 */
export function createSystemRole(overrides?: Partial<MockRole>): MockRole {
  return createMockRole({
    name: "admin",
    displayName: "Administrator",
    description: "System administrator role",
    isSystemRole: true,
    ...overrides,
  });
}

/**
 * Create an inactive role (isActive: false)
 */
export function createInactiveRole(overrides?: Partial<MockRole>): MockRole {
  return createMockRole({
    isActive: false,
    displayName: "Inactive Role",
    ...overrides,
  });
}

/**
 * Create multiple mock roles
 */
export function createMockRoles(count: number, overrides?: Partial<MockRole>): MockRole[] {
  return Array.from({ length: count }, (_, i) =>
    createMockRole({
      id: `role-${i}`,
      name: `role_${i}`,
      displayName: `Role ${i}`,
      ...overrides,
    })
  );
}

/**
 * Create a mock user-role assignment with optional role embed
 */
export function createMockUserRole(
  overrides?: Partial<MockUserRole>
): MockUserRole {
  const id =
    overrides?.id ||
    `ur-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = Date.now();
  return {
    id,
    userId: overrides?.userId ?? "user-test-1",
    roleId: overrides?.roleId ?? "role-test-1",
    assignedBy: overrides?.assignedBy ?? "admin-user-id",
    assignedAt: overrides?.assignedAt ?? now,
    expiresAt: overrides?.expiresAt ?? null,
    isActive: overrides?.isActive ?? true,
    role: overrides?.role,
    ...overrides,
  };
}

/**
 * Create multiple mock user-roles for a user
 */
export function createMockUserRoles(
  count: number,
  userId: string,
  baseOverrides?: Partial<MockUserRole>
): MockUserRole[] {
  return Array.from({ length: count }, (_, i) =>
    createMockUserRole({
      userId,
      roleId: `role-${i}`,
      role: {
        id: `role-${i}`,
        name: `role_${i}`,
        displayName: `Role ${i}`,
        permissions: [TEST_PERMISSIONS[0]],
      },
      ...baseOverrides,
    })
  );
}
