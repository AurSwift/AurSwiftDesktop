// Supplier Management IPC Handlers
import { ipcMain } from "electron";
import { getDatabase } from "../database/index.js";
import { getLogger } from "../utils/logger.js";

const logger = getLogger("supplierHandlers");
// let db: any = null; // Removed: Always get fresh DB reference

export function registerSupplierHandlers() {
  // ============================================================================
  // SUPPLIER MANAGEMENT IPC HANDLERS
  // ============================================================================

  ipcMain.handle("suppliers:create", async (_event, supplierData) => {
    try {
      const db = await getDatabase();
      const supplier = await db.suppliers.createSupplier(supplierData);

      return {
        success: true,
        supplier: JSON.parse(JSON.stringify(supplier)),
      };
    } catch (error) {
      logger.error("Create supplier IPC error:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to create supplier",
      };
    }
  });

  ipcMain.handle("suppliers:getById", async (_event, supplierId) => {
    try {
      const db = await getDatabase();
      const supplier = await db.suppliers.getSupplierById(supplierId);

      return {
        success: true,
        supplier: JSON.parse(JSON.stringify(supplier)),
      };
    } catch (error) {
      logger.error("Get supplier IPC error:", error);
      return {
        success: false,
        message: "Failed to get supplier",
      };
    }
  });

  ipcMain.handle(
    "suppliers:getByBusiness",
    async (_event, businessId, includeInactive) => {
      try {
        const db = await getDatabase();
        const suppliers = await db.suppliers.getSuppliersByBusiness(
          businessId,
          includeInactive
        );

        return {
          success: true,
          suppliers: JSON.parse(JSON.stringify(suppliers)),
        };
      } catch (error) {
        logger.error("Get suppliers by business IPC error:", error);
        return {
          success: false,
          message: "Failed to get suppliers",
        };
      }
    }
  );

  ipcMain.handle("suppliers:update", async (_event, supplierId, updates) => {
    try {
      const db = await getDatabase();
      const supplier = await db.suppliers.updateSupplier(supplierId, updates);

      return {
        success: true,
        supplier: JSON.parse(JSON.stringify(supplier)),
      };
    } catch (error) {
      logger.error("Update supplier IPC error:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to update supplier",
      };
    }
  });

  ipcMain.handle("suppliers:delete", async (_event, supplierId) => {
    try {
      const db = await getDatabase();
      const deleted = await db.suppliers.deleteSupplier(supplierId);

      return {
        success: deleted,
        message: deleted
          ? "Supplier deleted successfully"
          : "Supplier not found",
      };
    } catch (error) {
      logger.error("Delete supplier IPC error:", error);
      return {
        success: false,
        message: "Failed to delete supplier",
      };
    }
  });
}
