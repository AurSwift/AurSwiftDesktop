/**
 * useExportReports Hook
 *
 * Hook for exporting sales reports to CSV and PDF formats.
 * Handles authentication, data preparation, and IPC communication.
 */

import { useCallback } from "react";
import { useAuth } from "@/shared/hooks";
import { toast } from "sonner";
import { getLogger } from "@/shared/utils/logger";
import type { Transaction } from "../components/sales-reports";
import type { DateRange } from "../components/sales-reports/sales-reports-filters";
import { formatDateRangeForFilename } from "../utils/export-utils";

const logger = getLogger("use-export-reports");

interface ExportStatistics {
  totalSales: number;
  totalRefunds: number;
  totalVoids: number;
  revenue: number;
  averageOrderValue: number;
  transactionCount: number;
}

/**
 * Hook for exporting sales reports
 */
export function useExportReports() {
  const { user } = useAuth();

  /**
   * Export transactions to CSV
   */
  const exportToCSV = useCallback(
    async (
      transactions: Transaction[],
      dateRange: DateRange,
      statistics: ExportStatistics
    ) => {
      if (!user) {
        toast.error("You must be logged in to export reports");
        return;
      }

      try {
        // Get session token from authStore
        const sessionToken = await window.authStore.get("token");
        if (!sessionToken) {
          toast.error("Session expired. Please log in again.");
          return;
        }

        logger.info("Starting CSV export");

        // Prepare export data
        const exportData = {
          businessId: user.businessId,
          businessName: user.businessName,
          generatedAt: new Date(),
          dateRange: {
            start: dateRange.start,
            end: dateRange.end,
          },
          statistics: {
            totalRevenue: statistics.revenue,
            totalSales: statistics.totalSales,
            totalRefunds: statistics.totalRefunds,
            totalVoids: statistics.totalVoids,
            averageOrderValue: statistics.averageOrderValue,
            transactionCount: statistics.transactionCount,
          },
          transactions: transactions.map((t) => ({
            id: t.id,
            receiptNumber: t.receiptNumber,
            timestamp: new Date(t.timestamp),
            type: t.type,
            paymentMethod: t.paymentMethod,
            total: t.total,
            items: t.items.map((item) => ({
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              sku: item.sku,
            })),
            cashierName: t.cashierName,
            status: t.status,
          })),
        };

        // Export via IPC
        const result = await window.reportsExportAPI.exportToCSV(
          sessionToken,
          exportData
        );

        if (!result.success) {
          throw new Error(result.message || "Failed to export CSV");
        }

        logger.info(`CSV exported successfully to: ${result.filePath}`);
        toast.success("CSV report exported successfully");
      } catch (error) {
        logger.error("Failed to export CSV:", error);
        toast.error(
          `Failed to export CSV: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        throw error;
      }
    },
    [user]
  );

  /**
   * Export transactions to PDF
   */
  const exportToPDF = useCallback(
    async (
      transactions: Transaction[],
      dateRange: DateRange,
      statistics: ExportStatistics
    ) => {
      if (!user) {
        toast.error("You must be logged in to export reports");
        return;
      }

      try {
        // Get session token from authStore
        const sessionToken = await window.authStore.get("token");
        if (!sessionToken) {
          toast.error("Session expired. Please log in again.");
          return;
        }

        logger.info("Starting PDF export");

        // Prepare export data
        const exportData = {
          businessId: user.businessId,
          businessName: user.businessName,
          generatedAt: new Date(),
          dateRange: {
            start: dateRange.start,
            end: dateRange.end,
          },
          statistics: {
            totalRevenue: statistics.revenue,
            totalSales: statistics.totalSales,
            totalRefunds: statistics.totalRefunds,
            totalVoids: statistics.totalVoids,
            averageOrderValue: statistics.averageOrderValue,
            transactionCount: statistics.transactionCount,
          },
          transactions: transactions.map((t) => ({
            id: t.id,
            receiptNumber: t.receiptNumber,
            timestamp: new Date(t.timestamp),
            type: t.type,
            paymentMethod: t.paymentMethod,
            total: t.total,
            items: t.items.map((item) => ({
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              sku: item.sku,
            })),
            cashierName: t.cashierName,
            status: t.status,
          })),
        };

        // Export via IPC
        const result = await window.reportsExportAPI.exportToPDF(
          sessionToken,
          exportData
        );

        if (!result.success) {
          throw new Error(result.message || "Failed to export PDF");
        }

        logger.info(`PDF exported successfully to: ${result.filePath}`);
        toast.success("PDF report exported successfully");
      } catch (error) {
        logger.error("Failed to export PDF:", error);
        toast.error(
          `Failed to export PDF: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        throw error;
      }
    },
    [user]
  );

  return {
    exportToCSV,
    exportToPDF,
  };
}

