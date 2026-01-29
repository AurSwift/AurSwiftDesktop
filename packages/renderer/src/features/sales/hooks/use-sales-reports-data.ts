/**
 * useSalesReportsData Hook
 *
 * Main data hook for sales reports view.
 * Combines data from multiple sources including dashboard statistics,
 * transaction history, and performance metrics.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/shared/hooks";
import { useDashboardStatistics } from "@/features/dashboard/hooks/use-dashboard-statistics";
import { getLogger } from "@/shared/utils/logger";
import type {
  Transaction,
  TransactionTypeFilter,
  PaymentMethodFilter,
  TimePeriod,
  DateRange,
} from "../components/sales-reports";
import type { PerformanceMetrics } from "../components/sales-reports";

const logger = getLogger("use-sales-reports-data");

export interface UseSalesReportsDataOptions {
  transactionType?: TransactionTypeFilter;
  paymentMethod?: PaymentMethodFilter;
  timePeriod?: TimePeriod;
  dateRange?: DateRange;
  limit?: number;
}

export interface UseSalesReportsDataReturn {
  // Dashboard statistics
  revenue: number;
  revenueChange: number;
  revenueChangePercent: number;
  salesToday: number;
  averageOrderValue: number;
  averageOrderValueChange: number;
  averageOrderValueChangePercent: number;

  // Transaction data
  transactions: Transaction[];
  totalTransactions: number;
  totalSales: number;
  totalRefunds: number;
  totalVoids: number;

  // Performance metrics
  performanceMetrics: PerformanceMetrics | null;

  // Loading and error states
  isLoading: boolean;
  isLoadingTransactions: boolean;
  error: Error | null;

  // Actions
  refetch: () => Promise<void>;
  refetchTransactions: () => Promise<void>;
}

/**
 * Calculate date range based on time period
 */
function calculateDateRange(timePeriod: TimePeriod): DateRange {
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
    case "lastWeek":
      // Last week (previous Sunday to Saturday)
      const lastWeekEnd = new Date(now);
      lastWeekEnd.setDate(now.getDate() - now.getDay() - 1); // Last Saturday
      lastWeekEnd.setHours(23, 59, 59, 999);
      end.setTime(lastWeekEnd.getTime());
      
      start.setDate(lastWeekEnd.getDate() - 6); // Previous Sunday
      start.setHours(0, 0, 0, 0);
      break;
    case "lastMonth":
      // Last month
      start.setMonth(now.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth(), 0); // Last day of previous month
      end.setHours(23, 59, 59, 999);
      break;
    case "custom":
      // For custom, we'll use the provided dateRange
      return { start: now, end: now };
  }

  return { start, end };
}

/**
 * Filter transactions based on filters including date range
 */
function filterTransactions(
  transactions: Transaction[],
  transactionType: TransactionTypeFilter,
  paymentMethod: PaymentMethodFilter,
  dateRange?: DateRange
): Transaction[] {
  return transactions.filter((transaction) => {
    // Filter by date range
    if (dateRange) {
      const transactionDate = new Date(transaction.timestamp);
      const start = new Date(dateRange.start);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59, 999);

      if (transactionDate < start || transactionDate > end) {
        return false;
      }
    }

    // Filter by transaction type
    if (transactionType !== "all" && transaction.type !== transactionType) {
      return false;
    }

    // Filter by payment method
    if (paymentMethod !== "all" && transaction.paymentMethod !== paymentMethod) {
      return false;
    }

    return true;
  });
}

/**
 * Calculate performance metrics from transactions
 */
function calculatePerformanceMetrics(
  transactions: Transaction[],
  dateRange: DateRange
): PerformanceMetrics {
  const sales = transactions.filter((t) => t.type === "sale");
  const totalSales = sales.reduce((sum, t) => sum + t.total, 0);
  const totalTransactions = sales.length;

  // Calculate hours in date range
  const hoursDiff =
    (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60);
  const hours = Math.max(1, hoursDiff); // At least 1 hour to avoid division by zero

  const transactionsPerHour = totalTransactions / hours;
  const averageBasketSize =
    totalTransactions > 0 ? totalSales / totalTransactions : 0;

  // Calculate payment method breakdown
  const cashCount = sales.filter((t) => t.paymentMethod === "cash").length;
  const cardCount = sales.filter((t) => t.paymentMethod === "card").length;
  const mixedCount = sales.filter((t) => t.paymentMethod === "mixed").length;

  return {
    transactionsPerHour,
    averageBasketSize,
    cashVsCardRatio: {
      cash: cashCount,
      card: cardCount,
      mixed: mixedCount,
    },
  };
}

export function useSalesReportsData(
  options: UseSalesReportsDataOptions = {}
): UseSalesReportsDataReturn {
  const {
    transactionType = "all",
    paymentMethod = "all",
    timePeriod = "month",
    dateRange: customDateRange,
    limit = 50,
  } = options;

  const { user } = useAuth();
  const {
    statistics: dashboardStats,
    isLoading: isLoadingStats,
    error: statsError,
    refetch: refetchStats,
  } = useDashboardStatistics();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [transactionsError, setTransactionsError] = useState<Error | null>(null);

  // Calculate date range
  const dateRange = useMemo(() => {
    if (timePeriod === "custom" && customDateRange) {
      return customDateRange;
    }
    return calculateDateRange(timePeriod);
  }, [timePeriod, customDateRange]);

  // Fetch transactions by date range so reports show all transactions in the selected period
  const fetchTransactions = useCallback(async () => {
    if (!user?.businessId) {
      setTransactions([]);
      setIsLoadingTransactions(false);
      return;
    }

    try {
      setIsLoadingTransactions(true);
      setTransactionsError(null);

      const startIso = dateRange.start.toISOString();
      const endIso = dateRange.end.toISOString();
      const fetchLimit = Math.max(limit, 1000);

      const response = await window.refundAPI.getTransactionsByDateRange(
        user.businessId,
        startIso,
        endIso,
        fetchLimit
      );

      if (response.success && "transactions" in response) {
        const transactionsData = response.transactions || [];
        setTransactions(transactionsData as Transaction[]);
      } else {
        throw new Error(response.message || "Failed to load transactions");
      }
    } catch (error) {
      logger.error("Failed to load transactions:", error);
      setTransactionsError(
        error instanceof Error
          ? error
          : new Error("Failed to load transactions")
      );
      setTransactions([]);
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [user?.businessId, limit, dateRange.start, dateRange.end]);

  // Fetch transactions on mount and when date range/filters change
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return filterTransactions(transactions, transactionType, paymentMethod, dateRange);
  }, [transactions, transactionType, paymentMethod, dateRange]);

  // Calculate transaction statistics
  const transactionStats = useMemo(() => {
    const sales = filteredTransactions.filter((t) => t.type === "sale");
    const refunds = filteredTransactions.filter((t) => t.type === "refund");
    const voids = filteredTransactions.filter((t) => t.type === "void");

    return {
      totalTransactions: filteredTransactions.length,
      totalSales: sales.reduce((sum, t) => sum + t.total, 0),
      totalRefunds: refunds.reduce((sum, t) => sum + Math.abs(t.total), 0),
      totalVoids: voids.length,
    };
  }, [filteredTransactions]);

  // Calculate performance metrics
  const performanceMetrics = useMemo(() => {
    if (filteredTransactions.length === 0) {
      return null;
    }
    return calculatePerformanceMetrics(filteredTransactions, dateRange);
  }, [filteredTransactions, dateRange]);

  // Extract dashboard statistics
  const revenue = dashboardStats?.revenue.current || 0;
  const revenueChange = dashboardStats?.revenue.change || 0;
  const revenueChangePercent = dashboardStats?.revenue.changePercent || 0;
  const salesToday = dashboardStats?.salesToday || 0;
  const averageOrderValue = dashboardStats?.averageOrderValue.current || 0;
  const averageOrderValueChange = dashboardStats?.averageOrderValue.change || 0;
  const averageOrderValueChangePercent =
    dashboardStats?.averageOrderValue.changePercent || 0;

  const isLoading = isLoadingStats || isLoadingTransactions;
  const error = statsError || transactionsError;

  const refetch = useCallback(async () => {
    await Promise.all([refetchStats(), fetchTransactions()]);
  }, [refetchStats, fetchTransactions]);

  return {
    revenue,
    revenueChange,
    revenueChangePercent,
    salesToday,
    averageOrderValue,
    averageOrderValueChange,
    averageOrderValueChangePercent,
    transactions: filteredTransactions,
    totalTransactions: transactionStats.totalTransactions,
    totalSales: transactionStats.totalSales,
    totalRefunds: transactionStats.totalRefunds,
    totalVoids: transactionStats.totalVoids,
    performanceMetrics,
    isLoading,
    isLoadingTransactions,
    error,
    refetch,
    refetchTransactions: fetchTransactions,
  };
}

