/**
 * Database Recovery Dialogs
 *
 * Layer 4: User Communication & Decision Making
 * Provides user-friendly dialogs for database recovery scenarios.
 */

import { dialog, app } from "electron";
import path from "path";
import fs from "fs";

import { getLogger } from "../../utils/logger.js";
const logger = getLogger("db-recovery-dialog");

export type RecoveryAction =
  | "backup-and-fresh"
  | "repair"
  | "restore-backup"
  | "cancel";

export interface RecoveryDialogOptions {
  title: string;
  message: string;
  detail?: string;
  backupPath?: string;
  showRepairOption?: boolean;
  showRestoreOption?: boolean;
}

/**
 * Show database recovery dialog
 *
 * @param options - Dialog options
 * @returns User's selected action
 */
export async function showRecoveryDialog(
  options: RecoveryDialogOptions
): Promise<RecoveryAction> {
  const {
    title,
    message,
    detail,
    backupPath,
    showRepairOption,
    showRestoreOption,
  } = options;

  // Skip dialog in test/CI mode - app may not be ready
  const isTestMode =
    process.env.PLAYWRIGHT_TEST === "true" ||
    process.env.CI === "true" ||
    process.env.NODE_ENV === "test";

  if (isTestMode) {
    logger.warn(`[TEST MODE] ${title}: ${message}`);
    if (detail) {
      logger.warn(`[TEST MODE] Detail: ${detail}`);
    }
    // In test mode, automatically use the recommended action
    return "backup-and-fresh";
  }

  // Only show dialog if app is ready
  if (!app.isReady()) {
    logger.warn(`${title}: ${message}`);
    if (detail) {
      logger.warn(`Detail: ${detail}`);
    }
    logger.warn(
      "⚠️  App not ready, using default recovery action: backup-and-fresh"
    );
    return "backup-and-fresh";
  }

  // Build detail message with backup location if available
  let detailMessage = detail || "";

  if (backupPath && fs.existsSync(backupPath)) {
    const backupDir = path.dirname(backupPath);
    const backupName = path.basename(backupPath);
    detailMessage += `\n\nBackup location: ${backupDir}\nBackup file: ${backupName}`;
  }

  // Build buttons array
  const buttons: string[] = [];
  const cancelId = 2; // Index of cancel button

  if (showRestoreOption && backupPath) {
    buttons.push("Restore from Backup");
  }

  buttons.push("Backup & Start Fresh"); // Recommended option (index 0)
  buttons.push("Cancel");

  if (showRepairOption) {
    buttons.splice(1, 0, "Try Repair"); // Insert before "Cancel"
  }

  // Determine default button (first button is recommended)
  const defaultId = 0;

  try {
    const result = await dialog.showMessageBox({
      type: "warning",
      title,
      message,
      detail: detailMessage,
      buttons,
      defaultId,
      cancelId,
      noLink: true,
    });

    const buttonIndex = result.response;
    const buttonText = buttons[buttonIndex];

    if (buttonText === "Backup & Start Fresh") {
      return "backup-and-fresh";
    } else if (buttonText === "Try Repair") {
      return "repair";
    } else if (buttonText === "Restore from Backup") {
      return "restore-backup";
    } else {
      return "cancel";
    }
  } catch (error) {
    logger.error("Error showing recovery dialog:", error);
    return "cancel";
  }
}

/**
 * Show database too old dialog
 */
export async function showDatabaseTooOldDialog(
  backupPath?: string
): Promise<RecoveryAction> {
  return showRecoveryDialog({
    title: "⚠️  Incompatible Database Detected",
    message: "Your database cannot be automatically migrated.",
    detail:
      "Your database was created with a very old version of aurswift " +
      "and cannot be automatically migrated to the current version.\n\n" +
      "We recommend creating a backup of your current database and starting fresh. " +
      "Your old database will be preserved and can be manually inspected if needed.",
    backupPath,
    showRepairOption: false,
    showRestoreOption: false,
  });
}

/**
 * Show corrupted database dialog
 */
export async function showCorruptedDatabaseDialog(
  backupPath?: string
): Promise<RecoveryAction> {
  return showRecoveryDialog({
    title: "⚠️  Database Corruption Detected",
    message: "Your database appears to be corrupted.",
    detail:
      "Automatic repair attempts failed. Your database may have been damaged.\n\n" +
      "Options:\n" +
      "• Backup & Start Fresh: Creates a backup and starts with a new database (recommended)\n" +
      "• Try Repair: Attempts advanced repair techniques (may lose some data)\n\n" +
      "A backup will be created before any action is taken.",
    backupPath,
    showRepairOption: true,
    showRestoreOption: false,
  });
}

/**
 * Show migration failure dialog
 */
export async function showMigrationFailureDialog(
  backupPath?: string
): Promise<RecoveryAction> {
  return showRecoveryDialog({
    title: "⚠️  Database Migration Failed",
    message: "Failed to migrate your database to the current version.",
    detail:
      "The database migration encountered an error. Your database has been " +
      "restored to its previous state.\n\n" +
      "Options:\n" +
      "• Restore from Backup: Restore from the last successful backup and retry\n" +
      "• Backup & Start Fresh: Create a backup and start with a fresh database\n\n" +
      "The failed database has been preserved for investigation.",
    backupPath,
    showRepairOption: false,
    showRestoreOption: true,
  });
}

/**
 * Show incompatible schema dialog
 */
export async function showIncompatibleSchemaDialog(
  backupPath?: string
): Promise<RecoveryAction> {
  return showRecoveryDialog({
    title: "⚠️  Database Schema Incompatible",
    message: "Your database schema is incompatible with this version.",
    detail:
      "The database structure doesn't match what this version of aurswift expects. " +
      "This can happen if the database was corrupted or modified externally.\n\n" +
      "We recommend creating a backup and starting fresh. Your old database will be preserved.",
    backupPath,
    showRepairOption: true,
    showRestoreOption: false,
  });
}

/**
 * Show simple error dialog (for non-recoverable errors)
 * Skips dialog in test/CI mode to avoid "app not ready" errors
 */
export async function showDatabaseErrorDialog(
  title: string,
  message: string,
  detail?: string
): Promise<void> {
  // Skip dialog in test/CI mode - app may not be ready
  const isTestMode =
    process.env.PLAYWRIGHT_TEST === "true" ||
    process.env.CI === "true" ||
    process.env.NODE_ENV === "test";

  if (isTestMode) {
    logger.error(`[TEST MODE] ${title}: ${message}`);
    if (detail) {
      logger.error(`[TEST MODE] Detail: ${detail}`);
    }
    return;
  }

  // Only show dialog if app is ready
  if (!app.isReady()) {
    logger.error(`${title}: ${message}`);
    if (detail) {
      logger.error(`Detail: ${detail}`);
    }
    logger.warn(
      "⚠️  App not ready, skipping dialog. Directory will be created automatically."
    );
    return;
  }

  await dialog.showMessageBox({
    type: "error",
    title,
    message,
    detail,
    buttons: ["OK"],
    defaultId: 0,
  });
}
