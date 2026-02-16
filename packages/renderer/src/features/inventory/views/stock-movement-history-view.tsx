import React, { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MiniBar } from "@/components/mini-bar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  Filter,
  Download,
  TrendingUp,
  TrendingDown,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/shared/hooks/use-auth";
import { cn } from "@/shared/utils/cn";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("stock-movement-history-view");

interface StockMovement {
  id: string;
  productId: string;
  batchId?: string;
  movementType: "INBOUND" | "OUTBOUND" | "ADJUSTMENT" | "TRANSFER" | "WASTE";
  quantity: number;
  reason?: string;
  reference?: string;
  userId: string;
  businessId: string;
  createdAt: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
}

interface StockMovementHistoryViewProps {
  onBack: () => void;
}

const StockMovementHistoryView: React.FC<StockMovementHistoryViewProps> = ({
  onBack,
}) => {
  const { user } = useAuth();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProduct, setFilterProduct] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Load products for filter dropdown
  const loadProducts = useCallback(async () => {
    if (!user?.businessId) return;

    try {
      const response = await window.productAPI.getByBusiness(user.businessId);
      if (response.success && response.products) {
        setProducts(response.products);
      }
    } catch (error) {
      logger.error("Error loading products:", error);
    }
  }, [user?.businessId]);

  // Load stock movements
  const loadMovements = useCallback(async () => {
    if (!user?.businessId) return;

    setLoading(true);
    try {
      // If filtering by specific product
      if (filterProduct !== "all") {
        const response =
          await window.stockMovementsAPI.getByProduct(filterProduct);
        if (response.success && response.movements) {
          setMovements(response.movements);
        }
      } else {
        // Load all movements for business
        const response = await window.stockMovementsAPI.getByBusiness(
          user.businessId,
        );
        if (response.success && response.movements) {
          setMovements(response.movements);
        }
      }
    } catch (error) {
      logger.error("Error loading stock movements:", error);
      toast.error("Failed to load stock movement history");
    } finally {
      setLoading(false);
    }
  }, [user?.businessId, filterProduct]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  // Filter movements based on search and filters
  const filteredMovements = movements.filter((movement) => {
    // Search filter
    if (searchTerm) {
      const product = products.find((p) => p.id === movement.productId);
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        product?.name.toLowerCase().includes(searchLower) ||
        product?.sku.toLowerCase().includes(searchLower) ||
        movement.reason?.toLowerCase().includes(searchLower) ||
        movement.reference?.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;
    }

    // Type filter
    if (filterType !== "all" && movement.movementType !== filterType) {
      return false;
    }

    // Date filters
    if (startDate) {
      const movementDate = new Date(movement.createdAt);
      const filterStart = new Date(startDate);
      if (movementDate < filterStart) return false;
    }

    if (endDate) {
      const movementDate = new Date(movement.createdAt);
      const filterEnd = new Date(endDate);
      filterEnd.setHours(23, 59, 59, 999); // Include entire end date
      if (movementDate > filterEnd) return false;
    }

    return true;
  });

  // Calculate summary statistics
  const stats = {
    totalInbound: filteredMovements
      .filter((m) => m.movementType === "INBOUND")
      .reduce((sum, m) => sum + m.quantity, 0),
    totalOutbound: filteredMovements
      .filter((m) => m.movementType === "OUTBOUND")
      .reduce((sum, m) => sum + m.quantity, 0),
    totalWaste: filteredMovements
      .filter((m) => m.movementType === "WASTE")
      .reduce((sum, m) => sum + m.quantity, 0),
    totalAdjustments: filteredMovements.filter(
      (m) => m.movementType === "ADJUSTMENT",
    ).length,
  };

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case "INBOUND":
        return "bg-primary/10 text-primary";
      case "OUTBOUND":
        return "bg-destructive/10 text-destructive";
      case "WASTE":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
      case "ADJUSTMENT":
        return "bg-muted text-foreground";
      case "TRANSFER":
        return "bg-muted text-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getMovementTypeIcon = (type: string) => {
    switch (type) {
      case "INBOUND":
        return <TrendingUp className="w-4 h-4" />;
      case "OUTBOUND":
      case "WASTE":
        return <TrendingDown className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  return (
    <div className="container mx-auto p-1 max-w-[1600px] flex flex-col flex-1 min-h-0 gap-4 sm:gap-6 overflow-hidden">
      <MiniBar
        className="shrink-0"
        title="Stock Movement History"
        onBack={onBack}
        backAriaLabel="Back to Dashboard"
        action={{
          label: "Export",
          onClick: () => toast.info("Export coming soon"),
          icon: <Download className="h-4 w-4" />,
          ariaLabel: "Export report",
        }}
        center={
          <div className="w-full max-w-2xl flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[120px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Select value={filterProduct} onValueChange={setFilterProduct}>
              <SelectTrigger className="h-8 w-[130px]">
                <SelectValue placeholder="Product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 w-[100px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="INBOUND">Inbound</SelectItem>
                <SelectItem value="OUTBOUND">Outbound</SelectItem>
                <SelectItem value="WASTE">Waste</SelectItem>
                <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                <SelectItem value="TRANSFER">Transfer</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 w-[130px] text-sm"
              placeholder="Start"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 w-[130px] text-sm"
              placeholder="End"
            />
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
        <Card className="p-2">
          <CardContent className="p-0 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Inbound</p>
              <p className="text-lg font-semibold text-foreground truncate">
                {stats.totalInbound}
              </p>
            </div>
            <TrendingUp className="w-6 h-6 text-muted-foreground shrink-0" />
          </CardContent>
        </Card>
        <Card className="p-2">
          <CardContent className="p-0 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Outbound</p>
              <p className="text-lg font-semibold text-destructive truncate">
                {stats.totalOutbound}
              </p>
            </div>
            <TrendingDown className="w-6 h-6 text-muted-foreground shrink-0" />
          </CardContent>
        </Card>
        <Card className="p-2">
          <CardContent className="p-0 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Waste</p>
              <p className="text-lg font-semibold text-foreground truncate">
                {stats.totalWaste}
              </p>
            </div>
            <Package className="w-6 h-6 text-muted-foreground shrink-0" />
          </CardContent>
        </Card>
        <Card className="p-2">
          <CardContent className="p-0 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Adjustments</p>
              <p className="text-lg font-semibold text-foreground truncate">
                {stats.totalAdjustments}
              </p>
            </div>
            <Filter className="w-6 h-6 text-muted-foreground shrink-0" />
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-lg border bg-background">
        {loading ? (
          <div className="flex items-center justify-center flex-1 p-12">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">
                Loading movements...
              </p>
            </div>
          </div>
        ) : filteredMovements.length === 0 ? (
          <div className="flex items-center justify-center flex-1 p-12">
            <div className="text-center">
              <Package className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-base font-semibold text-foreground mb-2">
                No movements found
              </h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your filters or date range.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b sticky top-0 z-10">
                <tr>
                  <th className="text-left p-3 font-semibold text-foreground text-sm">
                    Date & Time
                  </th>
                  <th className="text-left p-3 font-semibold text-foreground text-sm">
                    Product
                  </th>
                  <th className="text-left p-3 font-semibold text-foreground text-sm">
                    Type
                  </th>
                  <th className="text-left p-3 font-semibold text-foreground text-sm">
                    Quantity
                  </th>
                  <th className="text-left p-3 font-semibold text-foreground text-sm">
                    Reason
                  </th>
                  <th className="text-left p-3 font-semibold text-foreground text-sm">
                    Reference
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredMovements.map((movement) => {
                  const product = products.find(
                    (p) => p.id === movement.productId,
                  );
                  return (
                    <tr key={movement.id} className="hover:bg-muted/30">
                      <td className="p-3 text-sm text-muted-foreground">
                        {new Date(movement.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <div>
                          <div className="font-medium text-foreground text-sm">
                            {product?.name || "Unknown Product"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {product?.sku}
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium",
                            getMovementTypeColor(movement.movementType),
                          )}
                        >
                          {getMovementTypeIcon(movement.movementType)}
                          {movement.movementType}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={cn(
                            "font-semibold text-sm",
                            movement.movementType === "INBOUND"
                              ? "text-primary"
                              : "text-destructive",
                          )}
                        >
                          {movement.movementType === "INBOUND" ? "+" : "-"}
                          {movement.quantity}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {movement.reason || "-"}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground font-mono">
                        {movement.reference || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockMovementHistoryView;
