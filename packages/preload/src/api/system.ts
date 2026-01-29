import { ipcRenderer } from "electron";

// Database import progress types
export interface DatabaseImportProgress {
  stage:
    | "validating"
    | "backing-up"
    | "copying"
    | "reinitializing"
    | "restoring-license"
    | "complete"
    | "error";
  percent: number;
  message: string;
}

export const databaseAPI = {
  getInfo: () => ipcRenderer.invoke("database:getInfo"),
  backup: () => ipcRenderer.invoke("database:backup"),
  empty: () => ipcRenderer.invoke("database:empty"),
  import: () => ipcRenderer.invoke("database:import"),

  // Progress subscription for database import
  onImportProgress: (callback: (progress: DatabaseImportProgress) => void) => {
    const subscription = (
      _: Electron.IpcRendererEvent,
      progress: DatabaseImportProgress,
    ) => callback(progress);
    ipcRenderer.on("database:import:progress", subscription);
    return () => {
      ipcRenderer.removeListener("database:import:progress", subscription);
    };
  },

  // Ready signal subscription for when database import is fully complete
  onImportReady: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on("database:import:ready", subscription);
    return () => {
      ipcRenderer.removeListener("database:import:ready", subscription);
    };
  },
};

export const printerAPI = {
  getStatus: () => ipcRenderer.invoke("printer:getStatus"),
  connect: (config: {
    type: string;
    interface: string;
    width?: number;
    options?: {
      timeout?: number;
      characterSet?: string;
      removeSpecialCharacters?: boolean;
    };
  }) =>
    ipcRenderer.invoke("printer:connect", config),
  disconnect: () => ipcRenderer.invoke("printer:disconnect"),
  printReceipt: (transactionData: any) =>
    ipcRenderer.invoke("printer:printReceipt", transactionData),
  previewReceipt: (transactionData: any) =>
    ipcRenderer.invoke("printer:previewReceipt", transactionData),
  cancelPrint: () => ipcRenderer.invoke("printer:cancelPrint"),
  getAvailableInterfaces: () =>
    ipcRenderer.invoke("printer:getAvailableInterfaces"),
};

export const officePrinterAPI = {
  // Printer Discovery
  list: () => ipcRenderer.invoke("office-printer:list"),
  getDefault: () => ipcRenderer.invoke("office-printer:get-default"),

  // Print Operations
  print: (config: {
    jobId: string;
    printerName: string;
    documentPath?: string;
    documentData?: Buffer;
    documentType: "pdf" | "image" | "text" | "raw";
    options?: any;
    metadata?: any;
    createdBy?: string;
    businessId?: string;
  }) => ipcRenderer.invoke("office-printer:print", config),

  // Job Management
  getJobStatus: (jobId: string) =>
    ipcRenderer.invoke("office-printer:job-status", jobId),
  cancel: (jobId: string) => ipcRenderer.invoke("office-printer:cancel", jobId),
  retry: (jobId: string) => ipcRenderer.invoke("office-printer:retry", jobId),
  getFailedJobs: () => ipcRenderer.invoke("office-printer:failed-jobs"),

  // Health & Monitoring
  getHealth: (printerName: string) =>
    ipcRenderer.invoke("office-printer:health", printerName),
  getMetrics: () => ipcRenderer.invoke("office-printer:metrics"),

  // Queue Management
  clearQueue: () => ipcRenderer.invoke("office-printer:clear-queue"),
};

export const paymentAPI = {
  // Card Reader Operations
  initializeReader: (config: {
    type: "bbpos_wisepad3" | "simulated";
    connectionType: "usb" | "bluetooth";
    deviceId?: string;
    simulated?: boolean;
  }) => ipcRenderer.invoke("payment:initialize-reader", config),

  discoverReaders: () => ipcRenderer.invoke("payment:discover-readers"),
  getReaderStatus: () => ipcRenderer.invoke("payment:reader-status"),
  testReader: () => ipcRenderer.invoke("payment:test-reader"),
  disconnectReader: () => ipcRenderer.invoke("payment:disconnect-reader"),

  // Payment Processing
  createPaymentIntent: (data: {
    amount: number;
    currency: string;
    description?: string;
    metadata?: Record<string, string>;
  }) => ipcRenderer.invoke("payment:create-intent", data),

  processCardPayment: (paymentIntentId: string) =>
    ipcRenderer.invoke("payment:process-card", paymentIntentId),

  cancelPayment: () => ipcRenderer.invoke("payment:cancel"),

  // Connection Token
  getConnectionToken: () => ipcRenderer.invoke("payment:connection-token"),
};

export const pdfReceiptAPI = {
  generatePDF: (receiptData: any) =>
    ipcRenderer.invoke("receipt:generate-pdf", receiptData),
};

export const scaleAPI = {
  // Scale Discovery & Connection
  discover: () => ipcRenderer.invoke("scale:discover"),
  connect: (config: {
    device: {
      id: string;
      type: "HID" | "SERIAL" | "TCP_IP";
      path?: string;
      vendorId?: number;
      productId?: number;
      manufacturer?: string;
      product?: string;
      serialNumber?: string;
      baudRate?: number;
      address?: string;
      port?: number;
    };
    tareWeight?: number;
    minWeight?: number;
    maxWeight?: number;
    stabilityThreshold?: number;
    stabilityReadings?: number;
    unit?: "g" | "kg" | "lb" | "oz";
    simulated?: boolean;
  }) => ipcRenderer.invoke("scale:connect", config),
  disconnect: () => ipcRenderer.invoke("scale:disconnect"),
  getStatus: () => ipcRenderer.invoke("scale:status"),
  tare: () => ipcRenderer.invoke("scale:tare"),
  startReading: () => ipcRenderer.send("scale:start-reading"),
  stopReading: () => ipcRenderer.send("scale:stop-reading"),
  // Event listeners
  onReading: (
    callback: (reading: {
      weight: number;
      stable: boolean;
      unit: "g" | "kg" | "lb" | "oz";
      timestamp: string;
      rawReadings?: number[];
    }) => void,
  ) => {
    ipcRenderer.on("scale:reading", (_event, reading) => callback(reading));
    return () => ipcRenderer.removeAllListeners("scale:reading");
  },
};

export const appAPI = {
  getVersion: () => ipcRenderer.invoke("app:getVersion"),
  restart: () => ipcRenderer.invoke("app:restart"),
  quit: () => ipcRenderer.invoke("app:quit"),
};

export const vivaWalletAPI = {
  // Terminal Discovery
  discoverTerminals: () => ipcRenderer.invoke("viva:discover-terminals"),
  connectTerminal: (terminalId: string) =>
    ipcRenderer.invoke("viva:connect-terminal", terminalId),
  disconnectTerminal: () => ipcRenderer.invoke("viva:disconnect-terminal"),
  getTerminalStatus: () => ipcRenderer.invoke("viva:terminal-status"),

  // Transactions
  initiateSale: (amount: number, currency: string) =>
    ipcRenderer.invoke("viva:initiate-sale", amount, currency),
  initiateRefund: (
    originalTransactionId: string,
    amount: number,
    currency: string,
  ) =>
    ipcRenderer.invoke(
      "viva:initiate-refund",
      originalTransactionId,
      amount,
      currency,
    ),
  cancelTransaction: (transactionId: string) =>
    ipcRenderer.invoke("viva:cancel-transaction", transactionId),

  // Status
  getTransactionStatus: (transactionId: string) =>
    ipcRenderer.invoke("viva:transaction-status", transactionId),

  // Configuration
  getConfig: () => ipcRenderer.invoke("viva:get-config"),
  saveConfig: (config: any) => ipcRenderer.invoke("viva:save-config", config),
  testConnection: (terminalId: string) =>
    ipcRenderer.invoke("viva:test-connection", terminalId),
};

/**
 * System notifications API
 * Handles system-level notifications from main process
 */
export const systemNotificationsAPI = {
  /**
   * Listen for system notifications
   * @param callback Function to handle notification data
   * @returns Cleanup function to remove listener
   */
  onNotification: (
    callback: (data: { type: string; message: string }) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { type: string; message: string },
    ) => callback(data);
    ipcRenderer.on("system:notification", handler);
    return () => {
      ipcRenderer.removeListener("system:notification", handler);
    };
  },
};
