/**
 * License Header Badge
 *
 * Compact badge component for dashboard header showing current subscription plan.
 * Displays plan name and status with appropriate visual indicators.
 * Clickable to navigate to detailed license information page.
 */

import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useLicenseContext } from "@/features/license";
import { Shield, AlertCircle, WifiOff, Clock } from "lucide-react";
import { cn } from "@/shared/utils/cn";

export function LicenseHeaderBadge() {
  const navigate = useNavigate();
  const { licenseStatus, isActivated, isLoading, planName } =
    useLicenseContext();

  // Don't show badge while loading
  if (isLoading) {
    return null;
  }

  // If not activated (or status hasn't hydrated yet), still show a clickable badge
  // so the user can always access the license screen.
  if (!isActivated || !licenseStatus) {
    return (
      <Badge
        variant="outline"
        onClick={() => navigate("/license")}
        className={cn(
          "text-xs flex items-center gap-1 px-2 py-1 font-medium cursor-pointer hover:opacity-80 transition-opacity",
          "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
        )}
      >
        <AlertCircle className="h-3 w-3" />
        <span>{planName || "License"} - Not Activated</span>
      </Badge>
    );
  }

  const getPlanBadgeConfig = () => {
    const { subscriptionStatus, expiresAt } = licenseStatus;

    // Active subscription - show in sky blue
    if (subscriptionStatus === "active") {
      return {
        icon: Shield,
        text: planName || "Licensed",
        className:
          "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800",
      };
    }

    // Trial period - show in sky blue with days remaining
    if (subscriptionStatus === "trialing") {
      let trialText = `${planName || "Licensed"} - Trial`;

      // Calculate days remaining if expiresAt is available
      if (expiresAt) {
        const expiryDate = new Date(expiresAt);
        const today = new Date();
        const daysRemaining = Math.ceil(
          (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysRemaining > 0) {
          trialText = `${planName || "Licensed"} - ${daysRemaining} day${
            daysRemaining === 1 ? "" : "s"
          } left`;
        } else if (daysRemaining === 0) {
          trialText = `${planName || "Licensed"} - Last day`;
        }
      }

      return {
        icon: Clock,
        text: trialText,
        className:
          "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800",
      };
    }

    // Payment overdue - show in amber
    if (subscriptionStatus === "past_due") {
      return {
        icon: AlertCircle,
        text: `${planName || "Licensed"} - Payment Due`,
        className:
          "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
      };
    }

    // Cancelled but still has access
    if (subscriptionStatus === "cancelled") {
      return {
        icon: AlertCircle,
        text: `${planName || "Licensed"} - Cancelled`,
        className:
          "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
      };
    }

    // Offline mode or other statuses
    return {
      icon: WifiOff,
      text: "Offline Mode",
      className:
        "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    };
  };

  const config = getPlanBadgeConfig();
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      onClick={() => navigate("/license")}
      className={cn(
        "text-xs flex items-center gap-1 px-2 py-1 font-medium cursor-pointer hover:opacity-80 transition-opacity",
        config.className
      )}
    >
      <Icon className="h-3 w-3" />
      <span>{config.text}</span>
    </Badge>
  );
}
