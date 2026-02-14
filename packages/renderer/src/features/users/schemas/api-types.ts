/**
 * API Response Types and Type Guards
 * Provides proper TypeScript interfaces for all API responses
 */

import type { StaffUser } from "./types";

/**
 * Base API Response structure
 */
export interface BaseAPIResponse {
  success: boolean;
  message?: string;
  errors?: string[];
}

/**
 * Get Users Response
 */
export interface GetUsersAPIResponse extends BaseAPIResponse {
  users?: RawUserData[];
}

/**
 * Raw user data from backend (before transformation)
 */
export interface RawUserData {
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
  primaryRole?: RawRoleData;
}

/**
 * Raw role data from backend
 */
export interface RawRoleData {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  permissions?: unknown[];
}

/**
 * Create User Response
 */
export interface CreateUserAPIResponse extends BaseAPIResponse {
  user?: StaffUser;
}

/**
 * Update User Response
 */
export interface UpdateUserAPIResponse extends BaseAPIResponse {
  user?: StaffUser;
}

/**
 * Delete User Response
 */
export interface DeleteUserAPIResponse extends BaseAPIResponse {}

/**
 * Reset PIN Response
 */
export interface ResetPINAPIResponse extends BaseAPIResponse {}

/**
 * Get Roles Response
 */
export interface GetRolesAPIResponse extends BaseAPIResponse {
  data?: RawRoleData[];
}

/**
 * Type Guards
 */

export function isGetUsersResponse(
  response: unknown,
): response is GetUsersAPIResponse {
  return (
    typeof response === "object" &&
    response !== null &&
    "success" in response &&
    typeof (response as BaseAPIResponse).success === "boolean"
  );
}

export function isCreateUserResponse(
  response: unknown,
): response is CreateUserAPIResponse {
  return (
    typeof response === "object" &&
    response !== null &&
    "success" in response &&
    typeof (response as BaseAPIResponse).success === "boolean"
  );
}

export function isUpdateUserResponse(
  response: unknown,
): response is UpdateUserAPIResponse {
  return (
    typeof response === "object" &&
    response !== null &&
    "success" in response &&
    typeof (response as BaseAPIResponse).success === "boolean"
  );
}

export function isDeleteUserResponse(
  response: unknown,
): response is DeleteUserAPIResponse {
  return (
    typeof response === "object" &&
    response !== null &&
    "success" in response &&
    typeof (response as BaseAPIResponse).success === "boolean"
  );
}

export function isRawUserData(data: unknown): data is RawUserData {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "firstName" in data &&
    "lastName" in data &&
    "businessId" in data
  );
}

export function isRawRoleData(data: unknown): data is RawRoleData {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "name" in data &&
    "displayName" in data
  );
}
