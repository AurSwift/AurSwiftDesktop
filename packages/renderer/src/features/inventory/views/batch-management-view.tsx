import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Search,
  ChevronLeft,
  AlertTriangle,
  Info,
  Package,
} from "lucide-react";
import { AdaptiveKeyboard } from "@/features/adaptive-keyboard/adaptive-keyboard";
import { cn } from "@/shared/utils/cn";
import { useAuth } from "@/shared/hooks/use-auth";
import { Pagination } from "@/components/ui/pagination";
import { useExpiryAlerts } from "@/features/inventory/hooks/use-expiry-alerts";
import { useNestedNavigation } from "@/navigation/hooks/use-nested-navigation";
import { getNestedViews } from "@/navigation/registry/view-registry";
import { INVENTORY_ROUTES } from "../config/navigation";
import BatchList from "@/features/inventory/components/batch/batch-list";
import BatchFormDrawer from "@/features/inventory/components/batch/batch-form-drawer";
import BatchAdjustmentModal from "@/features/inventory/components/batch/batch-adjustment-modal";
import { ExpiryDashboardView } from "./expiry-dashboard-view";
import ExpiryAlertCenter from "@/features/inventory/components/shared/expiry-alert-center";
import type {
  ProductBatch,
  ExpirySettings,
  Supplier,
} from "../types/batch.types";
import type { Product } from "@/types/domain";
import { toast } from "sonner";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("product-batch-management-view");

interface BatchManagementViewProps {
  onBack: () => void;
  initialProductId?: string;
}

const BatchManagementView: React.FC<BatchManagementViewProps> = ({
  onBack,
  initialProductId,
}) => {
  const { user } = useAuth();

  // Use nested navigation instead of local state
  const { navigateTo, currentNestedViewId, currentNestedParams } =
    useNestedNavigation(INVENTORY_ROUTES.BATCH_MANAGEMENT);

  const nestedViews = getNestedViews(INVENTORY_ROUTES.BATCH_MANAGEMENT);
  const defaultView = nestedViews.find(
    (v) => v.id === INVENTORY_ROUTES.BATCH_DASHBOARD
  );

  // Get productId from params if provided
  const productIdFromParams = currentNestedParams?.productId as
    | string
    | undefined;
  const effectiveProductId = productIdFromParams || initialProductId;

  // Map nested view IDs to view modes for compatibility
  const currentView = useMemo(() => {
    if (!currentNestedViewId) {
      // Default to dashboard or list based on initialProductId
      return effectiveProductId ? "list" : "dashboard";
    }

    // Map nested view IDs to view modes
    const viewMap: Record<string, "dashboard" | "list" | "alerts"> = {
      [INVENTORY_ROUTES.BATCH_DASHBOARD]: "dashboard",
      [INVENTORY_ROUTES.BATCH_LIST]: "list",
      [INVENTORY_ROUTES.EXPIRY_ALERTS]: "alerts",
    };

    return viewMap[currentNestedViewId] || "dashboard";
  }, [currentNestedViewId, effectiveProductId]);

  // Initialize default view if none is selected
  useEffect(() => {
    if (!currentNestedViewId && defaultView) {
      const initialView = effectiveProductId
        ? INVENTORY_ROUTES.BATCH_LIST
        : INVENTORY_ROUTES.BATCH_DASHBOARD;
      navigateTo(
        initialView,
        effectiveProductId ? { productId: effectiveProductId } : undefined
      );
    }
  }, [currentNestedViewId, defaultView, navigateTo, effectiveProductId]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingBatch, setEditingBatch] = useState<ProductBatch | null>(null);
  const [isBatchFormOpen, setIsBatchFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expiryFilter, setExpiryFilter] = useState<string>("all");
  
  // Keyboard state for search field
  const [showSearchKeyboard, setShowSearchKeyboard] = useState(false);
  const [searchValue, setSearchValue] = useState(searchTerm);

  // Sync searchValue with searchTerm
  useEffect(() => {
    setSearchValue(searchTerm);
  }, [searchTerm]);

  const handleSearchInput = useCallback((char: string) => {
    setSearchValue((prev) => {
      const newValue = prev + char;
      setSearchTerm(newValue);
      return newValue;
    });
  }, []);

  const handleSearchBackspace = useCallback(() => {
    setSearchValue((prev) => {
      const newValue = prev.slice(0, -1);
      setSearchTerm(newValue);
      return newValue;
    });
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchValue("");
    setSearchTerm("");
  }, []);

  const handleSearchFocus = useCallback(() => {
    setShowSearchKeyboard(true);
  }, []);

  const handleCloseSearchKeyboard = useCallback(() => {
    setShowSearchKeyboard(false);
  }, []);

  // Batch adjustment modal state
  const [adjustingBatch, setAdjustingBatch] = useState<ProductBatch | null>(
    null
  );
  const [adjustmentType, setAdjustmentType] = useState<
    "add" | "remove" | "set"
  >("add");
  const [adjustmentQuantity, setAdjustmentQuantity] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");

  // Data state
  // Full products only loaded when batch form drawer opens (lazy loading)
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [allBatches, setAllBatches] = useState<ProductBatch[]>([]); // For dashboard/alerts
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [expirySettings, setExpirySettings] = useState<ExpirySettings | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  // Batch stats for dashboard (optimized - loaded via aggregation query)
  const [batchStats, setBatchStats] = useState<{
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
  }>({
    totalBatches: 0,
    activeBatches: 0,
    expiredBatches: 0,
    soldOutBatches: 0,
    criticalBatches: 0,
    warningBatches: 0,
    expiringThisWeek: 0,
    expiringNext30Days: 0,
    valueAtRisk: 0,
    wasteValue: 0,
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Load lightweight product lookup for dropdown (only id, name, sku - NOT full products)
  // OPTIMIZED: Only load when needed (list view or when filtering by product)
  const [productLookup, setProductLookup] = useState<
    Array<{ id: string; name: string; sku: string | null }>
  >([]);
  const [productLookupLoaded, setProductLookupLoaded] = useState(false);

  // Lazy load product lookup - only when list view is active or when we have effectiveProductId
  const loadProductLookup = useCallback(async () => {
    if (!user?.businessId || productLookupLoaded) return;
    try {
      const response = await window.productAPI.getLookup(user.businessId, {
        includeInactive: true,
      });
      if (response.success && response.products) {
        setProductLookup(response.products);
        setProductLookupLoaded(true);
      }
    } catch (error) {
      logger.error("Error loading product lookup:", error);
    }
  }, [user?.businessId, productLookupLoaded]);

  // Load product lookup only when entering list view OR when we need to resolve effectiveProductId
  useEffect(() => {
    if (currentView === "list" || effectiveProductId) {
      loadProductLookup();
    }
  }, [currentView, effectiveProductId, loadProductLookup]);

  // Auto-select product from initialProductId or params
  useEffect(() => {
    const productId = effectiveProductId;
    if (productId && productLookup.length > 0) {
      const product = productLookup.find((p) => p.id === productId);
      if (product) {
        // Create a minimal Product object for selectedProduct state
        setSelectedProduct({
          id: product.id,
          name: product.name,
          sku: product.sku || "",
        } as Product);
      }
    }
  }, [effectiveProductId, productLookup]);

  // Load paginated batches (product info is now included via backend JOIN)
  const loadBatches = useCallback(async () => {
    if (!user?.businessId) return;

    setLoading(true);
    try {
      const response = await window.batchesAPI.getPaginated(
        user.businessId,
        {
          page: currentPage,
          pageSize,
          sortBy: "expiryDate",
          sortOrder: "asc",
        },
        {
          productId: selectedProduct?.id || effectiveProductId,
          status: statusFilter !== "all" ? (statusFilter as string) : undefined,
          expiryStatus:
            expiryFilter !== "all" ? (expiryFilter as string) : undefined,
        }
      );

      if (response.success && response.data) {
        // Batches now come pre-enriched with product info from backend JOIN
        // No need to iterate through 30k products client-side
        setBatches(response.data.items);
        setTotalItems(response.data.pagination.totalItems);
        setTotalPages(response.data.pagination.totalPages);
      } else {
        toast.error("Failed to load batches");
      }
    } catch (error) {
      logger.error("Error loading batches:", error);
      toast.error("Failed to load batches");
    } finally {
      setLoading(false);
    }
  }, [
    user?.businessId,
    currentPage,
    pageSize,
    selectedProduct,
    effectiveProductId,
    statusFilter,
    expiryFilter,
    // REMOVED: products - no longer needed as backend includes product info
  ]);

  // Load all batches for dashboard and alerts (without pagination)
  // OPTIMIZED: Only load expired + expiring batches with limit instead of ALL batches
  const loadAllBatches = useCallback(async () => {
    if (!user?.businessId) return;

    try {
      // Use optimized dashboard API that only returns relevant batches
      const response = await window.batchesAPI.getForDashboard(
        user.businessId,
        {
          expiringWithinDays: 30, // Only batches expiring in next 30 days
          limit: 100, // Limit to prevent loading massive datasets
          includeExpired: true, // Include expired for alerts display
        }
      );

      if (response.success && response.data) {
        // Combine expired and expiring batches for dashboard display
        const combinedBatches = [
          ...response.data.expiredBatches,
          ...response.data.expiringBatches,
        ];
        setAllBatches(combinedBatches);
      }
    } catch (error) {
      logger.error("Error loading dashboard batches:", error);
    }
  }, [user?.businessId]);
  // REMOVED: products dependency - not needed for alerts

  // Load batch stats (optimized - uses aggregation query)
  const loadBatchStats = useCallback(async () => {
    if (!user?.businessId) return;

    try {
      const response = await window.batchesAPI.getStats(
        user.businessId,
        expirySettings
          ? {
              criticalAlertDays: expirySettings.criticalAlertDays,
              warningAlertDays: expirySettings.warningAlertDays,
              infoAlertDays: expirySettings.infoAlertDays,
            }
          : undefined
      );

      if (response.success && response.data) {
        setBatchStats(response.data);
      }
    } catch (error) {
      logger.error("Error loading batch stats:", error);
    }
  }, [user?.businessId, expirySettings]);

  // Load suppliers - LAZY: only when batch form is opened
  const [suppliersLoaded, setSuppliersLoaded] = useState(false);
  const loadSuppliers = useCallback(async () => {
    if (!user?.businessId || suppliersLoaded) return;
    try {
      const response = await window.suppliersAPI.getByBusiness(user.businessId);
      if (response.success && response.suppliers) {
        setSuppliers(response.suppliers);
        setSuppliersLoaded(true);
      }
    } catch (error) {
      logger.error("Error loading suppliers:", error);
    }
  }, [user?.businessId, suppliersLoaded]);

  // Load suppliers when batch form is opened
  useEffect(() => {
    if (isBatchFormOpen) {
      loadSuppliers();
    }
  }, [isBatchFormOpen, loadSuppliers]);

  // Load expiry settings
  useEffect(() => {
    const loadExpirySettings = async () => {
      if (!user?.businessId) return;
      try {
        const response = await window.expirySettingsAPI.get(user.businessId);
        if (response.success && response.settings) {
          setExpirySettings(response.settings);
        } else {
          // Create default settings if none exist
          const defaultSettings: ExpirySettings = {
            id: "",
            businessId: user.businessId,
            criticalAlertDays: 3,
            warningAlertDays: 7,
            infoAlertDays: 14,
            notifyViaEmail: true,
            notifyViaPush: true,
            notifyViaDashboard: true,
            autoDisableExpired: true,
            allowSellNearExpiry: false,
            nearExpiryThreshold: 2,
            notificationRecipients: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setExpirySettings(defaultSettings);
        }
      } catch (error) {
        logger.error("Error loading expiry settings:", error);
        // Set default settings on error
        const defaultSettings: ExpirySettings = {
          id: "",
          businessId: user.businessId,
          criticalAlertDays: 3,
          warningAlertDays: 7,
          infoAlertDays: 14,
          notifyViaEmail: true,
          notifyViaPush: true,
          notifyViaDashboard: true,
          autoDisableExpired: true,
          allowSellNearExpiry: false,
          nearExpiryThreshold: 2,
          notificationRecipients: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setExpirySettings(defaultSettings);
      }
    };
    loadExpirySettings();
  }, [user?.businessId]);

  // Load batch stats immediately (fast query)
  useEffect(() => {
    loadBatchStats();
  }, [loadBatchStats]);

  // Load batches only when in list view (paginated, fast)
  useEffect(() => {
    if (currentView === "list") {
      loadBatches();
    }
  }, [currentView, loadBatches]);

  // Load all batches for dashboard when view changes
  useEffect(() => {
    if (currentView === "dashboard" || currentView === "alerts") {
      loadAllBatches();
    }
  }, [currentView, loadAllBatches]);

  // Reset to page 1 when filters change (but NOT when page changes)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, expiryFilter, selectedProduct]);

  // Clear product filter
  const clearProductFilter = useCallback(() => {
    setSelectedProduct(null);
  }, []);

  // Get expiry alerts (use all batches for dashboard/alerts)
  const { criticalAlerts, warningAlerts, infoAlerts } = useExpiryAlerts({
    batches: allBatches,
    expirySettings,
    businessId: user?.businessId,
  });

  // Lazy load full products only when batch form is opened (for costPrice, image, etc.)
  const loadProductsForForm = useCallback(async () => {
    if (productsLoaded || !user?.businessId) return;
    try {
      const response = await window.productAPI.getByBusiness(
        user.businessId,
        true
      );
      if (response.success && response.products) {
        setProducts(response.products);
        setProductsLoaded(true);
      }
    } catch (error) {
      logger.error("Error loading products for form:", error);
    }
  }, [user?.businessId, productsLoaded]);

  const handleCreateBatch = useCallback(() => {
    // Open drawer immediately - products will load in the background
    setEditingBatch(null);
    setIsBatchFormOpen(true);
    // Trigger product loading in background (will show loading state in drawer)
    if (!productsLoaded) {
      loadProductsForForm();
    }
  }, [productsLoaded, loadProductsForForm]);

  const handleEditBatch = useCallback(
    (batch: ProductBatch) => {
      // Open drawer immediately - products will load in the background
      setEditingBatch(batch);
      setIsBatchFormOpen(true);
      // Trigger product loading in background (will show loading state in drawer)
      if (!productsLoaded) {
        loadProductsForForm();
      }
    },
    [productsLoaded, loadProductsForForm]
  );

  const handleDeleteBatch = useCallback(
    async (batch: ProductBatch) => {
      if (
        !window.confirm(
          `Are you sure you want to delete batch ${batch.batchNumber}? This action cannot be undone.`
        )
      ) {
        return;
      }

      try {
        const response = await window.batchesAPI.remove(batch.id);
        if (response.success) {
          toast.success("Batch deleted successfully");
          loadBatches();
          loadAllBatches();
        } else {
          toast.error(response.error || "Failed to delete batch");
        }
      } catch (error) {
        logger.error("Error deleting batch:", error);
        toast.error("Failed to delete batch");
      }
    },
    [loadBatches, loadAllBatches]
  );

  const updateBatch = useCallback(
    async (_batchId: string, _updates: Partial<ProductBatch>) => {
      try {
        // Note: You'll need to add updateBatch to batchesAPI if not present
        loadBatches();
        loadAllBatches();
      } catch (error) {
        logger.error("Error updating batch:", error);
      }
    },
    [loadBatches, loadAllBatches]
  );

  const handleSaveBatch = useCallback(
    (_batch: ProductBatch) => {
      loadBatches();
    },
    [loadBatches]
  );

  const handleUpdateBatch = useCallback(
    (_batchId: string, _batch: ProductBatch) => {
      loadBatches();
    },
    [loadBatches]
  );

  const handleAdjustBatch = useCallback((batch: ProductBatch) => {
    setAdjustingBatch(batch);
    setAdjustmentQuantity("");
    setAdjustmentReason("");
    setAdjustmentType("add");
  }, []);

  const handleBatchAdjustment = useCallback(
    async (
      batchId: string,
      type: "add" | "remove" | "set",
      quantity: number,
      reason: string
    ) => {
      if (!window.batchesAPI) {
        toast.error("Batch API not available");
        return;
      }

      if (!user?.id) {
        toast.error("User information not available");
        return;
      }

      try {
        // Determine movement type based on adjustment type
        const movementType: "INBOUND" | "OUTBOUND" | "ADJUSTMENT" =
          type === "add"
            ? "INBOUND"
            : type === "remove"
            ? "OUTBOUND"
            : "ADJUSTMENT";

        // Call batch API to update quantity with userId and reason for audit trail
        const response = await window.batchesAPI.updateQuantity(
          batchId,
          quantity,
          movementType,
          user.id,
          reason
        );

        if (response.success) {
          await loadBatches();
          toast.success(
            `Batch ${
              type === "add"
                ? "increased"
                : type === "remove"
                ? "decreased"
                : "adjusted"
            } successfully`
          );
        } else {
          toast.error(response.error || "Failed to adjust batch quantity");
        }
      } catch (error) {
        logger.error("Error adjusting batch:", error);
        toast.error("Failed to adjust batch quantity");
      }
    },
    [loadBatches, user]
  );

  if (!user?.businessId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Please log in to manage batches</p>
      </div>
    );
  }

  return (
    <>
      {currentView === "dashboard" && (
        <ExpiryDashboardView
          batches={allBatches}
          expirySettings={expirySettings}
          businessId={user.businessId}
          batchStats={batchStats}
          onViewBatches={() => {
            navigateTo(INVENTORY_ROUTES.BATCH_LIST);
          }}
          onReceiveBatch={() => {
            handleCreateBatch();
          }}
          onGenerateReport={() => {
            toast.info("Report generation coming soon");
          }}
          onCreatePromotion={() => {
            toast.info("Promotion creation coming soon");
          }}
        />
      )}

      {currentView === "alerts" && (
        <ExpiryAlertCenter
          criticalAlerts={criticalAlerts}
          warningAlerts={warningAlerts}
          infoAlerts={infoAlerts}
          onAcknowledge={(_alert) => {
            toast.info("Acknowledgment coming soon");
          }}
          onCreatePromotion={(_alert) => {
            toast.info("Promotion creation coming soon");
          }}
          onAdjustStock={(alert) => {
            handleAdjustBatch(alert.batch);
          }}
          onMarkAsWaste={(alert) => {
            updateBatch(alert.batch.id, { status: "REMOVED" });
            toast.success("Batch marked as waste");
            loadBatches();
          }}
        />
      )}

      {currentView === "list" && (
        <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
          {/* Context Alert - Show when filtered by product */}
          {selectedProduct && (
            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span className="text-sm">
                  Viewing batches for:{" "}
                  <strong className="font-semibold">
                    {selectedProduct.name}
                  </strong>
                  {selectedProduct.sku && (
                    <span className="text-muted-foreground ml-2">
                      (SKU: {selectedProduct.sku})
                    </span>
                  )}
                </span>
                <Button
                  variant="link"
                  size="sm"
                  onClick={clearProductFilter}
                  className="h-auto p-0 w-fit"
                >
                  View all batches
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Header */}
          <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
            <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateTo(INVENTORY_ROUTES.BATCH_DASHBOARD)}
                className="w-fit"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  Batch Management
                </h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1">
                  Manage product batches and expiry tracking
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button
                onClick={onBack}
                variant="outline"
                className="w-full sm:w-auto"
              >
                Dashboard
              </Button>
              <Button
                variant="outline"
                onClick={() => navigateTo(INVENTORY_ROUTES.EXPIRY_ALERTS)}
                className="w-full sm:w-auto"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Alerts ({criticalAlerts.length + warningAlerts.length})
              </Button>
              <Button onClick={handleCreateBatch} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Create Batch
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border">
            <div className="flex flex-col space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative sm:col-span-2 lg:col-span-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search batches, products, SKU..."
                      value={searchValue}
                      readOnly
                      onFocus={handleSearchFocus}
                      className={cn(
                        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                        "pl-10",
                        "ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium",
                        "placeholder:text-muted-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        showSearchKeyboard && "ring-2 ring-primary border-primary"
                      )}
                    />
                  </div>
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="EXPIRED">Expired</SelectItem>
                    <SelectItem value="SOLD_OUT">Sold Out</SelectItem>
                    <SelectItem value="REMOVED">Removed</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={expiryFilter} onValueChange={setExpiryFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Expiry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Expiry</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={selectedProduct?.id || "all"}
                  onValueChange={(value) => {
                    if (value === "all") {
                      setSelectedProduct(null);
                    } else {
                      const product = productLookup.find((p) => p.id === value);
                      if (product) {
                        setSelectedProduct({
                          id: product.id,
                          name: product.name,
                          sku: product.sku || "",
                        } as Product);
                      } else {
                        setSelectedProduct(null);
                      }
                    }
                  }}
                  disabled={!productLookupLoaded}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        productLookupLoaded
                          ? "All Products"
                          : "Loading products..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    {/* Show first 100 products for performance - use search for more */}
                    {productLookup.slice(0, 100).map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                    {productLookup.length > 100 && (
                      <div className="px-2 py-1.5 text-xs text-gray-500 text-center border-t">
                        Showing first 100 of {productLookup.length} products
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Batch List */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading batches...</p>
                </div>
              </div>
            ) : batches.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No batches found
                </h3>
                <p className="text-gray-600 mb-4">
                  {totalItems === 0
                    ? "Get started by creating your first batch."
                    : "Try adjusting your search criteria or filters."}
                </p>
                <Button onClick={handleCreateBatch}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Batch
                </Button>
              </div>
            ) : (
              <>
                <BatchList
                  batches={batches}
                  expirySettings={expirySettings || undefined}
                  onEdit={handleEditBatch}
                  onDelete={handleDeleteBatch}
                  onView={(batch) => {
                    setEditingBatch(batch);
                    setIsBatchFormOpen(true);
                  }}
                  onAdjustStock={handleAdjustBatch}
                  onCreatePromotion={(_batch) => {
                    toast.info("Promotion creation coming soon");
                  }}
                  onMarkAsWaste={(batch) => {
                    updateBatch(batch.id, { status: "REMOVED" });
                    toast.success("Batch marked as waste");
                  }}
                />

                {/* Pagination */}
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={totalItems}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                  showPageSizeSelector={true}
                  showPageInfo={true}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* Batch Form Drawer */}
      {user.businessId && (
        <BatchFormDrawer
          isOpen={isBatchFormOpen}
          editingBatch={editingBatch}
          product={
            (editingBatch &&
              products.find((p) => p.id === editingBatch.productId)) ||
            selectedProduct ||
            products.find((p) => p.id === initialProductId) ||
            null
          }
          products={products}
          loadingProducts={isBatchFormOpen && !productsLoaded}
          suppliers={suppliers}
          businessId={user.businessId}
          onClose={() => {
            setIsBatchFormOpen(false);
            setEditingBatch(null);
          }}
          onSave={handleSaveBatch}
          onUpdate={handleUpdateBatch}
        />
      )}

      {/* Batch Adjustment Modal */}
      <BatchAdjustmentModal
        batch={adjustingBatch}
        adjustmentType={adjustmentType}
        quantity={adjustmentQuantity}
        reason={adjustmentReason}
        onClose={() => {
          setAdjustingBatch(null);
          setAdjustmentQuantity("");
          setAdjustmentReason("");
          setAdjustmentType("add");
        }}
        onTypeChange={setAdjustmentType}
        onQuantityChange={setAdjustmentQuantity}
        onReasonChange={setAdjustmentReason}
        onConfirm={handleBatchAdjustment}
      />

      {/* Adaptive Keyboard - Fixed at bottommost */}
      {showSearchKeyboard && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background shadow-lg">
          <AdaptiveKeyboard
            visible={showSearchKeyboard}
            initialMode="qwerty"
            onInput={handleSearchInput}
            onBackspace={handleSearchBackspace}
            onClear={handleSearchClear}
            onEnter={handleCloseSearchKeyboard}
            onClose={handleCloseSearchKeyboard}
          />
        </div>
      )}
    </>
  );
};

export default BatchManagementView;
