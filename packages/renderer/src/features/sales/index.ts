/**
 * Sales Feature - Public API
 *
 * This is the main entry point for the sales feature.
 * Export all public APIs here for easy importing.
 */

// ============================================================================
// Config
// ============================================================================
export { salesFeature, salesViews } from "./config/feature-config";
export { SALES_PERMISSIONS } from "./config/permissions";
export { SALES_ROUTES } from "./config/navigation";
export type { SalesPermission } from "./config/permissions";
export type { SalesRoute } from "./config/navigation";

// ============================================================================
// Components
// ============================================================================
export * from "./components";

// ============================================================================
// Hooks
// ============================================================================
export * from "./hooks";
export { useSalesMode } from "./hooks/use-sales-mode";

// ============================================================================
// Views
// ============================================================================
export { default as NewTransactionView } from "./views/new-transaction-view";
export { default as SalesReportsView } from "./views/sales-reports-view";

// ============================================================================
// Services
// ============================================================================
export * from "./services/payment-flow";
// Note: PDF receipt generator is NOT exported here because it uses pdfkit
// which requires Node.js modules. Use the IPC API instead:
// window.pdfReceiptAPI.generatePDF(receiptData)
// Export thermal receipt generator
export * from "./services/receipt-generator";

// ============================================================================
// Schemas
// ============================================================================
export * from "./schemas/payment-schema";
export * from "./schemas/shift-schema";

// ============================================================================
// Types
// ============================================================================
export * from "./types";

// ============================================================================
// Utils
// ============================================================================
export * from "./utils";
