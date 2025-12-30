/**
 * License Status Badge
 *
 * Small badge component to show current license status.
 */

import { cn } from "@/shared/utils/cn";
import { CheckCircle, AlertCircle, XCircle, Wifi, WifiOff } from "lucide-react";

interface LicenseStatusBadgeProps {
  status: "active" | "expired" | "offline" | "invalid" | "loading";
  planName?: string;
  className?: string;
}

export function LicenseStatusBadge({
  status,
  planName,
  className,
}: LicenseStatusBadgeProps) {
  const statusConfig = {
    active: {
      icon: CheckCircle,
      text: planName || "Licensed",
      bgColor: "bg-green-100 dark:bg-green-900/30",
      textColor: "text-green-700 dark:text-green-400",
      iconColor: "text-green-600 dark:text-green-400",
    },
    expired: {
      icon: AlertCircle,
      text: "License Expired",
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
      textColor: "text-amber-700 dark:text-amber-400",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    offline: {
      icon: WifiOff,
      text: "Offline Mode",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
      textColor: "text-blue-700 dark:text-blue-400",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    invalid: {
      icon: XCircle,
      text: "Not Licensed",
      bgColor: "bg-red-100 dark:bg-red-900/30",
      textColor: "text-red-700 dark:text-red-400",
      iconColor: "text-red-600 dark:text-red-400",
    },
    loading: {
      icon: Wifi,
      text: "Checking...",
      bgColor: "bg-gray-100 dark:bg-gray-800",
      textColor: "text-gray-600 dark:text-gray-400",
      iconColor: "text-gray-500 dark:text-gray-400",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        config.bgColor,
        config.textColor,
        className
      )}
    >
      <Icon className={cn("w-3.5 h-3.5", config.iconColor)} />
      <span>{config.text}</span>
    </div>
  );
}
