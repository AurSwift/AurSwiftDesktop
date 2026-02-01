/**
 * Product Search Combobox
 *
 * Searchable dropdown for selecting products to link to quick sell buttons.
 * Optimized for large datasets with server-side search and debouncing.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Check, ChevronsUpDown, Package, Loader2 } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/shared/hooks/use-auth";
import { getLogger } from "@/shared/utils/logger";

const logger = getLogger("product-search-combobox");

interface Product {
  id: string;
  name: string;
  basePrice: number;
  sku: string;
  categoryId?: string | null;
}

interface ProductSearchComboboxProps {
  selectedProductId: string | null;
  onSelect: (productId: string | null) => void;
}

export function ProductSearchCombobox({
  selectedProductId,
  onSelect,
}: ProductSearchComboboxProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Load selected product details on mount
  useEffect(() => {
    const loadSelectedProduct = async () => {
      if (!selectedProductId) {
        setSelectedProduct(null);
        return;
      }

      try {
        const response = await window.productAPI.getById(selectedProductId);
        if (response.success && response.product) {
          setSelectedProduct(response.product);
        }
      } catch (error) {
        logger.error("Error loading selected product:", error);
      }
    };

    loadSelectedProduct();
  }, [selectedProductId]);

  // Debounced search function
  const searchProducts = useCallback(
    async (query: string) => {
      if (!user?.businessId) return;

      try {
        setIsLoading(true);
        const response = await window.productAPI.getPaginated(
          user.businessId,
          {
            page: 1,
            pageSize: 50, // Limit to first 50 results
            sortBy: "name",
            sortOrder: "asc",
          },
          {
            searchTerm: query,
            isActive: true, // Only active products
          }
        );

        if (response.success && response.products) {
          setProducts(response.products);
        } else {
          setProducts([]);
        }
      } catch (error) {
        logger.error("Error searching products:", error);
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    },
    [user?.businessId]
  );

  // Handle search query change with debouncing
  useEffect(() => {
    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer
    debounceTimer.current = setTimeout(() => {
      searchProducts(searchQuery);
    }, 300); // 300ms debounce

    // Cleanup
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery, searchProducts]);

  // Load initial results when popover opens
  useEffect(() => {
    if (open && products.length === 0 && !searchQuery) {
      searchProducts("");
    }
  }, [open, products.length, searchQuery, searchProducts]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedProduct ? (
            <span className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              <span className="truncate">{selectedProduct.name}</span>
              <span className="text-muted-foreground text-xs">
                £{selectedProduct.basePrice.toFixed(2)}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Select a product...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search products by name or SKU..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Searching...
              </div>
            ) : products.length === 0 ? (
              <CommandEmpty>
                {searchQuery
                  ? "No products found. Try a different search."
                  : "Start typing to search products..."}
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {/* Clear selection option */}
                {selectedProductId && (
                  <CommandItem
                    value="__clear__"
                    onSelect={() => {
                      onSelect(null);
                      setOpen(false);
                    }}
                    className="text-muted-foreground"
                  >
                    <span className="flex items-center gap-2">
                      Clear selection
                    </span>
                  </CommandItem>
                )}
                {products.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={product.id}
                    onSelect={() => {
                      onSelect(product.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedProductId === product.id
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="truncate">{product.name}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        SKU: {product.sku} • £{product.basePrice.toFixed(2)}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
