/**
 * Auth API Types
 * 
 * Types for authentication, user management, and session handling.
 * 
 * @module types/api/auth
 */

import type { APIResponse } from './common';

export interface AuthAPI {
  register: (userData: {
    email?: string;
    username: string;
    pin: string;
    firstName: string;
    lastName: string;
    businessName: string;
    role: 'cashier' | 'manager' | 'admin';
  }) => Promise<APIResponse>;

  registerBusiness: (userData: {
    email?: string;
    username: string;
    pin: string;
    firstName: string;
    lastName: string;
    businessName: string;
    avatar?: string;
    businessAvatar?: string;
  }) => Promise<APIResponse>;

  createUser: (
    sessionToken: string,
    userData: {
      businessId: string;
      username: string;
      pin: string;
      email?: string;
      firstName: string;
      lastName: string;
      role: 'cashier' | 'manager';
      avatar?: string;
      address?: string;
    }
  ) => Promise<APIResponse>;

  login: (credentials: {
    username: string;
    pin: string;
    rememberMe?: boolean;
    terminalId?: string;
    ipAddress?: string;
    locationId?: string;
    autoClockIn?: boolean;
  }) => Promise<
    APIResponse & {
      clockEvent?: any;
      shift?: any;
      requiresClockIn?: boolean;
    }
  >;

  validateSession: (token: string) => Promise<APIResponse>;

  logout: (
    token: string,
    options?: {
      terminalId?: string;
      ipAddress?: string;
      autoClockOut?: boolean;
    }
  ) => Promise<
    APIResponse & {
      isClockedIn?: boolean;
      activeShift?: any;
    }
  >;

  getUserById: (
    sessionTokenOrUserId: string,
    userId?: string
  ) => Promise<APIResponse>;

  updateUser: (
    sessionToken: string,
    userId: string,
    updates: Record<string, string | number | boolean>
  ) => Promise<APIResponse>;

  getAllActiveUsers: (sessionToken?: string) => Promise<APIResponse>;

  getUsersByBusiness: (
    sessionToken: string,
    businessId: string
  ) => Promise<APIResponse>;

  deleteUser: (sessionToken: string, userId: string) => Promise<APIResponse>;

  getBusinessById: (
    sessionToken: string,
    businessId: string
  ) => Promise<{
    success: boolean;
    business?: {
      id: string;
      firstName: string;
      lastName: string;
      businessName: string;
      ownerId: string;
      address?: string;
      phone?: string;
      vatNumber?: string;
      createdAt: string;
      updatedAt: string;
    };
    message?: string;
  }>;

  /** Verify PIN for a user by ID (e.g. till unlock). Does not create a session. */
  verifyPin: (userId: string, pin: string) => Promise<{ success: boolean; message?: string }>;

  /** Change PIN (self-service) */
  changePin: (sessionToken: string, currentPin: string, newPin: string) => Promise<{ success: boolean; message: string }>;

  /** Reset PIN (admin action) */
  resetPin: (sessionToken: string, userId: string) => Promise<{ success: boolean; message: string; temporaryPin?: string }>;

  /** Set new PIN (forced change) */
  setNewPin: (sessionToken: string, newPin: string) => Promise<{ success: boolean; message: string }>;
}
