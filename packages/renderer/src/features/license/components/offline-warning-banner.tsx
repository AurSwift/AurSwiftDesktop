/**
 * Offline Warning Banner Component
 *
 * Displays progressive warnings when app is in offline/grace period mode.
 * Warning levels:
 * - low: 3-7 days remaining (subtle notification)
 * - high: <3 days remaining (prominent warning)
 * - expired: Grace period expired (critical error)
 */

import { AlertTriangle, WifiOff, RefreshCcw, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useLicenseContext } from "../context/use-license-context";
import { getLogger } from "@/shared/utils/logger";

const logger = getLogger("OfflineWarningBanner");

export function OfflineWarningBanner() {
  const { licenseStatus, refreshStatus } = useLicenseContext();
  const [isRetrying, setIsRetrying] = useState(false);
  const [retrySuccess, setRetrySuccess] = useState(false);

  // Only show if in offline mode or has warning level
  const warningLevel = licenseStatus?.gracePeriodWarningLevel ?? "none";
  const shouldShow =
    licenseStatus?.isOfflineMode ||
    warningLevel === "expired" ||
    warningLevel === "high" ||
    warningLevel === "low";

  if (!shouldShow) {
    return null;
  }

  const daysRemaining = licenseStatus?.gracePeriodRemainingDays ?? 0;

  const handleRetryConnection = async () => {
    setIsRetrying(true);
    setRetrySuccess(false);

    try {
      const result = await window.licenseAPI.retryConnection();

      if (result.success) {
        logger.info("Connection retry successful");
        setRetrySuccess(true);

        // Refresh license status to update UI
        await refreshStatus();

        // Hide success message after 3 seconds
        setTimeout(() => {
          setRetrySuccess(false);
        }, 3000);
      } else {
        logger.warn("Connection retry failed:", result.message);
      }
    } catch (error) {
      logger.error("Connection retry error:", error);
    } finally {
      setIsRetrying(false);
    }
  };

  // Show success message after successful retry
  if (retrySuccess) {
    return (
      <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-900 dark:text-green-100">
          Connection Restored
        </AlertTitle>
        <AlertDescription className="text-green-800 dark:text-green-200">
          Your license has been successfully verified. You're back online!
        </AlertDescription>
      </Alert>
    );
  }

  // Expired state
  if (warningLevel === "expired") {
    return (
      <Alert
        variant="destructive"
        className="border-red-600 bg-red-50 dark:bg-red-950"
      >
        <WifiOff className="h-5 w-5" />
        <AlertTitle className="text-base font-bold">
          Offline Grace Period Expired
        </AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            Your license could not be verified for more than 7 days. Please
            reconnect to the internet to continue using AuraSwift.
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              onClick={handleRetryConnection}
              disabled={isRetrying}
              className="bg-red-600 hover:bg-red-700"
            >
              {isRetrying ? (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Retry Connection
                </>
              )}
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // High warning (< 3 days)
  if (warningLevel === "high") {
    return (
      <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950">
        <AlertTriangle className="h-5 w-5 text-orange-600" />
        <AlertTitle className="text-base font-bold text-orange-900 dark:text-orange-100">
          License Verification Required
        </AlertTitle>
        <AlertDescription className="text-orange-800 dark:text-orange-200 space-y-2">
          <p>
            <strong>Urgent:</strong> Your license hasn't been verified in a
            while. You have{" "}
            <span className="font-bold">
              {daysRemaining < 1
                ? `${Math.round(daysRemaining * 24)} hours`
                : `${Math.round(daysRemaining * 10) / 10} days`}
            </span>{" "}
            remaining before the app requires reactivation.
          </p>
          <p className="text-sm">
            Please connect to the internet to verify your subscription.
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              onClick={handleRetryConnection}
              disabled={isRetrying}
              variant="outline"
              className="border-orange-600 text-orange-900 hover:bg-orange-100 dark:text-orange-100 dark:hover:bg-orange-900"
            >
              {isRetrying ? (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Check Connection
                </>
              )}
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Low warning (3-7 days)
  if (warningLevel === "low") {
    return (
      <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
        <WifiOff className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-900 dark:text-yellow-100">
          Running in Offline Mode
        </AlertTitle>
        <AlertDescription className="text-yellow-800 dark:text-yellow-200 space-y-2">
          <p>
            Your license hasn't been verified recently. You have{" "}
            <span className="font-semibold">
              {Math.round(daysRemaining * 10) / 10} days
            </span>{" "}
            of offline access remaining.
          </p>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRetryConnection}
            disabled={isRetrying}
            className="text-yellow-900 hover:bg-yellow-100 dark:text-yellow-100 dark:hover:bg-yellow-900 h-8 px-3"
          >
            {isRetrying ? (
              <>
                <RefreshCcw className="mr-2 h-3 w-3 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCcw className="mr-2 h-3 w-3" />
                Retry Connection
              </>
            )}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
