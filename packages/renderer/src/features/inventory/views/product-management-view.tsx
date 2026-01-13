import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/shared/hooks/use-auth";
import type { Product } from "@/types/domain";
import { useNestedNavigation } from "@/navigation/hooks/use-nested-navigation";
import { useNavigation } from "@/navigation/hooks/use-navigation";
import { getNestedViews } from "@/navigation/registry/view-registry";
import { INVENTORY_ROUTES } from "../config/navigation";

import ManageCategoriesView from "./category-management-view";
import ProductDashboardView from "./inventory-dashboard-view";
import ProductDetailsView from "./product-details-view";
import StockAdjustmentModal from "@/features/inventory/components/shared/stock-adjustment-modal";
import ProductFormDrawer from "@/features/inventory/components/product/product-form-drawer";
import BatchManagementView from "./batch-management-view";
import StockMovementHistoryView from "./stock-movement-history-view";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("manage-product-view");
import type { Category, VatCategory } from "../hooks/use-product-data";
import {
  invalidateInventoryCache,
  invalidateProductStatsCache,
  invalidateAllCaches,
} from "@/shared/utils/simple-cache";

interface ProductManagementViewProps {
  onBack: () => void;
}

const ProductManagementView: React.FC<ProductManagementViewProps> = ({
  onBack: _onBack,
}) => {
  const { user } = useAuth();

  // Use nested navigation instead of local state
  const { navigateTo, currentNestedViewId } = useNestedNavigation(
    INVENTORY_ROUTES.PRODUCT_MANAGEMENT
  );

  // Use main navigation to navigate to the main dashboard
  const { navigateTo: navigateToMainView } = useNavigation();

  const nestedViews = getNestedViews(INVENTORY_ROUTES.PRODUCT_MANAGEMENT);
  const defaultView = nestedViews.find(
    (v) => v.id === INVENTORY_ROUTES.PRODUCT_DASHBOARD
  );

  // Map nested view IDs to the old view names for compatibility
  const currentView = useMemo(() => {
    if (!currentNestedViewId) {
      return defaultView?.id || INVENTORY_ROUTES.PRODUCT_DASHBOARD;
    }
    return currentNestedViewId;
  }, [currentNestedViewId, defaultView]);

  // Track which product to filter batches by
  const [batchFilterProductId, setBatchFilterProductId] = useState<
    string | undefined
  >(undefined);

  // Data state
  const [products, setProducts] = useState<Product[]>([]);
  const [productStats, setProductStats] = useState<{
    totalProducts: number;
    activeProducts: number;
    inactiveProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalInventoryValue: number;
  }>({
    totalProducts: 0,
    activeProducts: 0,
    inactiveProducts: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalInventoryValue: 0,
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryStats, setCategoryStats] = useState<{
    totalCategories: number;
  }>({ totalCategories: 0 });
  const [vatCategories, setVatCategories] = useState<VatCategory[]>([]);
  const [loading, setLoading] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filter state
  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStock, setFilterStock] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [showFields, setShowFields] = useState({
    name: true,
    category: true,
    price: true,
    stock: true,
    sku: true,
    status: true,
  });

  // Product form state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Stock adjustment state
  const [stockAdjustmentProduct, setStockAdjustmentProduct] =
    useState<Product | null>(null);
  const [stockAdjustmentType, setStockAdjustmentType] = useState<
    "add" | "remove"
  >("add");
  const [stockAdjustmentQuantity, setStockAdjustmentQuantity] = useState("");
  const [stockAdjustmentReason, setStockAdjustmentReason] = useState("");

  // Stats are now loaded directly from backend aggregation

  // Load paginated products
  const loadProducts = useCallback(async () => {
    if (!user?.businessId) return;

    setLoading(true);
    try {
      const response = await window.productAPI.getPaginated(
        user.businessId,
        {
          page: currentPage,
          pageSize,
          sortBy: "name",
          sortOrder: "asc",
        },
        {
          searchTerm: searchTerm || undefined,
          categoryId: filterCategory !== "all" ? filterCategory : undefined,
          stockStatus: filterStock as
            | "all"
            | "in_stock"
            | "low"
            | "out_of_stock",
          isActive:
            filterStatus === "all"
              ? undefined
              : filterStatus === "active"
              ? true
              : false,
        }
      );

      if (response.success && response.data) {
        setProducts(response.data.items);
        setTotalItems(response.data.pagination.totalItems);
        setTotalPages(response.data.pagination.totalPages);
      } else {
        toast.error("Failed to load products");
      }
    } catch (error) {
      logger.error("Error loading products:", error);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [
    user?.businessId,
    currentPage,
    pageSize,
    searchTerm,
    filterCategory,
    filterStock,
    filterStatus,
  ]);

  // Load product statistics for dashboard (optimized - no full product loading)
  const loadProductStats = useCallback(async () => {
    if (!user?.businessId) return;

    try {
      const response = await window.productAPI.getStats(user.businessId);
      if (response.success && response.data) {
        setProductStats(response.data);
      }
    } catch (error) {
      logger.error("Error loading product stats:", error);
    }
  }, [user?.businessId]);

  // Load category statistics (optimized - count only)
  const loadCategoryStats = useCallback(async () => {
    if (!user?.businessId) return;

    try {
      const response = await window.categoryAPI.getStats(user.businessId);
      if (response.success && response.data) {
        setCategoryStats({ totalCategories: response.data.totalCategories });
      }
    } catch (error) {
      logger.error("Error loading category stats:", error);
    }
  }, [user?.businessId]);

  // Load categories (full list - only when needed)
  const loadCategories = useCallback(async () => {
    if (!user?.businessId) return;

    try {
      const response = await window.categoryAPI.getByBusiness(user.businessId);
      if (response.success && response.categories) {
        setCategories(response.categories as Category[]);
      }
    } catch (error) {
      logger.error("Error loading categories:", error);
    }
  }, [user?.businessId]);

  // Load VAT categories
  const loadVatCategories = useCallback(async () => {
    if (!user?.businessId) return;

    try {
      const response = await window.categoryAPI.getVatCategories(
        user.businessId
      );
      if (response.success && response.vatCategories) {
        // Normalize VatCategory to match hook type (ratePercent instead of percentage)
        const normalized = response.vatCategories.map((vat: any) => ({
          id: vat.id,
          name: vat.name,
          ratePercent: vat.ratePercent ?? vat.percentage ?? 0,
        }));
        setVatCategories(normalized);
      }
    } catch (error) {
      logger.error("Error loading VAT categories:", error);
    }
  }, [user?.businessId]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadProductStats();
    loadCategoryStats();
    loadVatCategories();
  }, [loadProductStats, loadCategoryStats, loadVatCategories]);

  // Reset to page 1 when filters change (but NOT when page changes)
  useEffect(() => {
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterCategory, filterStock, filterStatus]);

  // Load categories when navigating to category management view
  useEffect(() => {
    setIsDrawerOpen(false);
    if (
      currentView === INVENTORY_ROUTES.CATEGORY_MANAGEMENT &&
      user?.businessId
    ) {
      loadCategories();
      loadCategoryStats();
    }
  }, [currentView, user?.businessId, loadCategories, loadCategoryStats]);

  // Initialize default view if none is selected
  useEffect(() => {
    if (!currentNestedViewId && defaultView) {
      navigateTo(defaultView.id);
    }
  }, [currentNestedViewId, defaultView, navigateTo]);

  // Reset stock adjustment form when modal opens
  useEffect(() => {
    if (stockAdjustmentProduct) {
      setStockAdjustmentQuantity("");
      setStockAdjustmentReason("");
      setStockAdjustmentType("add");
    }
  }, [stockAdjustmentProduct]);

  // Handlers
  const handleDeleteProduct = useCallback(
    async (id: string) => {
      if (!window.confirm("Are you sure you want to delete this product?")) {
        return;
      }

      try {
        const response = await window.productAPI.delete(id);
        if (response.success) {
          toast.success("Product deleted successfully");

          // Invalidate caches
          if (user?.businessId) {
            invalidateInventoryCache(user.businessId);
            invalidateProductStatsCache(user.businessId);
          }

          loadProducts();
          loadProductStats();
        } else {
          toast.error(response.message || "Failed to delete product");
        }
      } catch (error) {
        logger.error("Error deleting product:", error);
        toast.error("Failed to delete product");
      }
    },
    [user, loadProducts, loadProductStats]
  );

  const handleAdjustStockClick = useCallback((product: Product) => {
    // Show quick adjustment modal for products
    // TODO: Check if product requires batch tracking once the field is added to schema
    // Tracking: docs/TODO_TRACKING.md#2
    setStockAdjustmentProduct(product);
  }, []);

  const handleStockAdjustment = useCallback(
    async (
      productId: string,
      type: "add" | "remove",
      quantity: number,
      reason: string
    ) => {
      if (!user?.businessId || !user.id) {
        toast.error("User information not available");
        return;
      }

      try {
        const adjustmentData = {
          productId,
          type: type as "add" | "remove" | "sale" | "waste" | "adjustment",
          quantity,
          reason,
          userId: user.id,
          businessId: user.businessId,
        };

        const response = await window.productAPI.adjustStock(adjustmentData);
        if (response.success) {
          // Invalidate caches
          if (user?.businessId) {
            invalidateInventoryCache(user.businessId);
            invalidateProductStatsCache(user.businessId);
          }

          await loadProducts();
          await loadProductStats();
          toast.success("Stock adjustment completed successfully");
          setStockAdjustmentProduct(null);
        } else {
          toast.error(response.message || "Failed to adjust stock");
        }
      } catch (error) {
        logger.error("Error adjusting stock:", error);
        toast.error("Failed to adjust stock");
      }
    },
    [user, loadProducts, loadProductStats]
  );

  const handleEditProduct = useCallback(
    async (product: Product) => {
      setEditingProduct(product);
      // Load categories if not already loaded (needed for product form)
      if (categories.length === 0 && user?.businessId) {
        await loadCategories();
      }
      setIsDrawerOpen(true);
    },
    [categories.length, user?.businessId, loadCategories]
  );

  const openAddProductDrawer = useCallback(async () => {
    setEditingProduct(null);
    // Load categories if not already loaded (needed for product form)
    if (categories.length === 0 && user?.businessId) {
      await loadCategories();
    }
    setIsDrawerOpen(true);
  }, [categories.length, user?.businessId, loadCategories]);

  const handleSaveProduct = useCallback(() => {
    // Invalidate caches on product create/update
    if (user?.businessId) {
      invalidateInventoryCache(user.businessId);
      invalidateProductStatsCache(user.businessId);
    }

    loadProducts(); // Reload to ensure consistency
    loadProductStats(); // Update dashboard stats
  }, [user, loadProducts, loadProductStats]);

  const handleUpdateProduct = useCallback(() => {
    // Invalidate caches on product update
    if (user?.businessId) {
      invalidateInventoryCache(user.businessId);
      invalidateProductStatsCache(user.businessId);
    }

    loadProducts(); // Reload to ensure consistency
    loadProductStats(); // Update dashboard stats
  }, [user, loadProducts, loadProductStats]);

  // Helper function to navigate to dashboard (defined outside useMemo for reuse)
  const goToDashboard = useCallback(() => {
    navigateTo(INVENTORY_ROUTES.PRODUCT_DASHBOARD);
  }, [navigateTo]);

  // Create view components with proper props (must be before conditional return)
  const viewComponents = useMemo(() => {
    if (!user) return {};

    // Navigate to main dashboard (the one with stat cards and feature cards)
    const goToMainDashboard = () => {
      navigateToMainView("dashboard");
    };

    return {
      productDashboard: (
        <ProductDashboardView
          productStats={productStats}
          categoryCount={categoryStats.totalCategories}
          onBack={goToMainDashboard}
          onManageProducts={() => navigateTo(INVENTORY_ROUTES.PRODUCT_LIST)}
          onManageCategories={() =>
            navigateTo(INVENTORY_ROUTES.CATEGORY_MANAGEMENT)
          }
          onAddProduct={openAddProductDrawer}
          onManageBatches={() => navigateTo(INVENTORY_ROUTES.BATCH_MANAGEMENT)}
        />
      ),
      productList: (
        <ProductDetailsView
          products={products}
          categories={categories}
          loading={loading}
          searchTerm={searchTerm}
          filterCategory={filterCategory}
          filterStock={filterStock}
          filterStatus={filterStatus}
          showFields={showFields}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onBack={goToDashboard}
          onAddProduct={openAddProductDrawer}
          onEditProduct={handleEditProduct}
          onDeleteProduct={handleDeleteProduct}
          onAdjustStock={handleAdjustStockClick}
          onSearchChange={setSearchTerm}
          onCategoryFilterChange={setFilterCategory}
          onStockFilterChange={(value: string) => setFilterStock(value)}
          onStatusFilterChange={(value: string) => setFilterStatus(value)}
          onShowFieldsChange={setShowFields}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          onProductsImported={() => {
            // Invalidate all caches after bulk import
            if (user?.businessId) {
              invalidateAllCaches(user.businessId);
            }
            loadProducts();
            loadProductStats();
          }}
        />
      ),
      categoryManagement: <ManageCategoriesView onBack={goToDashboard} />,
      // NOTE: BatchManagementView is rendered directly in JSX to ensure it re-renders
      // when navigation state changes (not through memoized viewComponents)
      stockMovementHistory: <StockMovementHistoryView onBack={goToDashboard} />,
    };
  }, [
    user,
    navigateTo,
    navigateToMainView,
    goToDashboard,
    productStats,
    categoryStats,
    categories,
    products,
    loading,
    searchTerm,
    filterCategory,
    filterStock,
    filterStatus,
    showFields,
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    openAddProductDrawer,
    handleAdjustStockClick,
    handleEditProduct,
    handleDeleteProduct,
    setSearchTerm,
    setFilterCategory,
    setFilterStock,
    setFilterStatus,
    setShowFields,
    setCurrentPage,
    setPageSize,
    loadProducts,
    loadProductStats,
  ]);

  if (!user) {
    return null;
  }

  return (
    <>
      {/* Main Content - Use NestedViewContainer for navigation */}
      <div className="w-full h-full relative">
        {currentView === INVENTORY_ROUTES.PRODUCT_DASHBOARD &&
          viewComponents.productDashboard}
        {currentView === INVENTORY_ROUTES.PRODUCT_LIST &&
          viewComponents.productList}
        {currentView === INVENTORY_ROUTES.CATEGORY_MANAGEMENT &&
          viewComponents.categoryManagement}
        {/* Render BatchManagementView directly to ensure it re-renders when navigation state changes */}
        {currentView === INVENTORY_ROUTES.BATCH_MANAGEMENT && (
          <BatchManagementView
            onBack={() => {
              setBatchFilterProductId(undefined);
              goToDashboard();
            }}
            initialProductId={batchFilterProductId}
          />
        )}
        {currentView === INVENTORY_ROUTES.STOCK_MOVEMENT_HISTORY &&
          viewComponents.stockMovementHistory}
      </div>

      {/* Stock Adjustment Modal */}
      <StockAdjustmentModal
        product={stockAdjustmentProduct}
        adjustmentType={stockAdjustmentType}
        quantity={stockAdjustmentQuantity}
        reason={stockAdjustmentReason}
        onClose={() => {
          setStockAdjustmentProduct(null);
          setStockAdjustmentQuantity("");
          setStockAdjustmentReason("");
          setStockAdjustmentType("add");
        }}
        onTypeChange={setStockAdjustmentType}
        onQuantityChange={setStockAdjustmentQuantity}
        onReasonChange={setStockAdjustmentReason}
        onConfirm={handleStockAdjustment}
      />

      {/* Product Form Drawer */}
      {user?.businessId ? (
        <ProductFormDrawer
          isOpen={isDrawerOpen}
          editingProduct={editingProduct}
          categories={categories}
          vatCategories={vatCategories}
          businessId={user.businessId}
          onClose={() => setIsDrawerOpen(false)}
          onSave={handleSaveProduct}
          onUpdate={handleUpdateProduct}
        />
      ) : null}
    </>
  );
};

export default ProductManagementView;
