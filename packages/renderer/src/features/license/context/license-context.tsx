/**
 * License Context Provider
 *
 * Global license state management for the application.
 * Provides license status to all components without prop drilling.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useLicense, type LicenseStatus } from "../hooks/use-license.js";
import {
  LicenseContext,
  type LicenseContextValue,
} from "./license-context-types.js";
import { getLogger } from "@/shared/utils/logger";

const logger = getLogger("LicenseContext");

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const {
    isLoading: licenseIsLoading,
    getStatus,
    activate: licenseActivate,
    deactivate: licenseDeactivate,
    hasFeature: licenseHasFeature,
    initialize: licenseInitialize,
  } = useLicense();

  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(
    null
  );
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

  // Listen for real-time license events (revocation, reactivation, etc.)
  useEffect(() => {
    if (!window.licenseAPI?.onLicenseEvent) {
      return;
    }

    const cleanup = window.licenseAPI.onLicenseEvent(
      async (eventType, data) => {
        logger.debug(`Received ${eventType} event:`, data);

        // Handle different event types
        switch (eventType) {
          case "license:disabled":
            // License was revoked or cancelled - immediately refresh status
            logger.warn("License disabled, refreshing status");
            await refreshStatus();
            break;

          case "license:reactivated":
            // License was reactivated - refresh status
            logger.info("License reactivated, refreshing status");
            await refreshStatus();
            break;

          case "license:planChanged":
            // Plan was changed - refresh status
            logger.info("Plan changed, refreshing status");
            await refreshStatus();
            break;

          case "license:cancelScheduled":
            // Subscription cancelled but still in grace period
            logger.info("Cancellation scheduled, refreshing status");
            await refreshStatus();
            break;

          default:
            // Other events (e.g., license:sseConnected) - can be handled if needed
            break;
        }
      }
    );

    // Cleanup on unmount
    return cleanup;
  }, [refreshStatus]);

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
