// Cash Drawer IPC Handlers
import { ipcMain } from "electron";
import { getDatabase } from "../database/index.js";
import { getLogger } from "../utils/logger.js";

const logger = getLogger("cashDrawerHandlers");
// let db: any = null; // Removed: Always get fresh DB reference

export function registerCashDrawerHandlers() {
  ipcMain.handle("cashDrawer:getExpectedCash", async (_event, shiftId) => {
    try {
      const db = await getDatabase();
      const result = db.cashDrawers.getExpectedCashForShift(shiftId);

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      logger.error("Get expected cash IPC error:", error);
      return {
        success: false,
        message: "Failed to get expected cash amount",
      };
    }
  });

  ipcMain.handle("cashDrawer:createCount", async (_event, countData) => {
    try {
      const db = await getDatabase();

      // Get shift to determine business ID
      const shift = db.shifts.getShiftById(countData.shiftId);

      if (!shift) {
        return {
          success: false,
          message: "Shift not found",
        };
      }

      // Create the cash drawer count
      const cashDrawerCount = db.cashDrawers.createCashDrawerCount({
        shift_id: countData.shiftId,
        business_id: shift.business_id,
        count_type: countData.countType,
        expected_amount: countData.expectedAmount,
        counted_amount: countData.countedAmount,
        variance: countData.variance,
        notes: countData.notes,
        counted_by: countData.countedBy,
        timestamp: new Date(),
        terminal_id: null,
        updatedAt: null,
      });

      // Create audit log entry for the count
      if (Math.abs(countData.variance) > 0) {
        await db.auditLogs.createAuditLog({
          userId: countData.countedBy,
          action: "cash_drawer_count",
          resource: "cash_drawer",
          resourceId: cashDrawerCount.id,
          details: {
            shiftId: countData.shiftId,
            variance: countData.variance,
            notes: countData.notes,
          },
        });
      }

      return {
        success: true,
        data: cashDrawerCount,
      };
    } catch (error: any) {
      logger.error("Create cash count IPC error:", error);
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to create cash count",
      };
    }
  });

  ipcMain.handle("cashDrawer:getCountsByShift", async (_event, shiftId) => {
    try {
      const db = await getDatabase();
      const counts = db.cashDrawers.getCashDrawerCountsByShift(shiftId);

      return {
        success: true,
        data: counts,
      };
    } catch (error: any) {
      logger.error("Get cash drawer counts IPC error:", error);
      return {
        success: false,
        message: "Failed to get cash drawer counts",
      };
    }
  });
}
