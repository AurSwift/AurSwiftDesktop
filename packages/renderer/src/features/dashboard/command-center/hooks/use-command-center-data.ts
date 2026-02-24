import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, FileText, Plus, ShoppingCart, UserPlus } from "lucide-react";
import { PERMISSIONS } from "@app/shared/constants/permissions";
import { useAuth } from "@/shared/hooks";
import { useNavigation } from "@/features/navigation/hooks/use-navigation";
import { INVENTORY_ROUTES } from "@/features/inventory/config/navigation";
import { SALES_ROUTES } from "@/features/sales/config/navigation";
import { STAFF_ROUTES } from "@/features/staff/config/navigation";
import { USERS_ROUTES } from "@/features/users/config/navigation";
import { useDashboardStatistics } from "@/features/dashboard/hooks/use-dashboard-statistics";
import { useTransactionHistory } from "@/features/sales/hooks/use-transaction-history";
import { useUserPermissions } from "@/features/dashboard/hooks/use-user-permissions";
import { getLogger } from "@/shared/utils/logger";
import {
  COMMAND_CENTER_PERIOD_OPTIONS,
  DEFAULT_PERIOD,
  SUPPLEMENTAL_REFRESH_INTERVAL_MS,
  TRANSACTION_HISTORY_LIMIT,
} from "../constants/command-center-defaults";
import {
  buildCategoryMix,
  buildHourlyVolume,
  buildKpiMetrics,
  buildLiveActivityItems,
  buildSalesTrend,
  buildTopSellers,
  getCommandCenterDateRange,
  summarizePayrollCost,
} from "../mappers/command-center-mappers";
import type {
  CategoryCatalogItem,
  CommandCenterPeriod,
  CommandCenterViewModel,
  InventoryStatsSnapshot,
  PayrollSummaryRow,
  ProductCatalogItem,
  TimeTrackingRealtimeSnapshot,
} from "../types/command-center.types";

const logger = getLogger("command-center-data");

interface SupplementalState {
  inventoryStats: InventoryStatsSnapshot | null;
  realtime: TimeTrackingRealtimeSnapshot | null;
  products: ProductCatalogItem[];
  categories: CategoryCatalogItem[];
  laborCostCurrent: number;
  laborCostPrevious: number;
  isLoading: boolean;
  errorCount: number;
}

const EMPTY_SUPPLEMENTAL_STATE: SupplementalState = {
  inventoryStats: null,
  realtime: null,
  products: [],
  categories: [],
  laborCostCurrent: 0,
  laborCostPrevious: 0,
  isLoading: false,
  errorCount: 0,
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function useCommandCenterData(): CommandCenterViewModel {
  const { user } = useAuth();
  const { navigateTo } = useNavigation();
  const { hasAnyPermission, hasPermission } = useUserPermissions();
  const {
    statistics,
    isLoading: isStatisticsLoading,
    refetch: refetchStatistics,
  } = useDashboardStatistics();
  const {
    transactions,
    isLoading: isTransactionsLoading,
    refetch: refetchTransactions,
  } = useTransactionHistory({ limit: TRANSACTION_HISTORY_LIMIT });

  const [period, setPeriod] = useState<CommandCenterPeriod>(DEFAULT_PERIOD);
  const [supplemental, setSupplemental] = useState<SupplementalState>(
    EMPTY_SUPPLEMENTAL_STATE,
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const requestIdRef = useRef(0);
  const catalogLoadedRef = useRef(false);
  const catalogProductsRef = useRef<ProductCatalogItem[]>([]);
  const catalogCategoriesRef = useRef<CategoryCatalogItem[]>([]);

  const periodRange = useMemo(
    () => getCommandCenterDateRange(period),
    [period, lastUpdatedAt],
  );

  const loadSupplemental = useCallback(
    async ({ includeCatalog }: { includeCatalog: boolean }) => {
      if (!user?.businessId) {
        setSupplemental(EMPTY_SUPPLEMENTAL_STATE);
        return;
      }

      const requestId = ++requestIdRef.current;
      setSupplemental((previous) => ({ ...previous, isLoading: true }));

      const nextErrors: Array<string> = [];
      let inventoryStats: InventoryStatsSnapshot | null = null;
      let realtime: TimeTrackingRealtimeSnapshot | null = null;
      let products = catalogProductsRef.current;
      let categories = catalogCategoriesRef.current;
      let laborCostCurrent = 0;
      let laborCostPrevious = 0;

      try {
        const inventoryResponse = await window.productAPI.getStats(user.businessId);
        if (inventoryResponse?.success && inventoryResponse.data) {
          inventoryStats = {
            lowStockCount: toNumber(inventoryResponse.data.lowStockCount),
          };
        }
      } catch (error) {
        nextErrors.push("inventory");
        logger.error("Failed to load inventory stats", error);
      }

      try {
        const realtimeResponse =
          await window.timeTrackingAPI.getRealTimeDashboard(user.businessId);
        if (realtimeResponse?.success && realtimeResponse.data) {
          realtime = realtimeResponse.data as TimeTrackingRealtimeSnapshot;
        }
      } catch (error) {
        nextErrors.push("realtime");
        logger.error("Failed to load real-time dashboard data", error);
      }

      if (includeCatalog || !catalogLoadedRef.current) {
        try {
          const [productsResponse, categoriesResponse] = await Promise.all([
            window.productAPI.getByBusiness(user.businessId, false),
            window.categoryAPI.getByBusiness(user.businessId),
          ]);

          if (productsResponse?.success && Array.isArray(productsResponse.products)) {
            products = productsResponse.products as ProductCatalogItem[];
          }

          if (categoriesResponse?.success && Array.isArray(categoriesResponse.categories)) {
            categories = categoriesResponse.categories as CategoryCatalogItem[];
          }

          catalogProductsRef.current = products;
          catalogCategoriesRef.current = categories;
          catalogLoadedRef.current = products.length > 0 || categories.length > 0;
        } catch (error) {
          nextErrors.push("catalog");
          logger.error("Failed to load product/category catalog", error);
        }
      }

      try {
        const [currentPayrollResponse, previousPayrollResponse] = await Promise.all([
          window.timeTrackingAPI.getPayrollSummary({
            businessId: user.businessId,
            startDate: periodRange.start.toISOString(),
            endDate: periodRange.end.toISOString(),
          }),
          window.timeTrackingAPI.getPayrollSummary({
            businessId: user.businessId,
            startDate: periodRange.comparisonStart.toISOString(),
            endDate: periodRange.comparisonEnd.toISOString(),
          }),
        ]);

        if (currentPayrollResponse?.success && Array.isArray(currentPayrollResponse.data)) {
          laborCostCurrent = summarizePayrollCost(
            currentPayrollResponse.data as PayrollSummaryRow[],
          );
        }

        if (
          previousPayrollResponse?.success &&
          Array.isArray(previousPayrollResponse.data)
        ) {
          laborCostPrevious = summarizePayrollCost(
            previousPayrollResponse.data as PayrollSummaryRow[],
          );
        }
      } catch (error) {
        nextErrors.push("labor");
        logger.error("Failed to load payroll summary", error);
      }

      if (requestId !== requestIdRef.current) {
        return;
      }

      setSupplemental({
        inventoryStats,
        realtime,
        products,
        categories,
        laborCostCurrent,
        laborCostPrevious,
        isLoading: false,
        errorCount: nextErrors.length,
      });
    },
    [
      periodRange.comparisonEnd,
      periodRange.comparisonStart,
      periodRange.end,
      periodRange.start,
      user?.businessId,
    ],
  );

  const refreshAll = useCallback(
    async ({ includeCatalog }: { includeCatalog: boolean }) => {
      if (!user?.businessId) {
        return;
      }

      setIsRefreshing(true);

      try {
        await Promise.all([
          refetchStatistics(),
          refetchTransactions(),
          loadSupplemental({ includeCatalog }),
        ]);
        setLastUpdatedAt(new Date());
      } finally {
        setIsRefreshing(false);
      }
    },
    [loadSupplemental, refetchStatistics, refetchTransactions, user?.businessId],
  );

  useEffect(() => {
    void loadSupplemental({ includeCatalog: !catalogLoadedRef.current });
  }, [loadSupplemental]);

  useEffect(() => {
    if (!user?.businessId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshAll({ includeCatalog: false });
    }, SUPPLEMENTAL_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [refreshAll, user?.businessId]);

  useEffect(() => {
    catalogLoadedRef.current = false;
    catalogProductsRef.current = [];
    catalogCategoriesRef.current = [];
  }, [user?.businessId]);

  const quickActions = useMemo<CommandCenterViewModel["quickActions"]>(
    () => [
      {
        id: "add-item",
        label: "Add Item",
        shortcut: "F2",
        icon: Plus,
        isPrimary: true,
        disabled: !hasPermission(PERMISSIONS.INVENTORY_MANAGE),
        disabledReason: "Inventory management permission required.",
        onTrigger: () =>
          navigateTo(INVENTORY_ROUTES.PRODUCT_MANAGEMENT, {
            openCreateProduct: true,
          }),
      },
      {
        id: "go-to-sales",
        label: "Go to Sales",
        shortcut: "F3",
        icon: ShoppingCart,
        disabled: false,
        onTrigger: () => navigateTo(SALES_ROUTES.NEW_TRANSACTION),
      },
      {
        id: "new-report",
        label: "New Report",
        shortcut: "F4",
        icon: FileText,
        disabled: !hasPermission(PERMISSIONS.REPORTS_READ),
        disabledReason: "Reports permission required.",
        onTrigger: () => navigateTo(SALES_ROUTES.SALES_REPORTS),
      },
      {
        id: "add-staff",
        label: "Add Staff",
        shortcut: "F6",
        icon: UserPlus,
        disabled: !hasPermission(PERMISSIONS.USERS_MANAGE),
        disabledReason: "User management permission required.",
        onTrigger: () => navigateTo(USERS_ROUTES.MANAGEMENT),
      },
      {
        id: "schedule",
        label: "Schedule",
        shortcut: "F8",
        icon: CalendarClock,
        disabled: !hasAnyPermission([
          PERMISSIONS.SCHEDULES_MANAGE_ALL,
          PERMISSIONS.SCHEDULES_MANAGE_CASHIERS,
        ]),
        disabledReason: "Scheduling permission required.",
        onTrigger: () => navigateTo(STAFF_ROUTES.SCHEDULES),
      },
    ],
    [hasAnyPermission, hasPermission, navigateTo],
  );

  const revenueValue = useMemo(
    () =>
      transactions.reduce((sum, transaction) => {
        if (transaction.type !== "sale" || transaction.status !== "completed") {
          return sum;
        }

        const timestamp = new Date(transaction.timestamp).getTime();
        if (!Number.isFinite(timestamp)) {
          return sum;
        }

        if (
          timestamp < periodRange.start.getTime() ||
          timestamp > periodRange.end.getTime()
        ) {
          return sum;
        }

        return sum + Math.abs(toNumber(transaction.total));
      }, 0),
    [periodRange.end, periodRange.start, transactions],
  );

  const laborCostPercent = useMemo(() => {
    if (revenueValue <= 0) return 0;
    return (supplemental.laborCostCurrent / revenueValue) * 100;
  }, [revenueValue, supplemental.laborCostCurrent]);

  const previousRevenueValue = useMemo(
    () =>
      transactions.reduce((sum, transaction) => {
        if (transaction.type !== "sale" || transaction.status !== "completed") {
          return sum;
        }

        const timestamp = new Date(transaction.timestamp).getTime();
        if (!Number.isFinite(timestamp)) {
          return sum;
        }

        if (
          timestamp < periodRange.comparisonStart.getTime() ||
          timestamp > periodRange.comparisonEnd.getTime()
        ) {
          return sum;
        }

        return sum + Math.abs(toNumber(transaction.total));
      }, 0),
    [periodRange.comparisonEnd, periodRange.comparisonStart, transactions],
  );

  const previousLaborCostPercent = useMemo(() => {
    if (previousRevenueValue <= 0) return 0;
    return (supplemental.laborCostPrevious / previousRevenueValue) * 100;
  }, [previousRevenueValue, supplemental.laborCostPrevious]);

  const metrics = useMemo(
    () =>
      buildKpiMetrics({
        statistics,
        transactions,
        periodRange,
        laborCostPercent,
        previousLaborCostPercent,
      }),
    [
      laborCostPercent,
      periodRange,
      previousLaborCostPercent,
      statistics,
      transactions,
    ],
  );

  const salesTrend = useMemo(
    () => buildSalesTrend(transactions, period),
    [period, transactions],
  );

  const liveActivity = useMemo(
    () =>
      buildLiveActivityItems({
        transactions,
        inventoryStats: supplemental.inventoryStats,
        realtime: supplemental.realtime,
        businessName: user?.businessName,
      }),
    [supplemental.inventoryStats, supplemental.realtime, transactions, user?.businessName],
  );

  const topSellers = useMemo(
    () =>
      buildTopSellers({
        transactions,
        periodRange,
      }),
    [periodRange, transactions],
  );

  const hourlyVolume = useMemo(
    () => buildHourlyVolume(transactions),
    [transactions],
  );

  const categoryMix = useMemo(
    () =>
      buildCategoryMix({
        transactions,
        products: supplemental.products,
        categories: supplemental.categories,
        periodRange,
      }),
    [
      periodRange,
      supplemental.categories,
      supplemental.products,
      transactions,
    ],
  );

  return {
    period,
    periodOptions: COMMAND_CENTER_PERIOD_OPTIONS,
    dateLabel: new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    isLoading: isStatisticsLoading || isTransactionsLoading || supplemental.isLoading,
    isDegraded: supplemental.errorCount > 0,
    isRefreshing,
    lastUpdatedAt: lastUpdatedAt ? lastUpdatedAt.toISOString() : null,
    metrics,
    salesTrend,
    liveActivity,
    topSellers,
    hourlyVolume,
    categoryMix,
    quickActions,
    onPeriodChange: setPeriod,
    onRefresh: () => refreshAll({ includeCatalog: true }),
  };
}
