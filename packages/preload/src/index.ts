import { contextBridge, ipcRenderer } from "electron";
import { sha256sum } from "./nodeCrypto.js";
import { versions } from "./versions.js";

import { authAPI, authStore, timeTrackingAPI } from "./api/auth.js";
import { productAPI } from "./api/products.js";
import { categoryAPI } from "./api/categories.js";
import { scheduleAPI, shiftAPI } from "./api/shifts.js";
import {
  transactionAPI,
  refundAPI,
  voidAPI,
  cashDrawerAPI,
} from "./api/transactions.js";
import {
  databaseAPI,
  printerAPI,
  officePrinterAPI,
  paymentAPI,
  pdfReceiptAPI,
  scaleAPI,
  appAPI,
  vivaWalletAPI,
  systemNotificationsAPI,
} from "./api/system.js";
import { ageVerificationAPI } from "./api/ageVerification.js";
import { batchesAPI } from "./api/batches.js";
import { suppliersAPI } from "./api/suppliers.js";
import { expirySettingsAPI } from "./api/expirySettings.js";
import { expiryNotificationsAPI } from "./api/expiryNotifications.js";
import { salesUnitSettingsAPI } from "./api/salesUnitSettings.js";
import { stockMovementsAPI } from "./api/stockMovements.js";
import { cartAPI } from "./api/cart.js";
import { basketAPI } from "./api/basket.js";
import { dashboardAPI } from "./api/dashboard.js";
import { importAPI } from "./api/import.js";
import { rbacAPI } from "./api/rbac.js";
import { seedAPI } from "./api/seed.js";
import { businessAPI } from "./api/business.js";
import { terminalsAPI } from "./api/terminals.js";
import { licenseAPI } from "./api/license.js";
import { reportsExportAPI } from "./api/reportsExport.js";
import { breakPolicyAPI } from "./api/breakPolicy.js";
import { emailSettingsAPI } from "./api/emailSettings.js";
import "./api/updates.js";

// Expose APIs to renderer process
contextBridge.exposeInMainWorld("authStore", authStore);
contextBridge.exposeInMainWorld("authAPI", authAPI);
contextBridge.exposeInMainWorld("timeTrackingAPI", timeTrackingAPI);
contextBridge.exposeInMainWorld("productAPI", productAPI);
contextBridge.exposeInMainWorld("categoryAPI", categoryAPI);
contextBridge.exposeInMainWorld("scheduleAPI", scheduleAPI);
contextBridge.exposeInMainWorld("shiftAPI", shiftAPI);
contextBridge.exposeInMainWorld("transactionAPI", transactionAPI);
contextBridge.exposeInMainWorld("refundAPI", refundAPI);
contextBridge.exposeInMainWorld("voidAPI", voidAPI);
contextBridge.exposeInMainWorld("cashDrawerAPI", cashDrawerAPI);
contextBridge.exposeInMainWorld("databaseAPI", databaseAPI);
contextBridge.exposeInMainWorld("printerAPI", printerAPI);
contextBridge.exposeInMainWorld("officePrinterAPI", officePrinterAPI);
contextBridge.exposeInMainWorld("paymentAPI", paymentAPI);
contextBridge.exposeInMainWorld("pdfReceiptAPI", pdfReceiptAPI);
contextBridge.exposeInMainWorld("scaleAPI", scaleAPI);
contextBridge.exposeInMainWorld("appAPI", appAPI);
contextBridge.exposeInMainWorld("vivaWalletAPI", vivaWalletAPI);
contextBridge.exposeInMainWorld("ageVerificationAPI", ageVerificationAPI);
contextBridge.exposeInMainWorld("batchesAPI", batchesAPI);
contextBridge.exposeInMainWorld("suppliersAPI", suppliersAPI);
contextBridge.exposeInMainWorld("expirySettingsAPI", expirySettingsAPI);
contextBridge.exposeInMainWorld(
  "expiryNotificationsAPI",
  expiryNotificationsAPI
);
contextBridge.exposeInMainWorld("salesUnitSettingsAPI", salesUnitSettingsAPI);
contextBridge.exposeInMainWorld("stockMovementsAPI", stockMovementsAPI);
contextBridge.exposeInMainWorld("cartAPI", cartAPI);
contextBridge.exposeInMainWorld("basketAPI", basketAPI);
contextBridge.exposeInMainWorld("dashboardAPI", dashboardAPI);
contextBridge.exposeInMainWorld("importAPI", importAPI);
contextBridge.exposeInMainWorld("rbacAPI", rbacAPI);
contextBridge.exposeInMainWorld("seedAPI", seedAPI);
contextBridge.exposeInMainWorld("businessAPI", businessAPI);
contextBridge.exposeInMainWorld("terminalsAPI", terminalsAPI);
contextBridge.exposeInMainWorld("licenseAPI", licenseAPI);
contextBridge.exposeInMainWorld("reportsExportAPI", reportsExportAPI);
contextBridge.exposeInMainWorld("breakPolicyAPI", breakPolicyAPI);
contextBridge.exposeInMainWorld("emailSettingsAPI", emailSettingsAPI);
contextBridge.exposeInMainWorld(
  "systemNotificationsAPI",
  systemNotificationsAPI
);

// Generic IPC send function for testing and general IPC communication
export const send = (channel: string, ...args: any[]) =>
  ipcRenderer.invoke(channel, ...args);

export { sha256sum, versions };
