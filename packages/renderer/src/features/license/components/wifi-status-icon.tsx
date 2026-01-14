/**
 * WiFi Status Icon Component
 *
 * Simple icon component that displays online/offline status with appropriate colors.
 * Shows green when online, yellow/red when offline based on warning level.
 */

import { Wifi, WifiOff } from "lucide-react";
import { useLicenseContext } from "../context/use-license-context";
import { cn } from "@/shared/utils/cn";
import { useState, useEffect } from "react";

interface WiFiStatusIconProps {
  className?: string;
  size?: number;
}

export function WiFiStatusIcon({ className, size }: WiFiStatusIconProps) {
  const { licenseStatus } = useLicenseContext();
  const [isOnline, setIsOnline] = useState(() => {
    // Check if navigator.onLine is available (browser/Electron)
    if (typeof navigator !== "undefined" && "onLine" in navigator) {
      return navigator.onLine;
    }
    // Default to online if we can't determine
    return true;
  });

  // Listen for online/offline events
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Also check periodically in case events don't fire
    const interval = setInterval(() => {
      if (typeof navigator !== "undefined" && "onLine" in navigator) {
        setIsOnline(navigator.onLine);
      }
    }, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Use actual network status, but show warning colors if license server is unreachable
  const isLicenseOffline = licenseStatus?.isOfflineMode ?? false;
  const warningLevel = licenseStatus?.gracePeriodWarningLevel ?? "none";

  // Determine color based on status
  const getColorClasses = () => {
    if (isOnline && !isLicenseOffline) {
      // Fully online - green
      return "text-green-600 dark:text-green-400";
    }

    if (isOnline && isLicenseOffline) {
      // Network is up but license server unreachable - show warning color
      switch (warningLevel) {
        case "expired":
          return "text-red-600 dark:text-red-400";
        case "high":
          return "text-orange-600 dark:text-orange-400";
        case "low":
          return "text-yellow-600 dark:text-yellow-400";
        default:
          return "text-yellow-600 dark:text-yellow-400";
      }
    }

    // No network connection - red
    return "text-red-600 dark:text-red-400";
  };

  const iconClasses = cn(
    getColorClasses(),
    size ? "" : "w-4 h-4 lg:w-5 lg:h-5"
  );

  // Show offline icon only if there's no network connection
  const showOfflineIcon = !isOnline;

  return (
    <div className={cn("flex items-center", className)}>
      {showOfflineIcon ? (
        <WifiOff
          className={iconClasses}
          size={size}
          aria-label="No Network Connection"
        />
      ) : (
        <Wifi
          className={iconClasses}
          size={size}
          aria-label={isLicenseOffline ? "Online (License Server Unreachable)" : "Online"}
        />
      )}
    </div>
  );
}
