import { ipcMain, dialog } from "electron";
import { getDatabase } from "../database/index.js";
import { getDrizzle } from "../database/drizzle.js";
import { BookerImportService } from "../services/bookerImportService.js";
import { ImportManager } from "../database/managers/importManager.js";
import type { ImportOptions } from "../database/managers/importManager.js";
import { v4 as uuidv4 } from "uuid";

import { getLogger } from '../utils/logger.js';
const logger = getLogger('bookerImportHandlers');

const bookerImportService = new BookerImportService();

/**
 * Register IPC handlers for Booker import functionality
 */
export function registerBookerImportHandlers() {
  /**
   * Select CSV file using native file dialog
   */
  ipcMain.handle(
    "import:booker:selectFile",
    async (_event, fileType: "department" | "product") => {
      try {
        const result = await dialog.showOpenDialog({
          title: `Select Booker ${
            fileType === "department" ? "Department" : "Product"
          } CSV File`,
          filters: [
            { name: "CSV Files", extensions: ["csv"] },
            { name: "All Files", extensions: ["*"] },
          ],
          properties: ["openFile"],
        });

        if (result.canceled || result.filePaths.length === 0) {
          return { success: false, message: "No file selected" };
        }

        return { success: true, filePath: result.filePaths[0] };
      } catch (error) {
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "Failed to select file",
        };
      }
    }
  );

  /**
   * Parse CSV file and return preview data
   */
  ipcMain.handle(
    "import:booker:parseFile",
    async (_event, filePath: string) => {
    try {
      const parseResult = await bookerImportService.parseFile(filePath);

      return {
        success: parseResult.success,
        data: parseResult.data,
        fileType: parseResult.fileType,
        rowCount: parseResult.rowCount,
        validRowCount: parseResult.validRowCount,
        errors: parseResult.errors,
        warnings: parseResult.warnings,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to parse file",
        errors: [{ row: 0, field: "", value: "", message: "Parse error" }],
      };
    }
  });

  /**
   * Validate parsed data before import
   */
  ipcMain.handle(
    "import:booker:validate",
    async (_event, data: any[], _businessId: string) => {
      try {
        const validation = bookerImportService.validateData(data);

        return {
          success: validation.valid,
          errors: validation.errors,
          duplicates: validation.duplicates,
        };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : "Validation failed",
        };
      }
    }
  );

  /**
   * Execute the import
   */
  ipcMain.handle(
    "import:booker:execute",
    async (
      event,
      departmentData: any[],
      productData: any[],
      businessId: string,
      options: ImportOptions
    ) => {
      try {
        await getDatabase(); // Ensure database is initialized
        const drizzle = getDrizzle(); // Get the drizzle instance
        const importManager = new ImportManager(drizzle, { v4: uuidv4 });

        // Set up progress callback
        const progressCallback = (progress: any) => {
          event.sender.send("import:booker:progress", progress);
        };

        const result = await importManager.importBookerData(
          departmentData,
          productData,
          businessId,
          {
            ...options,
            onProgress: progressCallback,
          }
        );

        return result;
      } catch (error) {
        return {
          success: false,
          categoriesCreated: 0,
          categoriesUpdated: 0,
          vatCategoriesCreated: 0,
          suppliersCreated: 0,
          suppliersUpdated: 0,
          productsCreated: 0,
          productsUpdated: 0,
          productsSkipped: 0,
          batchesCreated: 0,
          errors: [
            {
              message: error instanceof Error ? error.message : "Import failed",
              code: "IMPORT_ERROR",
            },
          ],
          warnings: [],
          duration: 0,
        };
      }
    }
  );

  /**
   * Import department data only (for Category Management page)
   */
  ipcMain.handle(
    "import:booker:department",
    async (
      event,
      departmentData: any[],
      businessId: string,
      options: Partial<ImportOptions>
    ) => {
      try {
        await getDatabase(); // Ensure database is initialized
        const drizzle = getDrizzle(); // Get the drizzle instance
        const importManager = new ImportManager(drizzle, { v4: uuidv4 });

        const progressCallback = (progress: any) => {
          event.sender.send("import:booker:progress", progress);
        };

        const fullOptions: ImportOptions = {
          onDuplicateSku: "skip",
          onDuplicateBarcode: "skip",
          createMissingCategories: true,
          categoryNameTransform: "none",
          updateStockLevels: false,
          stockUpdateMode: "replace",
          mapVatFromPercentage: false,
          batchSize: 100,
          ...options,
          onProgress: progressCallback,
        };

        // Import only categories
        const result = await importManager.importBookerData(
          departmentData,
          [], // Empty product data
          businessId,
          fullOptions
        );

        return result;
      } catch (error) {
        return {
          success: false,
          categoriesCreated: 0,
          categoriesUpdated: 0,
          vatCategoriesCreated: 0,
          suppliersCreated: 0,
          suppliersUpdated: 0,
          productsCreated: 0,
          productsUpdated: 0,
          productsSkipped: 0,
          batchesCreated: 0,
          errors: [
            {
              message:
                error instanceof Error
                  ? error.message
                  : "Department import failed",
              code: "DEPARTMENT_IMPORT_ERROR",
            },
          ],
          warnings: [],
          duration: 0,
        };
      }
    }
  );

  /**
   * Import product data only (for Product Management page)
   */
  ipcMain.handle(
    "import:booker:product",
    async (
      event,
      productData: any[],
      businessId: string,
      options: Partial<ImportOptions>
    ) => {
      try {
        await getDatabase(); // Ensure database is initialized
        const drizzle = getDrizzle(); // Get the drizzle instance
        const importManager = new ImportManager(drizzle, { v4: uuidv4 });

        const progressCallback = (progress: any) => {
          event.sender.send("import:booker:progress", progress);
        };

        const fullOptions: ImportOptions = {
          onDuplicateSku: "update",
          onDuplicateBarcode: "skip",
          createMissingCategories: true,
          categoryNameTransform: "none",
          updateStockLevels: true,
          stockUpdateMode: "replace",
          mapVatFromPercentage: true,
          batchSize: 100,
          defaultExpiryDays: 365,
          importDate: new Date(),
          ...options,
          onProgress: progressCallback,
        };

        // Extract unique departments from product data to create categories
        const uniqueDepartments = new Set<string>();
        productData.forEach((product: any) => {
          if (product.department) {
            uniqueDepartments.add(product.department);
          }
        });

        // Create department data from product data
        const departmentData = Array.from(uniqueDepartments).map((dept) => ({
          department: dept,
          balanceOnHand: 0,
          totalCostPrice: 0,
          totalRetailPrice: 0,
          totalVatAmount: 0,
          totalNetPrice: 0,
          totalPotentialProfit: 0,
        }));

        logger.info(
          `📁 Auto-creating ${departmentData.length} categories from product data`
        );

        // Import products with their categories
        const result = await importManager.importBookerData(
          departmentData, // Auto-generated from product data
          productData,
          businessId,
          fullOptions
        );

        return result;
      } catch (error) {
        return {
          success: false,
          categoriesCreated: 0,
          categoriesUpdated: 0,
          vatCategoriesCreated: 0,
          suppliersCreated: 0,
          suppliersUpdated: 0,
          productsCreated: 0,
          productsUpdated: 0,
          productsSkipped: 0,
          batchesCreated: 0,
          errors: [
            {
              message:
                error instanceof Error
                  ? error.message
                  : "Product import failed",
              code: "PRODUCT_IMPORT_ERROR",
            },
          ],
          warnings: [],
          duration: 0,
        };
      }
    }
  );
}
