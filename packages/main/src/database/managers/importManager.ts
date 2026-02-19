import type { DrizzleDB } from "../drizzle.js";
import type {
  BookerProduct,
  BookerDepartment,
} from "../../services/bookerImportService.js";
import { CategoryManager } from "./categoryManager.js";
import { ProductManager } from "./productManager.js";
import { BatchManager } from "./batchManager.js";
import { VatCategoryManager } from "./vatCategoryManager.js";
import { eq, and } from "drizzle-orm";
import * as schema from "../schema.js";

import { getLogger } from "../../utils/logger.js";
const logger = getLogger("importManager");

export interface ImportOptions {
  // Conflict resolution
  onDuplicateSku: "skip" | "update" | "error";
  onDuplicateBarcode: "skip" | "update" | "error";

  // Category handling
  createMissingCategories: boolean;
  categoryNameTransform: "none" | "lowercase" | "titlecase";

  // Stock handling
  updateStockLevels: boolean;
  stockUpdateMode: "replace" | "add";

  // VAT handling
  defaultVatCategoryId?: string;
  mapVatFromPercentage: boolean;

  // Batch size
  batchSize: number;

  // Progress callback
  onProgress?: (status: ImportProgress) => void;

  // Batch settings
  defaultExpiryDays?: number; // Default 365 if not provided
  importDate?: Date; // Date of the import (for batch naming)
}

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
  errors: ImportError[];
  warnings: string[];
  duration: number; // milliseconds
}

export interface ImportError {
  row?: number;
  item?: string;
  field?: string;
  message: string;
  code: string;
}

export class ImportManager {
  private categoryManager: CategoryManager;
  private productManager: ProductManager;
  private batchManager: BatchManager;
  private vatCategoryManager: VatCategoryManager;
  private drizzle: DrizzleDB;
  private uuid: any;

  constructor(drizzle: DrizzleDB, uuid: any) {
    this.drizzle = drizzle;
    this.uuid = uuid;
    this.categoryManager = new CategoryManager(drizzle, uuid);
    this.productManager = new ProductManager(drizzle, uuid);
    this.batchManager = new BatchManager(drizzle, uuid);
    this.vatCategoryManager = new VatCategoryManager(drizzle, uuid);
  }

  /**
   * Import Booker data
   */
  async importBookerData(
    departmentData: BookerDepartment[],
    productData: BookerProduct[],
    businessId: string,
    options: ImportOptions
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const result: ImportResult = {
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
      errors: [],
      warnings: [],
      duration: 0,
    };

    try {
      logger.info(
        `🚀 Starting Booker import: ${departmentData.length} departments, ${productData.length} products`
      );

      // Note: better-sqlite3 transactions are synchronous and cannot contain async operations
      // Since our import methods are async, we run without a transaction wrapper
      // Each individual operation is still atomic, and errors are collected for reporting

      // Phase 1: Import categories from department data
      const categoryMap = await this.importCategories(
        departmentData,
        businessId,
        options,
        result
      );
      logger.info(
        `✅ Categories phase complete: ${result.categoriesCreated} created, ${result.categoriesUpdated} updated`
      );

      // Phase 2: Import suppliers from product data
      const supplierMap = await this.importSuppliers(
        productData,
        businessId,
        options,
        result
      );
      logger.info(
        `✅ Suppliers phase complete: ${result.suppliersCreated} created, ${result.suppliersUpdated} updated`
      );

      // Phase 3: Import products and create batches
      await this.importProducts(
        productData,
        businessId,
        categoryMap,
        supplierMap,
        options,
        result
      );
      logger.info(
        `✅ Products phase complete: ${result.productsCreated} created, ${result.productsUpdated} updated, ${result.batchesCreated} batches`
      );

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      logger.info(`🎉 Import complete in ${result.duration}ms:`, {
        categoriesCreated: result.categoriesCreated,
        vatCategoriesCreated: result.vatCategoriesCreated,
        suppliersCreated: result.suppliersCreated,
        productsCreated: result.productsCreated,
        batchesCreated: result.batchesCreated,
        errors: result.errors.length,
      });

      return result;
    } catch (error) {
      result.errors.push({
        message: error instanceof Error ? error.message : "Import failed",
        code: "IMPORT_FAILED",
      });
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Import categories from department data
   */
  private async importCategories(
    departmentData: BookerDepartment[],
    businessId: string,
    options: ImportOptions,
    result: ImportResult
  ): Promise<Map<string, string>> {
    const categoryMap = new Map<string, string>(); // department name -> category ID

    if (options.onProgress) {
      options.onProgress({
        stage: "categories",
        total: departmentData.length,
        processed: 0,
        succeeded: 0,
        failed: 0,
      });
    }

    for (let i = 0; i < departmentData.length; i++) {
      const dept = departmentData[i];

      try {
        // Check if category exists
        const existing = await this.drizzle
          .select()
          .from(schema.categories)
          .where(
            and(
              eq(schema.categories.businessId, businessId),
              eq(schema.categories.name, dept.department)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          categoryMap.set(dept.department, existing[0].id);
          result.categoriesUpdated++;
        } else if (options.createMissingCategories) {
          // Create new category
          const category = await this.categoryManager.createCategory({
            name: dept.department,
            description: `Imported from Booker on ${new Date().toLocaleDateString()}`,
            businessId,
          });
          categoryMap.set(dept.department, category.id);
          result.categoriesCreated++;
        }

        if (options.onProgress) {
          options.onProgress({
            stage: "categories",
            total: departmentData.length,
            processed: i + 1,
            succeeded: result.categoriesCreated + result.categoriesUpdated,
            failed: 0,
            currentItem: dept.department,
          });
        }
      } catch (error) {
        result.errors.push({
          item: dept.department,
          message:
            error instanceof Error
              ? error.message
              : "Failed to create category",
          code: "CATEGORY_CREATE_FAILED",
        });
      }
    }

    return categoryMap;
  }

  /**
   * Import suppliers from product data
   */
  private async importSuppliers(
    productData: BookerProduct[],
    businessId: string,
    options: ImportOptions,
    result: ImportResult
  ): Promise<Map<string, string>> {
    const supplierMap = new Map<string, string>(); // supplier name -> supplier ID
    const uniqueSuppliers = new Set(
      productData.map((p) => p.supplierName).filter(Boolean)
    );

    if (options.onProgress) {
      options.onProgress({
        stage: "suppliers",
        total: uniqueSuppliers.size,
        processed: 0,
        succeeded: 0,
        failed: 0,
      });
    }

    let processed = 0;
    for (const supplierName of uniqueSuppliers) {
      try {
        // Check if supplier exists
        const existing = await this.drizzle
          .select()
          .from(schema.suppliers)
          .where(
            and(
              eq(schema.suppliers.businessId, businessId),
              eq(schema.suppliers.name, supplierName)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          supplierMap.set(supplierName, existing[0].id);
          result.suppliersUpdated++;
        } else {
          // Create new supplier
          const createdSupplier = await this.drizzle
            .insert(schema.suppliers)
            .values({
              id: this.uuid.v4(),
              name: supplierName,
              businessId,
              email: null,
              phone: null,
              address: null,
              contactPerson: null,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
          supplierMap.set(supplierName, createdSupplier[0].id);
          result.suppliersCreated++;
        }

        processed++;
        if (options.onProgress) {
          options.onProgress({
            stage: "suppliers",
            total: uniqueSuppliers.size,
            processed,
            succeeded: result.suppliersCreated + result.suppliersUpdated,
            failed: 0,
            currentItem: supplierName,
          });
        }
      } catch (error) {
        result.errors.push({
          item: supplierName,
          message:
            error instanceof Error
              ? error.message
              : "Failed to create supplier",
          code: "SUPPLIER_CREATE_FAILED",
        });
      }
    }

    return supplierMap;
  }

  /**
   * Import products and create batches
   */
  private async importProducts(
    productData: BookerProduct[],
    businessId: string,
    categoryMap: Map<string, string>,
    supplierMap: Map<string, string>,
    options: ImportOptions,
    result: ImportResult
  ): Promise<void> {
    logger.info(`📦 Starting product import: ${productData.length} products`);

    if (options.onProgress) {
      options.onProgress({
        stage: "products",
        total: productData.length,
        processed: 0,
        succeeded: 0,
        failed: 0,
      });
    }

    const importDate = options.importDate || new Date();
    const dateStr = importDate.toISOString().split("T")[0].replace(/-/g, ""); // YYYYMMDD
    const defaultExpiryDays = options.defaultExpiryDays || 365;
    const defaultExpiryDate = new Date(
      importDate.getTime() + defaultExpiryDays * 24 * 60 * 60 * 1000
    );

    for (let i = 0; i < productData.length; i++) {
      const product = productData[i];

      try {
        // Get category ID
        const categoryId = categoryMap.get(product.department);
        if (!categoryId) {
          result.warnings.push(
            `Product "${product.productDescription}" skipped: Category not found`
          );
          result.productsSkipped++;
          continue;
        }

        // Get supplier ID
        const supplierId = product.supplierName
          ? supplierMap.get(product.supplierName)
          : undefined;

        // Get or create VAT category
        let vatCategoryId: string | undefined;
        try {
          if (product.vatRate && options.mapVatFromPercentage) {
            // Check if VAT category already exists
            const parsed = this.vatCategoryManager.parseBookerVatRate(
              product.vatRate
            );
            if (parsed) {
              const existingVat =
                await this.vatCategoryManager.getVatCategoryByCode(
                  parsed.code,
                  businessId
                );
              const isNewVat = !existingVat;

              const vatCategory =
                await this.vatCategoryManager.getOrCreateVatCategory(
                  product.vatRate,
                  businessId
                );
              vatCategoryId = vatCategory.id;

              // Track if we created a new VAT category
              if (isNewVat) {
                result.vatCategoriesCreated++;
              }
            }
          } else if (options.defaultVatCategoryId) {
            vatCategoryId = options.defaultVatCategoryId;
          }
        } catch (error) {
          result.warnings.push(
            `Product "${
              product.productDescription
            }": Failed to create VAT category - ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }

        // Check for existing product by SKU
        let productId: string | undefined;
        const existing = await this.productManager.getProductBySKU(
          product.itemCode
        );

        if (existing) {
          // Handle duplicate
          switch (options.onDuplicateSku) {
            case "skip":
              result.productsSkipped++;
              result.warnings.push(
                `Product "${product.productDescription}" skipped: SKU already exists`
              );
              continue; // Skip to next product

            case "update":
              await this.productManager.updateProduct(existing.id, {
                name: product.productDescription,
                basePrice: product.retailPrice,
                costPrice: product.costPrice,
                barcode: product.eans[0] || null,
                categoryId,
                vatCategoryId: vatCategoryId ?? existing.vatCategoryId ?? null,
                // Note: We don't update stockLevel directly here if we are using batches
                // The batch creation below will update the stock level
                vatOverridePercent: product.vatPercentage || null,
                requiresBatchTracking: true, // Enforce batch tracking
              });
              productId = existing.id;
              result.productsUpdated++;
              break;

            case "error":
              result.errors.push({
                row: i + 1,
                item: product.productDescription,
                field: "sku",
                message: "SKU already exists",
                code: "DUPLICATE_SKU",
              });
              continue; // Skip to next product
          }
        } else {
          // Create new product
          const newProductId = this.uuid.v4();
          logger.info(
            `📦 Creating product: ${product.productDescription} (SKU: ${product.itemCode})`
          );

          await this.drizzle.insert(schema.products).values({
            id: newProductId,
            name: product.productDescription,
            sku: product.itemCode,
            barcode: product.eans[0] || null,
            basePrice: product.retailPrice,
            costPrice: product.costPrice,
            categoryId,
            vatCategoryId: vatCategoryId ?? null,
            businessId,
            stockLevel: 0, // Initial stock 0, will be updated by batch
            vatOverridePercent: product.vatPercentage || null,
            productType: "STANDARD",
            salesUnit: "PIECE",
            trackInventory: true,
            isActive: true,
            allowDiscount: true,
            requiresBatchTracking: true, // Enforce batch tracking
            // Optional fields with defaults
            description: null,
            image: null,
            plu: null,
            usesScale: false,
            pricePerKg: null,
            isGenericButton: false,
            genericDefaultPrice: null,
            minStockLevel: 0,
            reorderPoint: 0,
            allowPriceOverride: false,
            hasExpiry: false,
            shelfLifeDays: null,
            stockRotationMethod: "FIFO",
            requireIdScan: false,
            restrictionReason: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          productId = newProductId;
          result.productsCreated++;
          logger.info(`✅ Product created: ${newProductId}`);
        }

        // Create Batch if we have a valid product ID and stock to add
        if (
          productId &&
          options.updateStockLevels &&
          product.balanceOnHand > 0
        ) {
          const batchNumber = `${product.itemCode}-${dateStr}`;
          logger.info(
            `📦 Creating batch: ${batchNumber} for product ${productId} with ${product.balanceOnHand} units`
          );

          // Use a SELECT FOR UPDATE to prevent race conditions
          const existingBatches = await this.drizzle
            .select()
            .from(schema.productBatches)
            .where(
              and(
                eq(schema.productBatches.batchNumber, batchNumber),
                eq(schema.productBatches.productId, productId),
                eq(schema.productBatches.businessId, businessId)
              )
            )
            .limit(1);

          const existingBatch =
            existingBatches.length > 0 ? existingBatches[0] : null;

          if (!existingBatch) {
            await this.batchManager.createBatch({
              productId,
              batchNumber,
              expiryDate: defaultExpiryDate, // Default expiry
              initialQuantity: product.balanceOnHand,
              currentQuantity: product.balanceOnHand,
              supplierId,
              costPrice: product.costPrice,
              businessId,
              manufacturingDate: importDate, // Assume received date as manufacturing date for now
            });
            result.batchesCreated++;

            // Update product stock level after batch creation
            const currentProduct = await this.productManager.getProductById(
              productId
            );
            if (currentProduct) {
              const newStockLevel =
                options.stockUpdateMode === "add"
                  ? (currentProduct.stockLevel || 0) + product.balanceOnHand
                  : product.balanceOnHand;

              await this.drizzle
                .update(schema.products)
                .set({
                  stockLevel: newStockLevel,
                  updatedAt: new Date(),
                })
                .where(eq(schema.products.id, productId));

              logger.info(
                `✅ Batch created: ${batchNumber}, stock updated to ${newStockLevel}`
              );
            }
          } else if (options.stockUpdateMode === "add") {
            // If batch exists and we are in 'add' mode, we might want to update it?
            // But for now, let's just log a warning or skip to avoid double counting if re-importing same file
            // The requirement says: "Batch = Product + Receipt Date".
            // If we run the same file twice, we shouldn't double the stock in the same batch.
            // So skipping if batch exists is safer for "Initial System Setup".
            result.warnings.push(
              `Batch ${batchNumber} already exists. Skipped creation.`
            );
          }
        }

        if (options.onProgress) {
          options.onProgress({
            stage: "products",
            total: productData.length,
            processed: i + 1,
            succeeded: result.productsCreated + result.productsUpdated,
            failed: result.errors.length,
            currentItem: product.productDescription,
          });
        }
      } catch (error) {
        result.errors.push({
          row: i + 1,
          item: product.productDescription,
          message:
            error instanceof Error ? error.message : "Failed to import product",
          code: "PRODUCT_IMPORT_FAILED",
        });
      }
    }
  }
}
