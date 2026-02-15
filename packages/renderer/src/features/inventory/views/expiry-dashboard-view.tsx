import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  TrendingDown,
  Package,
  Calendar,
  DollarSign,
  BarChart3,
} from "lucide-react";
import type { ProductBatch, ExpirySettings } from "@/types/features/batches";
import { useExpiryAlerts } from "@/features/inventory/hooks/use-expiry-alerts";
import { formatExpiryDate } from "../utils/expiry-calculations";

interface BatchStats {
  totalBatches: number;
  activeBatches: number;
  expiredBatches: number;
  soldOutBatches: number;
  criticalBatches: number;
  warningBatches: number;
  expiringThisWeek: number;
  expiringNext30Days: number;
  valueAtRisk: number;
  wasteValue: number;
}

interface ExpiryDashboardProps {
  batches: ProductBatch[];
  expirySettings: ExpirySettings | null;
  businessId: string;
  batchStats?: BatchStats; // Optimized stats from server
  onViewBatches?: () => void;
  onReceiveBatch?: () => void;
  onGenerateReport?: () => void;
  onCreatePromotion?: () => void;
}

const ExpiryDashboard: React.FC<ExpiryDashboardProps> = ({
  batches,
  expirySettings,
  businessId,
  batchStats,
  onViewBatches,
  onReceiveBatch,
  onGenerateReport,
  onCreatePromotion,
}) => {
  const {
    criticalAlerts,
    expiredBatches,
    criticalBatches,
    expiringThisWeek,
    expiringNext30Days,
  } = useExpiryAlerts({
    batches,
    expirySettings,
    businessId,
  });

  // Use server stats (fast aggregation query) instead of client-side calculation
  // Server stats are more accurate as they cover ALL batches, not just the limited subset
  const totalBatches = batchStats?.totalBatches ?? batches.length;
  const activeBatches =
    batchStats?.activeBatches ??
    batches.filter((b) => b.status === "ACTIVE").length;
  const expiredCount = batchStats?.expiredBatches ?? expiredBatches.length;
  const criticalCount = batchStats?.criticalBatches ?? criticalBatches.length;

  // Use server stats for value calculations (fast aggregation, covers ALL batches)
  const valueAtRisk =
    batchStats?.valueAtRisk ??
    expiringThisWeek.reduce((total, batch) => {
      const cost = batch.costPrice || 0;
      return total + cost * batch.currentQuantity;
    }, 0);

  const wasteValue =
    batchStats?.wasteValue ??
    expiredBatches.reduce((total, batch) => {
      const cost = batch.costPrice || 0;
      return total + cost * batch.currentQuantity;
    }, 0);

  // Use server stats for "expiring this week" count (accurate count from aggregation)
  const expiringThisWeekCount =
    batchStats?.expiringThisWeek ?? expiringThisWeek.length;

  return (
    <div className="space-y-3">
      {(criticalAlerts.length > 0 || expiredBatches.length > 0) && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="flex items-center text-sm font-semibold text-foreground">
              <AlertTriangle className="w-4 h-4 mr-2 text-destructive" />
              Critical Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1 space-y-2">
            {expiredBatches.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 rounded-md bg-destructive/10">
                <div>
                  <p className="font-semibold text-foreground text-sm">
                    {expiredBatches.length} Expired Batch
                    {expiredBatches.length !== 1 ? "es" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {expiredBatches.reduce(
                      (sum, b) => sum + b.currentQuantity,
                      0,
                    )}{" "}
                    units need immediate attention
                  </p>
                </div>
                <Badge variant="destructive" className="w-fit">
                  Expired
                </Badge>
              </div>
            )}
            {criticalAlerts.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 rounded-md bg-amber-500/10 dark:bg-amber-500/20">
                <div>
                  <p className="font-semibold text-foreground text-sm">
                    {criticalAlerts.length} Critical Alert
                    {criticalAlerts.length !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Batches expiring within{" "}
                    {expirySettings?.criticalAlertDays || 3} days
                  </p>
                </div>
                <Badge variant="destructive" className="w-fit">
                  Critical
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3">
          <CardHeader className="p-0 pb-1.5">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Total Batches
              <Package className="w-4 h-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-lg font-semibold text-foreground">{totalBatches}</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeBatches} active, {expiredCount} expired
            </p>
          </CardContent>
        </Card>

        <Card className="p-3">
          <CardHeader className="p-0 pb-1.5">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Expiring This Week
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-lg font-semibold text-amber-600 dark:text-amber-400">
              {expiringThisWeekCount}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {expiringThisWeek.reduce((sum, b) => sum + b.currentQuantity, 0)} units
            </p>
          </CardContent>
        </Card>

        <Card className="p-3">
          <CardHeader className="p-0 pb-1.5">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Value at Risk
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-lg font-semibold text-destructive">
              £{valueAtRisk.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Expiring in next 7 days</p>
          </CardContent>
        </Card>

        <Card className="p-3">
          <CardHeader className="p-0 pb-1.5">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Waste Value
              <TrendingDown className="w-4 h-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-lg font-semibold text-foreground">
              £{wasteValue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">From expired batches</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-3">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-1.5">
            {onReceiveBatch && (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start h-8"
                onClick={onReceiveBatch}
              >
                <Package className="w-4 h-4 mr-2" />
                Receive New Batch
              </Button>
            )}
            {onViewBatches && (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start h-8"
                onClick={onViewBatches}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                View All Batches
              </Button>
            )}
            {onGenerateReport && (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start h-8"
                onClick={(e) => {
                  const target = e.currentTarget;
                  target.blur();
                  requestAnimationFrame(() => onGenerateReport?.());
                }}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Generate Expiry Report
              </Button>
            )}
            {onCreatePromotion && criticalCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start h-8"
                onClick={(e) => {
                  const target = e.currentTarget;
                  target.blur();
                  requestAnimationFrame(() => onCreatePromotion?.());
                }}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Create Promotion ({criticalCount} items)
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="p-3">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">
              Upcoming Expiry
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {expiringNext30Days.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No batches expiring in the next 30 days
              </p>
            ) : (
              <div className="space-y-1.5">
                {expiringNext30Days.slice(0, 5).map((batch) => (
                  <div
                    key={batch.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 p-2 rounded-md bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {batch.product?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatExpiryDate(batch.expiryDate, false)} •{" "}
                        {batch.currentQuantity} units
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs w-fit">
                      {batch.batchNumber}
                    </Badge>
                  </div>
                ))}
                {expiringNext30Days.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{expiringNext30Days.length - 5} more batches
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export { ExpiryDashboard as ExpiryDashboardView };
