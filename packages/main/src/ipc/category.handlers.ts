// Category Management IPC Handlers
import { ipcMain } from "electron";
import { getDatabase } from "../database/index.js";
import { getLogger } from "../utils/logger.js";

const logger = getLogger("categoryHandlers");
// let db: any = null; // Removed: Always get fresh DB reference

export function registerCategoryHandlers() {
  // Category Management IPC handlers
  ipcMain.handle("categories:create", async (_event, categoryData) => {
    try {
      const db = await getDatabase();
      return await db.categories.createCategoryWithResponse(categoryData);
    } catch (error: any) {
      logger.error("Create category IPC error:", error);
      return {
        success: false,
        message: error.message || "Failed to create category",
      };
    }
  });

  ipcMain.handle("categories:getByBusiness", async (_event, businessId) => {
    try {
      const db = await getDatabase();
      return await db.categories.getCategoriesByBusinessWithResponse(
        businessId
      );
    } catch (error: any) {
      logger.error("Get categories by business IPC error:", error);
      return {
        success: false,
        message: error.message || "Failed to get categories",
      };
    }
  });

  // Get category stats (optimized for dashboards)
  ipcMain.handle("categories:getStats", async (_event, businessId) => {
    try {
      const db = await getDatabase();
      const stats = await db.categories.getCategoryStats(businessId);
      return {
        success: true,
        data: stats,
      };
    } catch (error: any) {
      logger.error("Get category stats IPC error:", error);
      return {
        success: false,
        message: error.message || "Failed to get category stats",
      };
    }
  });

  ipcMain.handle("categories:getById", async (_event, id) => {
    try {
      const db = await getDatabase();
      return await db.categories.getCategoryByIdWithResponse(id);
    } catch (error: any) {
      logger.error("Get category by ID IPC error:", error);
      return {
        success: false,
        message: error.message || "Failed to get category",
      };
    }
  });

  ipcMain.handle("categories:update", async (_event, id, updates) => {
    try {
      const db = await getDatabase();
      return await db.categories.updateCategoryWithResponse(id, updates);
    } catch (error: any) {
      logger.error("Update category IPC error:", error);
      return {
        success: false,
        message: error.message || "Failed to update category",
      };
    }
  });

  ipcMain.handle("categories:delete", async (_event, id) => {
    try {
      const db = await getDatabase();
      return await db.categories.deleteCategoryWithResponse(id);
    } catch (error: any) {
      logger.error("Delete category IPC error:", error);
      return {
        success: false,
        message: error.message || "Failed to delete category",
      };
    }
  });

  ipcMain.handle(
    "categories:reorder",
    async (_event, businessId, categoryIds) => {
      try {
        const db = await getDatabase();
        return await db.categories.reorderCategoriesWithResponse(
          businessId,
          categoryIds
        );
      } catch (error: any) {
        logger.error("Reorder categories IPC error:", error);
        return {
          success: false,
          message: error.message || "Failed to reorder categories",
        };
      }
    }
  );

  // Get category children with pagination (for lazy loading large category trees)
  ipcMain.handle(
    "categories:getChildren",
    async (_event, businessId, parentId, pagination) => {
      try {
        const db = await getDatabase();
        const result = await db.categories.getCategoryChildren(
          businessId,
          parentId,
          pagination
        );
        return {
          success: true,
          data: result,
        };
      } catch (error: any) {
        logger.error("Get category children IPC error:", error);
        return {
          success: false,
          message: error.message || "Failed to get categories",
        };
      }
    }
  );
}
