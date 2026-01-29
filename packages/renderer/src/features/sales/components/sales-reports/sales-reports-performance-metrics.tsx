/**
 * Sales Reports Performance Metrics
 *
 * Displays performance metrics including transactions per hour,
 * average basket size, and payment method breakdown.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Clock, ShoppingCart } from "lucide-react";
import { cn } from "@/shared/utils/cn";

export interface PerformanceMetrics {
  transactionsPerHour: number;
  averageBasketSize: number;
  cashVsCardRatio?: {
    cash: number;
    card: number;
    mixed: number;
  };
}

export interface SalesReportsPerformanceMetricsProps {
  metrics: PerformanceMetrics | null;
  isLoading?: boolean;
  className?: string;
}

export function SalesReportsPerformanceMetrics({
  metrics,
  isLoading = false,
  className,
}: SalesReportsPerformanceMetricsProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg font-semibold text-slate-700">
            Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                <div className="h-6 w-24 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg font-semibold text-slate-700">
            Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-slate-500">
            <p className="text-sm">No performance data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalPayments =
    (metrics.cashVsCardRatio?.cash || 0) +
    (metrics.cashVsCardRatio?.card || 0) +
    (metrics.cashVsCardRatio?.mixed || 0);
  const cashPercentage =
    totalPayments > 0
      ? ((metrics.cashVsCardRatio?.cash || 0) / totalPayments) * 100
      : 0;
  const cardPercentage =
    totalPayments > 0
      ? ((metrics.cashVsCardRatio?.card || 0) / totalPayments) * 100
      : 0;
  const mixedPercentage =
    totalPayments > 0
      ? ((metrics.cashVsCardRatio?.mixed || 0) / totalPayments) * 100
      : 0;

  return (
    <Card className={cn("bg-white border-slate-200 shadow-sm", className)}>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg font-semibold text-slate-700">
          Performance Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Transactions Per Hour */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-700" />
              <span className="text-sm text-slate-600">Transactions per hour:</span>
            </div>
            <span className="font-medium text-slate-800">
              {metrics.transactionsPerHour.toFixed(1)}
            </span>
          </div>

          {/* Average Basket Size */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-slate-700" />
              <span className="text-sm text-slate-600">Average basket size:</span>
            </div>
            <span className="font-medium text-slate-800">
              £{metrics.averageBasketSize.toFixed(2)}
            </span>
          </div>

          {/* Cash vs Card Ratio */}
          {metrics.cashVsCardRatio && totalPayments > 0 && (
            <div className="pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-slate-700" />
                <span className="text-sm font-medium text-slate-700">
                  Payment Method Breakdown
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Cash:</span>
                  <span className="font-medium text-slate-800">
                    {cashPercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Card:</span>
                  <span className="font-medium text-slate-800">
                    {cardPercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Mixed:</span>
                  <span className="font-medium text-slate-800">
                    {mixedPercentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}



