import { ipcMain } from "electron";
import { getDatabase } from "../database/index.js";
import { getLogger } from "../utils/logger.js";
import { ExpiryNotificationService } from "../services/expiryNotificationService.js";

const logger = getLogger("expiryProductHandlers");
// let db: any = null; // Removed: Always get fresh DB reference

export function registerExpiryProductHandlers() {
  ipcMain.handle(
    "expiryNotifications:create",
    async (_event, notificationData) => {
      try {
        const db = await getDatabase();
        const notification = await db.expiryNotifications.createNotification(
          notificationData
        );

        return {
          success: true,
          notification: JSON.parse(JSON.stringify(notification)),
        };
      } catch (error) {
        logger.error("Create expiry notification IPC error:", error);
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Failed to create expiry notification",
        };
      }
    }
  );

  ipcMain.handle("expiryNotifications:getByBatch", async (_event, batchId) => {
    try {
      const db = await getDatabase();
      const notifications =
        await db.expiryNotifications.getNotificationsByBatch(batchId);

      return {
        success: true,
        notifications: JSON.parse(JSON.stringify(notifications)),
      };
    } catch (error) {
      logger.error("Get notifications by batch IPC error:", error);
      return {
        success: false,
        message: "Failed to get notifications",
      };
    }
  });

  ipcMain.handle(
    "expiryNotifications:getByBusiness",
    async (_event, businessId, filters) => {
      try {
        const db = await getDatabase();
        const notifications =
          await db.expiryNotifications.getNotificationsByBusiness(
            businessId,
            filters
          );

        return {
          success: true,
          notifications: JSON.parse(JSON.stringify(notifications)),
        };
      } catch (error) {
        logger.error("Get notifications by business IPC error:", error);
        return {
          success: false,
          message: "Failed to get notifications",
        };
      }
    }
  );

  ipcMain.handle(
    "expiryNotifications:getPending",
    async (_event, businessId) => {
      try {
        const db = await getDatabase();
        const notifications =
          await db.expiryNotifications.getPendingNotifications(businessId);

        return {
          success: true,
          notifications: JSON.parse(JSON.stringify(notifications)),
        };
      } catch (error) {
        logger.error("Get pending notifications IPC error:", error);
        return {
          success: false,
          message: "Failed to get pending notifications",
        };
      }
    }
  );

  ipcMain.handle(
    "expiryNotifications:acknowledge",
    async (_event, notificationId, userId) => {
      try {
        const db = await getDatabase();
        const notification =
          await db.expiryNotifications.acknowledgeNotification(
            notificationId,
            userId
          );

        return {
          success: true,
          notification: JSON.parse(JSON.stringify(notification)),
        };
      } catch (error) {
        logger.error("Acknowledge notification IPC error:", error);
        return {
          success: false,
          message: "Failed to acknowledge notification",
        };
      }
    }
  );

  ipcMain.handle("expirySettings:get", async (_event, businessId) => {
    try {
      const db = await getDatabase();
      const settings = await db.expirySettings.getOrCreateSettings(businessId);

      return {
        success: true,
        settings: JSON.parse(JSON.stringify(settings)),
      };
    } catch (error) {
      logger.error("Get expiry settings IPC error:", error);
      return {
        success: false,
        message: "Failed to get expiry settings",
      };
    }
  });

  ipcMain.handle(
    "expirySettings:createOrUpdate",
    async (_event, businessId, settingsData) => {
      try {
        const db = await getDatabase();
        const settings = await db.expirySettings.createOrUpdateSettings(
          businessId,
          settingsData
        );

        return {
          success: true,
          settings: JSON.parse(JSON.stringify(settings)),
        };
      } catch (error) {
        logger.error("Create/update expiry settings IPC error:", error);
        return {
          success: false,
          message: "Failed to create/update expiry settings",
        };
      }
    }
  );
  // ============================================================================
  // EXPIRY NOTIFICATION SERVICE IPC HANDLERS
  // ============================================================================

  ipcMain.handle(
    "expiryNotifications:scanAndCreate",
    async (_event, businessId) => {
      try {
        const db = await getDatabase();
        const service = new ExpiryNotificationService(db);
        const count = await service.scanAndCreateNotifications(businessId);

        return {
          success: true,
          notificationsCreated: count,
        };
      } catch (error) {
        logger.error("Scan and create notifications IPC error:", error);
        return {
          success: false,
          message: "Failed to scan and create notifications",
        };
      }
    }
  );

  ipcMain.handle(
    "expiryNotifications:processTasks",
    async (_event, businessId) => {
      try {
        const db = await getDatabase();
        const service = new ExpiryNotificationService(db);
        const result = await service.processExpiryTasks(businessId);

        return {
          success: true,
          notificationsSent: result.notificationsSent,
          batchesAutoDisabled: result.expiredBatchesUpdated,
        };
      } catch (error) {
        logger.error("Process expiry tasks IPC error:", error);
        return {
          success: false,
          message: "Failed to process expiry tasks",
        };
      }
    }
  );
}
