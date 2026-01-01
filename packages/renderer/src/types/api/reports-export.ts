/**
 * Reports Export API Type Definitions
 *
 * Type definitions for the reports export IPC API exposed via preload.
 */

export interface ExportTransaction {
  id: string;
  receiptNumber: string;
  timestamp: Date | string;
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
  generatedAt: Date | string;
  dateRange: {
    start: Date | string;
    end: Date | string;
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

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface ReportsExportAPI {
  /**
   * Show save dialog for export file
   */
  showSaveDialog: (
    options: SaveDialogOptions
  ) => Promise<{ success: boolean; filePath: string | null; error?: string }>;

  /**
   * Export sales report to CSV
   */
  exportToCSV: (
    sessionToken: string,
    exportData: ExportData,
    options?: CSVExportOptions
  ) => Promise<{
    success: boolean;
    filePath?: string;
    message?: string;
    code?: string;
  }>;

  /**
   * Export sales report to PDF
   */
  exportToPDF: (
    sessionToken: string,
    exportData: ExportData,
    options?: PDFExportOptions
  ) => Promise<{
    success: boolean;
    filePath?: string;
    message?: string;
    code?: string;
  }>;
}



