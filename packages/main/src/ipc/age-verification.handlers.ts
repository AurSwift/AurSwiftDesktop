import { ipcMain } from "electron";
import { getDatabase } from "../database/index.js";
import { getLogger } from "../utils/logger.js";

const logger = getLogger("ageVerificationHandlers");
// let db: any = null; // Removed: Always get fresh DB reference

export function registerAgeVerificationHandlers() {
  // Age Verification IPC handlers
  ipcMain.handle("ageVerification:create", async (event, verificationData) => {
    try {
      logger.info("Creating age verification record", {
        data: verificationData,
      });
      const db = await getDatabase();
      const record =
        await db.ageVerification.createAgeVerification(verificationData);
      logger.info("✅ Age verification record created successfully", {
        recordId: record.id,
      });

      return {
        success: true,
        record: JSON.parse(JSON.stringify(record)),
      };
    } catch (error) {
      logger.error("Create age verification IPC error:", error);
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to create age verification record",
      };
    }
  });

  ipcMain.handle(
    "ageVerification:getByTransaction",
    async (event, transactionId) => {
      try {
        const db = await getDatabase();
        const records =
          await db.ageVerification.getAgeVerificationsByTransaction(
            transactionId,
          );

        return {
          success: true,
          records: JSON.parse(JSON.stringify(records)),
        };
      } catch (error) {
        logger.error("Get age verifications by transaction IPC error:", error);
        return {
          success: false,
          message: "Failed to get age verification records",
        };
      }
    },
  );

  ipcMain.handle(
    "ageVerification:getByTransactionItem",
    async (event, transactionItemId) => {
      try {
        const db = await getDatabase();
        const records =
          await db.ageVerification.getAgeVerificationsByTransactionItem(
            transactionItemId,
          );

        return {
          success: true,
          records: JSON.parse(JSON.stringify(records)),
        };
      } catch (error) {
        logger.error(
          "Get age verifications by transaction item IPC error:",
          error,
        );
        return {
          success: false,
          message: "Failed to get age verification records",
        };
      }
    },
  );

  ipcMain.handle(
    "ageVerification:getByBusiness",
    async (event, businessId, options) => {
      try {
        const db = await getDatabase();
        const records = await db.ageVerification.getAgeVerificationsByBusiness(
          businessId,
          options,
        );

        return {
          success: true,
          records: JSON.parse(JSON.stringify(records)),
        };
      } catch (error) {
        logger.error("Get age verifications by business IPC error:", error);
        return {
          success: false,
          message: "Failed to get age verification records",
        };
      }
    },
  );

  ipcMain.handle("ageVerification:getByProduct", async (event, productId) => {
    try {
      const db = await getDatabase();
      const records =
        await db.ageVerification.getAgeVerificationsByProduct(productId);

      return {
        success: true,
        records: JSON.parse(JSON.stringify(records)),
      };
    } catch (error) {
      logger.error("Get age verifications by product IPC error:", error);
      return {
        success: false,
        message: "Failed to get age verification records",
      };
    }
  });

  ipcMain.handle(
    "ageVerification:getByStaff",
    async (event, staffId, options) => {
      try {
        const db = await getDatabase();
        const records = await db.ageVerification.getAgeVerificationsByStaff(
          staffId,
          options,
        );

        return {
          success: true,
          records: JSON.parse(JSON.stringify(records)),
        };
      } catch (error) {
        logger.error("Get age verifications by staff IPC error:", error);
        return {
          success: false,
          message: "Failed to get age verification records",
        };
      }
    },
  );
}
