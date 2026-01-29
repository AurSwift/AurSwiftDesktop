/**
 * React hooks for thermal receipt printer management
 *
 * Enhanced with granular connection states for better UX:
 * - checking-connection: Verifying printer status
 * - connecting: Attempting to establish connection
 * - connection-failed: Connection attempt failed
 * - printing: Sending data to printer
 * - success/error/cancelled: Final states
 */

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import type { TransactionData } from "@/types/domain/transaction";
import type { PrinterConfig } from "@/types/features/printer";
import type {
  PrintStatus,
  PrinterInfo,
  PrintJob,
  PrinterError,
} from "../types/printer.types";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("use-thermal-printer");

// Re-export types for consumers who import from hooks
export type { PrintStatus, PrinterInfo, PrintJob, PrinterError };

/**
 * Hook for managing thermal printer operations
 */
export const useThermalPrinter = () => {
  const [printStatus, setPrintStatus] = useState<PrintStatus>("idle");
  const [printerInfo, setPrinterInfo] = useState<PrinterInfo | null>(null);
  const [printQueue, setPrintQueue] = useState<PrintJob[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [printerError, setPrinterError] = useState<PrinterError | null>(null);

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

  /**
   * Ensure printer is connected with granular status updates.
   * - Always refreshes status from main process
   * - If disconnected, attempts a best-effort auto-connect using saved config
   * - Updates printStatus to reflect connection progress
   */
  const ensureConnected = useCallback(
    async (updateStatus = true): Promise<boolean> => {
      if (!window.printerAPI) {
        if (updateStatus) {
          setPrinterError({
            code: "NOT_FOUND",
            message: "Printer API not available",
          });
          setPrintStatus("connection-failed");
        }
        return false;
      }

      try {
        // Step 1: Check current connection status
        if (updateStatus) {
          setPrintStatus("checking-connection");
          setPrinterError(null);
        }

        const status = await window.printerAPI.getStatus();
        setPrinterInfo(status);
        setIsConnected(status.connected);

        if (status.connected) {
          if (updateStatus) setPrintStatus("idle");
          return true;
        }

        // Step 2: Try auto-connect using saved config
        const savedConfigRaw = localStorage.getItem("printer_config");
        if (!savedConfigRaw) {
          if (updateStatus) {
            setPrinterError({
              code: "NOT_FOUND",
              message: "No printer configured",
              details: "Please connect a printer first using Printer Setup",
            });
            setPrintStatus("connection-failed");
          }
          return false;
        }

        let savedConfig: unknown;
        try {
          savedConfig = JSON.parse(savedConfigRaw);
        } catch {
          if (updateStatus) {
            setPrinterError({
              code: "UNKNOWN",
              message: "Invalid printer configuration",
            });
            setPrintStatus("connection-failed");
          }
          return false;
        }

        const config = savedConfig as Partial<PrinterConfig>;
        if (!config.interface || !config.type) {
          if (updateStatus) {
            setPrinterError({
              code: "NOT_FOUND",
              message: "Incomplete printer configuration",
            });
            setPrintStatus("connection-failed");
          }
          return false;
        }

        // Step 3: Attempt connection
        if (updateStatus) {
          setPrintStatus("connecting");
        }

        const connectResult = await window.printerAPI.connect({
          type: config.type,
          interface: config.interface,
          width: config.width,
          characterSet: config.characterSet,
          baudRate: config.baudRate,
          timeout: config.timeout,
        });

        if (!connectResult?.success) {
          if (updateStatus) {
            setPrinterError({
              code: "DISCONNECTED",
              message: connectResult?.error || "Failed to connect to printer",
              details: `Port: ${config.interface}`,
            });
            setPrintStatus("connection-failed");
          }
          return false;
        }

        // Step 4: Verify connection
        const statusAfter = await window.printerAPI.getStatus();
        setPrinterInfo(statusAfter);
        setIsConnected(statusAfter.connected);

        if (statusAfter.connected) {
          if (updateStatus) setPrintStatus("idle");
          return true;
        } else {
          if (updateStatus) {
            setPrinterError({
              code: "DISCONNECTED",
              message: "Printer connection unstable",
            });
            setPrintStatus("connection-failed");
          }
          return false;
        }
      } catch (error) {
        logger.error("Failed to ensure printer connection:", error);
        setIsConnected(false);
        if (updateStatus) {
          const message =
            error instanceof Error ? error.message : "Connection error";
          setPrinterError({ code: "UNKNOWN", message });
          setPrintStatus("connection-failed");
        }
        return false;
      }
    },
    [],
  );

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
        if (!result.success) {
          throw new Error(result.error || "Connection failed");
        }

        // Verify the connection actually became active (connect can succeed while status remains disconnected).
        const statusAfter = await window.printerAPI.getStatus();
        setPrinterInfo(statusAfter);
        setIsConnected(statusAfter.connected);

        if (!statusAfter.connected) {
          toast.error("Failed to connect printer: Printer not detected");
          return false;
        }

        toast.success("Printer connected successfully");
        return true;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        toast.error(`Failed to connect printer: ${errorMessage}`);
        setPrinterInfo((prev) =>
          prev ? { ...prev, connected: false, error: errorMessage } : null,
        );
        setIsConnected(false);
        return false;
      }
    },
    [checkPrinterStatus],
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
   * Updates status through: checking-connection → connecting (if needed) → printing → success/error
   */
  const printReceipt = useCallback(
    async (transactionData: TransactionData): Promise<boolean> => {
      if (!window.printerAPI) {
        setPrinterError({
          code: "NOT_FOUND",
          message: "Printer API not available",
        });
        setPrintStatus("error");
        return false;
      }

      // Validate transaction ID is present
      if (!transactionData.id) {
        logger.error("Transaction ID is required for receipt printing");
        setPrinterError({
          code: "UNKNOWN",
          message: "Transaction ID is missing",
        });
        toast.error("Cannot print receipt: Transaction ID is missing");
        return false;
      }

      // Clear any previous error
      setPrinterError(null);

      // ensureConnected will update status to checking-connection → connecting if needed
      const connected = await ensureConnected(true);
      if (!connected) {
        // printerError and printStatus already set by ensureConnected
        return false;
      }

      const jobId = `receipt_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Add to print queue
      const printJob: PrintJob = {
        id: jobId,
        transactionId: transactionData.id,
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
                : job,
            ),
          );
          setPrintStatus("success");
          setPrinterError(null);

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

        // Update job status with error
        setPrintQueue((prev) =>
          prev.map((job) =>
            job.id === jobId
              ? {
                  ...job,
                  status: "error" as PrintStatus,
                  retryCount: job.retryCount + 1,
                  error: { code: "PRINT_FAILED", message: errorMessage },
                }
              : job,
          ),
        );

        setPrintStatus("error");
        setPrinterError({ code: "PRINT_FAILED", message: errorMessage });
        setPrinterInfo((prev) =>
          prev ? { ...prev, error: errorMessage } : null,
        );
        toast.error(`Print failed: ${errorMessage}`);
        return false;
      }
    },
    [ensureConnected],
  );

  /**
   * Retry failed print job
   */
  const retryPrint = useCallback(
    async (jobId?: string): Promise<boolean> => {
      const failedJob = printQueue.find((job) =>
        jobId ? job.id === jobId : job.status === "error",
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
    [printQueue, printReceipt],
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
    printerError,

    // Actions
    connectPrinter,
    disconnectPrinter,
    printReceipt,
    retryPrint,
    cancelPrint,
    clearQueue,
    checkPrinterStatus,
    getAvailableInterfaces,
    ensureConnected,

    // Utilities
    setPrintStatus,
    setPrinterError,
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
    [connectPrinter, closeSetup],
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
 * Provides granular status feedback during the print flow
 */
export const useReceiptPrintingFlow = () => {
  const [isShowingStatus, setIsShowingStatus] = useState(false);
  const [currentTransaction, setCurrentTransaction] =
    useState<TransactionData | null>(null);

  const {
    printStatus,
    printerInfo,
    printerError,
    isConnected,
    printReceipt,
    cancelPrint,
    setPrintStatus,
    setPrinterError,
  } = useThermalPrinter();

  /**
   * Start receipt printing flow after transaction completion
   * Flow: checking-connection → connecting (if needed) → printing → success/error
   */
  const startPrintingFlow = useCallback(
    async (transactionData: TransactionData) => {
      setCurrentTransaction(transactionData);
      setIsShowingStatus(true);

      // printReceipt handles the full flow with status updates
      return await printReceipt(transactionData);
    },
    [printReceipt],
  );

  /**
   * Handle retry print action
   * Resets status first, then attempts print again
   */
  const handleRetryPrint = useCallback(async () => {
    if (currentTransaction) {
      // Reset status to idle first so UI updates
      setPrintStatus("idle");
      setPrinterError(null);

      // Small delay to allow state update
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Retry the print
      return await printReceipt(currentTransaction);
    }
    return false;
  }, [currentTransaction, printReceipt, setPrinterError, setPrintStatus]);

  /**
   * Cancel the current print operation
   */
  const handleCancelPrint = useCallback(async () => {
    await cancelPrint();
  }, [cancelPrint]);

  /**
   * Skip receipt printing and continue
   */
  const handleSkipReceipt = useCallback(() => {
    setIsShowingStatus(false);
    setCurrentTransaction(null);
    setPrintStatus("idle");
    setPrinterError(null);
  }, [setPrintStatus, setPrinterError]);

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
    printerError,
    isConnected,
    currentTransaction,
    startPrintingFlow,
    handleRetryPrint,
    handleCancelPrint,
    handleSkipReceipt,
    handleEmailReceipt,
    handleNewSale,
  };
};
