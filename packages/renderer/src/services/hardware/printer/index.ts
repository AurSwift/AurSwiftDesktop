/**
 * Thermal Printer Hardware Service
 *
 * Hardware integration for thermal receipt printers.
 * Provides hooks for printer connection, status, and printing operations.
 */

export {
  useThermalPrinter,
  usePrinterSetup,
  useReceiptPrintingFlow,
} from "./hooks/use-thermal-printer";
export type {
  PrintStatus,
  PrinterInfo,
  PrintJob,
  PrinterError,
  PrintStatusIndicatorProps,
} from "./types/printer.types";

export { PrinterSetupDialog } from "./components/printer-setup-dialog";
export {
  PrintStatusIndicator,
  PrintStatusBadge,
} from "./components/print-status-indicator";
