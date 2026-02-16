import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Search,
  Filter,
  Edit,
  Trash2,
  Package,
  Plus,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Scale,
  FileSpreadsheet,
} from "lucide-react";
import { AdaptiveKeyboard } from "@/features/adaptive-keyboard/adaptive-keyboard";
import { cn } from "@/shared/utils/cn";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MiniBar } from "@/components/mini-bar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Product } from "@/types/domain";
import { ImportBookerModal } from "@/features/inventory/components/shared/import-booker-modal";
import type { Category } from "../hooks/use-product-data";
import { VirtualizedProductTable } from "../components/product/virtualized-product-table";
import { ProductTableSkeleton } from "../components/shared/skeleton-loaders";
import { USE_VIRTUALIZED_INVENTORY_TABLE } from "@/shared/config/feature-flags";

interface ProductDetailsViewProps {
  products: Product[];
  categories: Category[];
  loading: boolean;
  searchTerm: string;
  filterCategory: string;
  filterStock: string;
  filterStatus: string;
  showFields: {
    name: boolean;
    category: boolean;
    price: boolean;
    stock: boolean;
    sku: boolean;
    status: boolean;
  };
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onBack: () => void;
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onAdjustStock: (product: Product) => void;
  onSearchChange: (value: string) => void;
  onCategoryFilterChange: (value: string) => void;
  onStockFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onShowFieldsChange: (fields: {
    name: boolean;
    category: boolean;
    price: boolean;
    stock: boolean;
    sku: boolean;
    status: boolean;
  }) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;

  onProductsImported: () => void;
}

/**
 * Build category path from category ID by traversing parent categories
 * Returns the full path as a string (e.g., "Parent > Child > Subchild")
 */
const getCategoryPath = (
  categoryId: string | null | undefined,
  categories: Category[],
): string | null => {
  if (!categoryId) return null;

  const categoryMap = new Map<string, Category>();
  categories.forEach((cat) => categoryMap.set(cat.id, cat));

  const path: string[] = [];
  let currentId: string | null | undefined = categoryId;
  const visited = new Set<string>(); // Prevent infinite loops

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const category = categoryMap.get(currentId);
    if (!category) break;
    path.unshift(category.name);
    currentId = category.parentId;
  }

  return path.length > 0 ? path.join(" > ") : null;
};

const ProductDetailsView: React.FC<ProductDetailsViewProps> = ({
  products,
  categories,
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
  onBack,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onAdjustStock,
  onSearchChange,
  onCategoryFilterChange,
  onStockFilterChange,
  onStatusFilterChange,
  onShowFieldsChange,
  onPageChange,
  onProductsImported,
}) => {
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Keyboard state for search field
  const [showSearchKeyboard, setShowSearchKeyboard] = useState(false);
  const [searchValue, setSearchValue] = useState(searchTerm);

  // Sync searchValue with searchTerm prop
  React.useEffect(() => {
    setSearchValue(searchTerm);
  }, [searchTerm]);

  const handleSearchInput = useCallback(
    (char: string) => {
      setSearchValue((prev) => {
        const newValue = prev + char;
        onSearchChange(newValue);
        return newValue;
      });
    },
    [onSearchChange],
  );

  const handleSearchBackspace = useCallback(() => {
    setSearchValue((prev) => {
      const newValue = prev.slice(0, -1);
      onSearchChange(newValue);
      return newValue;
    });
  }, [onSearchChange]);

  const handleSearchClear = useCallback(() => {
    setSearchValue("");
    onSearchChange("");
  }, [onSearchChange]);

  const handleSearchFocus = useCallback(() => {
    setShowSearchKeyboard(true);
  }, []);

  const handleCloseSearchKeyboard = useCallback(() => {
    setShowSearchKeyboard(false);
  }, []);

  return (
    <div className="container mx-auto p-1 max-w-[1600px] flex flex-col flex-1 min-h-0 gap-4 sm:gap-6 overflow-hidden relative">
      <MiniBar
        className="shrink-0"
        title="Product Management"
        onBack={onBack}
        backAriaLabel="Back to Dashboard"
        action={{
          label: "Add Product",
          onClick: onAddProduct,
          icon: <Plus className="h-4 w-4" />,
          ariaLabel: "Add product",
        }}
        center={
          <div className="w-full max-w-2xl flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[120px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                value={searchValue}
                readOnly
                onFocus={handleSearchFocus}
                className={cn(
                  "flex h-8 w-full rounded-md border border-input bg-background pl-8 pr-2 text-sm",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  showSearchKeyboard && "ring-2 ring-primary border-primary",
                )}
              />
            </div>
            <Select
              value={filterCategory}
              onValueChange={onCategoryFilterChange}
            >
              <SelectTrigger className="h-8 w-[130px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStock} onValueChange={onStockFilterChange}>
              <SelectTrigger className="h-8 w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Stock</SelectItem>
                <SelectItem value="in_stock">In Stock</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="out_of_stock">Out</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={onStatusFilterChange}>
              <SelectTrigger className="h-8 w-[90px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        right={
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
              {totalItems === 0
                ? "0 / 0"
                : `${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, totalItems)} / ${totalItems}`}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1 || totalPages <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                onPageChange(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage >= totalPages || totalPages <= 1}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {/* Slim toolbar: Import + Show fields */}
      <div className="shrink-0 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => setImportModalOpen(true)}
        >
          <FileSpreadsheet className="w-4 h-4 mr-1.5" />
          Import from Booker
        </Button>
        <Filter className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Show:</span>
        {Object.entries(showFields).map(([field, show]) => (
          <Button
            key={field}
            variant={show ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() =>
              onShowFieldsChange({ ...showFields, [field]: !show })
            }
          >
            {field.charAt(0).toUpperCase() + field.slice(1)}
          </Button>
        ))}
      </div>

      {/* Products Table */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex flex-col flex-1 min-h-0 rounded-lg border bg-background overflow-hidden">
          {loading ? (
            <ProductTableSkeleton rows={pageSize} />
          ) : products.length === 0 ? (
            <div className="flex items-center justify-center flex-1 p-12">
              <div className="text-center">
                <Package className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-base font-semibold text-foreground mb-2">
                  No products found
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {totalItems === 0
                    ? "Get started by adding your first product to the menu."
                    : "Try adjusting your search criteria or filters."}
                </p>
                <Button size="sm" onClick={onAddProduct}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Product
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Use virtualized table if feature flag is enabled */}
              {USE_VIRTUALIZED_INVENTORY_TABLE ? (
                <VirtualizedProductTable
                  products={products}
                  categories={categories}
                  showFields={showFields}
                  onEditProduct={onEditProduct}
                  onDeleteProduct={onDeleteProduct}
                  onAdjustStock={onAdjustStock}
                />
              ) : (
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="flex-1 overflow-auto min-h-0">
                    <table className="w-full border-collapse">
                      <thead className="bg-muted/50 border-b sticky top-0 z-10">
                        <tr>
                          <th
                            className="text-left p-3 font-semibold text-foreground text-sm"
                            style={{ width: "80px" }}
                          >
                            Image
                          </th>
                          {showFields.name && (
                            <th
                              className="text-left p-3 font-semibold text-foreground text-sm"
                              style={{ minWidth: "200px" }}
                            >
                              Name
                            </th>
                          )}
                          {showFields.category && (
                            <th
                              className="text-left p-3 font-semibold text-foreground text-sm"
                              style={{ minWidth: "180px" }}
                            >
                              Category
                            </th>
                          )}
                          {showFields.price && (
                            <th
                              className="text-left p-3 font-semibold text-foreground text-sm"
                              style={{ width: "140px" }}
                            >
                              Price
                            </th>
                          )}
                          {showFields.stock && (
                            <th
                              className="text-left p-3 font-semibold text-foreground text-sm"
                              style={{ width: "160px" }}
                            >
                              Stock
                            </th>
                          )}
                          {showFields.sku && (
                            <th
                              className="text-left p-3 font-semibold text-foreground text-sm"
                              style={{ minWidth: "140px" }}
                            >
                              SKU
                            </th>
                          )}
                          {showFields.status && (
                            <th
                              className="text-left p-3 font-semibold text-foreground text-sm"
                              style={{ width: "100px" }}
                            >
                              Status
                            </th>
                          )}
                          <th
                            className="text-left p-3 font-semibold text-foreground text-sm"
                            style={{ width: "130px" }}
                          >
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {products.map((product) => {
                          const categoryId = product.categoryId;
                          const usesScale = product.usesScale || false;
                          const pricePerKg =
                            product.pricePerKg || product.basePrice || 0;
                          const basePrice = product.basePrice || 0;
                          const salesUnit = product.salesUnit || "KG";

                          return (
                            <tr key={product.id} className="hover:bg-muted/30">
                              <td className="p-3">
                                <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                                  {product.image ? (
                                    <img
                                      src={product.image}
                                      alt={product.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                                  )}
                                </div>
                              </td>
                              {showFields.name && (
                                <td className="p-3 max-w-[250px]">
                                  <div className="space-y-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="font-medium text-foreground truncate cursor-help">
                                          {product.name}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent
                                        side="top"
                                        className="max-w-xs"
                                      >
                                        <p className="whitespace-normal">
                                          {product.name}
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                    {product.description && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="text-sm text-muted-foreground truncate cursor-help">
                                            {product.description}
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent
                                          side="top"
                                          className="max-w-xs"
                                        >
                                          <p className="whitespace-normal">
                                            {product.description}
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                </td>
                              )}
                              {showFields.category &&
                                (() => {
                                  const categoryPath = getCategoryPath(
                                    categoryId,
                                    categories,
                                  );
                                  const categoryName = categoryId
                                    ? categories.find(
                                        (cat) => cat.id === categoryId,
                                      )?.name || "Uncategorized"
                                    : "Uncategorized";

                                  return (
                                    <td className="p-3 max-w-[200px]">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="inline-block px-2 py-0.5 bg-muted text-foreground rounded-md text-xs font-medium truncate max-w-full cursor-help">
                                            {categoryName}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent
                                          side="top"
                                          className="max-w-xs"
                                        >
                                          <p className="whitespace-normal">
                                            {categoryPath || categoryName}
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </td>
                                  );
                                })()}
                              {showFields.price && (
                                <td className="p-3">
                                  <div className="flex items-center space-x-2">
                                    <div>
                                      <div className="text-foreground font-medium text-sm">
                                        £
                                        {usesScale
                                          ? pricePerKg.toFixed(2)
                                          : basePrice.toFixed(2)}
                                        {usesScale && (
                                          <span className="text-xs text-muted-foreground ml-1">
                                            /{salesUnit}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        Cost: £
                                        {(product.costPrice || 0).toFixed(2)}
                                      </div>
                                    </div>
                                    {usesScale && (
                                      <Scale className="w-4 h-4 text-muted-foreground" />
                                    )}
                                  </div>
                                </td>
                              )}
                              {showFields.stock && (
                                <td className="p-3">
                                  <div className="flex items-center space-x-2">
                                    <span
                                      className={cn(
                                        "font-medium text-sm",
                                        (product.stockLevel || 0) <=
                                          (product.minStockLevel || 0)
                                          ? "text-destructive"
                                          : (product.stockLevel || 0) <=
                                              (product.minStockLevel || 0) * 2
                                            ? "text-amber-600 dark:text-amber-400"
                                            : "text-foreground",
                                      )}
                                    >
                                      {product.stockLevel || 0}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7"
                                      onClick={() => onAdjustStock(product)}
                                    >
                                      Adjust
                                    </Button>
                                  </div>
                                  {(product.stockLevel || 0) <=
                                    (product.minStockLevel || 0) && (
                                    <div className="text-xs text-destructive mt-0.5">
                                      Low Stock!
                                    </div>
                                  )}
                                </td>
                              )}
                              {showFields.sku && (
                                <td className="p-3">
                                  {product.sku && product.sku.length > 15 ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="text-muted-foreground font-mono text-sm truncate cursor-help">
                                          {product.sku}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent
                                        side="top"
                                        className="max-w-xs font-mono"
                                      >
                                        <p className="whitespace-normal">
                                          {product.sku}
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <div className="text-muted-foreground font-mono text-sm">
                                      {product.sku}
                                    </div>
                                  )}
                                </td>
                              )}
                              {showFields.status && (
                                <td className="p-3">
                                  <span
                                    className={cn(
                                      "px-2 py-0.5 rounded-md text-xs font-medium",
                                      product.isActive
                                        ? "bg-primary/10 text-primary"
                                        : "bg-destructive/10 text-destructive",
                                    )}
                                  >
                                    {product.isActive ? "Active" : "Inactive"}
                                  </span>
                                </td>
                              )}
                              <td className="p-3">
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    onClick={() => onEditProduct(product)}
                                    aria-label="Edit product"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                    onClick={() => onDeleteProduct(product.id)}
                                    aria-label="Delete product"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {/* Import from Booker Modal */}
      <ImportBookerModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        importType="product"
        onSuccess={onProductsImported}
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
    </div>
  );
};

export default ProductDetailsView;
