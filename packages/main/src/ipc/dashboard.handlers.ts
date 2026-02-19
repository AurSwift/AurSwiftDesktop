// Dashboard Statistics IPC Handlers
import { ipcMain } from "electron";
import { getDatabase } from "../database/index.js";
import { getLogger } from "../utils/logger.js";
import { validateSessionAndPermission } from "../utils/authHelpers.js";
import { PERMISSIONS } from "@app/shared/constants/permissions";

const logger = getLogger("dashboardHandlers");
// let db: any = null; // Removed: Always get fresh DB reference

export function registerDashboardHandlers() {
  /**
   * Get dashboard statistics including revenue, sales count, and other metrics
   */
  ipcMain.handle(
    "dashboard:getStatistics",
    async (_event, sessionToken, businessId) => {
      try {
        const db = await getDatabase();

        // Validate session and check REPORTS_READ permission
        const auth = await validateSessionAndPermission(
          db,
          sessionToken,
          PERMISSIONS.REPORTS_READ
        );

        if (!auth.success) {
          return { success: false, message: auth.message, code: auth.code };
        }

        // Get revenue statistics for current month vs previous month
        const revenueStats = db.transactions.getRevenueStatistics(
          businessId,
          "month"
        );

        // Get today's sales count
        const todaySalesCount = db.transactions.getTodaySalesCount(businessId);

        // Get average order value for current month and previous month
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);
        const currentEnd = new Date(now);
        currentEnd.setHours(23, 59, 59, 999);

        const previousMonthStart = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          1
        );
        previousMonthStart.setHours(0, 0, 0, 0);
        const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        previousMonthEnd.setHours(23, 59, 59, 999);

        const currentAvgOrderValue = db.transactions.getAverageOrderValue(
          businessId,
          monthStart,
          currentEnd
        );

        const previousAvgOrderValue = db.transactions.getAverageOrderValue(
          businessId,
          previousMonthStart,
          previousMonthEnd
        );

        const avgOrderValueChange =
          currentAvgOrderValue - previousAvgOrderValue;
        const avgOrderValueChangePercent =
          previousAvgOrderValue > 0
            ? (avgOrderValueChange / previousAvgOrderValue) * 100
            : 0;

        return {
          success: true,
          data: {
            revenue: {
              current: revenueStats.currentPeriod,
              previous: revenueStats.previousPeriod,
              change: revenueStats.change,
              changePercent: revenueStats.changePercent,
            },
            salesToday: todaySalesCount,
            averageOrderValue: {
              current: currentAvgOrderValue,
              previous: previousAvgOrderValue,
              change: avgOrderValueChange,
              changePercent: avgOrderValueChangePercent,
            },
          },
        };
      } catch (error) {
        logger.error("Get dashboard statistics IPC error:", error);
        return {
          success: false,
          message: "Failed to get dashboard statistics",
        };
      }
    }
  );
}
