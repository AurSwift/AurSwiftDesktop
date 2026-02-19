import { ipcMain } from "electron";
import { getDatabase } from "../database/index.js";
import { getLogger } from "../utils/logger.js";

const logger = getLogger("salesUnitSettingsHandlers");
// let db: any = null; // Removed: Always get fresh DB reference

export function registerSalesUnitSettingsHandlers() {
  ipcMain.handle("salesUnitSettings:get", async (_event, businessId) => {
    try {
      const db = await getDatabase();
      const settings = await db.salesUnitSettings.getOrCreateSettings(
        businessId
      );

      return {
        success: true,
        settings: JSON.parse(JSON.stringify(settings)),
      };
    } catch (error) {
      logger.error("Get sales unit settings IPC error:", error);
      return {
        success: false,
        message: "Failed to get sales unit settings",
      };
    }
  });

  ipcMain.handle(
    "salesUnitSettings:createOrUpdate",
    async (_event, businessId, settingsData) => {
      try {
        const db = await getDatabase();
        const settings = await db.salesUnitSettings.createOrUpdateSettings(
          businessId,
          settingsData
        );

        return {
          success: true,
          settings: JSON.parse(JSON.stringify(settings)),
        };
      } catch (error) {
        logger.error("Create/update sales unit settings IPC error:", error);
        return {
          success: false,
          message: "Failed to create/update sales unit settings",
        };
      }
    }
  );
}
