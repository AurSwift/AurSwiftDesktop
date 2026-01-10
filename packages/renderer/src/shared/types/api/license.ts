/**
 * License API Types
 *
 * Type definitions for the license management API.
 */

export interface LicenseStatus {
  success: boolean;
  isActivated: boolean;
  message?: string;
  data?: {
    licenseKey: string;
    terminalName: string;
    planId: string;
    planName: string;
    features: string[];
    businessName: string | null;
    subscriptionStatus: string;
    expiresAt: string | null;
    trialEnd: string | null;
    activatedAt: string;
    lastHeartbeat: string;
    daysSinceHeartbeat: number | null;
    withinGracePeriod: boolean;
    gracePeriodDays: number;
  };
}

export interface LicenseActivationResult {
  success: boolean;
  message: string;
  data?: {
    activationId: string;
    planId: string;
    planName: string;
    maxTerminals: number;
    currentActivations: number;
    features: string[];
    expiresAt: string | null;
    subscriptionStatus: string;
    businessName: string | null;
    terminalName: string; // Terminal name from activation
    trialEnd: string | null;
  };
}

export interface LicenseValidationResult {
  success: boolean;
  message?: string;
  data?: {
    isValid: boolean;
    planId: string;
    planName: string;
    features: string[];
    subscriptionStatus: string;
    daysUntilExpiry?: number | null;
    offlineMode?: boolean;
  };
}

export interface MachineInfoResult {
  success: boolean;
  message?: string;
  data?: {
    hostname: string;
    platform: string;
    arch: string;
    cpuModel: string;
    totalMemoryGB: number;
    hasNetworkInterface: boolean;
    fingerprintPreview: string;
  };
}

export interface FeatureCheckResult {
  success: boolean;
  hasFeature: boolean;
  planId?: string;
  reason?: string;
  message?: string;
}

export interface HeartbeatResult {
  success: boolean;
  message: string;
  data?: {
    isValid: boolean;
    planId: string;
    subscriptionStatus: string;
    shouldDisable: boolean;
    gracePeriodRemaining: number | null;
  };
}

export interface LicenseInitResult {
  success: boolean;
  isActivated: boolean;
  message?: string;
  data?: {
    planId: string;
    planName: string;
    features: string[];
    businessName: string | null;
  };
}

export interface LicenseAPI {
  /**
   * Get current license activation status
   */
  getStatus: () => Promise<LicenseStatus>;

  /**
   * Activate a license key
   */
  activate: (
    licenseKey: string,
    terminalName?: string
  ) => Promise<LicenseActivationResult>;

  /**
   * Validate the current license (online check)
   */
  validate: () => Promise<LicenseValidationResult>;

  /**
   * Deactivate the current license
   */
  deactivate: () => Promise<{ success: boolean; message: string }>;

  /**
   * Get machine info for display
   */
  getMachineInfo: () => Promise<MachineInfoResult>;

  /**
   * Check if a feature is enabled for the current plan
   */
  hasFeature: (featureName: string) => Promise<FeatureCheckResult>;

  /**
   * Send a manual heartbeat to the license server
   */
  sendHeartbeat: () => Promise<HeartbeatResult>;

  /**
   * Initialize the license system (called on app start)
   */
  initialize: () => Promise<LicenseInitResult>;

  /**
   * Listen for real-time license events (disabled, reactivated, etc.)
   * @param callback - Function to call when license events occur
   * @returns Cleanup function to remove the listener
   */
  onLicenseEvent: (callback: (event: string, data: any) => void) => () => void;
}
