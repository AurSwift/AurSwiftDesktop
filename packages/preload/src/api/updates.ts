/**
 * Update API for renderer process
 * Provides IPC communication for update functionality
 */

import { ipcRenderer, contextBridge } from "electron";
import type { UpdateInfo, DownloadProgress, UpdateError } from "@app/shared";

type UpdateAvailableCallback = (info: UpdateInfo) => void;
type DownloadProgressCallback = (progress: DownloadProgress) => void;
type UpdateDownloadedCallback = (info: UpdateInfo) => void;
type UpdateErrorCallback = (error: UpdateError) => void;
type UpdateCheckCompleteCallback = (
  hasUpdate: boolean,
  version?: string,
) => void;

export const updateAPI = {
  /**
   * Listen for update available event
   */
  onUpdateAvailable: (callback: UpdateAvailableCallback) => {
    ipcRenderer.on("update:available", (_, info: UpdateInfo) => {
      callback(info);
    });
  },

  /**
   * Listen for download progress updates
   */
  onDownloadProgress: (callback: DownloadProgressCallback) => {
    ipcRenderer.on(
      "update:download-progress",
      (_, progress: DownloadProgress) => {
        callback(progress);
      },
    );
  },

  /**
   * Listen for update downloaded event
   */
  onUpdateDownloaded: (callback: UpdateDownloadedCallback) => {
    ipcRenderer.on("update:downloaded", (_, info: UpdateInfo) => {
      callback(info);
    });
  },

  /**
   * Listen for update errors
   */
  onUpdateError: (callback: UpdateErrorCallback) => {
    ipcRenderer.on("update:error", (_, error: UpdateError) => {
      callback(error);
    });
  },

  /**
   * Listen for manual check completion
   */
  onUpdateCheckComplete: (callback: UpdateCheckCompleteCallback) => {
    ipcRenderer.on(
      "update:check-complete",
      (_, hasUpdate: boolean, version?: string) => {
        callback(hasUpdate, version);
      },
    );
  },

  /**
   * Listen for install request (from notification or external trigger)
   */
  onInstallRequest: (callback: () => void) => {
    ipcRenderer.on("update:install-request", () => {
      callback();
    });
  },

  /**
   * Start downloading the update
   */
  downloadUpdate: async (): Promise<void> => {
    await ipcRenderer.invoke("update:download");
  },

  /**
   * Install the downloaded update (Cursor-style: immediate quit + silent install)
   */
  installUpdate: async (): Promise<void> => {
    await ipcRenderer.invoke("update:install");
    // Note: This will cause app to quit, so promise may not resolve
  },

  /**
   * Postpone the update
   */
  postponeUpdate: async (): Promise<void> => {
    await ipcRenderer.invoke("update:postpone");
  },

  /**
   * Manually check for updates
   */
  checkForUpdates: async (): Promise<{
    hasUpdate: boolean;
    version?: string;
  }> => {
    return await ipcRenderer.invoke("update:check");
  },

  /**
   * Dismiss error notification
   */
  dismissError: async (): Promise<void> => {
    await ipcRenderer.invoke("update:dismiss-error");
  },

  /**
   * Get postpone count (for renderer sync)
   */
  getPostponeCount: async (): Promise<{
    success: boolean;
    postponeCount: number;
    error?: string;
  }> => {
    return await ipcRenderer.invoke("update:get-postpone-count");
  },

  /**
   * Get pending update info (for renderer mount sync)
   * Call this when the renderer mounts to check if there's a pending update
   * that was detected before the renderer set up its listeners
   */
  getPendingUpdate: async (): Promise<{
    success: boolean;
    updateInfo: UpdateInfo | null;
    isDownloaded?: boolean;
  }> => {
    return await ipcRenderer.invoke("update:get-pending-update");
  },

  /**
   * Cancel ongoing download
   */
  cancelDownload: async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    return await ipcRenderer.invoke("update:cancel-download");
  },

  /**
   * Listen for download cancelled event
   */
  onDownloadCancelled: (callback: () => void) => {
    ipcRenderer.on("update:download-cancelled", () => {
      callback();
    });
  },

  /**
   * Remove all listeners for a specific channel
   */
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
};

// Extend Window interface for TypeScript
declare global {
  interface Window {
    updateAPI: typeof updateAPI;
  }
}

contextBridge.exposeInMainWorld("updateAPI", updateAPI);
