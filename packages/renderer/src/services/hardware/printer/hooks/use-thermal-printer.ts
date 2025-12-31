/**
 * React hooks for thermal receipt printer management
 */

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import type { TransactionData } from "@/types/domain/transaction";
import type { PrinterConfig } from "@/types/features/printer";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("use-thermal-printer");

export type PrintStatus =
  | "idle"
  | "printing"
  | "success"
  | "error"
  | "cancelled";

export interface PrinterInfo {
  connected: boolean;
  interface: string;
  type: string;
  error?: string;
}

export interface PrintJob {
  id: string;
  transactionId: string;
  data: TransactionData;
  timestamp: Date;
  status: PrintStatus;
  retryCount: number;
}

/**
 * Hook for managing thermal printer operations
 */
export const useThermalPrinter = () => {
  const [printStatus, setPrintStatus] = useState<PrintStatus>("idle");
  const [printerInfo, setPrinterInfo] = useState<PrinterInfo | null>(null);
  const [printQueue, setPrintQueue] = useState<PrintJob[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  /**
   * Check current printer status
   */
  const checkPrinterStatus = useCallback(async () => {
    try {
      if (window.printerAPI) {
        const status = await window.printerAPI.getStatus();
        setPrinterInfo(status);
        setIsConnected(status.connected);
      }
    } catch (error) {
      logger.error("Failed to check printer status:", error);
      setPrinterInfo(null);
      setIsConnected(false);
    }
  }, []);

  // Initialize printer connection status
  useEffect(() => {
    checkPrinterStatus();
  }, [checkPrinterStatus]);

  /**
   * Connect to printer with configuration
   */
  const connectPrinter = useCallback(
    async (config: PrinterConfig): Promise<boolean> => {
      try {
        if (!window.printerAPI) {
          throw new Error("Printer API not available");
        }

        const result = await window.printerAPI.connect(config);
        if (result.success) {
          await checkPrinterStatus();
          toast.success("Printer connected successfully");
          return true;
        } else {
          throw new Error(result.error || "Connection failed");
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        toast.error(`Failed to connect printer: ${errorMessage}`);
        setPrinterInfo((prev) =>
          prev ? { ...prev, connected: false, error: errorMessage } : null
        );
        setIsConnected(false);
        return false;
      }
    },
    [checkPrinterStatus]
  );

  /**
   * Disconnect printer
   */
  const disconnectPrinter = useCallback(async (): Promise<void> => {
    try {
      if (window.printerAPI) {
        await window.printerAPI.disconnect();
        setPrinterInfo(null);
        setIsConnected(false);
        toast.success("Printer disconnected");
      }
    } catch (error) {
      logger.error("Failed to disconnect printer:", error);
      toast.error("Failed to disconnect printer");
    }
  }, []);

  /**
   * Print receipt with transaction data
   */
  const printReceipt = useCallback(
    async (transactionData: TransactionData): Promise<boolean> => {
      if (!isConnected || !window.printerAPI) {
        toast.error("Printer not connected");
        return false;
      }

      // Validate transaction ID is present
      if (!transactionData.id) {
        logger.error("Transaction ID is required for receipt printing");
        toast.error("Cannot print receipt: Transaction ID is missing");
        return false;
      }

      const jobId = `receipt_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Add to print queue
      const printJob: PrintJob = {
        id: jobId,
        transactionId: transactionData.id, // Use actual transaction ID (required, no fallback)
        data: transactionData,
        timestamp: new Date(),
        status: "printing",
        retryCount: 0,
      };

      setPrintQueue((prev) => [...prev, printJob]);
      setPrintStatus("printing");

      try {
        const result = await window.printerAPI.printReceipt(transactionData);

        if (result.success) {
          // Update job status
          setPrintQueue((prev) =>
            prev.map((job) =>
              job.id === jobId
                ? { ...job, status: "success" as PrintStatus }
                : job
            )
          );
          setPrintStatus("success");
          toast.success("Receipt printed successfully!");

          // Auto-clear status after 3 seconds
          setTimeout(() => {
            setPrintStatus("idle");
          }, 3000);

          return true;
        } else {
          throw new Error(result.error || "Print failed");
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Print failed";

        // Update job status
        setPrintQueue((prev) =>
          prev.map((job) =>
            job.id === jobId
              ? {
                  ...job,
                  status: "error" as PrintStatus,
                  retryCount: job.retryCount + 1,
                }
              : job
          )
        );

        setPrintStatus("error");
        setPrinterInfo((prev) =>
          prev ? { ...prev, error: errorMessage } : null
        );
        toast.error(`Print failed: ${errorMessage}`);
        return false;
      }
    },
    [isConnected]
  );

  /**
   * Retry failed print job
   */
  const retryPrint = useCallback(
    async (jobId?: string): Promise<boolean> => {
      const failedJob = printQueue.find((job) =>
        jobId ? job.id === jobId : job.status === "error"
      );

      if (!failedJob) {
        toast.error("No failed print job found");
        return false;
      }

      if (failedJob.retryCount >= 3) {
        toast.error("Maximum retry attempts reached");
        return false;
      }

      return await printReceipt(failedJob.data);
    },
    [printQueue, printReceipt]
  );

  /**
   * Cancel current print operation
   */
  const cancelPrint = useCallback(async (): Promise<void> => {
    try {
      if (window.printerAPI) {
        await window.printerAPI.cancelPrint();
        setPrintStatus("cancelled");
        toast.info("Print job cancelled");
      }
    } catch (error) {
      logger.error("Failed to cancel print:", error);
    }
  }, []);

  /**
   * Clear print queue
   */
  const clearQueue = useCallback(() => {
    setPrintQueue([]);
    setPrintStatus("idle");
  }, []);

  /**
   * Get available printer interfaces
   */
  const getAvailableInterfaces = useCallback(async () => {
    try {
      if (window.printerAPI) {
        const interfaces = await window.printerAPI.getAvailableInterfaces();
        return interfaces;
      }
      return [];
    } catch (error) {
      logger.error("Failed to get printer interfaces:", error);
      return [];
    }
  }, []);

  return {
    // State
    printStatus,
    printerInfo,
    printQueue,
    isConnected,

    // Actions
    connectPrinter,
    disconnectPrinter,
    printReceipt,
    retryPrint,
    cancelPrint,
    clearQueue,
    checkPrinterStatus,
    getAvailableInterfaces,

    // Utilities
    setPrintStatus,
  };
};

/**
 * Hook for printer setup dialog management
 */
export const usePrinterSetup = () => {
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [availableInterfaces, setAvailableInterfaces] = useState<
    Array<{
      type: "usb" | "bluetooth";
      name: string;
      address: string;
    }>
  >([]);
  const [isConnecting, setIsConnecting] = useState(false);

  const { connectPrinter, getAvailableInterfaces } = useThermalPrinter();

  /**
   * Open setup dialog and scan for interfaces
   */
  const openSetup = useCallback(async () => {
    setIsSetupOpen(true);
    setIsConnecting(false);

    try {
      const interfaces = await getAvailableInterfaces();
      setAvailableInterfaces(interfaces);
    } catch (error) {
      logger.error("Failed to get available interfaces:", error);
      toast.error("Failed to scan for printers");
    }
  }, [getAvailableInterfaces]);

  /**
   * Close setup dialog
   */
  const closeSetup = useCallback(() => {
    setIsSetupOpen(false);
    setAvailableInterfaces([]);
    setIsConnecting(false);
  }, []);

  /**
   * Handle printer connection from setup
   */
  const handleConnect = useCallback(
    async (config: PrinterConfig) => {
      setIsConnecting(true);

      try {
        const success = await connectPrinter(config);
        if (success) {
          closeSetup();
        }
      } finally {
        setIsConnecting(false);
      }
    },
    [connectPrinter, closeSetup]
  );

  return {
    isSetupOpen,
    availableInterfaces,
    isConnecting,
    openSetup,
    closeSetup,
    handleConnect,
  };
};

/**
 * Hook for managing receipt printer status during transaction completion
 */
export const useReceiptPrintingFlow = () => {
  const [isShowingStatus, setIsShowingStatus] = useState(false);
  const [currentTransaction, setCurrentTransaction] =
    useState<TransactionData | null>(null);

  const {
    printStatus,
    printerInfo,
    isConnected,
    printReceipt,
    setPrintStatus,
  } = useThermalPrinter();

  /**
   * Start receipt printing flow after transaction completion
   */
  const startPrintingFlow = useCallback(
    async (transactionData: TransactionData) => {
      setCurrentTransaction(transactionData);
      setIsShowingStatus(true);

      if (!isConnected) {
        setPrintStatus("error");
        return false;
      }

      return await printReceipt(transactionData);
    },
    [isConnected, printReceipt, setPrintStatus]
  );

  /**
   * Handle retry print action
   */
  const handleRetryPrint = useCallback(async () => {
    if (currentTransaction) {
      return await printReceipt(currentTransaction);
    }
    return false;
  }, [currentTransaction, printReceipt]);

  /**
   * Skip receipt printing and continue
   */
  const handleSkipReceipt = useCallback(() => {
    setIsShowingStatus(false);
    setCurrentTransaction(null);
    setPrintStatus("idle");
  }, [setPrintStatus]);

  /**
   * Handle email receipt (if implemented)
   */
  const handleEmailReceipt = useCallback(async () => {
    if (currentTransaction) {
      try {
        // Implement email receipt functionality
        toast.info("Email receipt functionality not implemented");
        handleSkipReceipt();
      } catch {
        toast.error("Failed to send email receipt");
      }
    }
  }, [currentTransaction, handleSkipReceipt]);

  /**
   * Complete the transaction and close status
   */
  const handleNewSale = useCallback(() => {
    handleSkipReceipt();
    // This will be handled by the parent component to reset transaction
  }, [handleSkipReceipt]);

  return {
    isShowingStatus,
    printStatus,
    printerInfo,
    isConnected,
    startPrintingFlow,
    handleRetryPrint,
    handleSkipReceipt,
    handleEmailReceipt,
    handleNewSale,
  };
};
