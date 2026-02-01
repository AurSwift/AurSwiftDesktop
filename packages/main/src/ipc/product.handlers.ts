import { ipcMain } from "electron";
import { getDatabase } from "../database/index.js";
import { getLogger } from "../utils/logger.js";

const logger = getLogger("productHandlers");
// let db: any = null; // Removed: Always get fresh DB reference

export function registerProductHandlers() {
  // Product Management IPC handlers
  ipcMain.handle("products:create", async (event, productData) => {
    try {
      const db = await getDatabase();
      return await db.products.createProductWithValidation(productData);
    } catch (error: any) {
      logger.error("Create product IPC error:", error);
      return {
        success: false,
        message: error.message || "Failed to create product",
      };
    }
  });

  ipcMain.handle(
    "products:getByBusiness",
    async (event, businessId, includeInactive = false) => {
      try {
        const db = await getDatabase();
        const products = await db.products.getProductsByBusiness(
          businessId,
          includeInactive,
        );
        return {
          success: true,
          message: "Products retrieved successfully",
          products,
        };
      } catch (error: any) {
        logger.error("Get products by business IPC error:", error);
        return {
          success: false,
          message: error.message || "Failed to get products",
        };
      }
    },
  );

  ipcMain.handle("products:getById", async (event, id) => {
    try {
      const db = await getDatabase();
      return await db.products.getProductByIdWithResponse(id);
    } catch (error: any) {
      logger.error("Get product by ID IPC error:", error);
      return {
        success: false,
        message: error.message || "Failed to get product",
      };
    }
  });

  ipcMain.handle("products:update", async (event, id, updates) => {
    try {
      const db = await getDatabase();
      return await db.products.updateProductWithValidation(id, updates);
    } catch (error: any) {
      logger.error("Update product IPC error:", error);
      return {
        success: false,
        message: error.message || "Failed to update product",
      };
    }
  });

  ipcMain.handle("products:delete", async (event, id) => {
    try {
      const db = await getDatabase();
      return await db.products.deleteProductWithResponse(id);
    } catch (error: any) {
      logger.error("Delete product IPC error:", error);
      return {
        success: false,
        message: error.message || "Failed to delete product",
      };
    }
  });

  // Get products with pagination
  ipcMain.handle(
    "products:getPaginated",
    async (event, businessId, pagination, filters) => {
      try {
        const db = await getDatabase();
        const result = await db.products.getProductsByBusinessPaginated(
          businessId,
          pagination,
          filters,
        );
        return {
          success: true,
          data: {
            items: result.items,
            pagination: result.pagination,
          },
        };
      } catch (error: any) {
        logger.error("Get paginated products IPC error:", error);
        return {
          success: false,
          message: error.message || "Failed to get products",
        };
      }
    },
  );

  // Get lightweight product lookup (optimized for dropdowns - only id, name, sku)
  ipcMain.handle(
    "products:getLookup",
    async (
      event,
      businessId,
      options?: { includeInactive?: boolean; productIds?: string[] },
    ) => {
      try {
        const db = await getDatabase();
        const products = await db.products.getProductLookup(
          businessId,
          options,
        );
        return {
          success: true,
          products,
        };
      } catch (error: any) {
        logger.error("Get product lookup IPC error:", error);
        return {
          success: false,
          message: error.message || "Failed to get product lookup",
        };
      }
    },
  );

  // Stock adjustment with audit trail
  ipcMain.handle("products:adjustStock", async (event, adjustmentData) => {
    try {
      const db = await getDatabase();

      const { productId, type, quantity, reason, userId, businessId, batchId } =
        adjustmentData;

      // Validate inputs
      if (!productId || !type || !quantity || !userId || !businessId) {
        return {
          success: false,
          message: "Missing required fields for stock adjustment",
        };
      }

      // Get product to check if batch tracking is required
      const product = await db.products.getProductById(productId, true);

      if (!product) {
        return {
          success: false,
          message: "Product not found",
        };
      }

      // Determine movement type based on adjustment type
      let movementType:
        | "INBOUND"
        | "OUTBOUND"
        | "ADJUSTMENT"
        | "TRANSFER"
        | "WASTE";

      if (type === "add") {
        movementType = "INBOUND";
      } else if (type === "remove") {
        movementType = "OUTBOUND";
      } else if (type === "waste") {
        movementType = "WASTE";
      } else {
        movementType = "ADJUSTMENT";
      }

      // If product requires batch tracking and no batch specified, return error
      if (product.requiresBatchTracking && !batchId) {
        return {
          success: false,
          message:
            "This product requires batch tracking. Please specify a batch.",
        };
      }

      // Create stock movement record for audit trail
      await db.stockMovements.createStockMovement({
        productId,
        batchId: batchId || undefined,
        movementType,
        quantity,
        reason: reason || `Manual ${type} adjustment`,
        reference: undefined,
        userId,
        businessId,
      });

      // Update product stock level (or batch if batch tracking)
      if (product.requiresBatchTracking && batchId) {
        // Update batch quantity
        await db.batches.updateBatchQuantity(
          batchId,
          quantity,
          type === "add" ? "INBOUND" : "OUTBOUND",
        );
      } else {
        // Update product stock level directly
        const currentStock = product.stockLevel || 0;
        const newStock =
          type === "add" ? currentStock + quantity : currentStock - quantity;

        await db.products.updateProduct(productId, {
          stockLevel: Math.max(0, newStock),
        });
      }

      return {
        success: true,
        message: "Stock adjusted successfully",
      };
    } catch (error: any) {
      logger.error("Adjust stock IPC error:", error);
      return {
        success: false,
        message: error.message || "Failed to adjust stock",
      };
    }
  });

  // Sync product stock from batches
  ipcMain.handle("products:syncStock", async (event, businessId) => {
    try {
      const db = await getDatabase();

      // Get all products for the business
      const products = await db.products.getProductsByBusiness(businessId);

      let syncedCount = 0;
      let fixedCount = 0;
      const fixes: Array<{
        productName: string;
        oldStock: number;
        newStock: number;
      }> = [];

      for (const product of products) {
        const currentStock = product.stockLevel || 0;
        const calculatedStock = await db.batches.calculateProductStock(
          product.id,
        );

        if (currentStock !== calculatedStock) {
          await db.products.updateProduct(product.id, {
            stockLevel: calculatedStock,
          });
          fixes.push({
            productName: product.name,
            oldStock: currentStock,
            newStock: calculatedStock,
          });
          fixedCount++;
        }
        syncedCount++;
      }

      return {
        success: true,
        message: `Synced ${syncedCount} products, fixed ${fixedCount} discrepancies`,
        data: {
          syncedCount,
          fixedCount,
          fixes,
        },
      };
    } catch (error: any) {
      logger.error("Sync product stock IPC error:", error);
      return {
        success: false,
        message: error.message || "Failed to sync product stock",
      };
    }
  });

  ipcMain.handle("stock:adjust", async (event, adjustmentData) => {
    try {
      const db = await getDatabase();
      const adjustment =
        await db.inventory.createStockAdjustment(adjustmentData);
      return {
        success: true,
        message: "Stock adjustment created successfully",
        adjustment,
      };
    } catch (error: any) {
      logger.error("Stock adjustment IPC error:", error);
      return {
        success: false,
        message: error.message || "Failed to adjust stock",
      };
    }
  });

  ipcMain.handle("stock:getAdjustments", async (event, productId) => {
    try {
      const db = await getDatabase();
      const adjustments = db.inventory.getStockAdjustmentsByProduct(productId);
      return {
        success: true,
        message: "Stock adjustments retrieved successfully",
        adjustments,
      };
    } catch (error: any) {
      logger.error("Get stock adjustments IPC error:", error);
      return {
        success: false,
        message: error.message || "Failed to get stock adjustments",
      };
    }
  });
}

ipcMain.handle("stockMovements:create", async (event, movementData) => {
  try {
    const db = await getDatabase();
    const movement = await db.stockMovements.createStockMovement(movementData);

    return {
      success: true,
      movement: JSON.parse(JSON.stringify(movement)),
    };
  } catch (error) {
    logger.error("Create stock movement IPC error:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create stock movement",
    };
  }
});

ipcMain.handle("stockMovements:getByProduct", async (event, productId) => {
  try {
    const db = await getDatabase();
    const movements = await db.stockMovements.getMovementsByProduct(productId);

    return {
      success: true,
      movements: JSON.parse(JSON.stringify(movements)),
    };
  } catch (error) {
    logger.error("Get movements by product IPC error:", error);
    return {
      success: false,
      message: "Failed to get stock movements",
    };
  }
});

ipcMain.handle("stockMovements:getByBatch", async (event, batchId) => {
  try {
    const db = await getDatabase();
    const movements = await db.stockMovements.getMovementsByBatch(batchId);

    return {
      success: true,
      movements: JSON.parse(JSON.stringify(movements)),
    };
  } catch (error) {
    logger.error("Get movements by batch IPC error:", error);
    return {
      success: false,
      message: "Failed to get stock movements",
    };
  }
});

ipcMain.handle(
  "stockMovements:getByBusiness",
  async (event, businessId, filters) => {
    try {
      const db = await getDatabase();
      const movements = await db.stockMovements.getMovementsByBusiness(
        businessId,
        filters,
      );

      return {
        success: true,
        movements: JSON.parse(JSON.stringify(movements)),
      };
    } catch (error) {
      logger.error("Get movements by business IPC error:", error);
      return {
        success: false,
        message: "Failed to get stock movements",
      };
    }
  },
);

// Get product statistics for dashboard (optimized - no full product loading)
ipcMain.handle("products:getStats", async (event, businessId) => {
  try {
    const db = await getDatabase();
    const stats = await db.products.getProductStats(businessId);
    return {
      success: true,
      data: stats,
    };
  } catch (error: any) {
    logger.error("Get product stats IPC error:", error);
    return {
      success: false,
      message: error.message || "Failed to get product statistics",
    };
  }
});
