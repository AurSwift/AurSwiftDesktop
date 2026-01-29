/**
 * Update Error Toast Component
 * Displays update errors with retry option
 */

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { UpdateError } from "@app/shared";

interface UpdateErrorToastProps {
  error: UpdateError;
  onRetry?: () => void;
  onDismiss: () => void;
}

export function UpdateErrorToast({
  error,
  onRetry,
  onDismiss,
}: UpdateErrorToastProps) {
  const [showDetails, setShowDetails] = useState(false);

  const getErrorTitle = (): string => {
    switch (error.type) {
      case "download":
        return "Download failed";
      case "install":
        return "Installation failed";
      case "check":
        return "Update check failed";
      default:
        return "Update error";
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full max-w-md bg-card  rounded-lg shadow-xl p-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <AlertCircle className="h-5 w-5 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm leading-tight text-destructive">
            {getErrorTitle()}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {error.message}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Error Details (Expandable) */}
      <div className="border-t pt-2">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          {showDetails ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          <span>{showDetails ? "Hide" : "View"} error details</span>
        </button>
        {showDetails && (
          <div className="mt-2 p-2 bg-destructive/10 rounded-md text-xs text-destructive/80 max-h-32 overflow-y-auto">
            <pre className="whitespace-pre-wrap font-sans">{error.message}</pre>
            <p className="mt-2 text-xs text-muted-foreground">
              Time: {error.timestamp.toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {onRetry && (
          <Button
            onClick={onRetry}
            size="sm"
            variant="outline"
            className="flex-1"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        )}
        <Button
          onClick={onDismiss}
          variant="ghost"
          size="sm"
          className={onRetry ? "" : "flex-1"}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}

/**
 * Show update error toast
 */
export function showUpdateErrorToast(
  error: UpdateError,
  onRetry?: () => void,
  onDismiss?: () => void,
): string | number {
  return toast.custom(
    (t) => (
      <UpdateErrorToast
        error={error}
        onRetry={() => {
          onRetry?.();
          toast.dismiss(t);
        }}
        onDismiss={() => {
          onDismiss?.();
          toast.dismiss(t);
        }}
      />
    ),
    {
      duration: 10000, // Auto-dismiss after 10 seconds
      position: "top-right",
      style: {
        border: "none", // Remove default border, component has its own
        background: "transparent", // Let component handle background
      },
    },
  );
}
