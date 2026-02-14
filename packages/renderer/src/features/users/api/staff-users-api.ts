import type { StaffUser } from "../schemas/types";
import type {
  UserCreateFormData,
  UserUpdateFormData,
} from "../schemas/user-schema";
import { getUserRoleName } from "@/shared/utils/rbac-helpers";

/**
 * API Response types
 */
export interface APIResponse<T = unknown> {
  success: boolean;
  message?: string;
  errors?: string[];
  data?: T;
}

export interface StaffUsersResponse extends APIResponse {
  users?: Array<{
    id: string;
    username?: string;
    email?: string;
    firstName: string;
    lastName: string;
    businessName: string;
    businessId: string;
    avatar?: string;
    address?: string;
    createdAt?: string;
    isActive?: boolean;
    primaryRoleId?: string;
    roleName?: string;
    primaryRole?: {
      id: string;
      name: string;
      displayName: string;
      description?: string;
      permissions?: unknown[];
    };
  }>;
}

export interface UserCreateResponse extends APIResponse {
  user?: StaffUser;
}

export interface UserUpdateResponse extends APIResponse {
  user?: StaffUser;
}

export interface UserDeleteResponse extends APIResponse {}

/**
 * Pure API functions for staff users
 * These functions have no side effects (no toasts, no state updates)
 */

/**
 * Fetch all staff users for a business
 * Filters out admin users automatically
 */
export async function fetchStaffUsers(
  businessId: string,
): Promise<StaffUser[]> {
  // Get session token for authentication
  const sessionToken = await window.authStore.get("token");
  if (!sessionToken) {
    throw new Error("Not authenticated");
  }

  const response = (await window.authAPI.getUsersByBusiness(
    sessionToken,
    businessId,
  )) as StaffUsersResponse;

  if (!response.success) {
    throw new Error(response.message || "Failed to load staff users");
  }

  if (!response.users) {
    return [];
  }

  // Filter out admin users and convert to StaffUser format
  const staffUsers: StaffUser[] = response.users
    .filter((u) => getUserRoleName(u) !== "admin")
    .map((u) => ({
      id: u.id,
      username: u.username || "",
      email: u.email || "",
      firstName: u.firstName,
      lastName: u.lastName,
      businessName: u.businessName,
      businessId: u.businessId,
      avatar: u.avatar,
      address: u.address || "",
      createdAt: u.createdAt || new Date().toISOString(),
      isActive: u.isActive !== undefined ? u.isActive : true,
      // RBAC fields
      primaryRoleId: u.primaryRoleId,
      roleName: u.roleName,
      primaryRole: u.primaryRole,
    }));

  return staffUsers;
}

/**
 * Create a new staff user
 */
export async function createStaffUser(
  data: UserCreateFormData,
  createUserFn: (userData: unknown) => Promise<APIResponse>,
): Promise<StaffUser> {
  if (!data.businessId) {
    throw new Error("Business ID is required");
  }

  const userData = {
    businessId: data.businessId,
    email: data.email || undefined,
    username: data.username,
    pin: data.pin,
    firstName: data.firstName,
    lastName: data.lastName,
    role: data.role,
    avatar: data.avatar || undefined,
    address: data.address || undefined,
  };

  const response = (await createUserFn(userData)) as UserCreateResponse;

  if (!response.success) {
    const errorMessage = response.message || "Failed to create staff member";
    const errors = response.errors || [errorMessage];
    throw new Error(errors.join(", "));
  }

  if (!response.user) {
    throw new Error("No user data returned from server");
  }

  return response.user;
}

/**
 * Update an existing staff user
 */
export async function updateStaffUser(
  data: UserUpdateFormData,
  updateUserFn: (userData: unknown) => Promise<APIResponse>,
): Promise<StaffUser> {
  const userData = {
    id: data.id,
    email: data.email || undefined,
    firstName: data.firstName,
    lastName: data.lastName,
    role: data.role || undefined,
    avatar: data.avatar || undefined,
    address: data.address || undefined,
    businessId: data.businessId,
  };

  const response = (await updateUserFn(userData)) as UserUpdateResponse;

  if (!response.success) {
    const errorMessage = response.message || "Failed to update staff member";
    const errors = response.errors || [errorMessage];
    throw new Error(errors.join(", "));
  }

  if (!response.user) {
    throw new Error("No user data returned from server");
  }

  return response.user;
}

/**
 * Delete a staff user
 */
export async function deleteStaffUser(
  userId: string,
  deleteUserFn: (userId: string) => Promise<APIResponse>,
): Promise<void> {
  const response = (await deleteUserFn(userId)) as UserDeleteResponse;

  if (!response.success) {
    const errorMessage = response.message || "Failed to delete staff member";
    throw new Error(errorMessage);
  }
}
