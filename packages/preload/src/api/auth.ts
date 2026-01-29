import { ipcRenderer } from "electron";

export const authAPI = {
  register: (userData: {
    email?: string;
    firstName: string;
    lastName: string;
    businessName: string;
    role: "cashier" | "manager" | "admin";
    username: string;
    pin: string;
  }) => ipcRenderer.invoke("auth:register", userData),

  registerBusiness: (userData: {
    email?: string;
    firstName: string;
    lastName: string;
    businessName: string;
    username: string;
    pin: string;
    avatar?: string;
    businessAvatar?: string;
  }) => ipcRenderer.invoke("auth:registerBusiness", userData),

  createUser: (
    sessionToken: string,
    userData: {
      businessId: string;
      username: string;
      pin: string;
      email?: string;
      firstName: string;
      lastName: string;
      role: "cashier" | "manager";
      avatar?: string;
    }
  ) => ipcRenderer.invoke("auth:createUser", sessionToken, userData),

  login: (credentials: {
    username: string;
    pin: string;
    rememberMe?: boolean;
    terminalId?: string;
    ipAddress?: string;
  }) => ipcRenderer.invoke("auth:login", credentials),

  validateSession: (token: string) =>
    ipcRenderer.invoke("auth:validateSession", token),

  logout: (
    token: string,
    options?: {
      terminalId?: string;
      ipAddress?: string;
    }
  ) => ipcRenderer.invoke("auth:logout", token, options),

  getUserById: (sessionTokenOrUserId: string, userId?: string) =>
    ipcRenderer.invoke("auth:getUserById", sessionTokenOrUserId, userId),

  updateUser: (sessionToken: string, userId: string, updates: any) =>
    ipcRenderer.invoke("auth:updateUser", sessionToken, userId, updates),

  getAllActiveUsers: (sessionToken?: string) =>
    ipcRenderer.invoke("auth:getAllActiveUsers", sessionToken),

  getUsersByBusiness: (sessionToken: string, businessId: string) =>
    ipcRenderer.invoke("auth:getUsersByBusiness", sessionToken, businessId),

  deleteUser: (sessionToken: string, userId: string) =>
    ipcRenderer.invoke("auth:deleteUser", sessionToken, userId),

  getBusinessById: (sessionToken: string, businessId: string) =>
    ipcRenderer.invoke("auth:getBusinessById", sessionToken, businessId),

  verifyPin: (userId: string, pin: string) =>
    ipcRenderer.invoke("auth:verifyPin", userId, pin),

  // PIN Management
  changePin: (sessionToken: string, currentPin: string, newPin: string) =>
    ipcRenderer.invoke("auth:change-pin", sessionToken, currentPin, newPin),

  resetPin: (sessionToken: string, userId: string) =>
    ipcRenderer.invoke("auth:reset-pin", sessionToken, userId),

  setNewPin: (sessionToken: string, newPin: string) =>
    ipcRenderer.invoke("auth:set-new-pin", sessionToken, newPin),
};

export const authStore = {
  set: (key: string, value: string) =>
    ipcRenderer.invoke("auth:set", key, value),
  get: (key: string) => ipcRenderer.invoke("auth:get", key),
  delete: (key: string) => ipcRenderer.invoke("auth:delete", key),
};

// Time Tracking API
export const timeTrackingAPI = {
  clockIn: (data: {
    userId: string;
    terminalId: string;
    locationId?: string;
    businessId: string;
    ipAddress?: string;
  }) => ipcRenderer.invoke("timeTracking:clockIn", data),

  clockOut: (data: {
    userId: string;
    terminalId: string;
    ipAddress?: string;
  }) => ipcRenderer.invoke("timeTracking:clockOut", data),

  getActiveShift: (userId: string) =>
    ipcRenderer.invoke("timeTracking:getActiveShift", userId),

  startBreak: (data: {
    shiftId: string;
    userId: string;
    type?: "meal" | "rest" | "other";
    isPaid?: boolean;
  }) => ipcRenderer.invoke("timeTracking:startBreak", data),

  endBreak: (breakId: string) =>
    ipcRenderer.invoke("timeTracking:endBreak", breakId),

  // ============================================================================
  // Reporting (Admin/Manager)
  // ============================================================================

  getRealTimeDashboard: (businessId: string) =>
    ipcRenderer.invoke("timeTracking:reports:getRealTimeDashboard", businessId),

  getShiftsReport: (args: {
    businessId: string;
    startDate: string;
    endDate: string;
    filters?: {
      userIds?: string[];
      status?: "active" | "ended";
      complianceOnly?: boolean;
    };
  }) => ipcRenderer.invoke("timeTracking:reports:getShifts", args),

  getShiftDetails: (shiftId: string) =>
    ipcRenderer.invoke("timeTracking:reports:getShiftDetails", shiftId),

  getBreakComplianceReport: (args: {
    businessId: string;
    startDate: string;
    endDate: string;
  }) => ipcRenderer.invoke("timeTracking:reports:getBreakCompliance", args),

  getPayrollSummary: (args: {
    businessId: string;
    startDate: string;
    endDate: string;
    hourlyRate?: number;
  }) => ipcRenderer.invoke("timeTracking:reports:getPayrollSummary", args),

  getPendingTimeCorrections: (businessId: string) =>
    ipcRenderer.invoke("timeTracking:reports:getPendingTimeCorrections", businessId),

  // ============================================================================
  // Manager overrides (reason required)
  // ============================================================================

  forceClockOut: (args: { userId: string; managerId: string; reason: string }) =>
    ipcRenderer.invoke("timeTracking:manager:forceClockOut", args),

  updateBreak: (args: {
    breakId: string;
    managerId: string;
    reason: string;
    patch: {
      startTime?: string;
      endTime?: string | null;
      type?: "meal" | "rest" | "other";
      isPaid?: boolean;
      notes?: string | null;
    };
  }) => ipcRenderer.invoke("timeTracking:manager:updateBreak", args),

  processTimeCorrection: (args: {
    correctionId: string;
    managerId: string;
    approved: boolean;
  }) => ipcRenderer.invoke("timeTracking:manager:processTimeCorrection", args),
};
