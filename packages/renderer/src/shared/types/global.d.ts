/**
 * Global Window Interface Augmentation
 *
 * This file augments the Window interface with all IPC APIs.
 * All type definitions are imported from /types/api for better organization.
 *
 * @see /Users/admin/Documents/Developer/Electron/aurswift/packages/renderer/src/types/api
 */

import type { AuthStoreAPI } from "../types/api/auth-store";
import type { AuthAPI } from "../types/api/auth";
import type { ProductAPI } from "../types/api/product";
import type { CartAPI } from "../types/api/cart";
import type { TransactionAPI } from "../types/api/transaction";
import type { BatchAPI } from "../types/api/batch";
import type { ShiftAPI } from "../types/api/shift";
import type { CategoryAPI } from "../types/api/category";
import type { RBACAPI } from "../types/api/rbac";
import type { SupplierAPI } from "../types/api/supplier";
import type { ExpirySettingsAPI } from "../types/api/expiry-settings";
import type { SalesUnitSettingsAPI } from "../types/api/sales-unit-settings";
import type { StockMovementAPI } from "../types/api/stock-movement";
import type { ScheduleAPI } from "../types/api/schedule";
import type { RefundAPI } from "../types/api/refund";
import type { CashDrawerAPI } from "../types/api/cash-drawer";
import type { TimeTrackingAPI } from "../types/api/time-tracking";
import type { AgeVerificationAPI } from "../types/api/age-verification";
import type { ImportAPI } from "../types/api/import";
import type { PrinterAPI } from "../types/api/printer";
import type { OfficePrinterAPI } from "../types/api/office-printer";
import type { PaymentAPI } from "../types/api/payment";
import type { VivaWalletAPI } from "../../types/api/viva-wallet";
import type { ScaleAPI } from "../types/api/scale";
import type { DashboardAPI } from "../types/api/dashboard";
import type { DatabaseAPI } from "../types/api/database";
import type { PdfReceiptAPI } from "../types/api/pdf-receipt";
import type { AppAPI } from "../types/api/app";
import type { UpdateAPI } from "../types/api/update";
import type { BusinessAPI } from "../types/api/business";
import type { TerminalsAPI } from "../types/api/terminals";
import type { LicenseAPI } from "../types/api/license";
import type { BasketAPI } from "../types/api/basket";
import type { ReportsExportAPI } from "../types/api/reports-export";
import type { BreakPolicyAPI } from "../types/api/break-policy";
import type { EmailSettingsAPI } from "../types/api/email-settings";
import type { QuickSellAPI } from "../types/api/quick-sell";
import type { APIResponse } from "../types/api/common";

declare global {
  interface Window {
    // Electron IPC access (for internal use only)
    electron?: {
      ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => Promise<any>;
      };
    };

    // Auth Store
    authStore: AuthStoreAPI;

    // Authentication & User Management
    authAPI: AuthAPI;

    // Product Management
    productAPI: ProductAPI;
    categoryAPI: CategoryAPI;

    // Cart & Transactions
    cartAPI: CartAPI;
    transactionAPI: TransactionAPI;

    // Batch Management
    batchesAPI: BatchAPI;
    suppliersAPI: SupplierAPI;
    expirySettingsAPI: ExpirySettingsAPI;
    salesUnitSettingsAPI: SalesUnitSettingsAPI;
    stockMovementsAPI: StockMovementAPI;

    // Shift Management
    shiftAPI: ShiftAPI;
    scheduleAPI: ScheduleAPI;

    // Refunds
    refundAPI: RefundAPI;

    // Cash Drawer
    cashDrawerAPI: CashDrawerAPI;

    // Time Tracking
    timeTrackingAPI: TimeTrackingAPI;

    // Age Verification
    ageVerificationAPI: AgeVerificationAPI;

    // Import
    importAPI: ImportAPI;

    // Dashboard
    dashboardAPI: DashboardAPI;

    // Hardware Integration
    printerAPI: PrinterAPI;
    officePrinterAPI: OfficePrinterAPI;
    paymentAPI: PaymentAPI;
    vivaWalletAPI: VivaWalletAPI;
    scaleAPI: ScaleAPI;

    // System APIs
    databaseAPI: DatabaseAPI;
    pdfReceiptAPI: PdfReceiptAPI;
    appAPI: AppAPI;
    updateAPI: UpdateAPI;

    // RBAC
    rbacAPI: RBACAPI;

    // Business Management
    businessAPI: BusinessAPI;

    // Terminal Management
    terminalsAPI: TerminalsAPI;

    // License Management
    licenseAPI: LicenseAPI;

    // Basket Management
    basketAPI: BasketAPI;

    // Reports Export
    reportsExportAPI: ReportsExportAPI;

    // Break Policy Management
    breakPolicyAPI: BreakPolicyAPI;

    // Receipt Email (Gmail) Settings
    emailSettingsAPI: EmailSettingsAPI;

    // Quick Sell Button Configuration
    quickSellAPI: QuickSellAPI;

    // System Notifications
    systemNotificationsAPI?: {
      onNotification: (
        callback: (data: { type: string; message: string }) => void,
      ) => () => void;
    };

    // Dashboard cache invalidation
    invalidateDashboardCache?: (businessId?: string) => void;
  }
}

export {};
