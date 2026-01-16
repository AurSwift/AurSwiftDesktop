/**
 * Update Toast Context Provider
 * Manages update state and provides update functionality to components
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
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
  showUpdateReadyToast,
  showUpdateErrorToast,
} from "../components";
import { getLogger } from "@/shared/utils/logger";
import { useLicenseContext } from "@/features/license";

const logger = getLogger("UpdateToastContext");

interface UpdateContextValue {
  state: UpdateState;
  updateInfo: UpdateInfo | null;
  progress: DownloadProgress | null;
  error: UpdateError | null;
  currentVersion: string;
  postponeCount: number;

  // Actions
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  postponeUpdate: () => void;
  checkForUpdates: () => Promise<void>;
  dismissError: () => void;
}

const UpdateToastContext = createContext<UpdateContextValue | null>(null);

interface UpdateToastProviderProps {
  children: React.ReactNode;
}

export function UpdateToastProvider({ children }: UpdateToastProviderProps) {
  const [state, setState] = useState<UpdateState>("idle");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<UpdateError | null>(null);
  const [postponeCount, setPostponeCount] = useState(0);
  const [currentVersion, setCurrentVersion] = useState("1.0.0"); // Default, will be updated from IPC

  // Check if license is activated - suppress update notifications during activation
  // Note: UpdateToastProvider is inside LicenseProvider, so context should be available
  // We call the hook unconditionally (React rules) - UpdateToastProvider is nested inside LicenseProvider
  const licenseContext = useLicenseContext();
  const isLicenseActivated = licenseContext.isActivated;

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
      } catch (error) {
        logger.error("Failed to fetch app version:", error);
        // Keep default version on error
      }
    };

    fetchVersion();
  }, []);

  const activeToastIdRef = useRef<string | number | null>(null);
  const updateAvailableToastIdRef = useRef<string | number | null>(null);
  const downloadProgressToastIdRef = useRef<string | number | null>(null);
  const updateReadyToastIdRef = useRef<string | number | null>(null);

  // Use refs to store latest function versions to avoid dependency issues
  const downloadUpdateRef = useRef<(() => Promise<void>) | undefined>(
    undefined
  );
  const installUpdateRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const postponeUpdateRef = useRef<(() => void) | undefined>(undefined);
  const checkForUpdatesRef = useRef<(() => Promise<void>) | undefined>(
    undefined
  );
  const dismissErrorRef = useRef<(() => void) | undefined>(undefined);
  const cancelDownloadRef = useRef<(() => Promise<void>) | undefined>(
    undefined
  );

  // Cleanup listeners on unmount
  useEffect(() => {
    const cleanup = () => {
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

    return cleanup;
  }, []);

  // Listen for update available
  useEffect(() => {
    if (!window.updateAPI) return;

    const handleUpdateAvailable = (info: UpdateInfo) => {
      setState("available");
      setUpdateInfo(info);
      setError(null);

      // Suppress update notifications during license activation
      // This keeps the activation screen focused on its primary task
      if (!isLicenseActivated) {
        return;
      }

      // Dismiss any existing toasts FIRST to prevent overlapping
      toast.dismiss("update-available");
      toast.dismiss("download-progress");
      toast.dismiss("update-ready");

      // Clear refs
      if (updateAvailableToastIdRef.current) {
        updateAvailableToastIdRef.current = null;
      }
      if (downloadProgressToastIdRef.current) {
        downloadProgressToastIdRef.current = null;
      }
      if (updateReadyToastIdRef.current) {
        updateReadyToastIdRef.current = null;
      }

      // Small delay to ensure previous toast is fully dismissed
      setTimeout(() => {
        updateAvailableToastIdRef.current = showUpdateAvailableToast(
          info,
          currentVersion,
          () => downloadUpdateRef.current?.(),
          () => postponeUpdateRef.current?.()
        );
      }, 100);
    };

    window.updateAPI.onUpdateAvailable(handleUpdateAvailable);

    return () => {
      if (window.updateAPI) {
        window.updateAPI.removeAllListeners("update:available");
      }
    };
  }, [currentVersion, isLicenseActivated]);

  // Listen for download progress
  useEffect(() => {
    if (!window.updateAPI) return;

    const handleDownloadProgress = (progressData: DownloadProgress) => {
      setState("downloading");
      setProgress(progressData);

      // Suppress download progress notifications during license activation
      if (!isLicenseActivated) {
        return;
      }

      // Dismiss other toasts first to prevent overlapping
      toast.dismiss("update-available");
      toast.dismiss("update-ready");
      if (updateAvailableToastIdRef.current) {
        updateAvailableToastIdRef.current = null;
      }
      if (updateReadyToastIdRef.current) {
        updateReadyToastIdRef.current = null;
      }

      // Always use the fixed ID to replace/update the same toast
      downloadProgressToastIdRef.current = showDownloadProgressToast(
        progressData,
        () => cancelDownloadRef.current?.()
      );
    };

    window.updateAPI.onDownloadProgress(handleDownloadProgress);

    return () => {
      if (window.updateAPI) {
        window.updateAPI.removeAllListeners("update:download-progress");
      }
    };
  }, [isLicenseActivated]);

  // Listen for download cancelled
  useEffect(() => {
    if (!window.updateAPI) return;

    const handleDownloadCancelled = () => {
      setState("idle");
      setProgress(null);

      // Dismiss progress toast
      toast.dismiss("download-progress");
      if (downloadProgressToastIdRef.current) {
        downloadProgressToastIdRef.current = null;
      }

      // Show cancellation confirmation
      toast.info("Download cancelled", {
        description: "The update download has been cancelled.",
        duration: 3000,
      });
    };

    window.updateAPI.onDownloadCancelled(handleDownloadCancelled);

    return () => {
      if (window.updateAPI) {
        window.updateAPI.removeAllListeners("update:download-cancelled");
      }
    };
  }, []);

  // Listen for update downloaded
  useEffect(() => {
    if (!window.updateAPI) return;

    const handleUpdateDownloaded = (info: UpdateInfo) => {
      setState("downloaded");
      setUpdateInfo(info);
      setProgress(null);

      // Suppress update ready notifications during license activation
      if (!isLicenseActivated) {
        return;
      }

      // Dismiss all existing toasts FIRST to prevent overlapping
      toast.dismiss("update-available");
      toast.dismiss("download-progress");
      toast.dismiss("update-ready");

      // Clear refs
      if (updateAvailableToastIdRef.current) {
        updateAvailableToastIdRef.current = null;
      }
      if (downloadProgressToastIdRef.current) {
        downloadProgressToastIdRef.current = null;
      }
      if (updateReadyToastIdRef.current) {
        updateReadyToastIdRef.current = null;
      }

      // Small delay to ensure previous toast is fully dismissed
      setTimeout(() => {
        updateReadyToastIdRef.current = showUpdateReadyToast(
          info,
          () => installUpdateRef.current?.(),
          () => postponeUpdateRef.current?.()
        );
      }, 100);
    };

    window.updateAPI.onUpdateDownloaded(handleUpdateDownloaded);

    return () => {
      if (window.updateAPI) {
        window.updateAPI.removeAllListeners("update:downloaded");
      }
    };
  }, [isLicenseActivated]);

  // Listen for errors
  useEffect(() => {
    if (!window.updateAPI) return;

    const handleError = (errorData: UpdateError) => {
      setState("error");
      setError(errorData);

      // Dismiss existing toasts when error occurs
      if (errorData.type === "download") {
        toast.dismiss("download-progress");
        if (downloadProgressToastIdRef.current) {
          downloadProgressToastIdRef.current = null;
        }
      }
      if (errorData.type === "check") {
        toast.dismiss("update-available");
        if (updateAvailableToastIdRef.current) {
          updateAvailableToastIdRef.current = null;
        }
      }

      // Show error toast with retry option for download/check errors
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
        () => dismissErrorRef.current?.()
      );
    };

    window.updateAPI.onUpdateError(handleError);

    return () => {
      if (window.updateAPI) {
        window.updateAPI.removeAllListeners("update:error");
      }
    };
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

    return () => {
      window.updateAPI?.removeAllListeners("update:install-request");
    };
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

      // Dismiss the update available toast (using fixed ID)
      toast.dismiss("update-available");
      if (updateAvailableToastIdRef.current) {
        updateAvailableToastIdRef.current = null;
      }

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

export function useUpdateToast() {
  const context = useContext(UpdateToastContext);
  if (!context) {
    throw new Error("useUpdateToast must be used within UpdateToastProvider");
  }
  return context;
}
