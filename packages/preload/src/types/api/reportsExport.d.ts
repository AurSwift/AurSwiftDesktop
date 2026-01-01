import type {
  ExportData,
  ExportTransaction,
  ExportStatistics,
  CSVExportOptions,
  PDFExportOptions,
  SaveDialogOptions,
} from "../../api/reportsExport.js";

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

declare global {
  interface Window {
    reportsExportAPI: ReportsExportAPI;
  }
}

export type {
  ExportData,
  ExportTransaction,
  ExportStatistics,
  CSVExportOptions,
  PDFExportOptions,
  SaveDialogOptions,
};



