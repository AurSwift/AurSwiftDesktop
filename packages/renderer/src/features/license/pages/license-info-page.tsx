/**
 * License & Subscription Information Page
 *
 * Dedicated page showing comprehensive license details, subscription status, and system info.
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Shield,
  Calendar,
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
  ArrowLeft,
  CreditCard,
} from "lucide-react";
import { useLicenseContext } from "../context/use-license-context";
import { cn } from "@/shared/utils/cn";

export function LicenseInfoPage() {
  const navigate = useNavigate();
  const { licenseStatus, isActivated, isLoading, planName } =
    useLicenseContext();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">
            Loading license information...
          </p>
        </div>
      </div>
    );
  }

  if (!isActivated || !licenseStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              No License Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              No active license found. Please activate your license to continue.
            </p>
            <Button onClick={() => navigate("/dashboard")} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const {
    licenseKey,
    terminalName,
    planId,
    features = [],
    businessName,
    subscriptionStatus,
    expiresAt,
    trialEnd,
    activatedAt,
    lastHeartbeat,
    daysSinceHeartbeat,
    withinGracePeriod,
    gracePeriodDays,
  } = licenseStatus;

  // Calculate days remaining for trial or expiry
  const getDaysRemaining = () => {
    // For trial subscriptions, use trialEnd; otherwise use expiresAt
    const targetDate =
      subscriptionStatus === "trialing" && trialEnd ? trialEnd : expiresAt;
    if (!targetDate) return null;
    const expiryDate = new Date(targetDate);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard")}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Shield className="w-8 h-8" />
              License & Subscription
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your license and subscription details
            </p>
          </div>
        </div>

        {/* Subscription Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Subscription Status
              </div>
              {getStatusBadge()}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <p className="text-2xl font-semibold">
                {planName || "Unknown Plan"}
              </p>
            </div>

            {subscriptionStatus === "trialing" && daysRemaining !== null && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  {daysRemaining > 0 ? (
                    <>
                      Your trial ends in{" "}
                      <strong>
                        {daysRemaining} day{daysRemaining === 1 ? "" : "s"}
                      </strong>
                    </>
                  ) : (
                    <>Your trial ends today</>
                  )}
                </p>
              </div>
            )}

            {subscriptionStatus === "past_due" && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  ⚠️ Payment is overdue. Please update your payment method to
                  continue service.
                </p>
              </div>
            )}

            {subscriptionStatus === "cancelled" && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-700 dark:text-red-400">
                  Your subscription has been cancelled.
                  {(trialEnd || expiresAt) &&
                    ` Access expires on ${new Date(
                      (trialEnd || expiresAt)!
                    ).toLocaleDateString()}.`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* License Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              License Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InfoField label="License Key" icon={Shield}>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-muted px-3 py-1.5 rounded font-mono">
                    {licenseKey || "N/A"}
                  </code>
                  {licenseKey && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyLicenseKey}
                      className="h-8"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </Button>
                  )}
                </div>
              </InfoField>

              <InfoField label="Terminal Name" icon={Server}>
                <p className="text-base font-medium">
                  {terminalName || "Unknown"}
                </p>
              </InfoField>

              <InfoField label="Plan ID" icon={Package}>
                <p className="text-base font-medium">{planId || "Unknown"}</p>
              </InfoField>

              <InfoField label="Business Name" icon={Package}>
                <p className="text-base font-medium">
                  {businessName || "Not set"}
                </p>
              </InfoField>
            </div>
          </CardContent>
        </Card>

        {/* Connection & Sync Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Connection & Sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InfoField label="Connection Status" icon={ConnectionIcon}>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-base font-medium",
                      connectionStatus.className
                    )}
                  >
                    {connectionStatus.text}
                  </span>
                </div>
              </InfoField>

              <InfoField label="Last Sync" icon={Clock}>
                <p className="text-base text-muted-foreground">
                  {lastHeartbeat
                    ? new Date(lastHeartbeat).toLocaleString()
                    : "Never"}
                </p>
              </InfoField>

              {activatedAt && (
                <InfoField label="Activated On" icon={Calendar}>
                  <p className="text-base text-muted-foreground">
                    {new Date(activatedAt).toLocaleDateString()}
                  </p>
                </InfoField>
              )}

              {/* Show trial end for trials, or expiry date for others */}
              {subscriptionStatus === "trialing" && trialEnd ? (
                <InfoField label="Trial Ends On" icon={Calendar}>
                  <p className="text-base text-muted-foreground">
                    {new Date(trialEnd).toLocaleDateString()}
                  </p>
                </InfoField>
              ) : expiresAt ? (
                <InfoField label="Expires On" icon={Calendar}>
                  <p className="text-base text-muted-foreground">
                    {new Date(expiresAt).toLocaleDateString()}
                  </p>
                </InfoField>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Features Card */}
        {features && features.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Included Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={openPortal}
            className="flex-1"
            disabled={!licenseKey}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Manage Subscription
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/dashboard")}
            className="flex-1"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

// Helper component for info fields
function InfoField({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}
