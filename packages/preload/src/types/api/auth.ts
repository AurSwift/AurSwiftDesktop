/**
 * Auth API Types - Preload
 *
 * Type definitions for authentication and user management IPC APIs.
 *
 * @module preload/types/api/auth
 */

export interface AuthAPIPreload {
  register: (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    businessName: string;
    role: "cashier" | "manager" | "admin";
  }) => Promise<any>;

  registerBusiness: (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    businessName: string;
    avatar?: string;
    businessAvatar?: string;
  }) => Promise<any>;

  createUser: (
    sessionToken: string,
    userData: {
      businessId: string;
      username: string;
      pin: string;
      email?: string;
      password?: string;
      firstName: string;
      lastName: string;
      role: "cashier" | "manager";
      avatar?: string;
    }
  ) => Promise<any>;

  login: (credentials: {
    username: string;
    pin: string;
    rememberMe?: boolean;
    terminalId?: string;
    ipAddress?: string;
  }) => Promise<any>;

  validateSession: (token: string) => Promise<any>;

  logout: (
    token: string,
    options?: {
      terminalId?: string;
      ipAddress?: string;
    }
  ) => Promise<any>;

  getUserById: (sessionTokenOrUserId: string, userId?: string) => Promise<any>;

  updateUser: (
    sessionToken: string,
    userId: string,
    updates: any
  ) => Promise<any>;

  getAllActiveUsers: (sessionToken?: string) => Promise<any>;

  getUsersByBusiness: (
    sessionToken: string,
    businessId: string
  ) => Promise<any>;

  deleteUser: (sessionToken: string, userId: string) => Promise<any>;

  getBusinessById: (sessionToken: string, businessId: string) => Promise<any>;

  verifyPin: (userId: string, pin: string) => Promise<{ success: boolean; message?: string }>;
}

export interface AuthStoreAPIPreload {
  set: (key: string, value: string) => Promise<void>;
  get: (key: string) => Promise<string | null>;
  delete: (key: string) => Promise<void>;
}

export interface TimeTrackingAPIPreload {
  clockIn: (data: {
    userId: string;
    terminalId: string;
    locationId?: string;
    businessId: string;
    ipAddress?: string;
  }) => Promise<any>;

  clockOut: (data: {
    userId: string;
    terminalId: string;
    ipAddress?: string;
  }) => Promise<any>;

  getActiveShift: (userId: string) => Promise<any>;

  startBreak: (data: {
    shiftId: string;
    userId: string;
    type?: "meal" | "rest" | "other";
    isPaid?: boolean;
  }) => Promise<any>;

  endBreak: (breakId: string) => Promise<any>;
}
