/**
 * Export Utilities
 *
 * Utility functions for exporting sales reports data to various formats.
 */

import { getLogger } from "@/shared/utils/logger";
import type { Transaction } from "../components/sales-reports";

const logger = getLogger("export-utils");

/**
 * Export transactions to CSV format
 */
export function exportToCSV(
  transactions: Transaction[],
  filename: string = "sales-report.csv"
): void {
  try {
    // CSV headers
    const headers = [
      "Receipt Number",
      "Date",
      "Time",
      "Type",
      "Payment Method",
      "Items",
      "Total",
      "Status",
    ];

    // Convert transactions to CSV rows
    const rows = transactions.map((transaction) => {
      const date = new Date(transaction.timestamp);
      return [
        transaction.receiptNumber,
        date.toLocaleDateString(),
        date.toLocaleTimeString(),
        transaction.type,
        transaction.paymentMethod,
        transaction.items.length.toString(),
        transaction.total.toFixed(2),
        transaction.status,
      ];
    });

    // Combine headers and rows
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    logger.info(`Exported ${transactions.length} transactions to CSV`);
  } catch (error) {
    logger.error("Failed to export CSV:", error);
    throw new Error("Failed to export CSV file");
  }
}

/**
 * Generate PDF content (simplified - in production, use a library like jsPDF)
 */
export function generatePDFContent(
  transactions: Transaction[],
  dateRange?: { start: Date; end: Date },
  stats?: {
    totalSales: number;
    totalRefunds: number;
    totalVoids: number;
    revenue: number;
  }
): string {
  let content = "SALES REPORT\n";
  content += "=".repeat(50) + "\n\n";

  if (dateRange) {
    content += `Period: ${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}\n\n`;
  }

  if (stats) {
    content += "SUMMARY\n";
    content += "-".repeat(50) + "\n";
    content += `Total Revenue: £${stats.revenue.toFixed(2)}\n`;
    content += `Total Sales: £${stats.totalSales.toFixed(2)}\n`;
    content += `Total Refunds: £${stats.totalRefunds.toFixed(2)}\n`;
    content += `Voided Transactions: ${stats.totalVoids}\n\n`;
  }

  content += "TRANSACTIONS\n";
  content += "-".repeat(50) + "\n";
  content +=
    "Receipt # | Date       | Type    | Method | Total\n";
  content += "-".repeat(50) + "\n";

  transactions.forEach((transaction) => {
    const date = new Date(transaction.timestamp);
    content += `${transaction.receiptNumber.padEnd(10)} | ${date.toLocaleDateString().padEnd(10)} | ${transaction.type.padEnd(7)} | ${transaction.paymentMethod.padEnd(6)} | £${transaction.total.toFixed(2)}\n`;
  });

  return content;
}

/**
 * Export to PDF (simplified - opens print dialog)
 * In production, use a library like jsPDF or pdfkit
 */
export function exportToPDF(
  transactions: Transaction[],
  dateRange?: { start: Date; end: Date },
  stats?: {
    totalSales: number;
    totalRefunds: number;
    totalVoids: number;
    revenue: number;
  },
  filename: string = "sales-report.pdf"
): void {
  try {
    // Generate PDF content
    const content = generatePDFContent(transactions, dateRange, stats);

    // Create a temporary element with the content
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      throw new Error("Failed to open print window");
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${filename}</title>
          <style>
            body {
              font-family: monospace;
              padding: 20px;
              white-space: pre-wrap;
            }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          ${content.replace(/\n/g, "<br>")}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();

    logger.info(`Exported ${transactions.length} transactions to PDF`);
  } catch (error) {
    logger.error("Failed to export PDF:", error);
    throw new Error("Failed to export PDF file");
  }
}

/**
 * Format date range for filename
 */
export function formatDateRangeForFilename(
  dateRange: { start: Date; end: Date }
): string {
  const start = dateRange.start.toISOString().split("T")[0];
  const end = dateRange.end.toISOString().split("T")[0];
  return `${start}_to_${end}`;
}

