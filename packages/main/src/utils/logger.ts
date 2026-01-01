import { createLogger, format, transports } from "winston";
import * as path from "path";
import * as fs from "fs";
import { app } from "electron";

/**
 * Get the logs directory path.
 * Uses LOCALAPPDATA on Windows (machine-specific) instead of APPDATA (Roaming).
 * This follows Windows best practices for log files.
 *
 * @returns Path to logs directory
 */
function getLogsDirectory(): string {
  // On Windows, ensure logs go to LOCALAPPDATA instead of Roaming
  // Electron's app.getPath("logs") may default to userData on some platforms
  if (process.platform === "win32") {
    // Explicitly use LOCALAPPDATA for Windows
    // app.getPath("logs") should return LOCALAPPDATA, but we verify
    const logsPath = app.getPath("logs");
    const appDataPath = app.getPath("appData"); // This is APPDATA (Roaming)
    const localAppDataPath = app.getPath("appData").replace("Roaming", "Local");

    // If logs path is in Roaming, redirect to Local
    if (logsPath.includes("Roaming")) {
      // Construct path in Local AppData
      const appName = app.getName();
      return path.join(localAppDataPath, appName, "logs");
    }

    // Otherwise, use the default logs path (should be in Local already)
    return logsPath;
  }

  // For macOS and Linux, use Electron's default logs path
  // macOS: ~/Library/Logs/aurswift
  // Linux: ~/.config/aurswift/logs (or userData/logs)
  return app.getPath("logs");
}

/**
 * Shared logger factory for all services.
 * Usage: import { getLogger } from "../utils/logger";
 * const logger = getLogger("office-printer-service");
 */
export function getLogger(service: string) {
  // Sanitize service name for file use
  const safeService = service.replace(/[^a-zA-Z0-9-_]/g, "_");

  // Get logs directory (uses LOCALAPPDATA on Windows)
  const logsDir = getLogsDirectory();

  // Ensure logs directory exists (Winston will create it, but we do it explicitly for safety)
  try {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  } catch (error) {
    // If directory creation fails, Winston will handle it
    // But we log to console as fallback
    console.error(`Failed to create logs directory: ${logsDir}`, error);
  }

  const logger = createLogger({
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    format: format.combine(
      format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      format.errors({ stack: true }),
      format.splat(),
      format.json()
    ),
    defaultMeta: { service },
    transports: [
      new transports.File({
        filename: path.join(logsDir, `${safeService}-error.log`),
        level: "error",
        maxsize: 5242880,
        maxFiles: 5,
      }),
      new transports.File({
        filename: path.join(logsDir, `${safeService}-combined.log`),
        maxsize: 5242880,
        maxFiles: 5,
      }),
    ],
  });

  if (process.env.NODE_ENV !== "production") {
    logger.add(
      new transports.Console({
        format: format.combine(format.colorize(), format.simple()),
      })
    );
  }

  return logger;
}
