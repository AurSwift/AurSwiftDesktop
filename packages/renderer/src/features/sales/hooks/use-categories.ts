/**
 * Hook for managing categories and category navigation
 * Handles loading categories, navigation, breadcrumbs, and product filtering
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { toast } from "sonner";
import type { Category } from "@/types/domain/category";
import type { Product } from "@/types/domain";
import type { BreadcrumbItem } from "@/types/ui";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("use-categories");

interface UseCategoriesProps {
  businessId: string | undefined;
  products: Product[]; // Products are needed to filter by category
  onCategorySelectForPriceInput: (category: Category) => void; // Callback for when a category is selected for price input
}

/**
 * Hook for managing categories
 * @param props - Category configuration props
 * @returns Category state and navigation functions
 */
export function useCategories({
  businessId,
  products,
  onCategorySelectForPriceInput,
}: UseCategoriesProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(
    null
  );
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([
    { id: null, name: "All Categories" },
  ]);

  /**
   * Load categories from backend
   */
  const loadCategories = useCallback(async () => {
    if (!businessId) return;

    try {
      const response = await window.categoryAPI.getByBusiness(businessId);
      if (response.success && response.categories) {
        // Filter to only active categories
        const activeCategories = response.categories.filter(
          (cat: any) => cat.isActive
        );
        setCategories(activeCategories);
      } else {
        toast.error("Failed to load categories");
      }
    } catch (error) {
      logger.error("Error loading categories:", error);
      toast.error("Failed to load categories");
    }
  }, [businessId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleCategoryClick = useCallback(
    (category: Category, addToCart: boolean = false) => {
      if (addToCart) {
        onCategorySelectForPriceInput(category);
      } else {
        setCurrentCategoryId(category.id);
        setBreadcrumb((prev) => [
          ...prev,
          { id: category.id, name: category.name },
        ]);
      }
    },
    [onCategorySelectForPriceInput]
  );

  /**
   * Handle breadcrumb click - navigate to that level
   * @param index - Index of breadcrumb item clicked
   */
  const handleBreadcrumbClick = useCallback(
    (index: number) => {
      const newBreadcrumb = breadcrumb.slice(0, index + 1);
      setBreadcrumb(newBreadcrumb);
      setCurrentCategoryId(newBreadcrumb[newBreadcrumb.length - 1].id);
    },
    [breadcrumb]
  );

  /**
   * Get current level categories (top-level or children of current category)
   */
  const currentCategories = useMemo(() => {
    return categories
      .filter((cat) =>
        currentCategoryId === null
          ? !cat.parentId
          : cat.parentId === currentCategoryId
      )
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [categories, currentCategoryId]);

  /**
   * Get products for current category (including subcategories)
   */
  const getCurrentCategoryProducts = useCallback((): Product[] => {
    if (currentCategoryId === null) {
      // Show all products when at root
      return products;
    }

    // Get all descendant category IDs
    const getDescendantIds = (catId: string): string[] => {
      const children = categories.filter((c) => c.parentId === catId);
      return [
        catId,
        ...children.flatMap((child) => getDescendantIds(child.id)),
      ];
    };

    const categoryIds = getDescendantIds(currentCategoryId);
    return products.filter((p) => p.categoryId && categoryIds.includes(p.categoryId));
  }, [currentCategoryId, categories, products]);

  return {
    categories,
    currentCategoryId,
    breadcrumb,
    currentCategories,
    loadCategories,
    handleCategoryClick,
    handleBreadcrumbClick,
    getCurrentCategoryProducts,
    setCurrentCategoryId,
    setBreadcrumb,
  };
}
