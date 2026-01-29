/**
 * PrintStatusIndicator Component
 * 
 * Displays visual feedback during the print receipt flow:
 * - Connecting state with spinner
 * - Connection failed with retry option
 * - Printing state with spinner
 * - Success state with checkmark
 * - Error state with retry option
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Printer,
  RefreshCw,
  Settings,
  AlertTriangle,
} from "lucide-react";
import type { PrintStatus, PrinterError, PrintStatusIndicatorProps } from "../types/printer.types";
import { cn } from "@/shared/utils/cn";

/**
 * Get display configuration for each status
 */
function getStatusConfig(status: PrintStatus, error?: PrinterError | null) {
  switch (status) {
    case "idle":
      return {
        icon: Printer,
        iconColor: "text-slate-400",
        bgColor: "bg-slate-50",
        borderColor: "border-slate-200",
        title: "Ready to Print",
        message: "Click Print Receipt to begin",
        showSpinner: false,
        showRetry: false,
        showSetup: false,
      };

    case "checking-connection":
      return {
        icon: Printer,
        iconColor: "text-blue-500",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-200",
        title: "Checking Printer...",
        message: "Verifying printer connection",
        showSpinner: true,
        showRetry: false,
        showSetup: false,
      };

    case "connecting":
      return {
        icon: Printer,
        iconColor: "text-amber-500",
        bgColor: "bg-amber-50",
        borderColor: "border-amber-200",
        title: "Connecting to Printer...",
        message: "Establishing connection to thermal printer",
        showSpinner: true,
        showRetry: false,
        showSetup: false,
      };

    case "connection-failed": {
      // Provide specific messages based on error code
      let title = "Connection Failed";
      let message = error?.message || "Unable to connect to printer. Please check the connection.";
      
      if (error?.code === "NOT_FOUND") {
        title = "No Printer Configured";
        message = error.message || "Please set up your printer first.";
      } else if (error?.code === "DISCONNECTED") {
        title = "Printer Disconnected";
        message = error.message || "The printer is not responding. Check if it's powered on and connected.";
      } else if (error?.code === "PORT_BUSY") {
        title = "Port Busy";
        message = "Another application may be using the printer. Close other apps and try again.";
      } else if (error?.code === "TIMEOUT") {
        title = "Connection Timeout";
        message = "The printer took too long to respond. Check the connection and try again.";
      }
      
      return {
        icon: AlertTriangle,
        iconColor: "text-amber-600",
        bgColor: "bg-amber-50",
        borderColor: "border-amber-300",
        title,
        message,
        showSpinner: false,
        showRetry: true,
        showSetup: true,
      };
    }

    case "printing":
      return {
        icon: Printer,
        iconColor: "text-sky-500",
        bgColor: "bg-sky-50",
        borderColor: "border-sky-200",
        title: "Printing Receipt...",
        message: "Sending receipt to printer",
        showSpinner: true,
        showRetry: false,
        showSetup: false,
      };

    case "success":
      return {
        icon: CheckCircle,
        iconColor: "text-green-500",
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
        title: "Receipt Printed!",
        message: "Receipt was printed successfully",
        showSpinner: false,
        showRetry: false,
        showSetup: false,
      };

    case "error": {
      // Provide specific messages based on error code  
      let title = "Print Failed";
      let message = error?.message || "Failed to print receipt. Please try again.";
      
      if (error?.code === "NOT_FOUND") {
        title = "Printer Not Found";
        message = "No printer is configured. Please set up your printer first.";
      } else if (error?.code === "DISCONNECTED") {
        title = "Printer Disconnected";
        message = "Lost connection to printer. Check if it's powered on.";
      } else if (error?.code === "PRINT_FAILED") {
        title = "Print Failed";
        message = error.message || "Failed to send data to printer. Please try again.";
      }
      
      return {
        icon: XCircle,
        iconColor: "text-red-500",
        bgColor: "bg-red-50",
        borderColor: "border-red-200",
        title,
        message,
        showSpinner: false,
        showRetry: true,
        showSetup: true,
      };
    }

    case "cancelled":
      return {
        icon: XCircle,
        iconColor: "text-slate-500",
        bgColor: "bg-slate-50",
        borderColor: "border-slate-200",
        title: "Print Cancelled",
        message: "Print job was cancelled",
        showSpinner: false,
        showRetry: true,
        showSetup: false,
      };

    default:
      return {
        icon: Printer,
        iconColor: "text-slate-400",
        bgColor: "bg-slate-50",
        borderColor: "border-slate-200",
        title: "Unknown Status",
        message: "Please try again",
        showSpinner: false,
        showRetry: true,
        showSetup: true,
      };
  }
}

/**
 * Animated dots for loading states
 */
function AnimatedDots() {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return <span className="inline-block w-4">{dots}</span>;
}

export function PrintStatusIndicator({
  status,
  error,
  onRetry,
  onCancel,
  onSetupPrinter,
  printerName = "Thermal Printer",
}: PrintStatusIndicatorProps) {
  const config = getStatusConfig(status, error);
  const Icon = config.icon;

  // Determine if we're in an active state (showing progress)
  const isActive = ["checking-connection", "connecting", "printing"].includes(status);

  return (
    <div
      className={cn(
        "rounded-xl border-2 p-4 transition-all duration-300",
        config.bgColor,
        config.borderColor
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon with spinner overlay */}
        <div className="relative shrink-0">
          <div
            className={cn(
              "p-3 rounded-full transition-colors duration-300",
              config.bgColor
            )}
          >
            <Icon className={cn("h-6 w-6 transition-colors duration-300", config.iconColor)} />
          </div>
          {config.showSpinner && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-10 w-10 text-sky-500 animate-spin" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-slate-900 flex items-center gap-1">
            {config.title}
            {config.showSpinner && <AnimatedDots />}
          </h4>
          <p className="text-sm text-slate-600 mt-0.5">{config.message}</p>

          {/* Printer name for active states */}
          {isActive && printerName && (
            <p className="text-xs text-slate-500 mt-1">
              Printer: {printerName}
            </p>
          )}

          {/* Error details */}
          {error?.details && (
            <p className="text-xs text-red-600 mt-1 bg-red-100 px-2 py-1 rounded">
              {error.details}
            </p>
          )}

          {/* Action buttons */}
          {(config.showRetry || config.showSetup) && (
            <div className="flex items-center gap-2 mt-3">
              {config.showRetry && onRetry && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRetry}
                  className="h-8 text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1.5" />
                  Try Again
                </Button>
              )}
              {config.showSetup && onSetupPrinter && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onSetupPrinter}
                  className="h-8 text-xs text-slate-600"
                >
                  <Settings className="h-3 w-3 mr-1.5" />
                  Printer Setup
                </Button>
              )}
            </div>
          )}

          {/* Cancel button for active operations */}
          {isActive && onCancel && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancel}
              className="h-8 text-xs text-slate-500 hover:text-slate-700 mt-2"
            >
              Cancel
            </Button>
          )}
        </div>

        {/* Success animation */}
        {status === "success" && (
          <div className="shrink-0">
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center animate-bounce">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact version for inline use
 */
export function PrintStatusBadge({
  status,
  className,
}: {
  status: PrintStatus;
  className?: string;
}) {
  const config = getStatusConfig(status);

  const statusLabels: Record<PrintStatus, string> = {
    idle: "Ready",
    "checking-connection": "Checking...",
    connecting: "Connecting...",
    "connection-failed": "Not Connected",
    printing: "Printing...",
    success: "Printed",
    error: "Failed",
    cancelled: "Cancelled",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
        config.bgColor,
        config.iconColor,
        className
      )}
    >
      {config.showSpinner ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <config.icon className="h-3 w-3" />
      )}
      {statusLabels[status]}
    </span>
  );
}
