/**
 * Update Toast Context Provider (Cursor-style)
 *
 * Simple, reliable auto-update flow:
 * 1. Mount → Signal main process "renderer ready"
 * 2. Main checks for updates → broadcasts result
 * 3. Renderer shows toast based on events
 *
 * No complex caching, debouncing, or race condition workarounds.
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

const logger = getLogger("UpdateToast");

interface UpdateToastProviderProps {
  children: React.ReactNode;
}

export function UpdateToastProvider({ children }: UpdateToastProviderProps) {
  // Simple state
  const [state, setState] = useState<UpdateState>("idle");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<UpdateError | null>(null);
  const [currentVersion, setCurrentVersion] = useState("1.0.0");
  const [isReady, setIsReady] = useState(false);

  // Refs for stable callbacks
  const downloadRef = useRef<(() => Promise<void>) | null>(null);
  const installRef = useRef<(() => Promise<void>) | null>(null);
  const postponeRef = useRef<(() => void) | null>(null);

  // ============================================
  // STEP 1: Initialize on mount
  // ============================================
  useEffect(() => {
    const init = async () => {
      // Get current version
      try {
        if (window.appAPI?.getVersion) {
          const result = await window.appAPI.getVersion();
          if (result?.success && result.version) {
            setCurrentVersion(result.version);
            logger.info(`App version: ${result.version}`);
          }
        }
      } catch (err) {
        logger.error("Failed to get app version:", err);
      }

      // Signal ready and request pending update state
      try {
        if (window.updateAPI?.signalRendererReady) {
          logger.info("Signaling renderer ready to main process");
          await window.updateAPI.signalRendererReady();
        }
      } catch (err) {
        logger.error("Failed to signal renderer ready:", err);
      }

      setIsReady(true);
    };

    init();
  }, []);

  // ============================================
  // STEP 2: Set up IPC listeners
  // ============================================
  useEffect(() => {
    if (!window.updateAPI || !isReady) return;

    logger.info("Setting up update listeners");

    // UPDATE AVAILABLE
    const onUpdateAvailable = (info: UpdateInfo) => {
      logger.info(`Update available: ${info.version}`);
      setState("available");
      setUpdateInfo(info);
      setError(null);

      toast.dismiss("update-toast");
      showUpdateAvailableToast(
        info,
        currentVersion,
        () => downloadRef.current?.(),
        () => postponeRef.current?.(),
      );
    };

    // DOWNLOAD PROGRESS
    const onDownloadProgress = (progressData: DownloadProgress) => {
      setState("downloading");
      setProgress(progressData);

      toast.dismiss("update-toast");
      showDownloadProgressToast(progressData, () => {
        // Cancel not implemented - just dismiss
        toast.dismiss("download-progress");
      });
    };

    // UPDATE DOWNLOADED - Auto install
    const onUpdateDownloaded = (info: UpdateInfo) => {
      logger.info(`Update downloaded: ${info.version}`);
      setState("downloaded");
      setUpdateInfo(info);
      setProgress(null);

      toast.dismiss("update-toast");
      toast.dismiss("download-progress");

      // Auto-install with brief message
      toast.info("Installing update and restarting...", {
        id: "update-installing",
        duration: 2000,
      });

      // Trigger install
      setTimeout(() => {
        installRef.current?.();
      }, 500);
    };

    // ERROR
    const onUpdateError = (errorData: UpdateError) => {
      logger.error(`Update error: ${errorData.message}`);
      setState("error");
      setError(errorData);

      toast.dismiss("update-toast");
      toast.dismiss("download-progress");

      showUpdateErrorToast(
        errorData,
        errorData.type === "download"
          ? () => downloadRef.current?.()
          : undefined,
        () => {
          setError(null);
          setState("idle");
        },
      );
    };

    // Register listeners
    window.updateAPI.onUpdateAvailable(onUpdateAvailable);
    window.updateAPI.onDownloadProgress(onDownloadProgress);
    window.updateAPI.onUpdateDownloaded(onUpdateDownloaded);
    window.updateAPI.onUpdateError(onUpdateError);

    // Cleanup
    return () => {
      window.updateAPI?.removeAllListeners("update:available");
      window.updateAPI?.removeAllListeners("update:download-progress");
      window.updateAPI?.removeAllListeners("update:downloaded");
      window.updateAPI?.removeAllListeners("update:error");
    };
  }, [isReady, currentVersion]);

  // ============================================
  // STEP 3: Action handlers
  // ============================================

  const downloadUpdate = useCallback(async () => {
    try {
      logger.info("Starting download");
      setState("downloading");
      setError(null);
      await window.updateAPI.downloadUpdate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Download failed";
      logger.error(`Download failed: ${msg}`);
      setState("error");
      setError({ message: msg, type: "download", timestamp: new Date() });
      toast.error(msg);
    }
  }, []);

  const installUpdate = useCallback(async () => {
    try {
      logger.info("Installing update");
      setState("installing");
      await window.updateAPI.installUpdate();
      // App will quit - code after this may not run
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Install failed";
      logger.error(`Install failed: ${msg}`);
      setState("error");
      setError({ message: msg, type: "install", timestamp: new Date() });
      toast.error(msg);
    }
  }, []);

  const postponeUpdate = useCallback(async () => {
    try {
      logger.info("Postponing update");
      await window.updateAPI.postponeUpdate();
      setState("idle");
      setUpdateInfo(null);
      toast.dismiss("update-toast");
      toast.dismiss("update-available");
      toast.info("Update postponed. We'll remind you later.", {
        duration: 3000,
      });
    } catch (err) {
      toast.error("Failed to postpone update");
    }
  }, []);

  const checkForUpdates = useCallback(async () => {
    try {
      logger.info("Manual update check");
      setState("checking");
      setError(null);

      const toastId = toast.loading("Checking for updates...");
      const result = await window.updateAPI.checkForUpdates();
      toast.dismiss(toastId);

      if (!result.hasUpdate) {
        setState("idle");
        toast.success("You're up to date!", {
          description: `Running version ${currentVersion}`,
        });
      }
      // If hasUpdate, the onUpdateAvailable listener will handle it
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Check failed";
      logger.error(`Check failed: ${msg}`);
      setState("error");
      setError({ message: msg, type: "check", timestamp: new Date() });
      toast.error(msg);
    }
  }, [currentVersion]);

  const dismissError = useCallback(() => {
    setError(null);
    setState("idle");
  }, []);

  // Update refs
  useEffect(() => {
    downloadRef.current = downloadUpdate;
    installRef.current = installUpdate;
    postponeRef.current = postponeUpdate;
  }, [downloadUpdate, installUpdate, postponeUpdate]);

  // ============================================
  // STEP 4: Provide context
  // ============================================
  const value: UpdateContextValue = {
    state,
    updateInfo,
    progress,
    error,
    currentVersion,
    postponeCount: 0, // Simplified - main process tracks this
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
