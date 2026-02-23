import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Copy,
  DollarSign,
  Info,
  PackageCheck,
  Plus,
  RefreshCw,
  ShoppingCart,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useDashboardStatistics } from "../hooks/use-dashboard-statistics";
import { useUserPermissions } from "../hooks/use-user-permissions";
import { useAuth } from "@/shared/hooks";
import { useTransactionHistory } from "@/features/sales/hooks/use-transaction-history";
import { useActiveShift } from "../hooks/use-active-shift";
import { useNavigation } from "@/navigation/hooks/use-navigation";
import { SALES_ROUTES } from "@/features/sales/config/navigation";
import { INVENTORY_ROUTES } from "@/features/inventory/config/navigation";
import { PERMISSIONS } from "@app/shared/constants/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/shared/utils/cn";
import { getLogger } from "@/shared/utils/logger";
import type { Transaction } from "@/features/sales/components/sales-reports";

const logger = getLogger("store-control-center");

interface ProductStats {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalInventoryValue: number;
}

interface InventoryProduct {
  id: string;
  name: string;
  sku?: string | null;
  stockLevel?: number | null;
  minStockLevel?: number | null;
  reorderPoint?: number | null;
}

interface ShiftStats {
  totalTransactions: number;
  totalSales: number;
  totalRefunds: number;
  totalVoids: number;
}

interface SalesShift {
  id: string;
  status: "active" | "ended";
  startTime: string;
  startingCash: number;
}

interface CashDrawerBalance {
  amount: number;
  isEstimated: boolean;
  lastCountTime?: string;
  variance?: number;
}

interface ExpectedCashPayload {
  expectedAmount: number;
  breakdown?: {
    startingCash: number;
    cashSales: number;
    cashRefunds: number;
    cashVoids: number;
  };
}

interface CashDrawerCount {
  id: string;
  count_type: string;
  counted_amount: number;
  variance: number;
  timestamp: string;
}

interface LowStockItem {
  id: string;
  name: string;
  sku: string;
  stockLevel: number;
  reorderPoint: number;
}

type DensityMode = "comfortable" | "compact";

type AlertSeverity = "critical" | "attention" | "info";

interface OperationalAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  recommendation: string;
  actionLabel: string;
  onAction: () => void;
}

interface CommandAction {
  id: string;
  label: string;
  shortcut: string;
  icon: LucideIcon;
  onTrigger: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

const emptyStats: ProductStats = {
  totalProducts: 0,
  activeProducts: 0,
  inactiveProducts: 0,
  lowStockCount: 0,
  outOfStockCount: 0,
  totalInventoryValue: 0,
};

const emptyShiftStats: ShiftStats = {
  totalTransactions: 0,
  totalSales: 0,
  totalRefunds: 0,
  totalVoids: 0,
};

const DENSITY_STORAGE_KEY = "aurswift.store-control-center-density";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDelta(value: number): string {
  if (!Number.isFinite(value)) return "No change";
  if (value === 0) return "0.0%";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function asNumber(value: unknown, fallback = 0): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function parseDensity(): DensityMode {
  if (typeof window === "undefined") return "comfortable";
  const stored = window.localStorage.getItem(DENSITY_STORAGE_KEY);
  return stored === "compact" ? "compact" : "comfortable";
}

function calculateSplitDelta(series: number[]): number {
  if (!series.length) return 0;
  const midpoint = Math.ceil(series.length / 2);
  const previous = series
    .slice(0, midpoint)
    .reduce((sum, value) => sum + value, 0);
  const current = series.slice(midpoint).reduce((sum, value) => sum + value, 0);

  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function buildTrendSeries(
  transactions: Transaction[],
  extractor: (transaction: Transaction) => number,
  bucketCount = 6,
): number[] {
  const bucketMs = 60 * 60 * 1000;
  const nowMs = Date.now();
  const series = Array.from({ length: bucketCount }, () => 0);

  for (const transaction of transactions) {
    const timestamp = new Date(transaction.timestamp).getTime();
    if (!Number.isFinite(timestamp)) continue;

    const ageMs = nowMs - timestamp;
    if (ageMs < 0 || ageMs >= bucketCount * bucketMs) continue;

    const offset = Math.floor(ageMs / bucketMs);
    const index = bucketCount - 1 - offset;
    series[index] += extractor(transaction);
  }

  return series;
}

function buildAverageBasketSeries(
  transactions: Transaction[],
  bucketCount = 6,
): number[] {
  const bucketMs = 60 * 60 * 1000;
  const nowMs = Date.now();
  const totals = Array.from({ length: bucketCount }, () => 0);
  const counts = Array.from({ length: bucketCount }, () => 0);

  for (const transaction of transactions) {
    if (transaction.type !== "sale") continue;

    const timestamp = new Date(transaction.timestamp).getTime();
    if (!Number.isFinite(timestamp)) continue;

    const ageMs = nowMs - timestamp;
    if (ageMs < 0 || ageMs >= bucketCount * bucketMs) continue;

    const offset = Math.floor(ageMs / bucketMs);
    const index = bucketCount - 1 - offset;

    totals[index] += Math.abs(transaction.total);
    counts[index] += 1;
  }

  return totals.map((total, index) =>
    counts[index] > 0 ? total / counts[index] : 0,
  );
}

function getSeverityMeta(severity: AlertSeverity) {
  switch (severity) {
    case "critical":
      return {
        label: "Critical",
        icon: XCircle,
        tone: "text-red-700",
        chipClass: "bg-red-50 text-red-700 border-red-200",
      };
    case "attention":
      return {
        label: "Needs Attention",
        icon: AlertTriangle,
        tone: "text-amber-700",
        chipClass: "bg-amber-50 text-amber-700 border-amber-200",
      };
    default:
      return {
        label: "Info",
        icon: Info,
        tone: "text-blue-700",
        chipClass: "bg-blue-50 text-blue-700 border-blue-200",
      };
  }
}

function MiniTrend({
  points,
  tone = "neutral",
}: {
  points: number[];
  tone?: "neutral" | "positive" | "negative";
}) {
  const max = Math.max(...points, 1);
  const barTone =
    tone === "positive"
      ? "bg-emerald-500/80"
      : tone === "negative"
        ? "bg-rose-500/80"
        : "bg-slate-400/80";

  return (
    <div className="flex items-end gap-1 h-7" aria-hidden="true">
      {points.map((point, index) => {
        const ratio = point <= 0 ? 0.2 : Math.max(point / max, 0.2);
        return (
          <span
            key={`${index}-${point}`}
            className={cn("w-1.5 rounded-sm", barTone)}
            style={{ height: `${Math.round(ratio * 100)}%` }}
          />
        );
      })}
    </div>
  );
}

function KpiTile({
  label,
  value,
  subtitle,
  delta,
  trend,
  tone,
  onDrilldown,
  compact,
}: {
  label: string;
  value: string;
  subtitle: string;
  delta: number;
  trend: number[];
  tone: "neutral" | "positive" | "negative";
  onDrilldown: () => void;
  compact: boolean;
}) {
  const isPositive = delta >= 0;
  const DeltaIcon = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <article
      className={cn(
        "rounded-lg border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        compact ? "p-3" : "p-4",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              "font-semibold tabular-nums",
              compact ? "text-xl" : "text-2xl",
            )}
          >
            {value}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium",
              isPositive
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700",
            )}
          >
            <DeltaIcon className="h-3.5 w-3.5" />
            {formatDelta(delta)}
          </div>
          <MiniTrend points={trend} tone={tone} />
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDrilldown}
          className="h-7 px-2 text-xs"
        >
          Drilldown
        </Button>
      </div>
    </article>
  );
}

export function OperationsOverview() {
  const { user } = useAuth();
  const { navigateTo } = useNavigation();
  const { hasPermission, hasAnyPermission } = useUserPermissions();
  const { statistics, isLoading: statsLoading } = useDashboardStatistics();
  const { transactions, isLoading: transactionsLoading } =
    useTransactionHistory({ limit: 14 });
  useActiveShift(user?.id);

  const [, setNow] = useState(() => new Date());
  const [density] = useState<DensityMode>(parseDensity);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const [productStats, setProductStats] = useState<ProductStats>(emptyStats);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [, setLowStockItems] = useState<LowStockItem[]>([]);

  const [salesShift, setSalesShift] = useState<SalesShift | null>(null);
  const [shiftStats, setShiftStats] = useState<ShiftStats>(emptyShiftStats);
  const [cashBalance, setCashBalance] = useState<CashDrawerBalance | null>(
    null,
  );
  const [expectedCash, setExpectedCash] = useState<ExpectedCashPayload | null>(
    null,
  );
  const [cashCounts, setCashCounts] = useState<CashDrawerCount[]>([]);
  const [shiftFinanceLoading, setShiftFinanceLoading] = useState(false);

  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    null,
  );
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  const canCreateSale = hasPermission(PERMISSIONS.SALES_WRITE);
  const canManageInventory = hasPermission(PERMISSIONS.INVENTORY_MANAGE);
  const canRefund = hasAnyPermission([
    PERMISSIONS.TRANSACTIONS_REFUND,
    PERMISSIONS.TRANSACTIONS_OVERRIDE,
  ]);
  const canOpenDrawer = hasPermission(PERMISSIONS.TRANSACTIONS_OVERRIDE);
  const canRunCashActions = hasAnyPermission([
    PERMISSIONS.TRANSACTIONS_OVERRIDE,
    PERMISSIONS.SETTINGS_MANAGE,
  ]);

  const markSynced = useCallback(() => {
    setLastSyncAt(new Date());
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DENSITY_STORAGE_KEY, density);
  }, [density]);

  useEffect(() => {
    if (!user?.businessId || !canManageInventory) {
      setProductStats(emptyStats);
      setLowStockItems([]);
      return;
    }

    let mounted = true;

    const loadInventory = async () => {
      try {
        setInventoryLoading(true);

        const [statsResponse, productsResponse] = await Promise.all([
          window.productAPI.getStats(user.businessId),
          window.productAPI.getByBusiness(user.businessId, false),
        ]);

        if (!mounted) return;

        if (statsResponse?.success && statsResponse.data) {
          setProductStats(statsResponse.data as ProductStats);
        }

        if (
          productsResponse?.success &&
          Array.isArray(productsResponse.products)
        ) {
          const products = productsResponse.products as InventoryProduct[];

          const parsedLowStock = products
            .map((product) => {
              const reorderPoint = Math.max(
                asNumber(product.reorderPoint, 0),
                asNumber(product.minStockLevel, 0),
              );
              const stockLevel = asNumber(product.stockLevel, 0);
              return {
                id: product.id,
                name: product.name,
                sku: product.sku || "—",
                stockLevel,
                reorderPoint,
                isLowStock: reorderPoint > 0 && stockLevel <= reorderPoint,
              };
            })
            .filter((item) => item.isLowStock)
            .sort((a, b) => {
              const aGap = a.reorderPoint - a.stockLevel;
              const bGap = b.reorderPoint - b.stockLevel;
              return bGap - aGap;
            })
            .slice(0, 6)
            .map((item) => ({
              id: item.id,
              name: item.name,
              sku: item.sku,
              stockLevel: item.stockLevel,
              reorderPoint: item.reorderPoint,
            }));

          setLowStockItems(parsedLowStock);
        }

        markSynced();
      } catch (error) {
        logger.error("Failed to load inventory health:", error);
      } finally {
        if (mounted) setInventoryLoading(false);
      }
    };

    void loadInventory();
    const pollTimer = window.setInterval(() => void loadInventory(), 45_000);

    return () => {
      mounted = false;
      window.clearInterval(pollTimer);
    };
  }, [user?.businessId, canManageInventory, markSynced]);

  useEffect(() => {
    if (!user?.id) {
      setSalesShift(null);
      setShiftStats(emptyShiftStats);
      setCashBalance(null);
      setExpectedCash(null);
      setCashCounts([]);
      return;
    }

    let mounted = true;

    const loadShiftFinance = async () => {
      try {
        setShiftFinanceLoading(true);
        const activeShiftResponse = await window.shiftAPI.getActive(user.id);

        if (!mounted) return;

        if (activeShiftResponse?.success && activeShiftResponse.data) {
          const activeShift = activeShiftResponse.data as SalesShift;
          setSalesShift(activeShift);

          const [
            statsResponse,
            cashResponse,
            expectedResponse,
            countsResponse,
          ] = await Promise.all([
            window.shiftAPI.getStats(activeShift.id),
            window.shiftAPI.getCashDrawerBalance(activeShift.id),
            window.cashDrawerAPI.getExpectedCash(activeShift.id),
            window.cashDrawerAPI.getCountsByShift(activeShift.id),
          ]);

          if (!mounted) return;

          if (statsResponse?.success && statsResponse.data) {
            setShiftStats(statsResponse.data as ShiftStats);
          } else {
            setShiftStats(emptyShiftStats);
          }

          if (cashResponse?.success && cashResponse.data) {
            setCashBalance(cashResponse.data as CashDrawerBalance);
          } else {
            setCashBalance(null);
          }

          if (expectedResponse?.success && expectedResponse.data) {
            setExpectedCash(expectedResponse.data as ExpectedCashPayload);
          } else {
            setExpectedCash(null);
          }

          if (countsResponse?.success && Array.isArray(countsResponse.data)) {
            const sorted = [...(countsResponse.data as CashDrawerCount[])].sort(
              (a, b) =>
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime(),
            );
            setCashCounts(sorted);
          } else {
            setCashCounts([]);
          }

          markSynced();
        } else {
          setSalesShift(null);
          setShiftStats(emptyShiftStats);
          setCashBalance(null);
          setExpectedCash(null);
          setCashCounts([]);
        }
      } catch (error) {
        logger.error("Failed to load shift and cash data:", error);
      } finally {
        if (mounted) setShiftFinanceLoading(false);
      }
    };

    void loadShiftFinance();
    const pollTimer = window.setInterval(() => void loadShiftFinance(), 30_000);

    return () => {
      mounted = false;
      window.clearInterval(pollTimer);
    };
  }, [user?.id, markSynced]);

  useEffect(() => {
    if (
      !statsLoading &&
      !transactionsLoading &&
      !inventoryLoading &&
      !shiftFinanceLoading
    ) {
      markSynced();
    }
  }, [
    statsLoading,
    transactionsLoading,
    inventoryLoading,
    shiftFinanceLoading,
    markSynced,
  ]);

  const latestCount = cashCounts[0] || null;

  const expectedCashAmount = useMemo(() => {
    if (expectedCash?.expectedAmount !== undefined) {
      return asNumber(expectedCash.expectedAmount, 0);
    }
    if (cashBalance?.isEstimated) {
      return asNumber(cashBalance.amount, 0);
    }
    return 0;
  }, [cashBalance, expectedCash]);

  const countedCashAmount = useMemo(() => {
    if (latestCount) {
      return asNumber(latestCount.counted_amount, 0);
    }
    if (cashBalance && !cashBalance.isEstimated) {
      return asNumber(cashBalance.amount, 0);
    }
    return null;
  }, [cashBalance, latestCount]);

  const cashVariance = useMemo(() => {
    if (cashBalance?.variance !== undefined) {
      return asNumber(cashBalance.variance, 0);
    }
    if (countedCashAmount === null) return null;
    return countedCashAmount - expectedCashAmount;
  }, [cashBalance?.variance, countedCashAmount, expectedCashAmount]);

  const revenueTrend = useMemo(
    () =>
      buildTrendSeries(transactions, (transaction) =>
        transaction.type === "sale" ? Math.abs(transaction.total) : 0,
      ),
    [transactions],
  );

  const transactionTrend = useMemo(
    () =>
      buildTrendSeries(transactions, (transaction) =>
        transaction.type === "sale" ? 1 : 0,
      ),
    [transactions],
  );

  const refundVoidTrend = useMemo(
    () =>
      buildTrendSeries(transactions, (transaction) =>
        transaction.type === "refund" || transaction.type === "void" ? 1 : 0,
      ),
    [transactions],
  );

  const exceptionTrend = useMemo(
    () =>
      buildTrendSeries(transactions, (transaction) =>
        transaction.status !== "completed" || transaction.type === "void"
          ? 1
          : 0,
      ),
    [transactions],
  );

  const avgBasketTrend = useMemo(
    () => buildAverageBasketSeries(transactions),
    [transactions],
  );

  const revenueValue = statistics?.revenue.current ?? shiftStats.totalSales;
  const transactionCountValue =
    statistics?.salesToday ?? shiftStats.totalTransactions;
  const avgBasketValue =
    statistics?.averageOrderValue.current ??
    (transactionCountValue > 0 ? revenueValue / transactionCountValue : 0);

  const refundCount = transactions.filter(
    (transaction) => transaction.type === "refund",
  ).length;
  const refundVoidCount = refundCount + Math.max(0, shiftStats.totalVoids);

  const failedPaymentCount = transactions.filter(
    (transaction) => transaction.status !== "completed",
  ).length;
  const exceptionCount =
    failedPaymentCount + Math.max(0, shiftStats.totalVoids);

  const runSalesReports = useCallback(() => {
    navigateTo(SALES_ROUTES.SALES_REPORTS);
  }, [navigateTo]);

  const openInventoryWorkspace = useCallback(() => {
    navigateTo(INVENTORY_ROUTES.PRODUCT_MANAGEMENT);
  }, [navigateTo]);

  const handleStartSale = useCallback(() => {
    navigateTo(SALES_ROUTES.NEW_TRANSACTION);
  }, [navigateTo]);

  const handleRefundReturn = useCallback(() => {
    if (!canRefund) {
      toast.warning("Refund/Return requires manager override permissions.");
      return;
    }

    navigateTo(SALES_ROUTES.SALES_REPORTS, {
      transactionType: "refund",
    });
  }, [canRefund, navigateTo]);

  const handleOpenDrawer = useCallback(() => {
    if (!canOpenDrawer) {
      toast.warning("Open Drawer is role-gated to override permissions.");
      return;
    }

    if (!salesShift) {
      toast.warning("Open a shift first to access drawer controls.");
      navigateTo(SALES_ROUTES.NEW_TRANSACTION);
      return;
    }

    toast.info("Drawer controls are in the sales workspace for this terminal.");
    navigateTo(SALES_ROUTES.NEW_TRANSACTION);
  }, [canOpenDrawer, navigateTo, salesShift]);

  const handleReprintReceipt = useCallback(
    (focusTransactionId?: string) => {
      const targetTransactionId = focusTransactionId ?? selectedActivityId;
      const hasSelected = Boolean(targetTransactionId);
      navigateTo(SALES_ROUTES.SALES_REPORTS, {
        focusReceipt: targetTransactionId,
      });
      toast.info(
        hasSelected
          ? "Receipt selected for reprint review in Sales Reports."
          : "Open a transaction in Sales Reports to reprint receipt.",
      );
    },
    [navigateTo, selectedActivityId],
  );

  const handleStockReceive = useCallback(() => {
    navigateTo(INVENTORY_ROUTES.PRODUCT_MANAGEMENT, {
      openBatchManagement: true,
    });
  }, [navigateTo]);

  const handleAddProduct = useCallback(() => {
    navigateTo(INVENTORY_ROUTES.PRODUCT_MANAGEMENT, {
      openCreateProduct: true,
    });
  }, [navigateTo]);

  const handleCashUp = useCallback(() => {
    if (!canRunCashActions) {
      toast.warning("Cash up requires manager-level cash permissions.");
      return;
    }
    navigateTo(SALES_ROUTES.NEW_TRANSACTION);
    toast.info("Use the shift controls in sales workspace to cash up.");
  }, [canRunCashActions, navigateTo]);

  const commandActions = useMemo<CommandAction[]>(
    () => [
      {
        id: "start-sale",
        label: "Start Sale",
        shortcut: "F2",
        icon: ShoppingCart,
        onTrigger: handleStartSale,
        disabled: !canCreateSale,
        disabledReason: "Sales write permission required",
      },
      {
        id: "refund-return",
        label: "Refund / Return",
        shortcut: "F4",
        icon: RefreshCw,
        onTrigger: handleRefundReturn,
        disabled: !canRefund,
        disabledReason: "Manager refund permission required",
      },
      {
        id: "open-drawer",
        label: "Open Drawer",
        shortcut: "F6",
        icon: DollarSign,
        onTrigger: handleOpenDrawer,
        disabled: !canOpenDrawer,
        disabledReason: "Override permission required",
      },
      {
        id: "reprint-receipt",
        label: "Reprint Receipt",
        shortcut: "F7",
        icon: Copy,
        onTrigger: handleReprintReceipt,
      },
      {
        id: "stock-receive",
        label: "Stock Receive",
        shortcut: "F8",
        icon: PackageCheck,
        onTrigger: handleStockReceive,
        disabled: !canManageInventory,
        disabledReason: "Inventory permissions required",
      },
      {
        id: "add-product",
        label: "Add Product",
        shortcut: "F9",
        icon: Plus,
        onTrigger: handleAddProduct,
        disabled: !canManageInventory,
        disabledReason: "Inventory permissions required",
      },
    ],
    [
      canCreateSale,
      canManageInventory,
      canOpenDrawer,
      canRefund,
      handleAddProduct,
      handleOpenDrawer,
      handleRefundReturn,
      handleReprintReceipt,
      handleStartSale,
      handleStockReceive,
    ],
  );

  const runCommand = useCallback((command: CommandAction) => {
    if (command.disabled) {
      toast.warning(command.disabledReason || "Permission required");
      return;
    }
    command.onTrigger();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      const commandByKey: Record<string, string> = {
        F2: "start-sale",
        F4: "refund-return",
        F6: "open-drawer",
        F7: "reprint-receipt",
        F8: "stock-receive",
        F9: "add-product",
      };

      const commandId = commandByKey[event.key];
      if (!commandId) return;

      const command = commandActions.find((item) => item.id === commandId);
      if (!command) return;

      event.preventDefault();
      runCommand(command);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandActions, runCommand]);

  const alerts = useMemo<OperationalAlert[]>(() => {
    const items: OperationalAlert[] = [];

    if (!salesShift) {
      items.push({
        id: "shift-not-open",
        severity: "critical",
        title: "No active sales shift",
        description:
          "Transactions and drawer actions are blocked until a shift is opened.",
        recommendation: "Open a shift before serving customers.",
        actionLabel: "Open Shift",
        onAction: handleStartSale,
      });
    }

    if (failedPaymentCount > 0) {
      items.push({
        id: "failed-payments",
        severity: "critical",
        title: `${failedPaymentCount} payment exception${failedPaymentCount > 1 ? "s" : ""}`,
        description:
          "Some transactions are pending or failed and need reconciliation.",
        recommendation: "Review payment logs and retry where possible.",
        actionLabel: "Review Exceptions",
        onAction: runSalesReports,
      });
    }

    if (cashVariance !== null && Math.abs(cashVariance) >= 5) {
      items.push({
        id: "cash-variance",
        severity: Math.abs(cashVariance) >= 20 ? "critical" : "attention",
        title: "Cash variance detected",
        description: `${formatCurrency(Math.abs(cashVariance))} variance in drawer count.`,
        recommendation:
          "Run cash-up and manager verification before end shift.",
        actionLabel: "Cash Up",
        onAction: handleCashUp,
      });
    }

    if (productStats.lowStockCount > 0) {
      items.push({
        id: "low-stock",
        severity: "attention",
        title: `${productStats.lowStockCount} item${productStats.lowStockCount > 1 ? "s" : ""} low on stock`,
        description: "Top low-stock items need reorder or receiving actions.",
        recommendation: "Create purchase order or receive incoming stock.",
        actionLabel: "Open Inventory",
        onAction: openInventoryWorkspace,
      });
    }

    if (!transactionsLoading && transactions.length === 0) {
      items.push({
        id: "no-sales-yet",
        severity: "info",
        title: "No sales recorded yet",
        description: "Activity feed is empty for this trading window.",
        recommendation: "Start first sale or confirm terminal/session state.",
        actionLabel: "Start Sale",
        onAction: handleStartSale,
      });
    }

    if (lastSyncAt) {
      const syncAgeMinutes = Math.floor(
        (Date.now() - lastSyncAt.getTime()) / 60000,
      );
      if (syncAgeMinutes >= 5) {
        items.push({
          id: "sync-delay",
          severity: "info",
          title: "Sync delayed",
          description: `Last successful sync was ${syncAgeMinutes} minute${syncAgeMinutes > 1 ? "s" : ""} ago.`,
          recommendation: "Verify network and background sync services.",
          actionLabel: "Refresh",
          onAction: runSalesReports,
        });
      }
    }

    return items;
  }, [
    cashVariance,
    failedPaymentCount,
    handleCashUp,
    handleStartSale,
    lastSyncAt,
    openInventoryWorkspace,
    productStats.lowStockCount,
    runSalesReports,
    salesShift,
    transactions.length,
    transactionsLoading,
  ]);

  const groupedAlerts = useMemo(
    () => ({
      critical: alerts.filter((alert) => alert.severity === "critical"),
      attention: alerts.filter((alert) => alert.severity === "attention"),
      info: alerts.filter((alert) => alert.severity === "info"),
    }),
    [alerts],
  );

  const selectedAlert =
    alerts.find((alert) => alert.id === selectedAlertId) ?? null;

  const selectedActivity =
    transactions.find((transaction) => transaction.id === selectedActivityId) ??
    null;

  const hasContextPanel = Boolean(selectedAlert || selectedActivity);

  const kpis = useMemo(
    () => [
      {
        id: "revenue",
        label: "Revenue",
        value: formatCurrency(revenueValue),
        subtitle: "Today gross",
        delta:
          statistics?.revenue.changePercent ??
          calculateSplitDelta(revenueTrend),
        trend: revenueTrend,
        tone: revenueValue >= 0 ? ("positive" as const) : ("negative" as const),
        onDrilldown: runSalesReports,
      },
      {
        id: "transactions",
        label: "Transactions",
        value: transactionCountValue.toString(),
        subtitle: "Completed sales",
        delta: calculateSplitDelta(transactionTrend),
        trend: transactionTrend,
        tone: "neutral" as const,
        onDrilldown: runSalesReports,
      },
      {
        id: "avg-basket",
        label: "Avg Basket",
        value: formatCurrency(avgBasketValue),
        subtitle: "Per transaction",
        delta:
          statistics?.averageOrderValue.changePercent ??
          calculateSplitDelta(avgBasketTrend),
        trend: avgBasketTrend,
        tone: "positive" as const,
        onDrilldown: runSalesReports,
      },
      {
        id: "refunds-voids",
        label: "Refunds / Voids",
        value: refundVoidCount.toString(),
        subtitle: `${formatCurrency(shiftStats.totalRefunds)} refunded`,
        delta: calculateSplitDelta(refundVoidTrend),
        trend: refundVoidTrend,
        tone: "negative" as const,
        onDrilldown: runSalesReports,
      },
      {
        id: "exceptions",
        label: "Failed Payments / Exceptions",
        value: exceptionCount.toString(),
        subtitle: "Requires follow-up",
        delta: calculateSplitDelta(exceptionTrend),
        trend: exceptionTrend,
        tone: exceptionCount > 0 ? ("negative" as const) : ("neutral" as const),
        onDrilldown: runSalesReports,
      },
    ],
    [
      avgBasketTrend,
      avgBasketValue,
      exceptionCount,
      exceptionTrend,
      refundVoidCount,
      refundVoidTrend,
      revenueTrend,
      revenueValue,
      runSalesReports,
      shiftStats.totalRefunds,
      statistics?.averageOrderValue.changePercent,
      statistics?.revenue.changePercent,
      transactionCountValue,
      transactionTrend,
    ],
  );

  return (
    <div className="px-4 pb-6 pt-5 md:px-6 space-y-4 bg-[var(--color-ops-bg,#f4f6f7)] min-h-full">
      <div
        className={cn(
          "grid gap-4",
          hasContextPanel
            ? "xl:grid-cols-[1fr_21rem]"
            : "xl:grid-cols-1",
        )}
      >
        <main className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {kpis.map((kpi) => (
              <KpiTile
                key={kpi.id}
                label={kpi.label}
                value={kpi.value}
                subtitle={kpi.subtitle}
                delta={kpi.delta}
                trend={kpi.trend}
                tone={kpi.tone}
                onDrilldown={kpi.onDrilldown}
                compact={density === "compact"}
              />
            ))}
          </section>

          <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <article className="rounded-lg border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <header className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Recent Activity
                  </h3>
                  <p className="text-xs text-slate-500">
                    Time, type, operator, amount, status, and override tags
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={runSalesReports}
                >
                  View all
                </Button>
              </header>

              {transactionsLoading ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  Loading activity feed…
                </div>
              ) : transactions.length === 0 ? (
                <div className="px-4 py-8 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    No transactions yet in this shift window.
                  </p>
                  <Button onClick={handleStartSale} size="sm">
                    <ShoppingCart className="h-4 w-4" />
                    Start a sale
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 p-4">
                  {transactions.map((transaction) => {
                    const tags: string[] = [];

                    if (transaction.type === "refund") tags.push("refund");
                    if (transaction.type === "void") {
                      tags.push("void");
                      tags.push("override");
                    }
                    if (transaction.status !== "completed") {
                      tags.push("exception");
                    }

                    const typeTone =
                      transaction.type === "sale"
                        ? "text-emerald-700"
                        : transaction.type === "refund"
                          ? "text-amber-700"
                          : "text-rose-700";

                    return (
                      <article
                        key={transaction.id}
                        className={cn(
                          "rounded-md border p-3 transition-colors cursor-pointer",
                          selectedActivityId === transaction.id
                            ? "border-slate-300 bg-slate-50"
                            : "border-slate-200 bg-white hover:bg-slate-50",
                        )}
                        onClick={() => {
                          setSelectedActivityId(transaction.id);
                          setSelectedAlertId(null);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-slate-500 tabular-nums">
                            {new Date(transaction.timestamp).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </div>
                          <div
                            className={cn(
                              "text-xs font-semibold uppercase",
                              typeTone,
                            )}
                          >
                            {transaction.type}
                          </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <div className="text-sm font-medium text-slate-900">
                            {transaction.cashierName || "Operator"}
                          </div>
                          <div className="text-sm font-semibold tabular-nums text-slate-900">
                            {transaction.type === "sale" ? "+" : "-"}
                            {formatCurrency(Math.abs(transaction.total))}
                          </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <Badge
                            variant="outline"
                            className={cn(
                              "capitalize text-[11px]",
                              transaction.status === "completed"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700",
                            )}
                          >
                            {transaction.status}
                          </Badge>
                          <div className="flex flex-wrap gap-1 justify-end">
                            {tags.length === 0 ? (
                              <span className="text-xs text-slate-400">—</span>
                            ) : (
                              tags.map((tag) => (
                                <Badge
                                  key={`${transaction.id}-${tag}`}
                                  variant="outline"
                                  className="border-slate-200 bg-slate-50 text-[11px] text-slate-600"
                                >
                                  {tag}
                                </Badge>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedActivityId(transaction.id);
                              setSelectedAlertId(null);
                            }}
                          >
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedActivityId(transaction.id);
                              handleReprintReceipt(transaction.id);
                            }}
                          >
                            Reprint
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={!canRefund || transaction.type !== "sale"}
                            title={!canRefund ? "Role gated" : undefined}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedActivityId(transaction.id);
                              setSelectedAlertId(null);
                              handleRefundReturn();
                            }}
                          >
                            Refund
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </article>

            <article className="rounded-lg border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <header className="border-b px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Alerts & Exceptions
                </h3>
                <p className="text-xs text-slate-500">
                  Grouped by severity with recommended next action
                </p>
              </header>

              <div className="space-y-3 p-4">
                {(["critical", "attention", "info"] as AlertSeverity[]).map(
                  (severity) => {
                    const severityAlerts = groupedAlerts[severity];
                    const meta = getSeverityMeta(severity);
                    const Icon = meta.icon;

                    if (severityAlerts.length === 0) {
                      return null;
                    }

                    return (
                      <section key={severity}>
                        <div className="mb-2 flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn("text-[11px]", meta.chipClass)}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {meta.label}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {severityAlerts.length}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {severityAlerts.map((alert) => (
                            <article
                              key={alert.id}
                              className={cn(
                                "rounded-md border p-3",
                                selectedAlertId === alert.id
                                  ? "border-slate-300 bg-slate-50"
                                  : "border-slate-200 bg-white",
                              )}
                            >
                              <button
                                type="button"
                                className="w-full text-left"
                                onClick={() => {
                                  setSelectedAlertId(alert.id);
                                  setSelectedActivityId(null);
                                }}
                              >
                                <p className="text-sm font-medium text-slate-900">
                                  {alert.title}
                                </p>
                                <p className="mt-1 text-xs text-slate-600">
                                  {alert.description}
                                </p>
                              </button>
                              <div className="mt-2 flex items-center justify-between">
                                <span className="text-xs text-slate-500">
                                  {alert.recommendation}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => {
                                    setSelectedAlertId(alert.id);
                                    setSelectedActivityId(null);
                                    alert.onAction();
                                  }}
                                >
                                  {alert.actionLabel}
                                </Button>
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>
                    );
                  },
                )}

                {alerts.length === 0 && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    No open exceptions. Operations are stable.
                  </div>
                )}
              </div>
            </article>
          </section>
        </main>

        {hasContextPanel && (
          <aside className="rounded-lg border bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Context Panel
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setSelectedActivityId(null);
                  setSelectedAlertId(null);
                }}
              >
                Clear
              </Button>
            </div>

            {selectedActivity && (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Transaction
                  </p>
                  <p className="text-base font-semibold text-slate-900">
                    #{selectedActivity.receiptNumber}
                  </p>
                </div>

                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Type</span>
                    <span className="capitalize font-medium">
                      {selectedActivity.type}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Operator</span>
                    <span className="font-medium">
                      {selectedActivity.cashierName || "Operator"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Amount</span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(Math.abs(selectedActivity.total))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Payment</span>
                    <span className="font-medium capitalize">
                      {selectedActivity.paymentMethod}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Status</span>
                    <span className="font-medium capitalize">
                      {selectedActivity.status}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={runSalesReports}
                  >
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => handleReprintReceipt()}
                  >
                    Reprint
                  </Button>
                  <Button
                    size="sm"
                    className="h-8"
                    disabled={!canRefund || selectedActivity.type !== "sale"}
                    onClick={handleRefundReturn}
                  >
                    Refund
                  </Button>
                </div>
              </div>
            )}

            {selectedAlert && (
              <div className="space-y-3 text-sm">
                {(() => {
                  const meta = getSeverityMeta(selectedAlert.severity);
                  const Icon = meta.icon;

                  return (
                    <>
                      <Badge
                        variant="outline"
                        className={cn("w-fit", meta.chipClass)}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </Badge>
                      <div>
                        <p className="text-base font-semibold text-slate-900">
                          {selectedAlert.title}
                        </p>
                        <p className="mt-1 text-slate-600">
                          {selectedAlert.description}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-slate-700">
                        {selectedAlert.recommendation}
                      </div>
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={selectedAlert.onAction}
                      >
                        {selectedAlert.actionLabel}
                      </Button>
                    </>
                  );
                })()}
              </div>
            )}
          </aside>
        )}
      </div>

      <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Command Palette</DialogTitle>
            <DialogDescription>
              Desktop shortcuts for Store Control Center actions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {commandActions.map((command) => {
              const Icon = command.icon;
              return (
                <button
                  key={command.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left",
                    command.disabled
                      ? "border-slate-200 bg-slate-50 text-slate-400"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                  onClick={() => {
                    runCommand(command);
                    if (!command.disabled) {
                      setCommandPaletteOpen(false);
                    }
                  }}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="h-4 w-4" />
                    {command.label}
                  </span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                    {command.shortcut}
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
