// Terminal Management IPC Handlers

import { ipcMain } from "electron";
import { getDatabase } from "../database/index.js";
import { getLogger } from "../utils/logger.js";
import {
  validateSession,
  validateBusinessAccess,
} from "../utils/authHelpers.js";
import {
  getLocalIPAddress,
  getPrimaryMacAddress,
} from "../utils/networkInfo.js";

const logger = getLogger("terminalHandlers");
// let db: any = null; // Removed: Always get fresh DB reference

export function registerTerminalHandlers() {
  // ============================================================================
  // TERMINAL MANAGEMENT IPC HANDLERS
  // ============================================================================

  ipcMain.handle(
    "terminals:getByBusiness",
    async (_event, sessionToken, businessId) => {
      try {
        const db = await getDatabase();

        // Validate session
        const sessionValidation = await validateSession(db, sessionToken);
        if (!sessionValidation.success) {
          return {
            success: false,
            message: sessionValidation.message,
            code: sessionValidation.code,
          };
        }

        // Validate business access
        const businessCheck = validateBusinessAccess(
          sessionValidation.user!,
          businessId
        );
        if (!businessCheck.success) {
          return {
            success: false,
            message: businessCheck.message,
            code: businessCheck.code,
          };
        }

        // Get terminals
        const terminals = db.terminals.getTerminalsByBusiness(businessId);

        return {
          success: true,
          terminals: terminals.map((t: any) => ({
            ...t,
            settings:
              t.settings && typeof t.settings === "string"
                ? JSON.parse(t.settings)
                : t.settings,
          })),
        };
      } catch (error) {
        logger.error("Get terminals by business IPC error:", error);
        return {
          success: false,
          message: "Failed to get terminals",
        };
      }
    }
  );

  ipcMain.handle(
    "terminals:getById",
    async (_event, sessionToken, terminalId) => {
      try {
        const db = await getDatabase();

        // Validate session
        const sessionValidation = await validateSession(db, sessionToken);
        if (!sessionValidation.success) {
          return {
            success: false,
            message: sessionValidation.message,
            code: sessionValidation.code,
          };
        }

        // Get terminal
        const terminal = db.terminals.getTerminalById(terminalId);
        if (!terminal) {
          return {
            success: false,
            message: "Terminal not found",
          };
        }

        // Validate business access
        const businessCheck = validateBusinessAccess(
          sessionValidation.user!,
          terminal.business_id
        );
        if (!businessCheck.success) {
          return {
            success: false,
            message: businessCheck.message,
            code: businessCheck.code,
          };
        }

        return {
          success: true,
          terminal: {
            ...terminal,
            settings:
              terminal.settings && typeof terminal.settings === "string"
                ? JSON.parse(terminal.settings)
                : terminal.settings,
          },
        };
      } catch (error) {
        logger.error("Get terminal by ID IPC error:", error);
        return {
          success: false,
          message: "Failed to get terminal",
        };
      }
    }
  );

  ipcMain.handle(
    "terminals:update",
    async (_event, sessionToken, terminalId, updates) => {
      try {
        const db = await getDatabase();

        // Validate session
        const sessionValidation = await validateSession(db, sessionToken);
        if (!sessionValidation.success) {
          return {
            success: false,
            message: sessionValidation.message,
            code: sessionValidation.code,
          };
        }

        // Get terminal to check business access
        const terminal = db.terminals.getTerminalById(terminalId);
        if (!terminal) {
          return {
            success: false,
            message: "Terminal not found",
          };
        }

        // Validate business access
        const businessCheck = validateBusinessAccess(
          sessionValidation.user!,
          terminal.business_id
        );
        if (!businessCheck.success) {
          return {
            success: false,
            message: businessCheck.message,
            code: businessCheck.code,
          };
        }

        // Log the updates being applied
        logger.info("Updating terminal:", {
          terminalId,
          updates,
          updateCount: Object.keys(updates).length,
        });

        // Update terminal
        const updated = db.terminals.updateTerminal(terminalId, updates);

        logger.info("Terminal update result:", {
          updated,
          terminalId,
        });

        if (!updated) {
          logger.warn("Terminal update returned false - no rows changed");
          return {
            success: false,
            message: "Failed to update terminal - no changes were made",
          };
        }

        // Get updated terminal
        const updatedTerminal = db.terminals.getTerminalById(terminalId);
        if (!updatedTerminal) {
          return {
            success: false,
            message: "Terminal not found after update",
          };
        }

        // Log the action
        try {
          await db.audit.createAuditLog({
            userId: sessionValidation.user!.id,
            action: "update",
            entityType: "user", // Use "user" as terminal is not in allowed entity types
            entityId: sessionValidation.user!.id,
            details: {
              updates,
              terminalId,
              timestamp: Date.now(),
            },
          });
        } catch (auditError) {
          logger.error("Failed to log terminal update:", auditError);
          // Don't fail the update if audit logging fails
        }

        return {
          success: true,
          terminal: {
            ...updatedTerminal,
            settings:
              updatedTerminal.settings &&
              typeof updatedTerminal.settings === "string"
                ? JSON.parse(updatedTerminal.settings)
                : updatedTerminal.settings,
          },
        };
      } catch (error) {
        logger.error("Update terminal IPC error:", error);
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Failed to update terminal details",
        };
      }
    }
  );

  // ============================================================================
  // NETWORK INFORMATION IPC HANDLERS
  // ============================================================================

  ipcMain.handle("terminals:getNetworkInfo", async () => {
    try {
      const localIP = getLocalIPAddress();
      const macAddress = getPrimaryMacAddress();

      return {
        success: true,
        data: {
          localIP: localIP || "Not available",
          macAddress: macAddress || "Not available",
        },
      };
    } catch (error) {
      logger.error("Get network info IPC error:", error);
      return {
        success: false,
        message: "Failed to get network information",
      };
    }
  });

  logger.info("Terminal handlers registered");
}
