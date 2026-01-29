// Load environment variables
import dotenv from "dotenv";
dotenv.config();

import type { AppInitConfig } from "./AppInitConfig.js";
import { createModuleRunner } from "./ModuleRunner.js";
import { disallowMultipleAppInstance } from "./modules/SingleInstanceApp.js";
import { createWindowManagerModule } from "./modules/WindowManager.js";
import { terminateAppOnLastWindowClose } from "./modules/ApplicationTerminatorOnLastWindowClose.js";
import { autoUpdater } from "./modules/AutoUpdater.js";
import { allowInternalOrigins } from "./modules/BlockNotAllowdOrigins.js";
import { allowExternalUrls } from "./modules/ExternalUrls.js";
import { getDatabase } from "./database/index.js";
import { registerVatCategoryIpc } from "./services/vatCategoryService.js";
import { registerBookerImportHandlers } from "./ipc/bookerImportHandlers.js";
import { registerLoggerHandlers } from "./ipc/loggerHandlers.js";
import { registerAllIpcHandlers } from "./ipc/index.js";
import { getLogger } from "./utils/logger.js";
import {
  shouldMigrateLogPath,
  migrateLogsFromOldPath,
} from "./utils/log-path-migration.js";
import { emailService } from "./services/email-service.js";
import { ExpiryNotificationService } from "./services/expiryNotificationService.js";

const logger = getLogger("app-init");

// ============================================================================
// SECURITY NOTE
// ============================================================================
// Admin fallback has been removed for security.
// Admin users must have "*:*" permission in their role to access all resources.
// This ensures proper RBAC enforcement and auditability.

// Global reference to autoUpdater instance for menu access
let autoUpdaterInstance: ReturnType<typeof autoUpdater> | null = null;

// Store pending system notifications to send when window is ready
let pendingSystemNotifications: Array<{ type: string; message: string }> = [];

export function getAutoUpdaterInstance() {
  return autoUpdaterInstance;
}

/**
 * Queue a system notification to be sent to renderer when window is ready
 */
export function queueSystemNotification(type: string, message: string) {
  pendingSystemNotifications.push({ type, message });
}

/**
 * Get and clear pending system notifications
 */
export function getPendingSystemNotifications() {
  const notifications = [...pendingSystemNotifications];
  pendingSystemNotifications = []; // Clear after reading
  return notifications;
}

export async function initApp(initConfig: AppInitConfig) {
  // Register all IPC handlers (must be done before database operations)
  registerAllIpcHandlers();

  // Register additional service-specific handlers
  registerLoggerHandlers();
  registerVatCategoryIpc();
  registerBookerImportHandlers();

  // ========================================
  // LOG PATH MIGRATION: Move logs from Roaming to Local
  // ========================================
  // This should be done early, before logger is used extensively
  // But after IPC handlers are registered so logger can be used
  if (shouldMigrateLogPath()) {
    logger.info("📦 Detected logs in old location (Roaming profile)");
    logger.info("🔧 Attempting to migrate logs to Local profile...");

    const migrationResult = await migrateLogsFromOldPath(false); // Don't remove old yet

    if (migrationResult.migrated) {
      logger.info("✅ Logs migrated successfully!");
      logger.info(`   Old location: ${migrationResult.oldPath}`);
      logger.info(`   New location: ${migrationResult.newPath}`);
      logger.info(`   Files moved: ${migrationResult.filesMoved || 0}`);
    } else {
      const errorMessage =
        migrationResult.reason || "Unknown error during log migration";
      logger.warn("⚠️  Log migration failed:", errorMessage);
      logger.warn(
        "   Old logs preserved at:",
        migrationResult.oldPath || "unknown location"
      );
      // Don't fail app initialization for log migration - logs are not critical
    }
  }

  // Initialize database
  const db = await getDatabase();

  // Load hardware services in parallel - they're independent
  await Promise.all([
    import("./services/thermalPrinterService.js"),
    import("./services/officePrinterService.js"),
    import("./services/pdfReceiptService.js"),
    import("./services/paymentService.js"),
    import("./services/scaleService.js"),
    import("./services/vivaWallet/index.js"),
  ]);

  // Initialize email service in console mode at startup.
  // We load Gmail credentials per-business (businessId) at send time.
  const emailInitResult = await emailService.initialize({
    provider: "console",
    fromEmail: "no-reply@aurswift.local",
    fromName: "AurSwift POS",
  });

  // Queue notification if email service is degraded
  if (emailInitResult.degraded && emailInitResult.message) {
    queueSystemNotification("warning", emailInitResult.message);
  }

  // Initialize expiry notification service
  const expiryService = new ExpiryNotificationService(db);

  // Helper function to handle auto-closing shifts and clocking out TimeShifts
  const handleAutoCloseShifts = async () => {
    try {
      const closedShifts = db.shifts.autoCloseOldActiveShifts();

      if (closedShifts.length > 0) {
        // Group closed shifts by timeShiftId to check if we need to clock out
        const timeShiftGroups = new Map<
          string,
          Array<{ id: string; cashierId: string }>
        >();

        for (const closedShift of closedShifts) {
          if (
            closedShift.timeShiftId &&
            closedShift.timeShiftId.trim() !== ""
          ) {
            if (!timeShiftGroups.has(closedShift.timeShiftId)) {
              timeShiftGroups.set(closedShift.timeShiftId, []);
            }
            timeShiftGroups.get(closedShift.timeShiftId)!.push({
              id: closedShift.id,
              cashierId: closedShift.cashierId,
            });
          }
        }

        // For each TimeShift, check if all POS shifts are now closed
        for (const [
          timeShiftId,
          closedPosShifts,
        ] of timeShiftGroups.entries()) {
          const remainingActiveShifts =
            db.shifts.getActiveShiftsByTimeShift(timeShiftId);

          if (remainingActiveShifts.length === 0) {
            // All POS shifts for this TimeShift are closed, clock out TimeShift
            const timeShift = db.timeTracking.getShiftById(timeShiftId);
            if (timeShift && timeShift.status === "active") {
              // Validate cashierId before clock-out
              const cashierId = closedPosShifts[0]?.cashierId;
              if (!cashierId) {
                logger.error(
                  `Cannot clock out TimeShift ${timeShiftId}: closed shifts have no cashierId`
                );
              } else {
                try {
                  // End any active breaks
                  const activeBreak =
                    db.timeTracking.getActiveBreak(timeShiftId);
                  if (activeBreak) {
                    await db.timeTracking.endBreak(activeBreak.id);
                  }

                  // Create clock-out event
                  const clockOutEvent = await db.timeTracking.createClockEvent({
                    userId: cashierId,
                    businessId: timeShift.business_id, // ✅ REQUIRED: Get from shift
                    terminalId: "system",
                    type: "out",
                    method: "auto",
                    notes: "Auto clock-out: All POS shifts auto-closed",
                  });

                  // Complete the TimeShift
                  await db.timeTracking.completeShift(
                    timeShiftId,
                    clockOutEvent.id
                  );

                  logger.info(
                    `Auto clocked out TimeShift ${timeShiftId} after all POS shifts were auto-closed`
                  );
                } catch (error) {
                  logger.error(
                    `Failed to clock out TimeShift ${timeShiftId} after auto-closing shifts`,
                    error
                  );
                }
              }
            }
          }
        }

        logger.info(
          `Auto-closed ${closedShifts.length} old shift(s), processed ${timeShiftGroups.size} time shift group(s)`
        );
      }
    } catch (error) {
      logger.error("Error during auto-close shifts", error);
    }
  };

  const handleAutoCompleteSchedules = () => {
    try {
      const completedCount = db.schedules.autoCompleteExpiredSchedules(30);
      if (completedCount > 0) {
        logger.info(
          `[Schedule Auto-Complete] Marked ${completedCount} expired schedule(s) as completed`
        );
      }
    } catch (error) {
      logger.error("Error during auto-complete schedules", error);
    }
  };

  // Clean up expired sessions on startup
  try {
    const cleanedCount = db.sessions.cleanupExpiredSessions();
    if (cleanedCount > 0) {
      logger.info(
        `[Session Cleanup] Removed ${cleanedCount} expired session(s) on startup`
      );
    }
  } catch (error) {
    logger.error("Error during startup session cleanup", error);
  }

  // Set up periodic cleanup of old unclosed shifts and expired schedules
  // Run cleanup every 30 minutes
  const cleanupInterval = setInterval(() => {
    handleAutoCloseShifts();
    handleAutoCompleteSchedules();
  }, 30 * 60 * 1000); // 30 minutes

  // Set up periodic session cleanup
  // Run cleanup every hour to remove expired sessions
  const sessionCleanupInterval = setInterval(() => {
    try {
      const cleanedCount = db.sessions.cleanupExpiredSessions();
      if (cleanedCount > 0) {
        logger.info(
          `[Session Cleanup] Removed ${cleanedCount} expired session(s)`
        );
      }
    } catch (error) {
      logger.error("Error during periodic session cleanup", error);
    }
  }, 60 * 60 * 1000); // 1 hour

  // Set up daily expiry checks and notifications
  // Run expiry checks every 6 hours
  const expiryCheckInterval = setInterval(async () => {
    try {
      // Process expiry tasks for all businesses
      // In a multi-tenant system, you'd iterate through businesses
      // For now, we'll process when explicitly called via IPC
      logger.debug("Expiry check scheduled (use IPC to trigger)");
    } catch (error) {
      logger.error("Error during expiry check", error);
    }
  }, 6 * 60 * 60 * 1000); // 6 hours

  // Clean up on app exit
  process.on("exit", () => {
    clearInterval(cleanupInterval);
    clearInterval(sessionCleanupInterval);
    clearInterval(expiryCheckInterval);
  });

  // Run cleanup immediately on startup
  handleAutoCloseShifts();

  // Run initial expiry check on startup
  try {
    // Auto-update expired batches for all businesses
    await db.batches.autoUpdateExpiredBatches();
  } catch (error) {
    logger.error("Error during startup expiry check", error);
  }

  const moduleRunner = createModuleRunner()
    .init(
      createWindowManagerModule({
        initConfig,
        // DevTools disabled
        openDevTools: true,
      })
    )
    .init(disallowMultipleAppInstance())
    .init(terminateAppOnLastWindowClose());
  // Note: Hardware acceleration is disabled in entry-point.mjs before app.ready

  // Only enable auto-updater in production, not in test or development
  if (
    process.env.NODE_ENV !== "test" &&
    !process.env.ELECTRON_UPDATER_DISABLED
  ) {
    autoUpdaterInstance = autoUpdater();
    moduleRunner.init(autoUpdaterInstance);
  }
  // Install DevTools extension if needed
  // .init(chromeDevToolsExtension({extension: 'VUEJS3_DEVTOOLS'}))

  moduleRunner
    // Security
    .init(
      allowInternalOrigins(
        new Set(
          initConfig.renderer instanceof URL ? [initConfig.renderer.origin] : []
        )
      )
    )
    .init(
      allowExternalUrls(
        new Set(
          initConfig.renderer instanceof URL
            ? [
                "https://vite.dev",
                "https://developer.mozilla.org",
                "https://solidjs.com",
                "https://qwik.dev",
                "https://lit.dev",
                "https://react.dev",
                "https://preactjs.com",
                "https://www.typescriptlang.org",
                "https://vuejs.org",
              ]
            : []
        )
      )
    );

  await moduleRunner;
}
