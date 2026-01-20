// Business Management IPC Handlers
// Note: auth:getBusinessById is handled in auth.handlers.ts with RBAC validation

import { ipcMain } from "electron";
import { getDatabase } from "../database/index.js";
import { getLogger } from "../utils/logger.js";
import {
  validateSession,
  validateSessionAndPermission,
  validateBusinessAccess,
} from "../utils/authHelpers.js";
import { PERMISSIONS } from "@app/shared/constants/permissions";

const logger = getLogger("businessHandlers");
// let db: any = null; // Removed: Always get fresh DB reference

export function registerBusinessHandlers() {
  // ============================================================================
  // BUSINESS UPDATE IPC HANDLER
  // ============================================================================

  ipcMain.handle(
    "business:update",
    async (event, sessionToken, businessId, updates) => {
      try {
        const db = await getDatabase();

        // Validate session (basic)
        const sessionValidation = await validateSession(db, sessionToken);
        if (!sessionValidation.success) {
          return {
            success: false,
            message: sessionValidation.message,
            code: sessionValidation.code,
          };
        }

        // Validate business access (users can only update their own business)
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

        // If attempting to update receipt email sender credentials, require SETTINGS_MANAGE.
        const receiptEmailFields = [
          "receiptEmailGmailUser",
          "receiptEmailGmailAppPassword",
          "receiptEmailGmailAppPasswordEncrypted",
          "receiptEmailUpdatedAt",
        ];
        const isReceiptEmailUpdate =
          updates &&
          typeof updates === "object" &&
          receiptEmailFields.some((k) => Object.prototype.hasOwnProperty.call(updates, k));

        if (isReceiptEmailUpdate) {
          const authz = await validateSessionAndPermission(
            db,
            sessionToken,
            PERMISSIONS.SETTINGS_MANAGE
          );
          if (!authz.success) {
            return {
              success: false,
              message: authz.message,
              code: authz.code,
            };
          }
        }

        // Log the updates being applied
        logger.info("Updating business:", {
          businessId,
          updates,
          updateCount: Object.keys(updates).length,
        });

        // Update business
        const updated = db.businesses.updateBusiness(businessId, updates);

        logger.info("Business update result:", {
          updated,
          businessId,
        });

        if (!updated) {
          logger.warn("Business update returned false - no rows changed");
          return {
            success: false,
            message: "Failed to update business - no changes were made",
          };
        }

        // Get updated business
        const business = db.businesses.getBusinessById(businessId);
        if (!business) {
          return {
            success: false,
            message: "Business not found after update",
          };
        }

        // Log the action
        try {
          await db.audit.createAuditLog({
            userId: sessionValidation.user!.id,
            action: "update",
            entityType: "user", // Use "user" as business is not in allowed entity types
            entityId: sessionValidation.user!.id,
            details: {
              updates,
              businessId,
              timestamp: Date.now(),
            },
          });
        } catch (auditError) {
          logger.error("Failed to log business update:", auditError);
          // Don't fail the update if audit logging fails
        }

        return {
          success: true,
          business: business,
        };
      } catch (error) {
        logger.error("Update business IPC error:", error);
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Failed to update business details",
        };
      }
    }
  );

  logger.info("Business handlers registered");
}
