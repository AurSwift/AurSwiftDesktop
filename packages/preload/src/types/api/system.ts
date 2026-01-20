/**
 * System API Types - Preload
 * 
 * Type definitions for system-level IPC APIs (database, printer, payment, scale, etc.).
 * 
 * @module preload/types/api/system
 */

export interface DatabaseAPIPreload {
  getInfo: () => Promise<any>;
  backup: () => Promise<any>;
  empty: () => Promise<any>;
  import: () => Promise<any>;
}

export interface PrinterAPIPreload {
  getStatus: () => Promise<{
    connected: boolean;
    interface: string;
    type: string;
    error?: string;
  }>;
  connect: (config: {
    type: string;
    interface: string;
    width?: number;
    options?: {
      timeout?: number;
      characterSet?: string;
      removeSpecialCharacters?: boolean;
    };
  }) => Promise<{
    success: boolean;
    error?: string;
  }>;
  disconnect: () => Promise<void>;
  printReceipt: (transactionData: any) => Promise<{
    success: boolean;
    error?: string;
  }>;
  previewReceipt: (transactionData: any) => Promise<{
    success: boolean;
    text?: string;
    barcodePngBase64?: string;
    error?: string;
  }>;
  cancelPrint: () => Promise<void>;
  getAvailableInterfaces: () => Promise<
    Array<{
      type: 'usb' | 'bluetooth';
      name: string;
      address: string;
    }>
  >;
}

export interface OfficePrinterAPIPreload {
  list: () => Promise<any>;
  getDefault: () => Promise<any>;
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
  }) => Promise<any>;
  getJobStatus: (jobId: string) => Promise<any>;
  cancel: (jobId: string) => Promise<any>;
  retry: (jobId: string) => Promise<any>;
  getFailedJobs: () => Promise<any>;
  getHealth: (printerName: string) => Promise<any>;
  getMetrics: () => Promise<any>;
  clearQueue: () => Promise<any>;
}

export interface PaymentAPIPreload {
  initializeReader: (config: {
    type: "bbpos_wisepad3" | "simulated";
    connectionType: "usb" | "bluetooth";
    deviceId?: string;
    simulated?: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
  discoverReaders: () => Promise<{ success: boolean; readers: any[] }>;
  getReaderStatus: () => Promise<any>;
  testReader: () => Promise<{ success: boolean; error?: string }>;
  disconnectReader: () => Promise<{ success: boolean }>;
  createPaymentIntent: (data: {
    amount: number;
    currency: string;
    description?: string;
    metadata?: Record<string, string>;
  }) => Promise<any>;
  processCardPayment: (paymentIntentId: string) => Promise<any>;
  cancelPayment: () => Promise<{ success: boolean; error?: string }>;
  getConnectionToken: () => Promise<any>;
}

export interface ScaleAPIPreload {
  discover: () => Promise<any>;
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
  }) => Promise<{ success: boolean; error?: string }>;
  disconnect: () => Promise<{ success: boolean; error?: string }>;
  getStatus: () => Promise<any>;
  tare: () => Promise<{ success: boolean; error?: string }>;
  startReading: () => void;
  stopReading: () => void;
  onReading: (callback: (reading: {
    weight: number;
    stable: boolean;
    unit: "g" | "kg" | "lb" | "oz";
    timestamp: string;
    rawReadings?: number[];
  }) => void) => () => void;
}

export interface PdfReceiptAPIPreload {
  generatePDF: (receiptData: any) => Promise<{
    success: boolean;
    data?: string;
    error?: string;
  }>;
}

export interface AppAPIPreload {
  restart: () => Promise<{ success: boolean; message?: string }>;
}

