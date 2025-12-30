/**
 * License Hook
 *
 * Provides license state and actions for components.
 */

import { useState, useCallback } from "react";

export interface LicenseStatus {
  isActivated: boolean;
  licenseKey?: string;
  terminalName?: string;
  planId?: string;
  planName?: string;
  features?: string[];
  businessName?: string | null;
  subscriptionStatus?: string;
  expiresAt?: string | null;
  activatedAt?: string;
  lastHeartbeat?: string;
  daysSinceHeartbeat?: number | null;
  withinGracePeriod?: boolean;
  gracePeriodDays?: number;
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
  };
}

export interface MachineInfo {
  hostname: string;
  platform: string;
  arch: string;
  cpuModel: string;
  totalMemoryGB: number;
  hasNetworkInterface: boolean;
  fingerprintPreview: string;
}

export function useLicense() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Get current license status
   */
  const getStatus = useCallback(async (): Promise<LicenseStatus | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.licenseAPI.getStatus();

      if (!result.success) {
        setError(result.message || "Failed to get license status");
        return null;
      }

      return {
        isActivated: result.isActivated,
        ...result.data,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get license status";
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Activate a license key
   */
  const activate = useCallback(
    async (
      licenseKey: string,
      terminalName?: string
    ): Promise<LicenseActivationResult> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await window.licenseAPI.activate(licenseKey, terminalName);

        if (!result.success) {
          setError(result.message || "Activation failed");
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Activation failed";
        setError(message);
        return { success: false, message };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Validate current license
   */
  const validate = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.licenseAPI.validate();

      if (!result.success) {
        setError(result.message || "Validation failed");
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Validation failed";
      setError(message);
      return { success: false, message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Deactivate current license
   */
  const deactivate = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.licenseAPI.deactivate();

      if (!result.success) {
        setError(result.message || "Deactivation failed");
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Deactivation failed";
      setError(message);
      return { success: false, message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get machine info
   */
  const getMachineInfo = useCallback(async (): Promise<MachineInfo | null> => {
    try {
      const result = await window.licenseAPI.getMachineInfo();

      if (!result.success || !result.data) {
        return null;
      }

      return result.data;
    } catch {
      return null;
    }
  }, []);

  /**
   * Check if a feature is enabled
   */
  const hasFeature = useCallback(async (featureName: string): Promise<boolean> => {
    try {
      const result = await window.licenseAPI.hasFeature(featureName);
      return result.success && result.hasFeature;
    } catch {
      return false;
    }
  }, []);

  /**
   * Initialize license system
   */
  const initialize = useCallback(async () => {
    try {
      const result = await window.licenseAPI.initialize();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Initialization failed";
      return { success: false, message, isActivated: false };
    }
  }, []);

  return {
    isLoading,
    error,
    clearError: () => setError(null),
    getStatus,
    activate,
    validate,
    deactivate,
    getMachineInfo,
    hasFeature,
    initialize,
  };
}
