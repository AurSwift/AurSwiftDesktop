/**
 * WiFi Status Icon Component
 *
 * Simple icon component that displays online/offline status with appropriate colors.
 * Shows green when online, yellow/red when offline based on warning level.
 */

import { Wifi, WifiOff } from "lucide-react";
import { useLicenseContext } from "../context/use-license-context";
import { cn } from "@/shared/utils/cn";

interface WiFiStatusIconProps {
  className?: string;
  size?: number;
}

export function WiFiStatusIcon({ className, size }: WiFiStatusIconProps) {
  const { licenseStatus } = useLicenseContext();

  // Default to online if still loading or no status
  const isOffline = licenseStatus?.isOfflineMode ?? false;
  const warningLevel = licenseStatus?.gracePeriodWarningLevel ?? "none";

  // Determine color based on status
  const getColorClasses = () => {
    if (!isOffline) {
      // Online - green
      return "text-green-600 dark:text-green-400";
    }

    // Offline - color based on warning level
    switch (warningLevel) {
      case "expired":
        return "text-red-600 dark:text-red-400";
      case "high":
        return "text-orange-600 dark:text-orange-400";
      case "low":
        return "text-yellow-600 dark:text-yellow-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  const iconClasses = cn(
    getColorClasses(),
    size ? "" : "w-4 h-4 lg:w-5 lg:h-5"
  );

  return (
    <div className={cn("flex items-center", className)}>
      {isOffline ? (
        <WifiOff
          className={iconClasses}
          size={size}
          aria-label="Offline Mode"
        />
      ) : (
        <Wifi
          className={iconClasses}
          size={size}
          aria-label="Online"
        />
      )}
    </div>
  );
}
