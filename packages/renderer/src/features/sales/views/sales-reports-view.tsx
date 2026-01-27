/**
 * Sales Reports View
 *
 * Comprehensive sales analytics and reports view.
 * Consolidates components and functionality from both Cashier and Manager dashboards.
 */

import { useState, useMemo, useCallback } from "react";
import "./sales-reports-view.css";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getLogger } from "@/shared/utils/logger";
import { useSalesReportsData } from "../hooks/use-sales-reports-data";
import {
  SalesReportsHeader,
  SalesReportsStatsCard,
  SalesReportsTransactionTable,
  SalesReportsFilters,
} from "../components/sales-reports";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import { useNavigation } from "@/navigation/hooks/use-navigation";
import type {
  TransactionTypeFilter,
  PaymentMethodFilter,
  TimePeriod,
  DateRange,
} from "../components/sales-reports";
import { useUserPermissions } from "@/features/dashboard/hooks/use-user-permissions";
import { PERMISSIONS } from "@app/shared/constants/permissions";
import { useExportReports } from "../hooks/use-export-reports";
import { toast } from "sonner";

const logger = getLogger("sales-reports-view");

interface SalesReportsViewProps {
  onBack?: () => void;
  embeddedInDashboard?: boolean;
}

const SalesReportsView = ({ onBack }: SalesReportsViewProps) => {
  const { hasPermission } = useUserPermissions();
  const { goToRoot } = useNavigation();
  const { exportToCSV, exportToPDF } = useExportReports();

  // Filter state
  const [transactionType, setTransactionType] =
    useState<TransactionTypeFilter>("all");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodFilter>("all");
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("month");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Calculate date range based on time period
  const calculatedDateRange = useMemo((): DateRange => {
    if (timePeriod === "custom" && dateRange) {
      return dateRange;
    }

    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    switch (timePeriod) {
      case "today":
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case "week":
        // This week (Sunday to Saturday)
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case "month":
        // This month
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case "lastWeek": {
        // Last week (previous Sunday to Saturday)
        const lastWeekEnd = new Date(now);
        lastWeekEnd.setDate(now.getDate() - now.getDay() - 1); // Last Saturday
        lastWeekEnd.setHours(23, 59, 59, 999);
        end.setTime(lastWeekEnd.getTime());

        start.setDate(lastWeekEnd.getDate() - 6); // Previous Sunday
        start.setHours(0, 0, 0, 0);
        break;
      }
      case "lastMonth":
        // Last month
        start.setMonth(now.getMonth() - 1, 1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(now.getMonth(), 0); // Last day of previous month
        end.setHours(23, 59, 59, 999);
        break;
      case "custom":
        // Fallback to current month if custom date range is not set
        if (!dateRange) {
          start.setDate(1);
          start.setHours(0, 0, 0, 0);
          end.setMonth(now.getMonth() + 1, 0);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        }
        return dateRange;
    }

    return { start, end };
  }, [timePeriod, dateRange]);

  // Fetch data using the main hook
  const {
    transactions,
    totalSales,
    totalRefunds,
    totalVoids,
    isLoading,
    isLoadingTransactions,
    error,
    refetch,
  } = useSalesReportsData({
    transactionType,
    paymentMethod,
    timePeriod,
    dateRange: calculatedDateRange,
    limit: 50,
  });

  // Calculate stats from filtered transactions (synced with filters)
  const filteredStats = useMemo(() => {
    const sales = transactions.filter((t) => t.type === "sale");
    const refunds = transactions.filter((t) => t.type === "refund");

    // Calculate revenue from filtered sales
    const filteredRevenue = sales.reduce((sum, t) => sum + t.total, 0);

    // Calculate average order value from filtered sales
    const filteredAOV = sales.length > 0 ? filteredRevenue / sales.length : 0;

    return {
      revenue: filteredRevenue,
      salesCount: sales.length,
      refundsCount: refunds.length,
      averageOrderValue: filteredAOV,
    };
  }, [transactions]);

  // Get time period label for dynamic text
  const getTimePeriodLabel = useCallback((): string => {
    switch (timePeriod) {
      case "today":
        return "Today";
      case "week":
        return "This Week";
      case "month":
        return "This Month";
      case "lastWeek":
        return "Last Week";
      case "lastMonth":
        return "Last Month";
      case "custom":
        if (calculatedDateRange) {
          return `${calculatedDateRange.start.toLocaleDateString()} - ${calculatedDateRange.end.toLocaleDateString()}`;
        }
        return "Custom Range";
      default:
        return "";
    }
  }, [timePeriod, calculatedDateRange]);

  // Calculate adjustments value (refunds only, voids don't have monetary value)
  const adjustmentsValue = useMemo(() => {
    return totalRefunds;
  }, [totalRefunds]);

  // Handle export
  const handleExport = useCallback(
    async (format: "csv" | "pdf") => {
      try {
        logger.info(`Exporting sales report as ${format}`);

        if (!calculatedDateRange) {
          logger.error("Cannot export: date range is not defined");
          toast.error("Cannot export report: date range is not defined");
          return;
        }

        if (transactions.length === 0) {
          toast.warning("No transactions to export");
          return;
        }

        const statistics = {
          totalSales,
          totalRefunds,
          totalVoids,
          revenue: filteredStats.revenue,
          averageOrderValue: filteredStats.averageOrderValue,
          transactionCount: filteredStats.salesCount,
        };

        if (format === "csv") {
          await exportToCSV(transactions, calculatedDateRange, statistics);
        } else if (format === "pdf") {
          await exportToPDF(transactions, calculatedDateRange, statistics);
        }
      } catch (error) {
        // Error handling is done in the hook
        logger.error("Export failed:", error);
      }
    },
    [
      calculatedDateRange,
      transactions,
      totalSales,
      totalRefunds,
      totalVoids,
      filteredStats,
      exportToCSV,
      exportToPDF,
    ],
  );

  // Handle filter reset
  const handleResetFilters = useCallback(() => {
    setTransactionType("all");
    setPaymentMethod("all");
    setTimePeriod("month");
    setDateRange(undefined);
  }, []);

  // Check permissions
  const canViewFinancials = hasPermission(PERMISSIONS.REPORTS_READ);
  const canExport = hasPermission(PERMISSIONS.REPORTS_READ); // Can be enhanced with REPORTS_EXPORT permission

  // Early returns for error states
  if (!canViewFinancials) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              You don't have permission to view sales reports.
            </p>
            {onBack && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBack}
                className="mt-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-red-600 mb-4">Error loading sales reports</p>
            <p className="text-sm text-muted-foreground mb-4">
              {error.message}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="sales-reports-view p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Back Button */}
      <div className="no-print">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack || goToRoot}
          aria-label="Back to Dashboard"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>

      {/* Header */}
      <SalesReportsHeader
        title="Sales Reports"
        subtitle="Comprehensive sales analytics and insights"
        dateRange={calculatedDateRange}
        onExport={canExport ? handleExport : undefined}
        showExport={canExport}
        showPrint={false}
      />

      {/* Filters */}
      <div className="no-print">
        <SalesReportsFilters
          transactionType={transactionType}
          paymentMethod={paymentMethod}
          timePeriod={timePeriod}
          dateRange={calculatedDateRange}
          onTransactionTypeChange={setTransactionType}
          onPaymentMethodChange={setPaymentMethod}
          onTimePeriodChange={setTimePeriod}
          onDateRangeChange={setDateRange}
          onReset={handleResetFilters}
        />
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Revenue Card */}
        <SalesReportsStatsCard
          title="Total Revenue"
          value={filteredStats.revenue}
          change={`${getTimePeriodLabel()} • £${filteredStats.revenue.toFixed(
            2,
          )}`}
          icon={DollarSign}
          colorTheme="green"
          isLoading={isLoading}
        />

        {/* Sales Count Card */}
        <SalesReportsStatsCard
          title="Sales"
          value={filteredStats.salesCount}
          change={`${getTimePeriodLabel()} • ${
            filteredStats.salesCount
          } transaction${filteredStats.salesCount !== 1 ? "s" : ""}`}
          icon={ShoppingCart}
          colorTheme="blue"
          isLoading={isLoading}
        />

        {/* Average Order Value Card */}
        <SalesReportsStatsCard
          title="Average Order Value"
          value={filteredStats.averageOrderValue}
          change={`${getTimePeriodLabel()} • £${filteredStats.averageOrderValue.toFixed(
            2,
          )}`}
          icon={TrendingUp}
          colorTheme="purple"
          isLoading={isLoading}
        />

        {/* Adjustments Card */}
        <SalesReportsStatsCard
          title="Adjustments"
          value={`-£${adjustmentsValue.toFixed(2)}`}
          change={`${totalVoids} voided, £${totalRefunds.toFixed(2)} refunded`}
          icon={RefreshCw}
          colorTheme="red"
          isLoading={isLoading}
        />
      </div>

      {/* Additional Stats Section */}

      {/* Transaction Table */}
      <SalesReportsTransactionTable
        transactions={transactions}
        isLoading={isLoadingTransactions}
        emptyStateMessage="No transactions found for the selected filters"
      />
    </div>
  );
};

export default SalesReportsView;
