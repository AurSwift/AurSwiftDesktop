/**
 * Update Toast Context Provider
 * Manages update state and provides update functionality to components
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import type {
  UpdateInfo,
  DownloadProgress,
  UpdateError,
  UpdateState,
} from "@app/shared";
import { toast } from "sonner";
import {
  showUpdateAvailableToast,
  showDownloadProgressToast,
  showUpdateErrorToast,
} from "../components";
import { getLogger } from "@/shared/utils/logger";
import {
  UpdateToastContext,
  type UpdateContextValue,
} from "./update-toast-context-types";

const logger = getLogger("UpdateToastContext");

interface UpdateToastProviderProps {
  children: React.ReactNode;
}

export function UpdateToastProvider({ children }: UpdateToastProviderProps) {
  const [state, setState] = useState<UpdateState>("idle");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<UpdateError | null>(null);
  const [postponeCount, setPostponeCount] = useState(0);
  const [currentVersion, setCurrentVersion] = useState("1.0.0");

  // Fetch app version on mount
  useEffect(() => {
    const fetchVersion = async () => {
      try {
        if (window.appAPI?.getVersion) {
          const result = await window.appAPI.getVersion();
          if (result?.success && result.version) {
            setCurrentVersion(result.version);
          }
        }
      } catch (err) {
        logger.error("Failed to fetch app version:", err);
      }
    };
    fetchVersion();
  }, []);

  // Check for pending update on mount (in case update:available was missed)
  useEffect(() => {
    const checkPendingUpdate = async () => {
      try {
        if (!window.updateAPI?.getPendingUpdate) return;

        const result = await window.updateAPI.getPendingUpdate();
        if (result?.success && result.updateInfo) {
          logger.info(
            `Found pending update on mount: ${result.updateInfo.version}`,
          );

          // If update is already downloaded, trigger auto-install
          if (result.isDownloaded) {
            setState("downloaded");
            setUpdateInfo(result.updateInfo);
            // Auto-install after brief delay
            toast.info("Installing update...", {
              id: "update-installing",
              duration: 2000,
            });
            setTimeout(() => {
              installUpdateRef.current?.();
            }, 500);
          } else {
            // Show update available toast
            setState("available");
            setUpdateInfo(result.updateInfo);
            showUpdateAvailableToast(
              result.updateInfo,
              currentVersion,
              () => downloadUpdateRef.current?.(),
              () => postponeUpdateRef.current?.(),
            );
          }
        }
      } catch (err) {
        logger.error("Failed to check pending update:", err);
      }
    };

    // Delay slightly to ensure currentVersion is fetched first
    const timer = setTimeout(checkPendingUpdate, 500);
    return () => clearTimeout(timer);
  }, [currentVersion]);

  // Refs for callback functions (to avoid stale closures in event handlers)
  const downloadUpdateRef = useRef<(() => Promise<void>) | undefined>(
    undefined,
  );
  const installUpdateRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const postponeUpdateRef = useRef<(() => void) | undefined>(undefined);
  const checkForUpdatesRef = useRef<(() => Promise<void>) | undefined>(
    undefined,
  );
  const dismissErrorRef = useRef<(() => void) | undefined>(undefined);
  const cancelDownloadRef = useRef<(() => Promise<void>) | undefined>(
    undefined,
  );
  const activeToastIdRef = useRef<string | number | null>(null);

  // Helper to dismiss all update toasts
  const dismissAllUpdateToasts = useCallback(() => {
    toast.dismiss("update-available");
    toast.dismiss("download-progress");
    toast.dismiss("update-ready");
  }, []);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      if (window.updateAPI) {
        window.updateAPI.removeAllListeners("update:available");
        window.updateAPI.removeAllListeners("update:download-progress");
        window.updateAPI.removeAllListeners("update:downloaded");
        window.updateAPI.removeAllListeners("update:error");
        window.updateAPI.removeAllListeners("update:check-complete");
        window.updateAPI.removeAllListeners("update:install-request");
        window.updateAPI.removeAllListeners("update:download-cancelled");
      }
    };
  }, []);

  // Listen for update available
  useEffect(() => {
    if (!window.updateAPI) {
      logger.warn(
        "window.updateAPI not available - update listeners not set up",
      );
      return;
    }

    logger.info("Setting up update:available listener");

    const handleUpdateAvailable = (info: UpdateInfo) => {
      logger.info(`Update available event received: ${info.version}`);
      setState("available");
      setUpdateInfo(info);
      setError(null);

      // Show Update Available toast with Download Now button and changelog
      dismissAllUpdateToasts();
      showUpdateAvailableToast(
        info,
        currentVersion,
        () => downloadUpdateRef.current?.(),
        () => postponeUpdateRef.current?.(),
      );
    };

    window.updateAPI.onUpdateAvailable(handleUpdateAvailable);
    return () => window.updateAPI?.removeAllListeners("update:available");
  }, [currentVersion, dismissAllUpdateToasts]);

  // Listen for download progress
  useEffect(() => {
    if (!window.updateAPI) return;

    const handleDownloadProgress = (progressData: DownloadProgress) => {
      setState("downloading");
      setProgress(progressData);

      toast.dismiss("update-available");
      toast.dismiss("update-ready");
      showDownloadProgressToast(progressData, () =>
        cancelDownloadRef.current?.(),
      );
    };

    window.updateAPI.onDownloadProgress(handleDownloadProgress);
    return () =>
      window.updateAPI?.removeAllListeners("update:download-progress");
  }, []);

  // Listen for download cancelled
  useEffect(() => {
    if (!window.updateAPI) return;

    const handleDownloadCancelled = () => {
      setState("idle");
      setProgress(null);
      toast.dismiss("download-progress");
      toast.info("Download cancelled", {
        description: "The update download has been cancelled.",
        duration: 3000,
      });
    };

    window.updateAPI.onDownloadCancelled(handleDownloadCancelled);
    return () =>
      window.updateAPI?.removeAllListeners("update:download-cancelled");
  }, []);

  // Listen for update downloaded
  useEffect(() => {
    if (!window.updateAPI) return;

    const handleUpdateDownloaded = (info: UpdateInfo) => {
      setState("downloaded");
      setUpdateInfo(info);
      setProgress(null);

      // Auto-install immediately after download completes
      // No user intervention needed - silent install + app restart
      dismissAllUpdateToasts();
      toast.info("Installing update...", {
        id: "update-installing",
        duration: 2000,
      });

      // Trigger auto-install after brief toast
      setTimeout(() => {
        installUpdateRef.current?.();
      }, 500);
    };

    window.updateAPI.onUpdateDownloaded(handleUpdateDownloaded);
    return () => window.updateAPI?.removeAllListeners("update:downloaded");
  }, [dismissAllUpdateToasts]);

  // Listen for errors
  useEffect(() => {
    if (!window.updateAPI) return;

    const handleError = (errorData: UpdateError) => {
      setState("error");
      setError(errorData);

      if (errorData.type === "download") {
        toast.dismiss("download-progress");
      }
      if (errorData.type === "check") {
        toast.dismiss("update-available");
      }

      const canRetry =
        errorData.type === "download" || errorData.type === "check";
      showUpdateErrorToast(
        errorData,
        canRetry
          ? () => {
              if (errorData.type === "download") {
                downloadUpdateRef.current?.();
              } else if (errorData.type === "check") {
                checkForUpdatesRef.current?.();
              }
            }
          : undefined,
        () => dismissErrorRef.current?.(),
      );
    };

    window.updateAPI.onUpdateError(handleError);
    return () => window.updateAPI?.removeAllListeners("update:error");
  }, []);

  // Listen for install request (from notification)
  useEffect(() => {
    if (!window.updateAPI) return;

    const handleInstallRequest = () => {
      if (state === "downloaded" && updateInfo) {
        installUpdateRef.current?.();
      }
    };

    window.updateAPI.onInstallRequest(handleInstallRequest);
    return () => window.updateAPI?.removeAllListeners("update:install-request");
  }, [state, updateInfo]);

  // Download update
  const downloadUpdate = useCallback(async () => {
    try {
      setState("downloading");
      setError(null);
      await window.updateAPI.downloadUpdate();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to download update";
      setState("error");
      setError({
        message: errorMessage,
        type: "download",
        timestamp: new Date(),
      });
      throw err;
    }
  }, []);

  // Install update (Cursor-style: immediate quit)
  const installUpdate = useCallback(async () => {
    try {
      setState("installing");

      // Show brief "Installing..." toast
      toast.info("Installing update...", {
        duration: 1000,
      });

      // Small delay to show toast, then quit
      await new Promise((resolve) => setTimeout(resolve, 500));

      // This will trigger app quit
      await window.updateAPI.installUpdate();

      // Note: Code after this may not execute due to app quit
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to install update";
      setState("error");
      setError({
        message: errorMessage,
        type: "install",
        timestamp: new Date(),
      });
      toast.error(errorMessage);
    }
  }, []);

  // Postpone update
  const postponeUpdate = useCallback(async () => {
    try {
      await window.updateAPI.postponeUpdate();
      setPostponeCount((prev) => prev + 1);
      setState("idle");
      setUpdateInfo(null);

      toast.dismiss("update-available");
      toast.info("Update postponed. We'll remind you later.", {
        duration: 3000,
      });
    } catch {
      toast.error("Failed to postpone update");
    }
  }, []);

  // Check for updates
  const checkForUpdates = useCallback(async () => {
    try {
      setState("checking");
      setError(null);

      const toastId = toast.loading("Checking for updates...");
      activeToastIdRef.current = toastId;

      const result = await window.updateAPI.checkForUpdates();

      if (activeToastIdRef.current === toastId) {
        toast.dismiss(toastId);
        activeToastIdRef.current = null;
      }

      if (result.hasUpdate) {
        // Update available - will be handled by onUpdateAvailable event
        // Don't show additional toast, the UpdateAvailableToast will show
      } else {
        setState("idle");
        toast.success("You're up to date! ✅", {
          description: `You're running the latest version (${currentVersion})`,
        });
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to check for updates";
      setState("error");
      setError({
        message: errorMessage,
        type: "check",
        timestamp: new Date(),
      });

      if (activeToastIdRef.current) {
        toast.dismiss(activeToastIdRef.current);
        activeToastIdRef.current = null;
      }

      toast.error(errorMessage);
    }
  }, [currentVersion]);

  // Dismiss error
  const dismissError = useCallback(async () => {
    try {
      await window.updateAPI.dismissError();
      setError(null);
      if (state === "error") {
        setState("idle");
      }
    } catch {
      toast.error("Failed to dismiss error");
    }
  }, [state]);

  // Cancel download
  const cancelDownload = useCallback(async () => {
    try {
      const result = await window.updateAPI.cancelDownload();
      if (result.success) {
        setState("idle");
        setProgress(null);
        // The cancellation event will handle toast dismissal
      } else {
        toast.error(result.error || "Failed to cancel download");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to cancel download";
      toast.error(errorMessage);
    }
  }, []);

  // Update refs when functions change (must be after all functions are defined)
  useEffect(() => {
    downloadUpdateRef.current = downloadUpdate;
    installUpdateRef.current = installUpdate;
    postponeUpdateRef.current = postponeUpdate;
    checkForUpdatesRef.current = checkForUpdates;
    dismissErrorRef.current = dismissError;
    cancelDownloadRef.current = cancelDownload;
  }, [
    downloadUpdate,
    installUpdate,
    postponeUpdate,
    checkForUpdates,
    dismissError,
    cancelDownload,
  ]);

  const value: UpdateContextValue = {
    state,
    updateInfo,
    progress,
    error,
    currentVersion,
    postponeCount,
    downloadUpdate,
    installUpdate,
    postponeUpdate,
    checkForUpdates,
    dismissError,
  };

  return (
    <UpdateToastContext.Provider value={value}>
      {children}
    </UpdateToastContext.Provider>
  );
}
