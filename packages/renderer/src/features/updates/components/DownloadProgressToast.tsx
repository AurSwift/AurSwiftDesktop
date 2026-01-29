/**
 * Download Progress Toast Component
 * Displays download progress with percentage and speed
 */

import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DownloadProgress } from "@app/shared";

interface DownloadProgressToastProps {
  progress: DownloadProgress;
  onCancel?: () => void;
}

export function DownloadProgressToast({
  progress,
  onCancel,
}: DownloadProgressToastProps) {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  const estimatedTimeRemaining = (): string => {
    if (!progress.bytesPerSecond || progress.bytesPerSecond === 0) {
      return "Calculating...";
    }
    const remaining = progress.total - progress.transferred;
    const seconds = Math.ceil(remaining / progress.bytesPerSecond);

    if (seconds < 60) {
      return `~${seconds}s remaining`;
    }
    const minutes = Math.floor(seconds / 60);
    return `~${minutes}m remaining`;
  };

  return (
    <div className="flex flex-col gap-3 w-full max-w-md bg-card rounded-lg shadow-xl p-4 ">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <Download className="h-5 w-5 text-primary animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm leading-tight text-card-foreground">
            Downloading update...
          </h3>
        </div>
        {onCancel && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onCancel}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <Progress value={progress.percent} className="h-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{Math.round(progress.percent)}%</span>
          <span>
            {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatSpeed(progress.bytesPerSecond)}</span>
        <span>{estimatedTimeRemaining()}</span>
      </div>
    </div>
  );
}

/**
 * Show download progress toast
 */
export function showDownloadProgressToast(
  progress: DownloadProgress,
  onCancel?: () => void,
): string | number {
  return toast.custom(
    (t) => (
      <DownloadProgressToast
        progress={progress}
        onCancel={() => {
          onCancel?.();
          toast.dismiss(t);
        }}
      />
    ),
    {
      duration: Infinity, // Don't auto-dismiss during download
      position: "top-right",
      id: "download-progress", // Use fixed ID to update same toast
      style: {
        border: "none", // Remove default border, component has its own
        background: "transparent", // Let component handle background
      },
    },
  );
}
