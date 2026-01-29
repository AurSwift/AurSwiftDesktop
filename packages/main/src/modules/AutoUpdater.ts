import { AppModule } from "../AppModule.js";
import electronUpdater, {
  type AppUpdater,
  type Logger,
  type UpdateInfo,
  type ProgressInfo,
  CancellationToken,
} from "electron-updater";
import { app, dialog, Notification, shell, BrowserWindow } from "electron";
import Store from "electron-store";

import { getLogger } from "../utils/logger.js";
const logger = getLogger("AutoUpdater");

// Type for persisted download state
type PersistedDownloadState = {
  downloadedBytes: number;
  totalBytes: number;
  version: string;
  timestamp: number;
};

// Type for persisted update check error notification count
type PersistedUpdateCheckErrorCount = {
  count: number;
  lastReset: number; // timestamp when counter was last reset
};

export class AutoUpdater implements AppModule {
  readonly #logger: Logger | null;
  readonly #store: Store<{
    downloadState: PersistedDownloadState | null;
    updateCheckErrorCount: PersistedUpdateCheckErrorCount | null;
  }>;
  #updateCheckInterval: NodeJS.Timeout | null = null;
  #postponedUpdateInfo: UpdateInfo | null = null;
  #remindLaterTimeout: NodeJS.Timeout | null = null;
  #isDownloading = false;
  #downloadStartTime: number | null = null;
  #lastError: { message: string; timestamp: Date; type: string } | null = null;
  #downloadCancellationToken: CancellationToken | null = null;
  #lastErrorNotifications: Map<string, number> = new Map();
  #pendingCheckPromises: Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];

  readonly #REMIND_LATER_INTERVAL = 2 * 60 * 60 * 1000;
  readonly #MAX_POSTPONE_COUNT = 3;
  readonly #MAX_UPDATE_CHECK_ERROR_NOTIFICATIONS = 3; // Max times to show update check failed notification
  readonly #GITHUB_REPO_URL = "https://github.com/AurSwift/AurSwift";
  readonly #GITHUB_RELEASES_URL = `${this.#GITHUB_REPO_URL}/releases`;
  // Customer-facing release notes URL (web app)
  readonly #WEB_APP_URL =
    process.env.AURSWIFT_WEB_URL || "https://aurswift.vercel.app";
  readonly #WEB_RELEASES_URL = `${this.#WEB_APP_URL}/releases`;
  readonly #STARTUP_DELAY = 5 * 1000; // 5 seconds delay for startup check
  readonly #CACHE_DURATION = 15 * 60 * 1000; // 15 minutes cache duration
  readonly #IDLE_THRESHOLD = 30 * 60 * 1000; // 30 minutes idle threshold
  readonly #ACTIVITY_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes activity check interval
  // Phase 2.1: Request Timeout & Retry Logic
  readonly #REQUEST_TIMEOUT = 10000; // 10 seconds
  readonly #MAX_RETRIES = 3;
  readonly #RETRY_DELAY = 2000; // 2 seconds base delay
  // Download state for resume capability
  #downloadState: {
    downloadedBytes: number;
    totalBytes: number;
    version: string;
  } | null = null;
  #checkDebounceTimer: NodeJS.Timeout | null = null;
  readonly #DEBOUNCE_DELAY = 2000; // 2 seconds
  readonly #PROGRESS_NOTIFICATION_THRESHOLD = 50; // Show notification at 50%
  #postponeCount = 0;
  #isCheckingForUpdates = false;
  #updateListeners: Array<{
    event: string;
    listener: (...args: any[]) => void;
  }> = [];
  #hasShownProgressNotification = false;
  #lastCheckTime: number | null = null;
  #lastCheckResult: { version: string; timestamp: number } | null = null;
  #lastUserActivity: number = Date.now();
  #activityCheckInterval: NodeJS.Timeout | null = null;
  #downloadedUpdateInfo: UpdateInfo | null = null;
  #isOnLatestVersion: boolean = false; // Track if we've successfully confirmed we're on latest version

  constructor({
    logger = null,
  }: {
    logger?: Logger | null | undefined;
  } = {}) {
    this.#logger = logger;

    // Initialize persistent store for download state and error notification count
    this.#store = new Store<{
      downloadState: PersistedDownloadState | null;
      updateCheckErrorCount: PersistedUpdateCheckErrorCount | null;
    }>({
      name: "autoupdater-state",
      defaults: {
        downloadState: null,
        updateCheckErrorCount: null,
      },
    });

    // Load persisted download state on initialization
    this.loadDownloadState();
  }

  /**
   * Enable the auto-updater module
   * Checks for updates on startup (with delay) and schedules periodic checks
   */
  async enable(): Promise<void> {
    if (await this.handleSquirrelEvents()) {
      return;
    }

    logger.info(
      `🚀 AutoUpdater enabling (v${app.getVersion()}, packaged: ${app.isPackaged})`,
    );

    // Set up update listeners once when enabling (not on every check)
    // This ensures listeners are always ready to receive update events
    const updater = this.getAutoUpdater();
    updater.logger = this.#logger || null;
    updater.fullChangelog = true;
    updater.autoDownload = false; // User clicks "Download Now" to start download
    updater.autoInstallOnAppQuit = true;
    updater.allowDowngrade = false;
    updater.channel = "latest";
    this.setupUpdateListeners(updater);

    if (this.#logger) {
      this.#logger.info("AutoUpdater enabled, listeners set up");
    }

    // CURSOR-STYLE: Don't auto-check on startup. Instead, wait for renderer to signal ready.
    // This avoids the race condition where update events fire before renderer sets up listeners.
    // The renderer will call signalRendererReady via IPC, which triggers the check.
    // Keeping a delayed check as a fallback in case renderer never signals (e.g., dev mode issues)
    setTimeout(() => {
      // Only run if we don't already have pending update info (renderer hasn't checked yet)
      if (!this.#postponedUpdateInfo && !this.#downloadedUpdateInfo) {
        logger.info(
          "[enable] Fallback check - renderer may not have signaled ready",
        );
        this.runAutoUpdater().catch((error) => {
          const errorMessage = this.formatErrorMessage(error);
          if (this.#logger) {
            this.#logger.error(`Fallback update check failed: ${errorMessage}`);
          } else {
            logger.error("Fallback update check failed:", error);
          }
        });
      }
    }, this.#STARTUP_DELAY + 5000); // Extra 5 seconds to give renderer time to signal

    this.schedulePeriodicChecks();
    this.trackUserActivity();
  }

  /**
   * Disable the auto-updater module
   * Cleans up intervals, timeouts, event listeners, and memory
   */
  async disable(): Promise<void> {
    if (this.#updateCheckInterval) {
      clearInterval(this.#updateCheckInterval);
      this.#updateCheckInterval = null;
    }

    if (this.#remindLaterTimeout) {
      clearTimeout(this.#remindLaterTimeout);
      this.#remindLaterTimeout = null;
    }

    if (this.#activityCheckInterval) {
      clearInterval(this.#activityCheckInterval);
      this.#activityCheckInterval = null;
    }

    // Phase 4.3: Clear debounce timer
    if (this.#checkDebounceTimer) {
      clearTimeout(this.#checkDebounceTimer);
      this.#checkDebounceTimer = null;
    }

    // Performance: Clear pending promises to prevent memory leaks
    if (this.#pendingCheckPromises.length > 0) {
      const error = new Error("AutoUpdater disabled");
      this.#pendingCheckPromises.forEach((p) => p.reject(error));
      this.#pendingCheckPromises = [];
    }

    // Performance: Clear caches and Maps
    this.#lastErrorNotifications.clear();

    // Remove all event listeners
    const updater = this.getAutoUpdater();
    this.removeUpdateListeners(updater);
  }

  private async handleSquirrelEvents(): Promise<boolean> {
    if (process.platform !== "win32") {
      return false;
    }

    const squirrelCommand = process.argv[1];
    if (!squirrelCommand || !squirrelCommand.startsWith("--squirrel")) {
      return false;
    }

    const { spawn } = await import("node:child_process");
    const path = await import("node:path");

    const appFolder = path.dirname(process.execPath);
    const rootFolder = path.resolve(appFolder, "..");
    const updateExe = path.resolve(rootFolder, "Update.exe");
    const exeName = path.basename(process.execPath);

    const spawnUpdate = (args: string[]): Promise<void> => {
      return new Promise<void>((resolve) => {
        try {
          const child = spawn(updateExe, args, { detached: true });

          child.on("close", () => {
            resolve();
          });

          child.on("error", () => {
            resolve();
          });
        } catch {
          resolve();
        }
      });
    };

    try {
      switch (squirrelCommand) {
        case "--squirrel-install":
          await spawnUpdate(["--createShortcut", exeName]);
          break;
        case "--squirrel-updated":
          await spawnUpdate(["--createShortcut", exeName]);
          break;
        case "--squirrel-uninstall":
          await spawnUpdate(["--removeShortcut", exeName]);
          break;
        case "--squirrel-obsolete":
          break;
        default:
          return false;
      }

      app.quit();
      return true;
    } catch (error) {
      logger.error("Unexpected error in Squirrel event handling:", error);
      app.quit();
      return true;
    }
  }

  /**
   * Track user activity to enable smart periodic scheduling
   * Updates last activity timestamp when app receives focus
   */
  private trackUserActivity(): void {
    // Track window focus events
    app.on("browser-window-focus", () => {
      this.#lastUserActivity = Date.now();
      if (this.#logger && this.#logger.info) {
        this.#logger.info("User activity detected - window focused");
      }
    });

    // Periodic activity check (fallback if focus events don't fire)
    this.#activityCheckInterval = setInterval(() => {
      // If app is focused, consider it active
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (focusedWindow) {
        this.#lastUserActivity = Date.now();
      }
    }, this.#ACTIVITY_CHECK_INTERVAL);
  }

  /**
   * Schedule periodic update checks with smart scheduling
   * Skips checks when user is idle to save CPU and battery (Performance: Phase 1.3)
   */
  private schedulePeriodicChecks(): void {
    const CHECK_INTERVAL = 4 * 60 * 60 * 1000;

    this.#updateCheckInterval = setInterval(() => {
      const idleTime = Date.now() - this.#lastUserActivity;

      // Skip check if user is idle (Performance: Phase 1.3 - Smart Scheduling)
      if (idleTime > this.#IDLE_THRESHOLD) {
        if (this.#logger) {
          this.#logger.info(
            `Skipping update check - user idle for ${Math.floor(
              idleTime / 60000,
            )} minutes`,
          );
        }
        return;
      }

      // Use runAutoUpdater to ensure proper state management and avoid race conditions
      this.runAutoUpdater().catch((error) => {
        const errorMessage = this.formatErrorMessage(error);
        if (this.#logger) {
          this.#logger.error(`Periodic update check failed: ${errorMessage}`);
        } else {
          logger.error("Periodic update check failed:", error);
        }
      });
    }, CHECK_INTERVAL);
  }

  private scheduleReminder(updateInfo: UpdateInfo): void {
    if (this.#remindLaterTimeout) {
      clearTimeout(this.#remindLaterTimeout);
      this.#remindLaterTimeout = null;
    }

    this.#postponedUpdateInfo = updateInfo;
    this.#postponeCount++;

    this.#remindLaterTimeout = setTimeout(() => {
      this.showReminderNotification(updateInfo);
    }, this.#REMIND_LATER_INTERVAL);
  }

  private showReminderNotification(updateInfo: UpdateInfo): void {
    const newVersion = updateInfo.version;
    const hasReachedLimit = this.#postponeCount >= this.#MAX_POSTPONE_COUNT;

    if (Notification.isSupported()) {
      const title = hasReachedLimit
        ? "Important: Update Available"
        : "Update Reminder";
      const body = hasReachedLimit
        ? `aurswift ${newVersion} is ready. Please update to continue receiving updates.`
        : `aurswift ${newVersion} is available. Click to download.`;

      const notification = new Notification({
        title,
        body,
        urgency: hasReachedLimit ? "critical" : "normal",
        silent: false,
      });

      notification.on("click", () => {
        this.showUpdateAvailableDialog(updateInfo, true);
      });

      notification.show();
    } else {
      this.showUpdateAvailableDialog(updateInfo, true);
    }
  }

  /**
   * Format error message from unknown error type
   * @param error - The error to format
   * @returns Formatted error message string
   */
  private formatErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * Show dialog when an update is available
   * @param info - Update information from electron-updater
   * @param isReminder - Whether this is a reminder notification (default: false)
   */
  private showUpdateAvailableDialog(
    info: UpdateInfo,
    isReminder: boolean = false,
  ): void {
    // Input validation
    if (!info || !info.version) {
      logger.error("Invalid update info provided to showUpdateAvailableDialog");
      return;
    }

    const currentVersion = app.getVersion();
    const newVersion = info.version;
    const hasReachedLimit = this.#postponeCount >= this.#MAX_POSTPONE_COUNT;

    const buttons = hasReachedLimit
      ? ["Download Now", "View Release Notes"]
      : ["Download Now", "View Release Notes", "Remind Me Later"];

    const reminderText = isReminder
      ? `\n\n⏰ This is a reminder about the available update.\n${
          hasReachedLimit
            ? "⚠️ You've postponed this update multiple times. Please consider updating soon."
            : `You can postpone ${
                this.#MAX_POSTPONE_COUNT - this.#postponeCount
              } more time(s).`
        }`
      : "";

    dialog
      .showMessageBox({
        type: hasReachedLimit ? "warning" : "info",
        title: isReminder ? "Update Reminder" : "Update Available",
        message: `A new version of aurswift is available!`,
        detail: `Current version: ${currentVersion}\nNew version: ${newVersion}${reminderText}\n\nWould you like to download this update now?\n(The download will happen in the background.)`,
        buttons,
        defaultId: 0,
        cancelId: buttons.length - 1,
        noLink: true,
      })
      .then((result) => {
        if (result.response === 0) {
          // Check if already downloading to prevent race conditions
          if (this.#isDownloading) {
            if (this.#logger) {
              this.#logger.info(
                "Download already in progress, skipping duplicate request",
              );
            }
            return;
          }

          this.#postponeCount = 0;
          this.#postponedUpdateInfo = null;
          this.setDownloading(true);

          const updater = this.getAutoUpdater();
          if (this.#downloadState) {
            this.#downloadState.version = info.version;
          } else {
            this.#downloadState = {
              downloadedBytes: 0,
              totalBytes: 0,
              version: info.version,
            };
          }
          this.downloadWithResume(updater, info.version);

          if (Notification.isSupported()) {
            const notification = new Notification({
              title: "Downloading Update",
              body: `aurswift ${newVersion} is downloading in the background...`,
              silent: false,
            });
            notification.show();
          }
        } else if (result.response === 1) {
          // Open customer-facing release notes on web app
          const cleanVersion = newVersion.replace(/^v/, "");
          shell.openExternal(
            `${this.#WEB_RELEASES_URL}?version=${cleanVersion}`,
          );

          setTimeout(() => {
            this.showUpdateAvailableDialog(info, isReminder);
          }, 1000);
        } else if (result.response === 2 && !hasReachedLimit) {
          this.scheduleReminder(info);

          if (Notification.isSupported()) {
            const hours = this.#REMIND_LATER_INTERVAL / (60 * 60 * 1000);
            const notification = new Notification({
              title: "Reminder Set",
              body: `We'll remind you about aurswift ${newVersion} in ${hours} hours.`,
              silent: true,
            });
            notification.show();
          }
        }
      })
      .catch((error) => {
        const errorMessage = this.formatErrorMessage(error);
        if (this.#logger) {
          this.#logger.error(
            `Error showing update available dialog: ${errorMessage}`,
          );
        } else {
          logger.error("Error showing update available dialog:", error);
        }
      });
  }

  /**
   * Get the electron-updater AppUpdater instance
   * @returns The AppUpdater instance from electron-updater
   */
  getAutoUpdater(): AppUpdater {
    const { autoUpdater } = electronUpdater;
    return autoUpdater;
  }

  /**
   * Clear the last error
   */
  clearLastError(): void {
    this.#lastError = null;
  }

  /**
   * Set downloading state (centralized state management)
   * All isDownloading state changes should go through this method
   */
  setDownloading(isDownloading: boolean): void {
    this.#isDownloading = isDownloading;
    if (isDownloading) {
      this.#downloadStartTime = Date.now();
    } else {
      this.#downloadStartTime = null;
      this.#hasShownProgressNotification = false;
      // Clear cancellation token when stopping download
      this.#downloadCancellationToken = null;
    }
  }

  /**
   * Cancel ongoing download
   * @returns true if cancellation was successful, false if no download in progress
   */
  cancelDownload(): boolean {
    if (!this.#isDownloading || !this.#downloadCancellationToken) {
      return false;
    }

    try {
      this.#downloadCancellationToken.cancel();

      if (this.#logger) {
        this.#logger.info("Download cancelled by user");
      }

      // Update state
      this.setDownloading(false);

      // Clear download state (user cancelled, don't preserve for resume)
      this.#downloadState = null;
      this.saveDownloadState(null);

      // Broadcast cancellation to renderer
      this.broadcastToAllWindows("update:download-cancelled", {
        timestamp: new Date(),
      });

      return true;
    } catch (error) {
      const errorMessage = this.formatErrorMessage(error);
      if (this.#logger) {
        this.#logger.error(`Failed to cancel download: ${errorMessage}`);
      }
      return false;
    }
  }

  /**
   * Pause download - not supported by electron-updater
   * @returns always false as pause is not supported
   */
  pauseDownload(): boolean {
    // Note: electron-updater doesn't support true pause/resume
    // Keeping method for API compatibility but returns false
    return false;
  }

  /**
   * Resume download - not supported by electron-updater
   * @returns always false as resume is not supported
   */
  resumeDownload(): boolean {
    // Note: electron-updater doesn't support true pause/resume
    // Keeping method for API compatibility but returns false
    return false;
  }

  /**
   * Check if download is paused
   * @returns always false as pause is not supported
   */
  isDownloadPaused(): boolean {
    return false;
  }

  /**
   * Get current download progress
   * @returns Download progress information or null if not downloading
   */
  getDownloadProgress(): {
    percent: number;
    transferred: number;
    total: number;
    bytesPerSecond: number;
  } | null {
    if (!this.#downloadState || !this.#isDownloading) {
      return null;
    }
    return {
      percent:
        this.#downloadState.totalBytes > 0
          ? (this.#downloadState.downloadedBytes /
              this.#downloadState.totalBytes) *
            100
          : 0,
      transferred: this.#downloadState.downloadedBytes,
      total: this.#downloadState.totalBytes,
      bytesPerSecond: 0,
    };
  }

  /**
   * Get postpone count (for IPC exposure)
   */
  getPostponeCount(): number {
    return this.#postponeCount;
  }

  /**
   * Get current download status
   * @returns Whether a download is currently in progress
   */
  getIsDownloading(): boolean {
    return this.#isDownloading;
  }

  /**
   * Get pending update info (if available but not downloaded)
   */
  getPendingUpdateInfo(): UpdateInfo | null {
    return this.#postponedUpdateInfo;
  }

  /**
   * Check if update is downloaded and ready to install
   */
  isUpdateDownloaded(): boolean {
    return this.#downloadedUpdateInfo !== null;
  }

  /**
   * Postpone update (called from IPC)
   */
  postponeUpdate(updateInfo: UpdateInfo): void {
    this.scheduleReminder(updateInfo);
  }

  /**
   * Save download state to disk for persistence
   * @param state Download state to persist or null to clear
   */
  private saveDownloadState(
    state: {
      downloadedBytes: number;
      totalBytes: number;
      version: string;
    } | null,
  ): void {
    try {
      if (state) {
        this.#store.set("downloadState", { ...state, timestamp: Date.now() });
      } else {
        this.#store.delete("downloadState");
      }
    } catch (error) {
      if (this.#logger) {
        this.#logger.error(`Failed to save download state: ${error}`);
      }
    }
  }

  /**
   * Load download state from disk on startup
   * Only loads if download is recent (within 24 hours)
   */
  private loadDownloadState(): void {
    try {
      const saved = this.#store.get("downloadState");
      if (saved) {
        const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
        if (Date.now() - saved.timestamp < MAX_AGE) {
          this.#downloadState = {
            downloadedBytes: saved.downloadedBytes,
            totalBytes: saved.totalBytes,
            version: saved.version,
          };
        } else {
          this.#store.delete("downloadState");
        }
      }
    } catch (error) {
      if (this.#logger) {
        this.#logger.error(`Failed to load download state: ${error}`);
      }
    }
  }

  /**
   * Get the current update check error notification count
   * @returns Current count (0 if not set)
   */
  private getUpdateCheckErrorNotificationCount(): number {
    try {
      const saved = this.#store.get("updateCheckErrorCount");
      return saved?.count ?? 0;
    } catch (error) {
      if (this.#logger) {
        this.#logger.error(
          `Failed to get update check error notification count: ${error}`,
        );
      }
      return 0;
    }
  }

  /**
   * Increment the update check error notification count
   * Persists to disk for cross-session persistence
   */
  private incrementUpdateCheckErrorNotificationCount(): void {
    try {
      const current = this.getUpdateCheckErrorNotificationCount();
      const newCount = current + 1;

      this.#store.set("updateCheckErrorCount", {
        count: newCount,
        lastReset: Date.now(),
      });

      if (this.#logger) {
        this.#logger.info(
          `Update check error notification count: ${newCount}/${
            this.#MAX_UPDATE_CHECK_ERROR_NOTIFICATIONS
          }`,
        );
      }
    } catch (error) {
      if (this.#logger) {
        this.#logger.error(
          `Failed to increment update check error notification count: ${error}`,
        );
      }
    }
  }

  /**
   * Reset the update check error notification count
   * Called when a successful update check occurs (update found or no update available)
   */
  private resetUpdateCheckErrorNotificationCount(): void {
    try {
      const current = this.getUpdateCheckErrorNotificationCount();
      if (current > 0) {
        this.#store.set("updateCheckErrorCount", {
          count: 0,
          lastReset: Date.now(),
        });

        if (this.#logger) {
          this.#logger.info(
            "Reset update check error notification count (successful check occurred)",
          );
        }
      }
    } catch (error) {
      if (this.#logger) {
        this.#logger.error(
          `Failed to reset update check error notification count: ${error}`,
        );
      }
    }
  }

  /**
   * Broadcast event to all windows with type safety
   * Performance: Uses setImmediate to avoid blocking the main thread
   */
  private broadcastToAllWindows<T = unknown>(channel: string, data: T): void {
    // Performance: Defer to next tick to avoid blocking main thread during update operations
    setImmediate(() => {
      const allWindows = BrowserWindow.getAllWindows();
      let sentCount = 0;

      // Reduced logging - only log summary, not per-window details
      if (this.#logger) {
        this.#logger.info(
          `📡 Broadcasting ${channel} to ${allWindows.length} window(s)`,
        );
      }

      for (const window of allWindows) {
        if (window && !window.isDestroyed()) {
          try {
            window.webContents.send(channel, data);
            sentCount++;
          } catch {
            // Silently handle errors - toast system will handle missing events
          }
        }
      }

      if (this.#logger && sentCount === 0 && allWindows.length > 0) {
        this.#logger.warn(`⚠️ No windows received ${channel}`);
      }
    });
  }

  /**
   * Check if an error message indicates a network-related error
   */
  #isNetworkError(errorMessage: string): boolean {
    return (
      errorMessage.includes("ENOTFOUND") ||
      errorMessage.includes("ETIMEDOUT") ||
      errorMessage.includes("ECONNREFUSED") ||
      errorMessage.includes("Network Error") ||
      errorMessage.includes("net::ERR_INTERNET_DISCONNECTED") ||
      errorMessage.includes("timeout")
    );
  }

  /**
   * Show a dialog displaying the last update error with troubleshooting information
   * If no error exists, shows a message indicating no recent errors
   */
  showLastErrorDialog(): void {
    if (!this.#lastError) {
      dialog
        .showMessageBox({
          type: "info",
          title: "No Recent Errors",
          message: "No recent update errors",
          detail:
            "There are no recent update errors to display.\n\nIf you're experiencing issues, you can:\n• Check for updates from the Help menu\n• View release notes on GitHub\n• Check your internet connection",
          buttons: ["OK", "Check for Updates"],
        })
        .then((result) => {
          if (result.response === 1) {
            this.runAutoUpdater().catch((error) => {
              const errorMessage = this.formatErrorMessage(error);
              if (this.#logger) {
                this.#logger.error(
                  `Error checking for updates from error dialog: ${errorMessage}`,
                );
              } else {
                logger.error("Error checking for updates:", error);
              }
            });
          }
        });
      return;
    }

    const { message, timestamp, type } = this.#lastError;
    const timeAgo = this.formatTimeAgo(timestamp);

    const isDownloadError = type === "download";
    const title = isDownloadError
      ? "Update Download Failed"
      : "Update Check Issue";
    const mainMessage = isDownloadError
      ? "Failed to download the update"
      : "Unable to check for updates";

    const detail = isDownloadError
      ? `Last error occurred ${timeAgo}\n\n${message}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n⚠️ Possible causes:\n• Network connection interrupted during download\n• Download file was corrupted\n• Insufficient disk space\n• Firewall or antivirus blocking the download\n\n💡 What you can do:\n• Check your internet connection\n• Try downloading manually from GitHub\n• Ensure you have enough disk space\n• Temporarily disable antivirus/firewall\n• Try checking for updates again\n\nWould you like to download manually from GitHub?`
      : `Last error occurred ${timeAgo}\n\n${message}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nThis is not critical:\n• Your app will continue working normally\n• You can check manually later from Help menu\n• Automatic checks will retry periodically\n\nWould you like to view releases on GitHub?`;

    dialog
      .showMessageBox({
        type: isDownloadError ? "warning" : "info",
        title,
        message: mainMessage,
        detail,
        buttons: [
          "OK",
          isDownloadError ? "Download from GitHub" : "Open GitHub Releases",
          "Try Again",
        ],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      })
      .then((result) => {
        if (result.response === 1) {
          shell.openExternal(this.#GITHUB_RELEASES_URL);
        } else if (result.response === 2) {
          // Clear the error and try again
          this.#lastError = null;
          this.runAutoUpdater().catch((error) => {
            const errorMessage = this.formatErrorMessage(error);
            if (this.#logger) {
              this.#logger.error(
                `Error retrying update check: ${errorMessage}`,
              );
            } else {
              logger.error("Error retrying update check:", error);
            }
          });
        }
      })
      .catch((error) => {
        const errorMessage = this.formatErrorMessage(error);
        if (this.#logger) {
          this.#logger.error(
            `Error showing last error dialog: ${errorMessage}`,
          );
        } else {
          logger.error("Error showing last error dialog:", error);
        }
      });
  }

  /**
   * Format timestamp to human-readable "time ago" string
   */
  private formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;

    return date.toLocaleDateString();
  }

  /**
   * Run the auto-updater to check for available updates
   * Prevents race conditions by skipping if a check is already in progress
   * Uses caching to avoid redundant network requests (Performance: Phase 1.2)
   * Implements debouncing to prevent rapid checks (Performance: Phase 4.3)
   * Implements timeout and retry logic (Performance: Phase 2.1)
   * @returns Update check result or null if no update available or check skipped
   */
  async runAutoUpdater() {
    // Phase 4.3: Debounce rapid checks with pending promise tracking
    if (this.#checkDebounceTimer) {
      clearTimeout(this.#checkDebounceTimer);
      this.#checkDebounceTimer = null;
    }

    return new Promise((resolve, reject) => {
      // Track this promise to resolve/reject all pending calls together
      this.#pendingCheckPromises.push({ resolve, reject });

      this.#checkDebounceTimer = setTimeout(async () => {
        try {
          const result = await this.performUpdateCheck();
          // Resolve all pending promises with the same result
          this.#pendingCheckPromises.forEach((p) => p.resolve(result));
        } catch (error) {
          // Reject all pending promises with the same error
          this.#pendingCheckPromises.forEach((p) => p.reject(error));
        } finally {
          // Clear pending promises and timer
          this.#pendingCheckPromises = [];
          this.#checkDebounceTimer = null;
        }
      }, this.#DEBOUNCE_DELAY);
    });
  }

  /**
   * Perform the actual update check with timeout and retry logic
   * (Performance: Phase 2.1 - Request Timeout & Retry)
   * @returns Update check result or null
   */
  private async performUpdateCheck() {
    // Prevent race conditions: skip if already checking
    if (this.#isCheckingForUpdates) {
      if (this.#logger) {
        this.#logger.info("Update check already in progress, skipping...");
      }
      return null;
    }

    // Check cache first (Performance: Phase 1.2 - Update Check Caching)
    if (this.#lastCheckTime && this.#lastCheckResult) {
      const cacheAge = Date.now() - this.#lastCheckTime;
      if (cacheAge < this.#CACHE_DURATION) {
        if (this.#logger) {
          this.#logger.info(
            `Using cached update check (${Math.floor(
              cacheAge / 1000,
            )}s old, version: ${this.#lastCheckResult.version})`,
          );
        }
        // Return null to indicate cached result - no network request needed
        // The cached result was already broadcast via update-available event if available
        return null;
      }
    }

    this.#isCheckingForUpdates = true;
    const checkStartTime = Date.now();

    try {
      // Phase 2.1: Retry logic with timeout
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= this.#MAX_RETRIES; attempt++) {
        try {
          const updater = this.getAutoUpdater();
          // Note: Listeners are set up once in enable(), not on every check
          // Just configure updater settings here

          // Phase 2.1: Add timeout wrapper
          const checkPromise = updater.checkForUpdates();
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error("Update check timeout"));
            }, this.#REQUEST_TIMEOUT);
          });

          const result = await Promise.race([checkPromise, timeoutPromise]);
          const checkDuration = Date.now() - checkStartTime;

          // Reset error notification count on successful update check
          this.resetUpdateCheckErrorNotificationCount();

          // Cache successful result (Performance: Phase 1.2)
          if (result?.updateInfo) {
            const currentVersion = app.getVersion();
            const newVersion = result.updateInfo.version;

            // Update available - we're not on latest
            this.#isOnLatestVersion = false;

            // Invalidate cache if version changed from last check
            if (
              this.#lastCheckResult?.version &&
              this.#lastCheckResult.version !== newVersion
            ) {
              if (this.#logger) {
                this.#logger.info(
                  `Version changed from ${
                    this.#lastCheckResult.version
                  } to ${newVersion}, invalidating cache`,
                );
              }
              this.#lastCheckTime = null;
              this.#lastCheckResult = null;
            }

            this.#lastCheckResult = {
              version: newVersion,
              timestamp: Date.now(),
            };
            this.#lastCheckTime = Date.now();

            if (this.#logger) {
              this.#logger.info(
                `Update check completed in ${checkDuration}ms (attempt ${attempt}/${
                  this.#MAX_RETRIES
                }), cached for ${Math.floor(
                  this.#CACHE_DURATION / 60000,
                )} minutes`,
              );
            }
          } else {
            // No update available - we're on the latest version
            this.#isOnLatestVersion = true;
            // Cache "no update" result too
            this.#lastCheckTime = Date.now();
            this.#lastCheckResult = {
              version: app.getVersion(),
              timestamp: Date.now(),
            };
          }

          if (result === null) {
            return null;
          }

          return result;
        } catch (error) {
          lastError = error as Error;
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          // Handle expected errors (don't retry)
          // These are not actual errors - they mean no update is available
          // This is a successful check confirming we're on the latest version
          if (
            errorMessage.includes("No published versions") ||
            errorMessage.includes("Cannot find latest") ||
            errorMessage.includes("No updates available")
          ) {
            // Mark that we're on the latest version
            this.#isOnLatestVersion = true;
            // Reset error notification count on successful check (no update available)
            this.resetUpdateCheckErrorNotificationCount();
            return null;
          }

          // Handle network errors (retry)
          if (
            errorMessage.includes("ENOTFOUND") ||
            errorMessage.includes("ETIMEDOUT") ||
            errorMessage.includes("ECONNREFUSED") ||
            errorMessage.includes("timeout")
          ) {
            if (attempt < this.#MAX_RETRIES) {
              const retryDelay = this.#RETRY_DELAY * attempt; // Exponential backoff
              if (this.#logger) {
                this.#logger.warn(
                  `Update check failed (attempt ${attempt}/${
                    this.#MAX_RETRIES
                  }): ${errorMessage}. Retrying in ${retryDelay}ms...`,
                );
              }
              await new Promise((resolve) => setTimeout(resolve, retryDelay));
              continue;
            }
          }

          // If we've exhausted retries or it's not a retryable error, throw
          if (attempt === this.#MAX_RETRIES) {
            if (this.#logger) {
              this.#logger.error(
                `Update check failed after ${this.#MAX_RETRIES} attempts: ${errorMessage}`,
              );
            }
            throw lastError || new Error("Update check failed after retries");
          }
        }
      }

      // Should never reach here, but TypeScript needs it
      throw lastError || new Error("Update check failed");
    } finally {
      this.#isCheckingForUpdates = false;
    }
  }

  private removeUpdateListeners(updater: AppUpdater): void {
    for (const { event, listener } of this.#updateListeners) {
      updater.off(event as any, listener);
    }
    this.#updateListeners = [];
  }

  private setupUpdateListeners(updater: AppUpdater): void {
    // Remove existing listeners first to prevent duplicates
    this.removeUpdateListeners(updater);

    const onUpdateAvailable = (info: UpdateInfo) => {
      // Validate update info
      if (!info || !info.version) {
        if (this.#logger) {
          this.#logger.warn("Received invalid update info, ignoring");
        }
        return;
      }

      if (this.#logger) {
        this.#logger.info(
          `🔔 Update available: ${info.version} (current: ${app.getVersion()})`,
        );
      }

      // Reset error notification count on successful update check
      this.resetUpdateCheckErrorNotificationCount();

      // Update is available - user is NOT on latest version
      this.#isOnLatestVersion = false;

      // Store the update info so it can be retrieved for postpone/download actions
      // If this is a different version than previously postponed, clear the postpone state
      if (
        this.#postponedUpdateInfo &&
        this.#postponedUpdateInfo.version !== info.version
      ) {
        // New version available, reset postpone state
        this.#postponedUpdateInfo = null;
        this.#postponeCount = 0;
        if (this.#remindLaterTimeout) {
          clearTimeout(this.#remindLaterTimeout);
          this.#remindLaterTimeout = null;
        }
      }

      // Store current available update info (even if not postponed yet)
      if (!this.#postponedUpdateInfo) {
        this.#postponedUpdateInfo = info;
      }

      // Initialize download state with version for resume capability
      if (!this.#downloadState) {
        this.#downloadState = {
          downloadedBytes: 0,
          totalBytes: 0,
          version: info.version,
        };
      } else {
        this.#downloadState.version = info.version;
      }

      // Broadcast to renderer for toast notification
      this.broadcastToAllWindows<UpdateInfo>("update:available", {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
        files: info.files,
        path: info.path,
        sha512: info.sha512,
        releaseName: info.releaseName,
        stagingPercentage: info.stagingPercentage,
      });

      // Keep dialog as fallback (can be removed later)
      // this.showUpdateAvailableDialog(info, false);
    };
    updater.on("update-available", onUpdateAvailable);
    this.#updateListeners.push({
      event: "update-available",
      listener: onUpdateAvailable,
    });

    const onUpdateNotAvailable = () => {
      // Log that no update is available (useful for debugging)
      if (this.#logger) {
        this.#logger.info("No update available - app is up to date");
      }
      // Mark that we're on the latest version - successful check
      this.#isOnLatestVersion = true;
      // Reset error notification count on successful check (even if no update)
      this.resetUpdateCheckErrorNotificationCount();
      // Optionally broadcast to renderer if needed for UI feedback
      // this.broadcastToAllWindows("update:not-available");
    };
    updater.on("update-not-available", onUpdateNotAvailable);
    this.#updateListeners.push({
      event: "update-not-available",
      listener: onUpdateNotAvailable,
    });

    const onDownloadProgress = (progressInfo: ProgressInfo) => {
      // Log differential update status on first progress event
      if (
        progressInfo.total &&
        progressInfo.transferred === 0 &&
        this.#logger
      ) {
        const totalMB = (progressInfo.total / (1024 * 1024)).toFixed(2);
        // If total size is close to full installer size (>100MB), likely full download
        // Differential updates are typically much smaller (<50MB for most changes)
        const isLikelyFullDownload = progressInfo.total > 100 * 1024 * 1024;
        this.#logger.info(
          `Download started: ${totalMB} MB total${
            isLikelyFullDownload
              ? " (likely full installer - differential may not be available)"
              : " (differential update)"
          }`,
        );
      }

      // Track download progress for resume and persist to disk
      if (progressInfo.total && progressInfo.transferred) {
        if (
          !this.#downloadState ||
          this.#downloadState.totalBytes !== progressInfo.total
        ) {
          this.#downloadState = {
            downloadedBytes: progressInfo.transferred,
            totalBytes: progressInfo.total,
            version: this.#downloadState?.version || "",
          };
        } else {
          this.#downloadState.downloadedBytes = progressInfo.transferred;
        }
        this.saveDownloadState(this.#downloadState);
      }

      // Broadcast progress to renderer
      if (progressInfo.total && progressInfo.transferred) {
        this.broadcastToAllWindows<{
          percent: number;
          transferred: number;
          total: number;
          bytesPerSecond: number;
        }>("update:download-progress", {
          percent: progressInfo.percent,
          transferred: progressInfo.transferred,
          total: progressInfo.total,
          bytesPerSecond: progressInfo.bytesPerSecond || 0,
        });
      }

      // Log progress for debugging
      if (this.#logger) {
        this.#logger.info(
          `Download progress: ${progressInfo.percent.toFixed(2)}% (${
            progressInfo.transferred
          }/${progressInfo.total})`,
        );
      }

      // Show a notification at ~50% progress (only once)
      if (
        !this.#hasShownProgressNotification &&
        progressInfo.percent > this.#PROGRESS_NOTIFICATION_THRESHOLD &&
        progressInfo.percent < this.#PROGRESS_NOTIFICATION_THRESHOLD + 5 &&
        Notification.isSupported()
      ) {
        this.#hasShownProgressNotification = true;
        new Notification({
          title: "Download In Progress",
          body: `Update download is ${progressInfo.percent.toFixed(0)}% complete...`,
          silent: true,
        }).show();
      }
    };
    updater.on("download-progress", onDownloadProgress);
    this.#updateListeners.push({
      event: "download-progress",
      listener: onDownloadProgress,
    });

    const onUpdateDownloaded = (info: UpdateInfo) => {
      this.setDownloading(false);
      const downloadDuration = this.#downloadStartTime
        ? Date.now() - this.#downloadStartTime
        : 0;
      const downloadDurationSeconds = downloadDuration
        ? (downloadDuration / 1000).toFixed(0)
        : "unknown";
      this.#downloadStartTime = null;

      // Phase 4.1: Clear download state after successful download
      this.#downloadState = null;
      this.saveDownloadState(null);

      // Store downloaded update info
      this.#downloadedUpdateInfo = info;

      if (this.#logger) {
        this.#logger.info(
          `Update downloaded successfully in ${downloadDurationSeconds}s`,
        );
      }
      if (this.#remindLaterTimeout) {
        clearTimeout(this.#remindLaterTimeout);
        this.#remindLaterTimeout = null;
      }
      this.#postponedUpdateInfo = null;
      this.#postponeCount = 0;

      const newVersion = info.version;

      // Broadcast to renderer for toast notification
      this.broadcastToAllWindows<UpdateInfo>("update:downloaded", {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
        files: info.files,
        path: info.path,
        sha512: info.sha512,
        releaseName: info.releaseName,
        stagingPercentage: info.stagingPercentage,
      });

      // Optional: Show system notification (non-blocking)
      if (Notification.isSupported()) {
        const notification = new Notification({
          title: "Update Ready",
          body: `aurswift ${newVersion} is ready to install. Click the notification to install now.`,
          silent: false,
        });

        notification.on("click", () => {
          // Trigger install via IPC
          this.broadcastToAllWindows<null>("update:install-request", null);
        });

        notification.show();
      }
    };
    updater.on("update-downloaded", onUpdateDownloaded);
    this.#updateListeners.push({
      event: "update-downloaded",
      listener: onUpdateDownloaded,
    });

    const onError = (error: Error) => {
      const errorMessage = this.formatErrorMessage(error);

      // Check if this is a cancellation (cancelled downloads may trigger error event)
      const isCancellation =
        errorMessage.includes("cancelled") ||
        errorMessage.includes("canceled") ||
        errorMessage.includes("CancellationToken") ||
        this.#downloadCancellationToken?.cancelled === true;

      // Reset download state on error (unless it's a cancellation - already handled)
      const wasDownloading = this.#isDownloading;
      if (!isCancellation) {
        this.setDownloading(false);
      }

      // If cancelled, don't process as error - cancellation is already handled
      if (isCancellation) {
        if (this.#logger) {
          this.#logger.info("Download was cancelled");
        }
        return;
      }

      // Phase 4.1: Keep download state for resume (don't clear on error)
      // The download state is preserved so user can retry and resume

      // Check if this is a download error
      const isDownloadError =
        wasDownloading ||
        errorMessage.includes("download") ||
        errorMessage.includes("Downloaded file") ||
        errorMessage.includes("sha512") ||
        errorMessage.includes("checksum") ||
        errorMessage.includes("verification failed") ||
        errorMessage.toLowerCase().includes("corrupt");

      // Store the error for later viewing
      this.#lastError = {
        message: errorMessage,
        timestamp: new Date(),
        type: isDownloadError ? "download" : "check",
      };

      // Broadcast error to renderer for toast notification
      // For download errors, always broadcast. For check errors, only if under limit (already checked above)
      // Note: The count check and latest version check happen above before we get here
      this.broadcastToAllWindows<{
        message: string;
        type: "download" | "check" | "install";
        timestamp: Date;
      }>("update:error", {
        message: errorMessage,
        type: isDownloadError ? "download" : "check",
        timestamp: new Date(),
      });

      if (this.#logger) {
        this.#logger.error(
          `Update error (${this.#lastError.type}): ${errorMessage}`,
        );
      }

      // Determine if we should skip notifications/dialogs
      // Skip if:
      // 1. Error indicates no updates available (successful check, not a failure)
      // 2. User is on latest version and it's just a network error (best practice: don't annoy users)
      // 3. Development mode
      const isNoUpdateAvailable =
        errorMessage.includes("No published versions") ||
        errorMessage.includes("Cannot find latest") ||
        errorMessage.includes("No updates available");
      const isNetworkError = this.#isNetworkError(errorMessage);

      // Best practice: If user is on latest version and it's just a network error,
      // don't show notifications (they don't need updates anyway)
      const shouldSkipDueToLatestVersion =
        this.#isOnLatestVersion && isNetworkError && !isDownloadError;

      const shouldSkipDialog =
        isNoUpdateAvailable ||
        shouldSkipDueToLatestVersion ||
        process.env.NODE_ENV !== "production";

      // If this is "no update available", it's not actually an error - successful check
      // Don't count it, don't broadcast, don't show UI
      if (isNoUpdateAvailable) {
        // Mark that we're on the latest version (successful check)
        this.#isOnLatestVersion = true;
        // Reset error notification count since this is a successful check
        this.resetUpdateCheckErrorNotificationCount();
        if (this.#logger) {
          this.#logger.info(
            "No update available - this is a successful check, not an error",
          );
        }
        return;
      }

      // For check errors, check notification count limit and latest version status
      if (!isDownloadError) {
        // Best practice: If on latest version and network error, don't notify
        // (user doesn't need updates, so check failure isn't critical)
        if (shouldSkipDueToLatestVersion) {
          if (this.#logger) {
            this.#logger.info(
              "Skipping update check error notification (user is on latest version, network error not critical)",
            );
          }
          return;
        }

        const currentCount = this.getUpdateCheckErrorNotificationCount();

        // Only show notification if we haven't exceeded the limit
        if (currentCount >= this.#MAX_UPDATE_CHECK_ERROR_NOTIFICATIONS) {
          if (this.#logger) {
            this.#logger.info(
              `Skipping update check error notification (limit reached: ${currentCount}/${
                this.#MAX_UPDATE_CHECK_ERROR_NOTIFICATIONS
              })`,
            );
          }
          // Don't broadcast to renderer, don't show UI - silently log the error
          return;
        }

        // Increment counter after checking (before showing notification)
        // This ensures we show exactly MAX_UPDATE_CHECK_ERROR_NOTIFICATIONS times
        this.incrementUpdateCheckErrorNotificationCount();
      }

      if (!shouldSkipDialog) {
        // Per-error-type cooldown for better error notification management
        const now = Date.now();
        const ERROR_NOTIFICATION_COOLDOWN = 60 * 1000; // 1 minute
        const errorType = isDownloadError ? "download" : "check";
        const lastNotification =
          this.#lastErrorNotifications.get(errorType) || 0;
        const timeSinceLastError = now - lastNotification;

        if (timeSinceLastError < ERROR_NOTIFICATION_COOLDOWN) {
          if (this.#logger) {
            this.#logger.info(
              `Skipping ${errorType} error UI (cooldown active: ${Math.floor(
                timeSinceLastError / 1000,
              )}s)`,
            );
          }
          return;
        }
        this.#lastErrorNotifications.set(errorType, now);

        if (this.#isNetworkError(errorMessage) && !isDownloadError) {
          // For network check errors, show a persistent notification instead of dialog
          if (Notification.isSupported()) {
            const notification = new Notification({
              title: "Update Check Failed",
              body: "Couldn't check for updates. Click to view details or check Help menu.",
              silent: false,
              urgency: "low",
              timeoutType: "never", // Keep notification visible
            });

            notification.on("click", () => {
              this.showLastErrorDialog();
            });

            notification.show();
          }
          return;
        }

        // Show different dialog based on error type
        const title = isDownloadError
          ? "Update Download Failed"
          : "Update Check Issue";
        const message = isDownloadError
          ? "Failed to download the update"
          : "Unable to check for updates at this time";

        const detail = isDownloadError
          ? `The update download encountered an issue:\n\n${errorMessage}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n⚠️ Possible causes:\n• Network connection interrupted during download\n• Download file was corrupted\n• Insufficient disk space\n• Firewall or antivirus blocking the download\n\n💡 What you can do:\n• Check your internet connection\n• Try downloading manually from GitHub\n• Ensure you have enough disk space\n• Temporarily disable antivirus/firewall\n• View this error later from Help → View Update Error\n• The app will retry on next launch\n\nWould you like to download manually from GitHub?`
          : `The update check encountered an issue:\n\n${errorMessage}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nThis is not critical:\n• Your app will continue working normally\n• You can check manually later from Help menu\n• View this error later from Help → View Update Error\n• Automatic checks will retry in 4 hours\n\nWould you like to view releases on GitHub?`;

        // Show the dialog
        dialog
          .showMessageBox({
            type: isDownloadError ? "warning" : "info",
            title,
            message,
            detail,
            buttons: [
              "OK",
              isDownloadError ? "Download from GitHub" : "Open GitHub Releases",
            ],
            defaultId: 0,
            cancelId: 0,
            noLink: true,
          })
          .then((result) => {
            if (result.response === 1) {
              shell.openExternal(this.#GITHUB_RELEASES_URL);
            }
          })
          .catch((error) => {
            const errorMessage = this.formatErrorMessage(error);
            if (this.#logger) {
              this.#logger.error(`Error showing error dialog: ${errorMessage}`);
            } else {
              logger.error("Error showing error dialog:", error);
            }
          });

        // Also show a persistent notification for download errors
        if (isDownloadError && Notification.isSupported()) {
          const errorNotification = new Notification({
            title: "⚠️ Update Download Failed",
            body: "Click here to view error details and solutions, or check Help → View Update Error",
            silent: false,
            urgency: "critical",
            timeoutType: "never", // Keep notification visible until clicked
          });

          errorNotification.on("click", () => {
            this.showLastErrorDialog();
          });

          // Show notification after a brief delay so it doesn't conflict with dialog
          setTimeout(() => {
            errorNotification.show();
          }, 500);
        }
      }
    };
    updater.on("error", onError);
    this.#updateListeners.push({ event: "error", listener: onError });
  }

  /**
   * Download update with resume capability (Phase 4.1)
   * @param updater - The AppUpdater instance
   * @param version - The version being downloaded
   */
  private downloadWithResume(updater: AppUpdater, version: string): void {
    try {
      // Create new cancellation token for this download
      this.#downloadCancellationToken = new CancellationToken();

      // Check for partial download to resume
      if (
        this.#downloadState &&
        this.#downloadState.version === version &&
        this.#downloadState.downloadedBytes > 0 &&
        this.#downloadState.downloadedBytes < this.#downloadState.totalBytes
      ) {
        if (this.#logger) {
          this.#logger.info(
            `Resuming download: ${this.#downloadState.downloadedBytes}/${
              this.#downloadState.totalBytes
            } bytes (${Math.floor(
              (this.#downloadState.downloadedBytes /
                this.#downloadState.totalBytes) *
                100,
            )}%)`,
          );
        }
        // Note: electron-updater handles resume automatically via Squirrel
        // We track state for logging and potential future manual resume
      } else {
        if (this.#logger) {
          this.#logger.info("Starting new download");
        }
      }

      // Start/resume download with cancellation token - wrap in try-catch for synchronous errors
      try {
        updater.downloadUpdate(this.#downloadCancellationToken);
      } catch (downloadError) {
        // Clear cancellation token on synchronous error
        this.#downloadCancellationToken = null;
        this.setDownloading(false);
        throw downloadError;
      }
    } catch (error) {
      const errorMessage = this.formatErrorMessage(error);
      this.#isDownloading = false;
      this.#downloadCancellationToken = null;
      if (this.#logger) {
        this.#logger.error(`Failed to start download: ${errorMessage}`);
      }
      // Error will be handled by onError listener, but rethrow for caller awareness
      throw error;
    }
  }
}

export function autoUpdater(
  ...args: ConstructorParameters<typeof AutoUpdater>
) {
  return new AutoUpdater(...args);
}
