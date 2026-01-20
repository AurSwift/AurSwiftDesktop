/**
 * Printer API Types
 * 
 * Types for thermal printer operations.
 * 
 * @module types/api/printer
 */

export interface PrinterAPI {
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

