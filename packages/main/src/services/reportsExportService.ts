/**
 * Reports Export Service (Main Process)
 * Generates CSV and PDF reports for sales data
 * Exposes functions for IPC handlers to use
 */

import { writeFile } from "fs/promises";
import { join } from "path";
import PDFDocument from "pdfkit";
import { getLogger } from "../utils/logger.js";
import { getDatabase } from "../database/index.js";

const logger = getLogger("reportsExportService");

export interface ExportTransaction {
  id: string;
  receiptNumber: string;
  timestamp: Date;
  type: "sale" | "refund" | "void";
  paymentMethod: "cash" | "card" | "mixed";
  total: number;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    sku?: string;
  }>;
  cashierName?: string;
  status: string;
}

export interface ExportStatistics {
  totalRevenue: number;
  totalSales: number;
  totalRefunds: number;
  totalVoids: number;
  averageOrderValue: number;
  transactionCount: number;
}

export interface ExportData {
  businessId: string;
  businessName?: string;
  generatedAt: Date;
  dateRange: {
    start: Date;
    end: Date;
  };
  statistics: ExportStatistics;
  transactions: ExportTransaction[];
  filters?: {
    transactionType?: string;
    paymentMethod?: string;
    timePeriod?: string;
  };
}

export interface CSVExportOptions {
  includeHeaders?: boolean;
  delimiter?: string;
  includeItems?: boolean;
  dateFormat?: string;
}

export interface PDFExportOptions {
  includeSummary?: boolean;
  includeTransactions?: boolean;
  includeItems?: boolean;
  pageSize?: "LETTER" | "A4";
  orientation?: "portrait" | "landscape";
}

/**
 * Escape CSV value to handle commas, quotes, and newlines
 */
function escapeCSV(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Format date and time for display
 */
function formatDateTime(date: Date): string {
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Generate CSV content from export data
 */
export function generateCSVContent(
  data: ExportData,
  options: CSVExportOptions = {}
): string {
  const {
    includeHeaders = true,
    delimiter = ",",
    includeItems = false,
    dateFormat = "en-GB",
  } = options;

  const lines: string[] = [];

  // BOM for Excel UTF-8 compatibility
  lines.push("\ufeff");

  // Header row
  if (includeHeaders) {
    const headers = [
      "Receipt #",
      "Date",
      "Time",
      "Type",
      "Payment Method",
      "Items Count",
      "Total",
      "Status",
      "Cashier",
    ];
    lines.push(headers.map(escapeCSV).join(delimiter));
  }

  // Transaction rows
  for (const transaction of data.transactions) {
    const date = new Date(transaction.timestamp);
    const row = [
      transaction.receiptNumber,
      formatDate(date),
      date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      transaction.type,
      transaction.paymentMethod,
      transaction.items.length.toString(),
      transaction.total.toFixed(2),
      transaction.status,
      transaction.cashierName || "N/A",
    ];
    lines.push(row.map(escapeCSV).join(delimiter));

    // Optionally include items as sub-rows
    if (includeItems) {
      for (const item of transaction.items) {
        const itemRow = [
          "", // Empty receipt #
          "", // Empty date
          "", // Empty time
          "", // Empty type
          "", // Empty payment method
          item.productName,
          item.quantity.toString(),
          item.unitPrice.toFixed(2),
          item.totalPrice.toFixed(2),
        ];
        lines.push(itemRow.map(escapeCSV).join(delimiter));
      }
    }
  }

  // Summary section
  lines.push("");
  lines.push("SUMMARY");
  lines.push(
    `Total Revenue${delimiter}${data.statistics.totalRevenue.toFixed(2)}`
  );
  lines.push(
    `Total Sales${delimiter}${data.statistics.totalSales.toFixed(2)}`
  );
  lines.push(
    `Total Refunds${delimiter}${data.statistics.totalRefunds.toFixed(2)}`
  );
  lines.push(
    `Voided Transactions${delimiter}${data.statistics.totalVoids}`
  );
  lines.push(
    `Average Order Value${delimiter}${data.statistics.averageOrderValue.toFixed(2)}`
  );
  lines.push(
    `Transaction Count${delimiter}${data.statistics.transactionCount}`
  );

  return lines.join("\n");
}

/**
 * Generate PDF document from export data
 */
export async function generatePDFDocument(
  data: ExportData,
  options: PDFExportOptions = {}
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const {
        includeSummary = true,
        includeTransactions = true,
        includeItems = false,
        pageSize = "LETTER",
        orientation = "portrait",
      } = options;

      // Fetch business details from database
      const db = await getDatabase();
      const business = db.businesses.getBusinessById(data.businessId);

      const doc = new PDFDocument({
        size: pageSize,
        layout: orientation,
        margins: { top: 50, bottom: 50, left: 60, right: 60 },
      });

      const buffers: Buffer[] = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      let y = 50;
      const pageWidth = doc.page.width - 120;
      const leftMargin = 60;

      // ========================================
      // HEADER SECTION
      // ========================================
      doc.font("Helvetica-Bold").fontSize(20);
      doc.text(
        data.businessName || business?.businessName || "Sales Report",
        leftMargin,
        y,
        { align: "center", width: pageWidth }
      );
      y += 30;

      doc.fontSize(14);
      doc.text("Sales Report", leftMargin, y, {
        align: "center",
        width: pageWidth,
      });
      y += 20;

      doc.fontSize(10).font("Helvetica");
      const dateRangeText = `${formatDate(data.dateRange.start)} - ${formatDate(data.dateRange.end)}`;
      doc.text(dateRangeText, leftMargin, y, {
        align: "center",
        width: pageWidth,
      });
      y += 15;

      doc.text(
        `Generated: ${formatDateTime(data.generatedAt)}`,
        leftMargin,
        y,
        { align: "center", width: pageWidth }
      );
      y += 30;

      // ========================================
      // SUMMARY STATISTICS SECTION
      // ========================================
      if (includeSummary) {
        doc.fontSize(12).font("Helvetica-Bold");
        doc.text("Summary Statistics", leftMargin, y);
        y += 20;

        doc.fontSize(10).font("Helvetica");
        const stats = [
          ["Total Revenue", `£${data.statistics.totalRevenue.toFixed(2)}`],
          ["Total Sales", `£${data.statistics.totalSales.toFixed(2)}`],
          ["Total Refunds", `£${data.statistics.totalRefunds.toFixed(2)}`],
          ["Voided Transactions", data.statistics.totalVoids.toString()],
          [
            "Average Order Value",
            `£${data.statistics.averageOrderValue.toFixed(2)}`,
          ],
          ["Transaction Count", data.statistics.transactionCount.toString()],
        ];

        // Draw summary table
        const tableTop = y;
        const rowHeight = 20;
        const colWidth = pageWidth / 2;

        stats.forEach(([label, value], index) => {
          const rowY = tableTop + index * rowHeight;

          // Background for alternating rows
          if (index % 2 === 0) {
            doc
              .rect(leftMargin, rowY, pageWidth, rowHeight)
              .fillColor("#f5f5f5")
              .fill();
          }

          // Label
          doc.fillColor("black").text(label, leftMargin + 10, rowY + 5, {
            width: colWidth - 20,
          });

          // Value
          doc.text(value, leftMargin + colWidth, rowY + 5, {
            width: colWidth - 20,
            align: "right",
          });
        });

        y = tableTop + stats.length * rowHeight + 30;
      }

      // ========================================
      // TRANSACTIONS TABLE SECTION
      // ========================================
      if (includeTransactions && data.transactions.length > 0) {
        // Check if we need a new page
        if (y > doc.page.height - 150) {
          doc.addPage();
          y = 50;
        }

        doc.fontSize(12).font("Helvetica-Bold");
        doc.text("Transactions", leftMargin, y);
        y += 20;

        // Table headers
        const headers = ["Receipt #", "Date", "Type", "Method", "Total"];
        const headerY = y;
        const colWidths = [
          pageWidth * 0.2,
          pageWidth * 0.25,
          pageWidth * 0.15,
          pageWidth * 0.15,
          pageWidth * 0.25,
        ];

        doc.fontSize(9).font("Helvetica-Bold");
        let x = leftMargin;
        headers.forEach((header, i) => {
          doc.text(header, x, headerY, { width: colWidths[i] });
          x += colWidths[i];
        });

        y += 15;
        doc.moveTo(leftMargin, y).lineTo(leftMargin + pageWidth, y).stroke();
        y += 10;

        // Transaction rows
        doc.fontSize(8).font("Helvetica");
        for (const transaction of data.transactions) {
          // Check if we need a new page
          if (y > doc.page.height - 100) {
            doc.addPage();
            y = 50;

            // Redraw headers on new page
            doc.fontSize(9).font("Helvetica-Bold");
            x = leftMargin;
            headers.forEach((header, i) => {
              doc.text(header, x, y, { width: colWidths[i] });
              x += colWidths[i];
            });
            y += 15;
            doc.moveTo(leftMargin, y).lineTo(leftMargin + pageWidth, y).stroke();
            y += 10;
            doc.fontSize(8).font("Helvetica");
          }

          const date = new Date(transaction.timestamp);
          const row = [
            transaction.receiptNumber,
            formatDate(date),
            transaction.type,
            transaction.paymentMethod,
            `£${transaction.total.toFixed(2)}`,
          ];

          x = leftMargin;
          row.forEach((cell, i) => {
            doc.text(cell, x, y, { width: colWidths[i] });
            x += colWidths[i];
          });

          y += 15;

          // Optionally include items
          if (includeItems && transaction.items.length > 0) {
            doc.fontSize(7).fillColor("#666666");
            transaction.items.forEach((item) => {
              if (y > doc.page.height - 100) {
                doc.addPage();
                y = 50;
                doc.fontSize(8).font("Helvetica");
              }
              const itemText = `  • ${item.productName} (x${item.quantity}) - £${item.totalPrice.toFixed(2)}`;
              doc.text(itemText, leftMargin + 20, y, { width: pageWidth - 40 });
              y += 12;
            });
            doc.fontSize(8).fillColor("black");
            y += 5;
          }
        }
      }

      // ========================================
      // FOOTER
      // ========================================
      // Footer will be added on each page via pageAdded event if needed

      doc.end();
    } catch (error) {
      logger.error("Error generating PDF:", error);
      reject(error);
    }
  });
}

/**
 * Export data to CSV file
 */
export async function exportToCSV(
  data: ExportData,
  filePath: string,
  options: CSVExportOptions = {}
): Promise<void> {
  try {
    logger.info(`Exporting CSV to: ${filePath}`);
    const csvContent = generateCSVContent(data, options);
    await writeFile(filePath, csvContent, "utf-8");
    logger.info(`CSV exported successfully to: ${filePath}`);
  } catch (error) {
    logger.error("Failed to export CSV:", error);
    throw new Error(
      `Failed to export CSV: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Export data to PDF file
 */
export async function exportToPDF(
  data: ExportData,
  filePath: string,
  options: PDFExportOptions = {}
): Promise<void> {
  try {
    logger.info(`Exporting PDF to: ${filePath}`);
    const pdfBuffer = await generatePDFDocument(data, options);
    await writeFile(filePath, pdfBuffer);
    logger.info(`PDF exported successfully to: ${filePath}`);
  } catch (error) {
    logger.error("Failed to export PDF:", error);
    throw new Error(
      `Failed to export PDF: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

