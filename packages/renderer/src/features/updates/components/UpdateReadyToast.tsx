/**
 * Update Ready Toast Component
 * Displays when update is downloaded and ready to install
 */

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Rocket, Clock } from "lucide-react";
import type { UpdateInfo } from "@app/shared";

interface UpdateReadyToastProps {
  updateInfo: UpdateInfo;
  onInstall: () => void;
  onPostpone: () => void;
}

export function UpdateReadyToast({
  updateInfo,
  onInstall,
  onPostpone,
}: UpdateReadyToastProps) {
  return (
    <div className="flex flex-col gap-3 w-full max-w-md bg-card rounded-lg  p-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm leading-tight text-card-foreground">
            Update ready to install
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            aurswift {updateInfo.version} has been downloaded
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            The app will close, install in the background, and reopen
            automatically
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button onClick={onInstall} size="sm" className="flex-1">
          <Rocket className="h-4 w-4" />
          Install Now
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
 * Show update ready toast
 */
export function showUpdateReadyToast(
  updateInfo: UpdateInfo,
  onInstall: () => void,
  onPostpone: () => void,
): string | number {
  return toast.custom(
    (t) => (
      <UpdateReadyToast
        updateInfo={updateInfo}
        onInstall={() => {
          onInstall();
          toast.dismiss(t);
        }}
        onPostpone={() => {
          onPostpone();
          toast.dismiss(t);
        }}
      />
    ),
    {
      duration: Infinity, // Don't auto-dismiss until action taken
      position: "top-right",
      id: "update-ready", // Use fixed ID to replace any existing toast
      style: {
        border: "none", // Remove default border, component has its own
        background: "transparent", // Let component handle background
      },
    },
  );
}
