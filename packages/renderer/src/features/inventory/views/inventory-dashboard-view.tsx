import React, { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MiniBar } from "@/components/mini-bar";
import {
  Package,
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

  const handleNavigate = useCallback(
    (handler: () => void) => {
      if (navigating) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setNavigating(true);
      handler();
      timeoutRef.current = setTimeout(() => setNavigating(false), 300);
    },
    [navigating],
  );

  const debouncedOnManageProducts = useCallback(
    () => handleNavigate(onManageProducts),
    [handleNavigate, onManageProducts],
  );
  const debouncedOnManageCategories = useCallback(
    () => handleNavigate(onManageCategories),
    [handleNavigate, onManageCategories],
  );
  const debouncedOnManageBatches = useCallback(() => {
    if (onManageBatches) handleNavigate(onManageBatches);
  }, [handleNavigate, onManageBatches]);

  return (
    <div className="container mx-auto p-1 max-w-[1600px] flex flex-col flex-1 min-h-0 gap-4 sm:gap-6">
      <MiniBar
        className="shrink-0"
        title="Product & Menu Management"
        onBack={onBack}
        backAriaLabel="Back to Dashboard"
      />

      {productStats.lowStockCount > 0 && (
        <Alert variant="destructive" className="shrink-0">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {productStats.lowStockCount} product(s) are running low on stock and
            need attention.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 min-h-0">
        <Card className="p-3">
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Total Products</p>
                <p className="text-lg font-semibold text-foreground truncate">
                  {productStats.totalProducts}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {productStats.activeProducts} active
                </p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Package className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-3">
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Categories</p>
                <p className="text-lg font-semibold text-foreground truncate">
                  {categoryCount}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Menu categories
                </p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <MenuSquare className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-3">
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Low Stock Items</p>
                <p className="text-lg font-semibold text-foreground truncate">
                  {productStats.lowStockCount}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Need restocking
                </p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <TrendingDown className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-3">
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Inventory Value</p>
                <p className="text-lg font-semibold text-foreground truncate">
                  £{productStats.totalInventoryValue.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Total stock value
                </p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-0">
        <Card className="p-3">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-1.5">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start h-8"
              onClick={debouncedOnManageProducts}
              disabled={navigating}
            >
              <Package className="w-4 h-4 mr-2" />
              Manage Products
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start h-8"
              onClick={debouncedOnManageCategories}
              disabled={navigating}
            >
              <Tag className="w-4 h-4 mr-2" />
              Manage Categories
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start h-8"
              onClick={debouncedOnManageBatches}
              disabled={navigating}
            >
              <PackageCheck className="w-4 h-4 mr-2" />
              Batch & Expiry Management
            </Button>
          </CardContent>
        </Card>

        <Card className="p-3">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {productStats.lowStockCount === 0 ? (
              <p className="text-xs text-muted-foreground">
                All products are well stocked!
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <span className="text-sm font-medium text-foreground">
                    {productStats.lowStockCount} product
                    {productStats.lowStockCount !== 1 ? "s" : ""} need
                    {productStats.lowStockCount === 1 ? "s" : ""} attention
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8"
                  onClick={debouncedOnManageProducts}
                  disabled={navigating}
                >
                  View Low Stock Products
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default React.memo(ProductDashboardView);
