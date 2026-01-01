/**
 * @deprecated Use @/types/features/import instead
 * @see /Users/admin/Documents/Developer/Electron/aurswift/packages/renderer/src/types/features/import/index.ts
 *
 * Migration: Replace imports with:
 * ```typescript
 * import { ImportProgress, ImportResult, ImportOptions } from '@/types/features/import';
 * ```
 */
export interface ImportProgress {
  stage: "categories" | "suppliers" | "products" | "complete";
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  currentItem?: string;
}

export interface ImportResult {
  success: boolean;
  categoriesCreated: number;
  categoriesUpdated: number;
  vatCategoriesCreated: number;
  suppliersCreated: number;
  suppliersUpdated: number;
  productsCreated: number;
  productsUpdated: number;
  productsSkipped: number;
  batchesCreated: number;
  errors: Array<{
    row?: number;
    item?: string;
    field?: string;
    message: string;
    code: string;
  }>;
  warnings: string[];
  duration: number;
}

export interface ImportOptions {
  onDuplicateSku?: "skip" | "update" | "error";
  onDuplicateBarcode?: "skip" | "update" | "error";
  createMissingCategories?: boolean;
  updateStockLevels?: boolean;
  stockUpdateMode?: "replace" | "add";
  mapVatFromPercentage?: boolean;
  defaultVatCategoryId?: string;
  batchSize?: number;
  defaultExpiryDays?: number;
}
