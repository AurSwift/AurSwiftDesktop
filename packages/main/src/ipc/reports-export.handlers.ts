/**
 * Reports Export IPC Handlers
 * Handles IPC requests for exporting sales reports to CSV and PDF
 */

import { ipcMain, dialog } from "electron";
import { getLogger } from "../utils/logger.js";
import { validateSessionAndPermission } from "../utils/authHelpers.js";
import { PERMISSIONS } from "@app/shared/constants/permissions";
import {
  exportToCSV,
  exportToPDF,
  type ExportData,
  type CSVExportOptions,
  type PDFExportOptions,
} from "../services/reportsExportService.js";

const logger = getLogger("reportsExportHandlers");

export function registerReportsExportHandlers() {
  /**
   * Show save dialog for export file
   */
  ipcMain.handle(
    "reports:showSaveDialog",
    async (event, options: {
      title?: string;
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
    }) => {
      try {
        const result = await dialog.showSaveDialog({
          title: options.title || "Save Report",
          defaultPath: options.defaultPath || "sales-report",
          filters: options.filters || [
            { name: "All Files", extensions: ["*"] },
          ],
        });

        if (result.canceled) {
          return { success: false, filePath: null };
        }

        return { success: true, filePath: result.filePath };
      } catch (error) {
        logger.error("Error showing save dialog:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  /**
   * Export sales report to CSV
   */
  ipcMain.handle(
    "reports:exportCSV",
    async (
      event,
      sessionToken: string,
      exportData: ExportData,
      options?: CSVExportOptions
    ) => {
      try {
        // Validate session and check REPORTS_READ permission
        const db = await import("../database/index.js").then((m) =>
          m.getDatabase()
        );
        const auth = await validateSessionAndPermission(
          db,
          sessionToken,
          PERMISSIONS.REPORTS_READ
        );

        if (!auth.success) {
          logger.warn(
            `CSV export denied for user: ${auth.message || "Unauthorized"}`
          );
          return {
            success: false,
            message: auth.message || "Unauthorized",
            code: auth.code,
          };
        }

        // Show save dialog
        const dialogResult = await dialog.showSaveDialog({
          title: "Save CSV Report",
          defaultPath: exportData.dateRange
            ? `sales-report-${exportData.dateRange.start.toISOString().split("T")[0]}_to_${exportData.dateRange.end.toISOString().split("T")[0]}.csv`
            : "sales-report.csv",
          filters: [{ name: "CSV Files", extensions: ["csv"] }],
        });

        if (dialogResult.canceled || !dialogResult.filePath) {
          return { success: false, message: "Export cancelled by user" };
        }

        // Export to CSV
        await exportToCSV(exportData, dialogResult.filePath, options);

        logger.info(
          `CSV export successful for user ${auth.user?.id || "unknown"} to ${dialogResult.filePath}`
        );

        return {
          success: true,
          filePath: dialogResult.filePath,
        };
      } catch (error) {
        logger.error("CSV export error:", error);
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "Failed to export CSV",
        };
      }
    }
  );

  /**
   * Export sales report to PDF
   */
  ipcMain.handle(
    "reports:exportPDF",
    async (
      event,
      sessionToken: string,
      exportData: ExportData,
      options?: PDFExportOptions
    ) => {
      try {
        // Validate session and check REPORTS_READ permission
        const db = await import("../database/index.js").then((m) =>
          m.getDatabase()
        );
        const auth = await validateSessionAndPermission(
          db,
          sessionToken,
          PERMISSIONS.REPORTS_READ
        );

        if (!auth.success) {
          logger.warn(
            `PDF export denied for user: ${auth.message || "Unauthorized"}`
          );
          return {
            success: false,
            message: auth.message || "Unauthorized",
            code: auth.code,
          };
        }

        // Show save dialog
        const dialogResult = await dialog.showSaveDialog({
          title: "Save PDF Report",
          defaultPath: exportData.dateRange
            ? `sales-report-${exportData.dateRange.start.toISOString().split("T")[0]}_to_${exportData.dateRange.end.toISOString().split("T")[0]}.pdf`
            : "sales-report.pdf",
          filters: [{ name: "PDF Files", extensions: ["pdf"] }],
        });

        if (dialogResult.canceled || !dialogResult.filePath) {
          return { success: false, message: "Export cancelled by user" };
        }

        // Export to PDF
        await exportToPDF(exportData, dialogResult.filePath, options);

        logger.info(
          `PDF export successful for user ${auth.user?.id || "unknown"} to ${dialogResult.filePath}`
        );

        return {
          success: true,
          filePath: dialogResult.filePath,
        };
      } catch (error) {
        logger.error("PDF export error:", error);
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "Failed to export PDF",
        };
      }
    }
  );
}

