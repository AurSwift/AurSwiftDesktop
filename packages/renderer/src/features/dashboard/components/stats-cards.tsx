/**
 * StatsCards Component
 *
 * Reusable stats cards component with permission-based visibility.
 * Displays key metrics based on user permissions.
 * Now includes dynamic data from backend for revenue and sales metrics.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Package,
} from "lucide-react";
import { useUserPermissions } from "../hooks/use-user-permissions";
import { useDashboardStatistics } from "../hooks/use-dashboard-statistics";
import { PERMISSIONS } from "@app/shared/constants/permissions";
import { useAuth } from "@/shared/hooks";
import { useState, useEffect, useCallback } from "react";
import { getLogger } from "@/shared/utils/logger";

const logger = getLogger("manager-stats-cards");

interface StatsCardsProps {
  className?: string;
  onActionClick?: (featureId: string, actionId: string) => void;
}

/**
 * Format currency value in GBP (British Pounds)
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format percentage change
 */
function formatPercentageChange(changePercent: number): string {
  const sign = changePercent >= 0 ? "+" : "";
  return `${sign}${changePercent.toFixed(1)}%`;
}

export function StatsCards({ className = "", onActionClick }: StatsCardsProps) {
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const { statistics, isLoading: statisticsLoading } = useDashboardStatistics();

  const isLoading = permissionsLoading || statisticsLoading;

  // Handle Go To Sales button click
  const handleGoToSales = () => {
    if (onActionClick) {
      // Use the same pattern as other actions - map to management-actions/new-sale for navigation
      onActionClick("management-actions", "new-sale");
    }
  };

  // Build stats array with dynamic data
  const stats = [
    {
      id: "revenue",
      title: "Total Revenue",
      value: statistics ? formatCurrency(statistics.revenue.current) : "£0.00",
      change: statistics
        ? `${formatPercentageChange(
            statistics.revenue.changePercent
          )} from last month`
        : "Loading...",
      icon: DollarSign,
      permission: PERMISSIONS.REPORTS_READ,
      isLoading: statisticsLoading,
    },
    {
      id: "avg-order-value",
      title: "Average Order Value",
      value: statistics
        ? formatCurrency(statistics.averageOrderValue.current)
        : "£0.00",
      change: statistics
        ? `${formatPercentageChange(
            statistics.averageOrderValue.changePercent
          )} from last month`
        : "Loading...",
      icon: TrendingUp,
      permission: PERMISSIONS.REPORTS_READ,
      isLoading: statisticsLoading,
    },
    {
      id: "sales-today",
      title: "Sales Today",
      value: statistics ? statistics.salesToday.toString() : "0",
      change: statistics ? `Transactions completed` : "Loading...",
      icon: ShoppingCart,
      permission: PERMISSIONS.REPORTS_READ,
      isLoading: statisticsLoading,
    },
  ];

  if (isLoading) {
    return (
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 ${className}`}
      >
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-4 w-4 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-32 bg-muted rounded mb-2" />
              <div className="h-3 w-20 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const visibleStats = stats.filter((stat) => hasPermission(stat.permission));

  if (visibleStats.length === 0) {
    return null;
  }

  // Check if user has permission to view sales (for Go To Sales button)
  const canGoToSales = hasPermission(PERMISSIONS.SALES_WRITE);

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 ${className}`}
    >
      {visibleStats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card
            key={stat.id}
            className="shadow-sm hover:shadow-md transition-shadow"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">
                {stat.isLoading ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  stat.value
                )}
              </div>
              <p className="text-caption text-muted-foreground mt-1">
                {stat.isLoading ? (
                  <span className="animate-pulse">Loading...</span>
                ) : (
                  stat.change
                )}
              </p>
            </CardContent>
          </Card>
        );
      })}
      {/* Go To Sales Button Card */}
      {canGoToSales && (
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Quick Action
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleGoToSales}
              className="w-full h-auto py-3 text-sm sm:text-base font-semibold"
              variant="default"
            >
              <ShoppingCart className="h-4 w-4" />
              Go To Sales
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Manager Stats Cards
 *
 * Specialized stats cards for manager dashboard with real data from backend.
 */
export const ManagerStatsCards = ({ className = "", onActionClick }: StatsCardsProps) => {
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const { statistics, isLoading: statisticsLoading } = useDashboardStatistics();
  const { user } = useAuth();
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [isLoadingLowStock, setIsLoadingLowStock] = useState(true);

  // Fetch low stock count
  const fetchLowStockCount = useCallback(async () => {
    if (!user?.businessId) {
      setIsLoadingLowStock(false);
      return;
    }

    try {
      setIsLoadingLowStock(true);
      const response = await window.productAPI.getStats(user.businessId);
      if (response.success && response.data) {
        setLowStockCount(response.data.lowStockCount || 0);
        logger.info(
          `[ManagerStatsCards] Loaded low stock count: ${response.data.lowStockCount}`
        );
      }
    } catch (error) {
      logger.error("[ManagerStatsCards] Failed to load low stock count:", error);
      setLowStockCount(0);
    } finally {
      setIsLoadingLowStock(false);
    }
  }, [user?.businessId]);

  useEffect(() => {
    fetchLowStockCount();
  }, [fetchLowStockCount]);

  // Handle Go To Sales button click
  const handleGoToSales = () => {
    if (onActionClick) {
      // Use the same pattern as other actions - map to management-actions/new-sale for navigation
      onActionClick("management-actions", "new-sale");
    }
  };

  const isLoading = permissionsLoading || statisticsLoading;

  if (isLoading) {
    return (
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 ${className}`}
      >
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-3 w-20 bg-muted rounded" />
              <div className="h-3 w-3 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-6 w-24 bg-muted rounded mb-1" />
              <div className="h-2 w-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = [
    {
      id: "weekly-revenue",
      title: "Monthly Revenue",
      value: statistics
        ? formatCurrency(statistics.revenue.current)
        : "£0.00",
      change: statistics
        ? `${formatPercentageChange(
            statistics.revenue.changePercent
          )} from last month`
        : "Loading...",
      icon: DollarSign,
      permission: PERMISSIONS.REPORTS_READ,
      isLoading: statisticsLoading,
    },
    {
      id: "low-stock",
      title: "Low Stock Items",
      value: isLoadingLowStock ? "..." : lowStockCount.toString(),
      change: isLoadingLowStock
        ? "Loading..."
        : lowStockCount === 0
        ? "All items in stock"
        : `${lowStockCount} ${lowStockCount === 1 ? "item" : "items"} need reordering`,
      icon: Package,
      permission: PERMISSIONS.INVENTORY_MANAGE,
      isLoading: isLoadingLowStock,
    },
    {
      id: "discounts",
      title: "Sales Today",
      value: statistics ? statistics.salesToday.toString() : "0",
      change: statistics ? "Transactions completed" : "Loading...",
      icon: TrendingUp,
      permission: PERMISSIONS.REPORTS_READ,
      isLoading: statisticsLoading,
    },
  ];

  const visibleStats = stats.filter((stat) => hasPermission(stat.permission));

  // Check if user has permission to view sales (for Go To Sales button)
  const canGoToSales = hasPermission(PERMISSIONS.SALES_WRITE);

  if (visibleStats.length === 0 && !canGoToSales) {
    return null;
  }

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 ${className}`}
    >
      {visibleStats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">
                {stat.title}
              </CardTitle>
              <Icon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">
                {stat.isLoading ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  stat.value
                )}
              </div>
              <p className="text-caption text-muted-foreground">
                {stat.isLoading ? (
                  <span className="animate-pulse">Loading...</span>
                ) : (
                  stat.change
                )}
              </p>
            </CardContent>
          </Card>
        );
      })}
      {/* Go To Sales Button Card */}
      {canGoToSales && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Quick Action
            </CardTitle>
            <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleGoToSales}
              className="w-full h-auto py-2 sm:py-3 text-sm sm:text-base font-semibold"
              variant="default"
            >
              <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4" />
              Go To Sales
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
