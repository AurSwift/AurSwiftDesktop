/**
 * Update Available Toast Component
 * Displays when a new update is available
 */

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Gift,
  Download,
  Clock,
  ExternalLink,
} from "lucide-react";
import type { UpdateInfo } from "@app/shared";

// GitHub releases URL for changelog
const GITHUB_RELEASES_URL = "https://github.com/AurSwift/AurSwift/releases";

interface UpdateAvailableToastProps {
  updateInfo: UpdateInfo;
  currentVersion: string;
  onDownload: () => void;
  onPostpone: () => void;
}

export function UpdateAvailableToast({
  updateInfo,
  currentVersion,
  onDownload,
  onPostpone,
}: UpdateAvailableToastProps) {
  return (
    <div className="flex flex-col gap-3 w-full max-w-md bg-card border-2 border-border rounded-lg shadow-xl p-4 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <Gift className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm leading-tight text-card-foreground">
            New update available
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            aurswift {updateInfo.version} is now available
          </p>
          <p className="text-xs text-muted-foreground">
            You're currently on v{currentVersion}
          </p>
        </div>
      </div>

      {/* Changelog Link */}
      <a
        href={`${GITHUB_RELEASES_URL}/tag/v${updateInfo.version}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors border-t pt-2"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        <span>View release notes</span>
      </a>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button onClick={onDownload} size="sm" className="flex-1">
          <Download className="h-4 w-4" />
          Download Now
        </Button>
        <Button onClick={onPostpone} variant="ghost" size="sm">
          <Clock className="h-4 w-4" />
          Later
        </Button>
      </div>
    </div>
  );
}

/**
 * Show update available toast
 */
export function showUpdateAvailableToast(
  updateInfo: UpdateInfo,
  currentVersion: string,
  onDownload: () => void,
  onPostpone: () => void,
): string | number {
  return toast.custom(
    (t) => (
      <UpdateAvailableToast
        updateInfo={updateInfo}
        currentVersion={currentVersion}
        onDownload={() => {
          onDownload();
          toast.dismiss(t);
        }}
        onPostpone={() => {
          onPostpone();
          toast.dismiss(t);
        }}
      />
    ),
    {
      duration: Infinity, // Don't auto-dismiss
      position: "top-right",
      id: "update-available", // Use fixed ID to replace any existing toast
    },
  );
}
