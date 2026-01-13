import React, { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Package,
  Settings,
  AlertTriangle,
  MenuSquare,
  DollarSign,
  TrendingDown,
  Tag,
  PackageCheck,
} from "lucide-react";

interface ProductDashboardViewProps {
  productStats: {
    totalProducts: number;
    activeProducts: number;
    inactiveProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalInventoryValue: number;
  };
  categoryCount: number;
  onBack: () => void;
  onManageProducts: () => void;
  onManageCategories: () => void;
  onAddProduct: () => void;
  onManageBatches?: () => void;
}

const ProductDashboardView: React.FC<ProductDashboardViewProps> = ({
  productStats,
  categoryCount,
  onBack,
  onManageProducts,
  onManageCategories,
  onManageBatches,
}) => {
  const [navigating, setNavigating] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced navigation handler to prevent rapid clicks
  const handleNavigate = useCallback(
    (handler: () => void) => {
      if (navigating) return; // Prevent multiple clicks
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      setNavigating(true);
      handler();
      
      // Reset after a short delay to allow navigation to complete
      timeoutRef.current = setTimeout(() => {
        setNavigating(false);
      }, 300);
    },
    [navigating]
  );

  // Create handlers with debouncing
  const debouncedOnBack = useCallback(() => handleNavigate(onBack), [handleNavigate, onBack]);
  const debouncedOnManageProducts = useCallback(() => handleNavigate(onManageProducts), [handleNavigate, onManageProducts]);
  const debouncedOnManageCategories = useCallback(() => handleNavigate(onManageCategories), [handleNavigate, onManageCategories]);
  const debouncedOnManageBatches = useCallback(() => {
    if (onManageBatches) handleNavigate(onManageBatches);
  }, [handleNavigate, onManageBatches]);

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Product & Menu Management
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Manage your inventory and menu items
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-4">
          <Button
            onClick={debouncedOnBack}
            disabled={navigating}
            className="w-full sm:w-auto"
          >
            Go to dashboard
          </Button>

          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Alert for low stock */}
      {productStats.lowStockCount > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            {productStats.lowStockCount} product(s) are running low on stock and
            need attention.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-600">Total Products</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                {productStats.totalProducts}
              </p>
              <p className="text-xs sm:text-sm text-blue-600 mt-1">
                {productStats.activeProducts} active
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-600">Categories</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                {categoryCount}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Menu categories
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <MenuSquare className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-600">
                Low Stock Items
              </p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                {productStats.lowStockCount}
              </p>
              <p className="text-xs sm:text-sm text-orange-600 mt-1">
                Need restocking
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-600">
                Inventory Value
              </p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                £{productStats.totalInventoryValue.toFixed(2)}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Total stock value
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
            Quick Actions
          </h3>
          <div className="space-y-2 sm:space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={debouncedOnManageProducts}
              disabled={navigating}
            >
              <Package className="w-4 h-4 mr-3" />
              <span className="text-sm sm:text-base">Manage Products</span>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={debouncedOnManageCategories}
              disabled={navigating}
            >
              <Tag className="w-4 h-4 mr-3" />
              <span className="text-sm sm:text-base">Manage Categories</span>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={debouncedOnManageBatches}
              disabled={navigating}
            >
              <PackageCheck className="w-4 h-4 mr-3" />
              <span className="text-sm sm:text-base">
                Batch & Expiry Management
              </span>
            </Button>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
            Low Stock Alerts
          </h3>
          {productStats.lowStockCount === 0 ? (
            <p className="text-gray-500 text-xs sm:text-sm">
              All products are well stocked!
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <span className="font-medium text-sm">
                    {productStats.lowStockCount} product
                    {productStats.lowStockCount !== 1 ? "s" : ""} need
                    {productStats.lowStockCount === 1 ? "s" : ""} attention
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={debouncedOnManageProducts}
                disabled={navigating}
                className="w-full"
              >
                View Low Stock Products
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(ProductDashboardView);
