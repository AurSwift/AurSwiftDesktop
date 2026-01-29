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
import { Pagination } from "@/components/ui/pagination";
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
  categories: Category[]
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
  onPageSizeChange,
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

  const handleSearchInput = useCallback((char: string) => {
    setSearchValue((prev) => {
      const newValue = prev + char;
      onSearchChange(newValue);
      return newValue;
    });
  }, [onSearchChange]);

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
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden relative">
      {/* Header */}
      <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0 shrink-0 p-4 md:p-6">
        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="w-fit"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Back</span>
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Product Management
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Manage all menu items and inventory
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => setImportModalOpen(true)}
        >
          <FileSpreadsheet className="w-4 h-4 mr-3" />
          <span className="text-sm sm:text-base">Import from Booker</span>
        </Button>
        <Button onClick={onAddProduct} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="shrink-0 px-4 md:px-6 pb-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search products..."
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

              <Select
                value={filterCategory}
                onValueChange={onCategoryFilterChange}
              >
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="All Categories" />
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
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stock</SelectItem>
                  <SelectItem value="in_stock">In Stock</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                  <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={onStatusFilterChange}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="all">All Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap mt-3 items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-xs sm:text-sm text-gray-600">
              Show fields:
            </span>
            {Object.entries(showFields).map(([field, show]) => (
              <Button
                key={field}
                variant={show ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  onShowFieldsChange({ ...showFields, [field]: !show })
                }
                className="text-xs sm:text-sm"
              >
                {field.charAt(0).toUpperCase() + field.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="flex-1 min-h-0 px-4 md:px-6 pb-4 md:pb-6">
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border overflow-hidden">
          {loading ? (
            <ProductTableSkeleton rows={pageSize} />
          ) : products.length === 0 ? (
            <div className="flex items-center justify-center flex-1 p-12">
              <div className="text-center">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No products found
                </h3>
                <p className="text-gray-600 mb-4">
                  {totalItems === 0
                    ? "Get started by adding your first product to the menu."
                    : "Try adjusting your search criteria or filters."}
                </p>
                <Button onClick={onAddProduct}>
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
                      <thead className="bg-gray-50 border-b sticky top-0 z-10">
                        <tr>
                          <th
                            className="text-left p-4 font-semibold text-gray-900"
                            style={{ width: "80px" }}
                          >
                            Image
                          </th>
                          {showFields.name && (
                            <th
                              className="text-left p-4 font-semibold text-gray-900"
                              style={{ minWidth: "200px" }}
                            >
                              Name
                            </th>
                          )}
                          {showFields.category && (
                            <th
                              className="text-left p-4 font-semibold text-gray-900"
                              style={{ minWidth: "180px" }}
                            >
                              Category
                            </th>
                          )}
                          {showFields.price && (
                            <th
                              className="text-left p-4 font-semibold text-gray-900"
                              style={{ width: "140px" }}
                            >
                              Price
                            </th>
                          )}
                          {showFields.stock && (
                            <th
                              className="text-left p-4 font-semibold text-gray-900"
                              style={{ width: "160px" }}
                            >
                              Stock
                            </th>
                          )}
                          {showFields.sku && (
                            <th
                              className="text-left p-4 font-semibold text-gray-900"
                              style={{ minWidth: "140px" }}
                            >
                              SKU
                            </th>
                          )}
                          {showFields.status && (
                            <th
                              className="text-left p-4 font-semibold text-gray-900"
                              style={{ width: "100px" }}
                            >
                              Status
                            </th>
                          )}
                          <th
                            className="text-left p-4 font-semibold text-gray-900"
                            style={{ width: "130px" }}
                          >
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {products.map((product) => {
                          const categoryId = product.categoryId;
                          const usesScale = product.usesScale || false;
                          const pricePerKg =
                            product.pricePerKg || product.basePrice || 0;
                          const basePrice = product.basePrice || 0;
                          const salesUnit = product.salesUnit || "KG";

                          return (
                            <tr key={product.id} className="hover:bg-gray-50">
                              <td className="p-4">
                                <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                                  {product.image ? (
                                    <img
                                      src={product.image}
                                      alt={product.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <ImageIcon className="w-6 h-6 text-gray-400" />
                                  )}
                                </div>
                              </td>
                              {showFields.name && (
                                <td className="p-4 max-w-[250px]">
                                  <div className="space-y-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="font-medium text-gray-900 truncate cursor-help">
                                          {product.name}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent
                                        side="top"
                                        className="max-w-xs bg-gray-900 text-white"
                                      >
                                        <p className="whitespace-normal">
                                          {product.name}
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                    {product.description && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="text-sm text-gray-500 truncate cursor-help">
                                            {product.description}
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent
                                          side="top"
                                          className="max-w-xs bg-gray-900 text-white"
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
                                    categories
                                  );
                                  const categoryName = categoryId
                                    ? categories.find(
                                        (cat) => cat.id === categoryId
                                      )?.name || "Uncategorized"
                                    : "Uncategorized";

                                  return (
                                    <td className="p-4 max-w-[200px]">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium truncate max-w-full cursor-help">
                                            {categoryName}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent
                                          side="top"
                                          className="max-w-xs bg-gray-900 text-white"
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
                                <td className="p-4">
                                  <div className="flex items-center space-x-2">
                                    <div>
                                      <div className="text-gray-900 font-medium">
                                        £
                                        {usesScale
                                          ? pricePerKg.toFixed(2)
                                          : basePrice.toFixed(2)}
                                        {usesScale && (
                                          <span className="text-xs text-gray-500 ml-1">
                                            /{salesUnit}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        Cost: £
                                        {(product.costPrice || 0).toFixed(2)}
                                      </div>
                                    </div>
                                    {usesScale && (
                                      <Scale className="w-4 h-4 text-blue-500" />
                                    )}
                                  </div>
                                </td>
                              )}
                              {showFields.stock && (
                                <td className="p-4">
                                  <div className="flex items-center space-x-2">
                                    <span
                                      className={`font-medium ${
                                        (product.stockLevel || 0) <=
                                        (product.minStockLevel || 0)
                                          ? "text-red-600"
                                          : (product.stockLevel || 0) <=
                                            (product.minStockLevel || 0) * 2
                                          ? "text-orange-600"
                                          : "text-green-600"
                                      }`}
                                    >
                                      {product.stockLevel || 0}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => onAdjustStock(product)}
                                    >
                                      Adjust
                                    </Button>
                                  </div>
                                  {(product.stockLevel || 0) <=
                                    (product.minStockLevel || 0) && (
                                    <div className="text-xs text-red-600 mt-1">
                                      Low Stock!
                                    </div>
                                  )}
                                </td>
                              )}
                              {showFields.sku && (
                                <td className="p-4">
                                  {product.sku && product.sku.length > 15 ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="text-gray-600 font-mono text-sm truncate cursor-help">
                                          {product.sku}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent
                                        side="top"
                                        className="max-w-xs bg-gray-900 text-white font-mono"
                                      >
                                        <p className="whitespace-normal">
                                          {product.sku}
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <div className="text-gray-600 font-mono text-sm">
                                      {product.sku}
                                    </div>
                                  )}
                                </td>
                              )}
                              {showFields.status && (
                                <td className="p-4">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      product.isActive
                                        ? "bg-green-100 text-green-800"
                                        : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {product.isActive ? "Active" : "Inactive"}
                                  </span>
                                </td>
                              )}
                              <td className="p-4">
                                <div className="flex items-center space-x-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onEditProduct(product)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onDeleteProduct(product.id)}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination - Fixed at bottom */}
                  <div className="shrink-0 border-t bg-white">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      pageSize={pageSize}
                      totalItems={totalItems}
                      onPageChange={onPageChange}
                      onPageSizeChange={onPageSizeChange}
                      showPageSizeSelector={true}
                      showPageInfo={true}
                    />
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
