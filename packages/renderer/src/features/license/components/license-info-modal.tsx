/**
 * License & Subscription Information Modal
 *
 * Comprehensive view of license details, subscription status, and system info.
 * Shows all relevant information about the current license and subscription.
 */

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  Calendar,
  CreditCard,
  Package,
  Server,
  AlertCircle,
  CheckCircle,
  Clock,
  Wifi,
  WifiOff,
  Copy,
  ExternalLink,
  Activity,
} from "lucide-react";
import { useLicenseContext } from "../context/use-license-context";
import { cn } from "@/shared/utils/cn";

interface LicenseInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LicenseInfoModal({
  open,
  onOpenChange,
}: LicenseInfoModalProps) {
  const { licenseStatus, isActivated, isLoading, planName } =
    useLicenseContext();

  if (isLoading || !isActivated || !licenseStatus) {
    return null;
  }

  const {
    licenseKey,
    terminalName,
    planId,
    features = [],
    businessName,
    subscriptionStatus,
    expiresAt,
    activatedAt,
    lastHeartbeat,
    daysSinceHeartbeat,
    withinGracePeriod,
    gracePeriodDays,
  } = licenseStatus;

  // Calculate days remaining for trial
  const getDaysRemaining = () => {
    if (!expiresAt) return null;
    const expiryDate = new Date(expiresAt);
    const today = new Date();
    const diff = expiryDate.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const daysRemaining = getDaysRemaining();

  // Get subscription status badge
  const getStatusBadge = () => {
    if (subscriptionStatus === "active") {
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    }
    if (subscriptionStatus === "trialing") {
      return (
        <Badge className="bg-blue-100 text-blue-700 border-blue-200">
          <Clock className="w-3 h-3 mr-1" />
          Trial - {daysRemaining} days left
        </Badge>
      );
    }
    if (subscriptionStatus === "past_due") {
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200">
          <AlertCircle className="w-3 h-3 mr-1" />
          Payment Due
        </Badge>
      );
    }
    if (subscriptionStatus === "cancelled") {
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200">
          <AlertCircle className="w-3 h-3 mr-1" />
          Cancelled
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        <WifiOff className="w-3 h-3 mr-1" />
        Offline
      </Badge>
    );
  };

  // Get connection status
  const getConnectionStatus = () => {
    if (!lastHeartbeat) {
      return {
        icon: WifiOff,
        text: "Never connected",
        className: "text-gray-500",
      };
    }

    const hoursSinceHeartbeat = daysSinceHeartbeat
      ? daysSinceHeartbeat * 24
      : 0;

    if (hoursSinceHeartbeat < 1) {
      return { icon: Wifi, text: "Connected", className: "text-green-600" };
    }
    if (hoursSinceHeartbeat < 24) {
      return {
        icon: Activity,
        text: "Recently active",
        className: "text-blue-600",
      };
    }
    if (withinGracePeriod) {
      return {
        icon: AlertCircle,
        text: `Grace period (${gracePeriodDays} days left)`,
        className: "text-amber-600",
      };
    }
    return { icon: WifiOff, text: "Disconnected", className: "text-red-600" };
  };

  const connectionStatus = getConnectionStatus();
  const ConnectionIcon = connectionStatus.icon;

  const copyLicenseKey = () => {
    if (licenseKey) {
      navigator.clipboard.writeText(licenseKey);
    }
  };

  const openPortal = () => {
    // Open customer portal in external browser
    if (licenseKey) {
      window.open(`https://yourapp.com/portal?license=${licenseKey}`, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Shield className="w-5 h-5" />
            License & Subscription
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Subscription Status Card */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Subscription Status
                </p>
                <p className="text-lg font-semibold">
                  {planName || "Unknown Plan"}
                </p>
              </div>
              {getStatusBadge()}
            </div>

            {subscriptionStatus === "trialing" && daysRemaining !== null && (
              <div className="text-sm text-muted-foreground">
                {daysRemaining > 0 ? (
                  <>
                    Your trial ends in {daysRemaining} day
                    {daysRemaining === 1 ? "" : "s"}
                  </>
                ) : (
                  <>Your trial ends today</>
                )}
              </div>
            )}

            {subscriptionStatus === "past_due" && (
              <div className="text-sm text-amber-700 dark:text-amber-400">
                Payment is overdue. Please update your payment method to
                continue service.
              </div>
            )}

            {subscriptionStatus === "cancelled" && (
              <div className="text-sm text-red-700 dark:text-red-400">
                Your subscription has been cancelled.
                {expiresAt &&
                  ` Access expires on ${new Date(
                    expiresAt
                  ).toLocaleDateString()}.`}
              </div>
            )}
          </div>

          <Separator />

          {/* License Information */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Package className="w-4 h-4" />
              License Information
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="License Key" icon={Shield}>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    {licenseKey ? `${licenseKey.substring(0, 20)}...` : "N/A"}
                  </code>
                  {licenseKey && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyLicenseKey}
                      className="h-7 w-7 p-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </InfoRow>

              <InfoRow label="Terminal Name" icon={Server}>
                <span className="text-sm font-medium">
                  {terminalName || "Unknown"}
                </span>
              </InfoRow>

              <InfoRow label="Plan" icon={Package}>
                <span className="text-sm font-medium">
                  {planId || "Unknown"}
                </span>
              </InfoRow>

              <InfoRow label="Business" icon={Package}>
                <span className="text-sm font-medium">
                  {businessName || "Not set"}
                </span>
              </InfoRow>
            </div>
          </div>

          <Separator />

          {/* Connection & Sync */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Connection & Sync
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Connection Status" icon={ConnectionIcon}>
                <span
                  className={cn(
                    "text-sm font-medium",
                    connectionStatus.className
                  )}
                >
                  {connectionStatus.text}
                </span>
              </InfoRow>

              <InfoRow label="Last Sync" icon={Clock}>
                <span className="text-sm text-muted-foreground">
                  {lastHeartbeat
                    ? new Date(lastHeartbeat).toLocaleString()
                    : "Never"}
                </span>
              </InfoRow>

              {activatedAt && (
                <InfoRow label="Activated On" icon={Calendar}>
                  <span className="text-sm text-muted-foreground">
                    {new Date(activatedAt).toLocaleDateString()}
                  </span>
                </InfoRow>
              )}

              {expiresAt && (
                <InfoRow label="Expires On" icon={Calendar}>
                  <span className="text-sm text-muted-foreground">
                    {new Date(expiresAt).toLocaleDateString()}
                  </span>
                </InfoRow>
              )}
            </div>
          </div>

          <Separator />

          {/* Features */}
          {features && features.length > 0 && (
            <>
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Included Features
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  {features.map((feature) => (
                    <div
                      key={feature}
                      className="flex items-center gap-2 text-sm"
                    >
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />
            </>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={openPortal}
              className="flex-1"
              disabled={!licenseKey}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Manage Subscription
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper component for info rows
function InfoRow({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="w-3 h-3" />
        <span>{label}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}
