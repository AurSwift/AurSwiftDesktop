import { ipcMain, safeStorage } from "electron";
import { getDatabase } from "../database/index.js";
import { getLogger } from "../utils/logger.js";
import { emailService } from "../services/email-service.js";
import {
  validateBusinessAccess,
  validateSession,
  validateSessionAndPermission,
} from "../utils/authHelpers.js";
import { PERMISSIONS } from "@app/shared/constants/permissions";

const logger = getLogger("emailSettingsHandlers");

const isEncryptionAvailable = safeStorage.isEncryptionAvailable();

function normalizeEmail(value: string): string {
  return value.trim();
}

function normalizeAppPassword(value: string): string {
  // Gmail app passwords are often shown with spaces for readability.
  // Nodemailer accepts either, but we normalize to avoid accidental whitespace issues.
  return value.replace(/\s+/g, "").trim();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function decryptIfNeeded(
  storedValue: string,
  isEncrypted: boolean
): string | null {
  if (!storedValue) return null;
  if (isEncrypted && isEncryptionAvailable) {
    try {
      const buffer = Buffer.from(storedValue, "base64");
      return safeStorage.decryptString(buffer);
    } catch (error) {
      logger.error("Failed to decrypt stored Gmail app password:", error);
      return null;
    }
  }
  return storedValue;
}

async function initializeEmailServiceFromBusiness(
  business: any
): Promise<{ success: boolean; configured: boolean; degraded: boolean; message?: string }> {
  const gmailUser = (business?.receiptEmailGmailUser || "").trim();
  const storedPassword = business?.receiptEmailGmailAppPassword || "";
  const encryptedFlag = business?.receiptEmailGmailAppPasswordEncrypted === true;

  const appPassword = decryptIfNeeded(storedPassword, encryptedFlag);

  if (!gmailUser || !appPassword) {
    const init = await emailService.initialize({
      provider: "console",
      fromEmail: "no-reply@aurswift.local",
      fromName: "AurSwift POS",
    });
    return {
      success: init.success,
      configured: false,
      degraded: init.degraded,
      message:
        init.message ||
        "Email not configured. Set Gmail credentials in Settings to enable sending.",
    };
  }

  const init = await emailService.initialize({
    provider: "smtp",
    smtp: {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: gmailUser,
        pass: normalizeAppPassword(appPassword),
      },
    },
    fromEmail: gmailUser,
    fromName: "AurSwift POS",
  });

  return {
    success: init.success,
    configured: true,
    degraded: init.degraded,
    message: init.message,
  };
}

export function registerEmailSettingsHandlers() {
  ipcMain.handle("emailSettings:get", async (event, sessionToken: string, businessId: string) => {
    try {
      const db = await getDatabase();

      const sessionValidation = await validateSession(db, sessionToken);
      if (!sessionValidation.success) {
        return {
          success: false,
          message: sessionValidation.message,
          code: sessionValidation.code,
        };
      }

      const businessCheck = validateBusinessAccess(sessionValidation.user!, businessId);
      if (!businessCheck.success) {
        return {
          success: false,
          message: businessCheck.message,
          code: businessCheck.code,
        };
      }

      const business = db.businesses.getBusinessById(businessId);
      if (!business) {
        return { success: false, message: "Business not found" };
      }

      // One-time migration from legacy app_settings keys (if present).
      // Only migrate if business doesn't already have settings.
      const hasBusinessSettings =
        !!(business as any).receiptEmailGmailUser?.trim() &&
        !!(business as any).receiptEmailGmailAppPassword?.trim();

      if (!hasBusinessSettings) {
        const legacyUser = db.settings.getSetting("receipt_email:gmail_user");
        const legacyPass = db.settings.getSetting("receipt_email:gmail_app_password");
        const legacyEncrypted =
          db.settings.getSetting("receipt_email:gmail_app_password_encrypted") === "true";

        if (legacyUser && legacyPass) {
          logger.info("Migrating legacy receipt_email:* app_settings into businesses table");
          db.businesses.updateBusiness(businessId, {
            receiptEmailGmailUser: legacyUser,
            receiptEmailGmailAppPassword: legacyPass,
            receiptEmailGmailAppPasswordEncrypted: legacyEncrypted,
            receiptEmailUpdatedAt: new Date(),
          });
          db.settings.deleteSetting("receipt_email:gmail_user");
          db.settings.deleteSetting("receipt_email:gmail_app_password");
          db.settings.deleteSetting("receipt_email:gmail_app_password_encrypted");
          db.settings.deleteSetting("receipt_email:last_updated_at");
        }
      }

      const refreshedBusiness = db.businesses.getBusinessById(businessId) || business;
      const gmailUser = (refreshedBusiness as any).receiptEmailGmailUser || "";
      const hasPassword = !!(refreshedBusiness as any).receiptEmailGmailAppPassword;
      const updatedAt = (refreshedBusiness as any).receiptEmailUpdatedAt as Date | null | undefined;

      return {
        success: true,
        data: {
          gmailUser: gmailUser?.trim() ? gmailUser.trim() : null,
          configured: !!gmailUser && hasPassword,
          encryptionAvailable: isEncryptionAvailable,
          lastUpdatedAt: updatedAt ? updatedAt.toISOString() : null,
        },
      };
    } catch (error) {
      logger.error("emailSettings:get failed:", error);
      return { success: false, message: "Failed to load email settings" };
    }
  });

  ipcMain.handle(
    "emailSettings:set",
    async (
      event,
      sessionToken: string,
      businessId: string,
      payload: {
        gmailUser: string;
        gmailAppPassword: string;
      }
    ) => {
      try {
        const db = await getDatabase();

        const authz = await validateSessionAndPermission(
          db,
          sessionToken,
          PERMISSIONS.SETTINGS_MANAGE
        );
        if (!authz.success) {
          return { success: false, message: authz.message, code: authz.code };
        }

        const businessCheck = validateBusinessAccess(authz.user!, businessId);
        if (!businessCheck.success) {
          return {
            success: false,
            message: businessCheck.message,
            code: businessCheck.code,
          };
        }

        const gmailUser = normalizeEmail(payload.gmailUser);
        const gmailAppPassword = normalizeAppPassword(payload.gmailAppPassword);

        if (!gmailUser || !isValidEmail(gmailUser)) {
          return { success: false, message: "Please enter a valid Gmail address" };
        }
        if (!gmailAppPassword) {
          return { success: false, message: "Please enter a Gmail App Password" };
        }

        // Store password (secret) encrypted when possible.
        let storedPassword = gmailAppPassword;
        let encryptedFlag = false;
        if (isEncryptionAvailable) {
          try {
            const buffer = safeStorage.encryptString(gmailAppPassword);
            storedPassword = buffer.toString("base64");
            encryptedFlag = true;
          } catch (error) {
            logger.error(
              "Failed to encrypt Gmail app password, storing plaintext:",
              error
            );
            storedPassword = gmailAppPassword;
            encryptedFlag = false;
          }
        } else {
          logger.warn(
            "Safe storage encryption not available; storing Gmail app password in plaintext."
          );
          storedPassword = gmailAppPassword;
          encryptedFlag = false;
        }

        const updated = db.businesses.updateBusiness(businessId, {
          receiptEmailGmailUser: gmailUser,
          receiptEmailGmailAppPassword: storedPassword,
          receiptEmailGmailAppPasswordEncrypted: encryptedFlag,
          receiptEmailUpdatedAt: new Date(),
        });

        if (!updated) {
          return { success: false, message: "Failed to save email settings" };
        }

        const business = db.businesses.getBusinessById(businessId);
        const init = await initializeEmailServiceFromBusiness(business);

        return {
          success: true,
          data: {
            configured: init.configured,
            degraded: init.degraded,
          },
          message: init.degraded
            ? init.message || "Email configured, but connection may be offline."
            : "Email configured successfully.",
        };
      } catch (error) {
        logger.error("emailSettings:set failed:", error);
        return { success: false, message: "Failed to save email settings" };
      }
    }
  );

  ipcMain.handle("emailSettings:clear", async (event, sessionToken: string, businessId: string) => {
    try {
      const db = await getDatabase();
      const authz = await validateSessionAndPermission(
        db,
        sessionToken,
        PERMISSIONS.SETTINGS_MANAGE
      );
      if (!authz.success) {
        return { success: false, message: authz.message, code: authz.code };
      }

      const businessCheck = validateBusinessAccess(authz.user!, businessId);
      if (!businessCheck.success) {
        return {
          success: false,
          message: businessCheck.message,
          code: businessCheck.code,
        };
      }

      db.businesses.updateBusiness(businessId, {
        receiptEmailGmailUser: "",
        receiptEmailGmailAppPassword: "",
        receiptEmailGmailAppPasswordEncrypted: false,
        receiptEmailUpdatedAt: new Date(),
      });

      const init = await emailService.initialize({
        provider: "console",
        fromEmail: "no-reply@aurswift.local",
        fromName: "AurSwift POS",
      });

      return {
        success: init.success,
        message: "Email settings cleared. Email sending is now disabled.",
      };
    } catch (error) {
      logger.error("emailSettings:clear failed:", error);
      return { success: false, message: "Failed to clear email settings" };
    }
  });

  ipcMain.handle(
    "emailSettings:testConnection",
    async (event, sessionToken: string, businessId: string) => {
    try {
      const db = await getDatabase();

      const authz = await validateSessionAndPermission(
        db,
        sessionToken,
        PERMISSIONS.SETTINGS_MANAGE
      );
      if (!authz.success) {
        return { success: false, message: authz.message, code: authz.code };
      }

      const businessCheck = validateBusinessAccess(authz.user!, businessId);
      if (!businessCheck.success) {
        return {
          success: false,
          message: businessCheck.message,
          code: businessCheck.code,
        };
      }

      const business = db.businesses.getBusinessById(businessId);
      const init = await initializeEmailServiceFromBusiness(business);

      if (!init.configured) {
        return {
          success: false,
          message: "Email not configured. Please set Gmail credentials first.",
        };
      }

      if (init.degraded) {
        return {
          success: false,
          message:
            init.message ||
            "Unable to verify SMTP connection. Check credentials and internet connection.",
        };
      }

      return { success: true, message: "SMTP connection verified successfully." };
    } catch (error) {
      logger.error("emailSettings:testConnection failed:", error);
      return { success: false, message: "Failed to test email connection" };
    }
  }
  );
}

