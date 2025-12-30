/**
 * License Context Provider
 *
 * Global license state management for the application.
 * Provides license status to all components without prop drilling.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useLicense, type LicenseStatus } from "../hooks/use-license.js";
import { LicenseContext, type LicenseContextValue } from "./license-context-types.js";

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const {
    isLoading: licenseIsLoading,
    getStatus,
    activate: licenseActivate,
    deactivate: licenseDeactivate,
    hasFeature: licenseHasFeature,
    initialize: licenseInitialize,
  } = useLicense();
  
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Refresh license status
  const refreshStatus = useCallback(async () => {
    const status = await getStatus();
    setLicenseStatus(status);
  }, [getStatus]);

  // Initialize on mount (only once)
  useEffect(() => {
    const init = async () => {
      await licenseInitialize();
      const status = await getStatus();
      setLicenseStatus(status);
      setIsInitialized(true);
    };

    init();
  }, [licenseInitialize, getStatus]);

  // Activate license
  const activate = useCallback(
    async (licenseKey: string, terminalName?: string): Promise<boolean> => {
      const result = await licenseActivate(licenseKey, terminalName);

      if (result.success) {
        const status = await getStatus();
        setLicenseStatus(status);
        return true;
      }

      return false;
    },
    [licenseActivate, getStatus]
  );

  // Deactivate license
  const deactivate = useCallback(async (): Promise<boolean> => {
    const result = await licenseDeactivate();

    if (result.success) {
      const status = await getStatus();
      setLicenseStatus(status);
      return true;
    }

    return false;
  }, [licenseDeactivate, getStatus]);

  // Check feature
  const hasFeature = useCallback(
    async (featureName: string): Promise<boolean> => {
      return licenseHasFeature(featureName);
    },
    [licenseHasFeature]
  );

  const value: LicenseContextValue = {
    isActivated: licenseStatus?.isActivated ?? false,
    isLoading: licenseIsLoading || !isInitialized,
    licenseStatus,
    refreshStatus,
    activate,
    deactivate,
    hasFeature,
    planId: licenseStatus?.planId ?? null,
    planName: licenseStatus?.planName ?? null,
    businessName: licenseStatus?.businessName ?? null,
  };

  return (
    <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>
  );
}
