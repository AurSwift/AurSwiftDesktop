/**
 * Printer Hardware Types
 */

/**
 * Enhanced print status with granular connection states
 * for better UX feedback during the print receipt flow
 */
export type PrintStatus =
  | "idle"
  | "checking-connection" // Checking current printer status
  | "connecting" // Attempting to connect to printer
  | "connection-failed" // Connection attempt failed
  | "printing" // Actively sending data to printer
  | "success" // Print completed successfully
  | "error" // Print operation failed
  | "cancelled"; // Print was cancelled by user

/**
 * Detailed error information for printer operations
 */
export interface PrinterError {
  code:
    | "NOT_FOUND"
    | "PORT_BUSY"
    | "TIMEOUT"
    | "DISCONNECTED"
    | "PRINT_FAILED"
    | "UNKNOWN";
  message: string;
  details?: string;
}

export interface PrinterInfo {
  connected: boolean;
  interface: string;
  type: string;
  error?: string;
}

export interface PrintJob {
  id: string;
  transactionId: string;
  data: any; // TransactionData
  timestamp: Date;
  status: PrintStatus;
  retryCount: number;
  error?: PrinterError;
}

/**
 * Props for the PrintStatusIndicator component
 */
export interface PrintStatusIndicatorProps {
  status: PrintStatus;
  error?: PrinterError | null;
  onRetry?: () => void;
  onCancel?: () => void;
  onSetupPrinter?: () => void;
  printerName?: string;
}
