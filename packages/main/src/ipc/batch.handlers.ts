import { ipcMain } from "electron";
import { getDatabase } from "../database/index.js";
import { getLogger } from "../utils/logger.js";

const logger = getLogger("batchHandlers");
// let db: any = null; // Removed: Always get fresh DB reference

export function registerBatchHandlers() {
  ipcMain.handle("batches:create", async (_event, batchData) => {
    try {
      const db = await getDatabase();
      const batch = await db.batches.createBatch(batchData);

      return {
        success: true,
        batch: JSON.parse(JSON.stringify(batch)),
      };
    } catch (error) {
      logger.error("Create batch IPC error:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to create batch",
      };
    }
  });

  ipcMain.handle("batches:getById", async (_event, batchId) => {
    try {
      const db = await getDatabase();
      const batch = await db.batches.getBatchById(batchId);

      return {
        success: true,
        batch: JSON.parse(JSON.stringify(batch)),
      };
    } catch (error) {
      logger.error("Get batch IPC error:", error);
      return {
        success: false,
        message: "Failed to get batch",
      };
    }
  });

  ipcMain.handle("batches:getByProduct", async (_event, productId, options) => {
    try {
      const db = await getDatabase();
      const batches = await db.batches.getBatchesByProduct(productId, options);

      return {
        success: true,
        batches: JSON.parse(JSON.stringify(batches)),
      };
    } catch (error) {
      logger.error("Get batches by product IPC error:", error);
      return {
        success: false,
        message: "Failed to get batches",
      };
    }
  });

  ipcMain.handle(
    "batches:getByBusiness",
    async (_event, businessId, options) => {
      try {
        const db = await getDatabase();
        const batches = await db.batches.getBatchesByBusiness(
          businessId,
          options
        );

        return {
          success: true,
          batches: JSON.parse(JSON.stringify(batches)),
        };
      } catch (error) {
        logger.error("Get batches by business IPC error:", error);
        return {
          success: false,
          message: "Failed to get batches",
        };
      }
    }
  );

  // Get batches with pagination
  ipcMain.handle(
    "batches:getPaginated",
    async (_event, businessId, pagination, filters) => {
      try {
        const db = await getDatabase();
        const result = await db.batches.getBatchesByBusinessPaginated(
          businessId,
          pagination,
          filters
        );
        return {
          success: true,
          data: JSON.parse(JSON.stringify(result)),
        };
      } catch (error: any) {
        logger.error("Get paginated batches IPC error:", error);
        return {
          success: false,
          message: error.message || "Failed to get batches",
        };
      }
    }
  );

  // Get batch stats (optimized for dashboards)
  ipcMain.handle(
    "batches:getStats",
    async (_event, businessId, expirySettings) => {
      try {
        const db = await getDatabase();
        const stats = await db.batches.getBatchStats(
          businessId,
          expirySettings
        );
        return {
          success: true,
          data: stats,
        };
      } catch (error: any) {
        logger.error("Get batch stats IPC error:", error);
        return {
          success: false,
          message: error.message || "Failed to get batch stats",
        };
      }
    }
  );

  ipcMain.handle(
    "batches:getActiveBatches",
    async (_event, productId, rotationMethod) => {
      try {
        const db = await getDatabase();
        const batches = await db.batches.getActiveBatchesByProduct(
          productId,
          rotationMethod || "FEFO"
        );

        return {
          success: true,
          batches: JSON.parse(JSON.stringify(batches)),
        };
      } catch (error) {
        logger.error("Get active batches IPC error:", error);
        return {
          success: false,
          message: "Failed to get active batches",
        };
      }
    }
  );

  ipcMain.handle(
    "batches:selectForSale",
    async (_event, productId, quantity, rotationMethod) => {
      try {
        const db = await getDatabase();
        const selected = await db.batches.selectBatchesForSale(
          productId,
          quantity,
          rotationMethod || "FEFO"
        );

        return {
          success: true,
          batches: JSON.parse(JSON.stringify(selected)),
        };
      } catch (error) {
        logger.error("Select batches for sale IPC error:", error);
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "Failed to select batches",
        };
      }
    }
  );

  ipcMain.handle(
    "batches:updateQuantity",
    async (_event, batchId, quantity, movementType, userId, reason) => {
      try {
        const db = await getDatabase();

        // Get batch to find productId and businessId
        const batch = await db.batches.getBatchById(batchId);

        // Update batch quantity first
        const updatedBatch = await db.batches.updateBatchQuantity(
          batchId,
          quantity,
          movementType
        );

        // Record stock movement if userId is provided (for audit trail)
        // NOTE: We pass null as batchManager to StockMovementManager to avoid double-updating
        if (userId && batch) {
          try {
            // Create stock movement record using the stockMovements manager
            await db.stockMovements.createStockMovement({
              productId: batch.productId,
              batchId: batch.id,
              movementType: movementType as
                | "INBOUND"
                | "OUTBOUND"
                | "ADJUSTMENT",
              quantity,
              reason:
                reason || `Batch ${movementType.toLowerCase()} adjustment`,
              userId,
              businessId: batch.businessId,
            });
          } catch (movementError) {
            logger.error("Failed to record stock movement:", movementError);
            // Don't fail the whole operation if stock movement fails
          }
        }

        return {
          success: true,
          batch: JSON.parse(JSON.stringify(updatedBatch)),
        };
      } catch (error) {
        logger.error("Update batch quantity IPC error:", error);
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Failed to update batch quantity",
        };
      }
    }
  );

  ipcMain.handle("batches:updateStatus", async (_event, batchId, status) => {
    try {
      const db = await getDatabase();
      const batch = await db.batches.updateBatchStatus(batchId, status);

      return {
        success: true,
        batch: JSON.parse(JSON.stringify(batch)),
      };
    } catch (error) {
      logger.error("Update batch status IPC error:", error);
      return {
        success: false,
        message: "Failed to update batch status",
      };
    }
  });

  ipcMain.handle("batches:getExpiringSoon", async (_event, businessId, days) => {
    try {
      const db = await getDatabase();
      const batches = await db.batches.getBatchesExpiringSoon(businessId, days);

      return {
        success: true,
        batches: JSON.parse(JSON.stringify(batches)),
      };
    } catch (error) {
      logger.error("Get expiring batches IPC error:", error);
      return {
        success: false,
        message: "Failed to get expiring batches",
      };
    }
  });

  ipcMain.handle("batches:calculateProductStock", async (_event, productId) => {
    try {
      const db = await getDatabase();
      const stock = await db.batches.calculateProductStock(productId);

      return {
        success: true,
        stock,
      };
    } catch (error) {
      logger.error("Calculate product stock IPC error:", error);
      return {
        success: false,
        message: "Failed to calculate product stock",
      };
    }
  });

  ipcMain.handle("batches:autoUpdateExpired", async (_event, businessId) => {
    try {
      const db = await getDatabase();
      const count = await db.batches.autoUpdateExpiredBatches(businessId);

      return {
        success: true,
        updatedCount: count,
      };
    } catch (error) {
      logger.error("Auto-update expired batches IPC error:", error);
      return {
        success: false,
        message: "Failed to auto-update expired batches",
      };
    }
  });

  ipcMain.handle("batches:remove", async (_event, batchId) => {
    try {
      const db = await getDatabase();
      await db.batches.removeBatch(batchId);

      return {
        success: true,
        message: "Batch removed successfully",
      };
    } catch (error) {
      logger.error("Remove batch IPC error:", error);
      return {
        success: false,
        message: "Failed to remove batch",
      };
    }
  });

  ipcMain.handle(
    "batches:getByNumber",
    async (_event, batchNumber, productId, businessId) => {
      try {
        const db = await getDatabase();
        const batch = await db.batches.getBatchByNumber(
          batchNumber,
          productId,
          businessId
        );

        if (!batch) {
          return {
            success: false,
            message: "Batch not found",
          };
        }

        return {
          success: true,
          batch: JSON.parse(JSON.stringify(batch)),
        };
      } catch (error) {
        logger.error("Get batch by number IPC error:", error);
        return {
          success: false,
          message: "Failed to get batch",
        };
      }
    }
  );

  // Optimized dashboard batches (only expired + expiring soon, with limit)
  ipcMain.handle(
    "batches:getForDashboard",
    async (_event, businessId, options) => {
      try {
        const db = await getDatabase();
        const result = await db.batches.getBatchesForDashboard(
          businessId,
          options
        );
        return {
          success: true,
          data: JSON.parse(JSON.stringify(result)),
        };
      } catch (error: any) {
        logger.error("Get dashboard batches IPC error:", error);
        return {
          success: false,
          message: error.message || "Failed to get dashboard batches",
        };
      }
    }
  );
}
