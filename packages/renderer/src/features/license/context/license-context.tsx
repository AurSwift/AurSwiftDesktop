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
  const [error, setError] = useState<string | null>(null);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Refresh license status
  const refreshStatus = useCallback(async () => {
    try {
      const status = await getStatus();
      setLicenseStatus(status);
      setError(null); // Clear any previous errors on successful refresh
    } catch (err) {
      logger.error("Failed to refresh license status:", err);
      setError(
        err instanceof Error ? err.message : "Failed to refresh license status"
      );
    }
  }, [getStatus]);

  // Initialize on mount with retry logic
  useEffect(() => {
    let retryCount = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 1000;

    const init = async (): Promise<void> => {
      try {
        logger.info("Initializing license system...");
        const result = await licenseInitialize();

        if (!result.success && result.message) {
          // Initialization returned an error but didn't throw
          // This could be network issue, grace period expired, etc.
          logger.warn("License initialization warning:", result.message);

          // Only set error if it's a critical issue (not just "not activated")
          if (
            !result.message.includes("not activated") &&
            !result.message.includes("No local activation")
          ) {
            setError(result.message);
          }
        }

        const status = await getStatus();
        setLicenseStatus(status);
        setIsInitialized(true);
        logger.info("License system initialized successfully");
      } catch (err) {
        logger.error(
          `License initialization failed (attempt ${
            retryCount + 1
          }/${MAX_RETRIES}):`,
          err
        );

        // Retry on failure (database might not be ready yet)
        if (retryCount < MAX_RETRIES - 1) {
          retryCount++;
          logger.info(
            `Retrying license initialization in ${RETRY_DELAY_MS}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          return init(); // Retry
        }

        // Max retries exceeded
        setError(
          err instanceof Error
            ? err.message
            : "License initialization failed after multiple attempts"
        );
        setIsInitialized(true); // Mark as initialized even on failure to unblock UI
      }
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

          case "license:sseConnected":
            // SSE connection state changed - refresh status to update online/offline state
            if (data && (data as { connected: boolean }).connected) {
              logger.info("SSE connected, refreshing status");
              await refreshStatus();
            }
            break;

          default:
            // Other events - can be handled if needed
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
    error,
    clearError,
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
