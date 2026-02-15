import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  Plus,
  Tag,
  Settings,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MiniBar } from "@/components/mini-bar";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/shared/hooks/use-auth";
import type { Category, VatCategory } from "../hooks/use-product-data";

import { buildCategoryTree } from "../utils";
import { CategoryRow } from "../components/category/category-row";
import { CategoryFormDrawer } from "@/features/inventory/components/category/category-form-drawer";
import { ImportBookerModal } from "@/features/inventory/components/shared/import-booker-modal";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("manage-categories-view");

interface ManageCategoriesViewProps {
  onBack: () => void;
}

const ManageCategoriesView: React.FC<ManageCategoriesViewProps> = ({
  onBack,
}) => {
  const { user } = useAuth();

  // State management
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryStats, setCategoryStats] = useState<{
    totalCategories: number;
    activeCategories: number;
    inactiveCategories: number;
    rootCategories: number;
    mostRecentCategory: { id: string; name: string; createdAt: string } | null;
  }>({
    totalCategories: 0,
    activeCategories: 0,
    inactiveCategories: 0,
    rootCategories: 0,
    mostRecentCategory: null,
  });
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  const [vatCategories, setVatCategories] = useState<VatCategory[]>([]);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  // Build hierarchical category tree
  const categoryTree = useMemo(
    () => buildCategoryTree(categories),
    [categories]
  );

  const toggleExpand = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const response = await window.categoryAPI.getByBusiness(user!.businessId);
      if (response.success && response.categories) {
        // Normalize all fields to match Category type
        const normalized: Category[] = response.categories.map(
          (cat: unknown) => {
            const c = cat as Partial<Category> & { [key: string]: unknown };
            return {
              ...c,
              parentId: c.parentId ?? null,
              vatCategoryId: c.vatCategoryId ?? null,
              color: c.color ?? null,
              image: c.image ?? null,
              isActive: typeof c.isActive === "boolean" ? c.isActive : true,
              sortOrder: c.sortOrder ?? 0,
              createdAt: c.createdAt
                ? typeof c.createdAt === "string"
                  ? c.createdAt
                  : c.createdAt instanceof Date
                  ? c.createdAt.toISOString()
                  : new Date().toISOString()
                : new Date().toISOString(),
              updatedAt: c.updatedAt
                ? typeof c.updatedAt === "string"
                  ? c.updatedAt
                  : c.updatedAt instanceof Date
                  ? c.updatedAt.toISOString()
                  : null
                : null,
              description: c.description ?? "",
              vatOverridePercent: c.vatOverridePercent ?? null,
            } as Category;
          }
        );
        // Sort by sortOrder, handling nulls
        const sortedCategories = normalized.sort(
          (a: Category, b: Category) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
        );
        setCategories(sortedCategories);
      } else {
        toast.error("Failed to load categories");
      }
    } catch (error) {
      logger.error("Error loading categories:", error);
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load VAT categories from backend
  const loadVatCategories = useCallback(async () => {
    if (!user?.businessId) {
      setVatCategories([]);
      return;
    }
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
      } else {
        logger.error("Failed to load VAT categories:", response.message);
        setVatCategories([]);
      }
    } catch (error) {
      logger.error("Error loading VAT categories:", error);
      setVatCategories([]);
    }
  }, [user]);

  // Load category stats (optimized - uses aggregation)
  const loadCategoryStats = useCallback(async () => {
    if (!user?.businessId) return;

    try {
      const response = await window.categoryAPI.getStats(user.businessId);
      if (response.success && response.data) {
        setCategoryStats(response.data);
      }
    } catch (error) {
      logger.error("Error loading category stats:", error);
    }
  }, [user?.businessId]);

  useEffect(() => {
    loadVatCategories();
  }, [loadVatCategories]);

  // Load stats immediately on mount (fast query)
  useEffect(() => {
    if (user?.businessId) {
      loadCategoryStats();
    }
  }, [user?.businessId, loadCategoryStats]);

  // Load categories on component mount
  useEffect(() => {
    if (user?.businessId) {
      loadCategories();
    }
  }, [user, loadCategories]);

  // Normalize category from API response
  const normalizeCategory = useCallback((cat: unknown): Category => {
    const c = cat as Partial<Category> & { [key: string]: unknown };
    return {
      ...c,
      parentId: c.parentId ?? null,
      vatCategoryId: c.vatCategoryId ?? null,
      color: c.color ?? null,
      image: c.image ?? null,
      isActive: typeof c.isActive === "boolean" ? c.isActive : true,
      sortOrder: c.sortOrder ?? 0,
      createdAt: c.createdAt
        ? typeof c.createdAt === "string"
          ? c.createdAt
          : c.createdAt instanceof Date
          ? c.createdAt.toISOString()
          : new Date().toISOString()
        : new Date().toISOString(),
      updatedAt: c.updatedAt
        ? typeof c.updatedAt === "string"
          ? c.updatedAt
          : c.updatedAt instanceof Date
          ? c.updatedAt.toISOString()
          : null
        : null,
      description: c.description ?? "",
      vatOverridePercent: c.vatOverridePercent ?? null,
    } as Category;
  }, []);

  const handleSaveCategory = useCallback(
    async (data: {
      name: string;
      description?: string;
      parentId?: string | null;
      vatCategoryId?: string | null;
      vatOverridePercent?: number | null;
      color?: string | null;
      image?: string | null;
      isActive: boolean;
      sortOrder?: number;
    }) => {
      if (!user?.businessId) {
        throw new Error("Business ID not found");
      }

      try {
        setLoading(true);
        const categoryPayload = {
          ...data,
          businessId: user.businessId,
          sortOrder: data.sortOrder ?? categories.length + 1,
        };

        const response = await window.categoryAPI.create(categoryPayload);

        if (response.success && response.category) {
          const normalizedCat = normalizeCategory(response.category);
          setCategories([...categories, normalizedCat]);
          await loadCategories();
          await loadCategoryStats();
        } else {
          const errorMsg = response.message || "Failed to create category";
          const lowerErrorMsg = errorMsg.toLowerCase();
          if (
            (lowerErrorMsg.includes("name") &&
              lowerErrorMsg.includes("already exists")) ||
            lowerErrorMsg.includes("unique constraint failed: categories.name")
          ) {
            throw new Error(
              "This category name already exists. Please use a different name."
            );
          }
          throw new Error(errorMsg);
        }
      } catch (error) {
        logger.error("Error saving category:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [user, categories, normalizeCategory, loadCategories]
  );

  const handleUpdateCategory = useCallback(
    async (
      id: string,
      data: {
        name: string;
        description?: string;
        parentId?: string | null;
        vatCategoryId?: string | null;
        vatOverridePercent?: number | null;
        color?: string | null;
        image?: string | null;
        isActive: boolean;
      }
    ) => {
      if (!user?.businessId) {
        throw new Error("Business ID not found");
      }

      try {
        setLoading(true);
        const categoryPayload = {
          ...data,
          businessId: user.businessId,
        };

        const response = await window.categoryAPI.update(id, categoryPayload);

        if (response.success && response.category) {
          const normalizedCat = normalizeCategory(response.category);
          setCategories(
            categories.map((c) => (c.id === id ? normalizedCat : c))
          );
          await loadCategories();
          await loadCategoryStats();
        } else {
          const errorMsg = response.message || "Failed to update category";
          const lowerErrorMsg = errorMsg.toLowerCase();
          if (
            (lowerErrorMsg.includes("name") &&
              lowerErrorMsg.includes("already exists")) ||
            lowerErrorMsg.includes("unique constraint failed: categories.name")
          ) {
            throw new Error(
              "This category name already exists. Please use a different name."
            );
          }
          throw new Error(errorMsg);
        }
      } catch (error) {
        logger.error("Error updating category:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [user, categories, normalizeCategory, loadCategories]
  );

  const handleEditCategory = useCallback((category: Category) => {
    setEditingCategory(category);
    setIsDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setEditingCategory(null);
  }, []);

  const handleDeleteCategory = (id: string) => {
    setCategoryToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;

    try {
      setLoading(true);
      const response = await window.categoryAPI.delete(categoryToDelete);
      if (response.success) {
        setCategories(categories.filter((c) => c.id !== categoryToDelete));
        await loadCategoryStats();
        toast.success("Category deleted successfully");
      } else {
        toast.error(response.message || "Failed to delete category");
      }
    } catch (error) {
      logger.error("Error deleting category:", error);
      toast.error("Failed to delete category");
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
    }
  };

  return (
    <>
      <div className="container mx-auto p-1 max-w-[1600px] flex flex-col flex-1 min-h-0 gap-4 sm:gap-6 overflow-hidden">
        <MiniBar
          className="shrink-0"
          title="Category Management"
          onBack={onBack}
          backAriaLabel="Back to Dashboard"
          action={{
            label: "New",
            onClick: () => {
              setEditingCategory(null);
              setIsDrawerOpen(true);
            },
            icon: <Plus className="h-4 w-4" />,
            ariaLabel: "Add category",
          }}
          right={
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setImportModalOpen(true)}
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5" />
              Import
            </Button>
          }
        />

        {categories.length === 0 && !loading && (
          <Alert className="shrink-0">
            <Tag className="h-4 w-4" />
            <AlertDescription>
              You don't have any categories yet. Create your first category to
              organize your products.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 shrink-0">
          <Card className="p-3">
            <CardContent className="p-0">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Total Categories</p>
                  <p className="text-lg font-semibold text-foreground truncate">
                    {categoryStats.totalCategories}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {categoryStats.activeCategories} active
                  </p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="p-3">
            <CardContent className="p-0">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Most Recent</p>
                  {categoryStats.mostRecentCategory ? (
                    (() => {
                      const categoryName = categoryStats.mostRecentCategory.name;
                      const shouldTruncate = categoryName.length > 25;
                      return shouldTruncate ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-sm font-semibold text-foreground truncate cursor-help">
                              {categoryName}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="whitespace-normal">{categoryName}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <p className="text-sm font-semibold text-foreground truncate">
                          {categoryName}
                        </p>
                      );
                    })()
                  ) : (
                    <p className="text-sm font-semibold text-foreground">None</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {categoryStats.mostRecentCategory
                      ? new Date(
                          categoryStats.mostRecentCategory.createdAt
                        ).toLocaleDateString()
                      : ""}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 ml-2">
                  <Settings className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col flex-1 min-h-0 rounded-lg border bg-background overflow-hidden">
          <div className="p-3 border-b bg-muted/30 shrink-0">
            <h3 className="text-sm font-semibold text-foreground">Categories</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click to expand/collapse subcategories
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center flex-1 p-8">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">
                  Loading categories...
                </span>
              </div>
            </div>
          ) : categories.length === 0 ? (
            <div className="flex items-center justify-center flex-1 p-12">
              <div className="text-center">
                <Tag className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-base font-semibold text-foreground mb-2">
                  No categories found
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first category to organize your products.
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingCategory(null);
                    setIsDrawerOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Category
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border">
              {categoryTree.map((category) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  level={0}
                  isExpanded={expandedCategories.has(category.id)}
                  onToggleExpand={toggleExpand}
                  onEdit={handleEditCategory}
                  onDelete={handleDeleteCategory}
                  allCategories={categories}
                  expandedCategories={expandedCategories}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Category Drawer */}
      <CategoryFormDrawer
        isOpen={isDrawerOpen}
        category={editingCategory}
        categories={categories}
        vatCategories={vatCategories}
        businessId={user?.businessId || ""}
        onClose={handleCloseDrawer}
        onSave={handleSaveCategory}
        onUpdate={handleUpdateCategory}
      />

      <ImportBookerModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        importType="department"
        onSuccess={loadCategories}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              category.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ManageCategoriesView;
