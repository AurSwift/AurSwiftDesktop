/**
 * License IPC Handlers
 *
 * Handles all license-related IPC communication between main and renderer processes.
 * Manages license activation, validation, heartbeat, and local storage.
 */

import { ipcMain } from "electron";
import { eq } from "drizzle-orm";
import { getDrizzle } from "../database/drizzle.js";
import { licenseActivation, licenseValidationLog } from "../database/schema.js";
import { getLogger } from "../utils/logger.js";
import { generateMachineFingerprint, getMachineInfo } from "../utils/machineFingerprint.js";
import {
  activateLicense,
  validateLicense,
  sendHeartbeat,
  deactivateLicense,
} from "../services/licenseService.js";

const logger = getLogger("licenseHandlers");

// Grace period for offline operation (7 days in milliseconds)
const OFFLINE_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

// Heartbeat interval (24 hours in milliseconds)
const HEARTBEAT_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Track heartbeat timer
let heartbeatTimer: NodeJS.Timeout | null = null;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Log license validation attempt to database
 */
async function logValidationAttempt(
  action: string,
  status: string,
  licenseKey?: string,
  machineIdHash?: string,
  errorMessage?: string,
  serverResponse?: object
) {
  try {
    const drizzle = getDrizzle();
    await drizzle.insert(licenseValidationLog).values({
      action,
      status,
      licenseKey: licenseKey || null,
      machineIdHash: machineIdHash || null,
      errorMessage: errorMessage || null,
      serverResponse: serverResponse || null,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error("Failed to log validation attempt:", error);
  }
}

/**
 * Get the current license activation from local database
 */
async function getLocalActivation() {
  try {
    const drizzle = getDrizzle();
    const [activation] = await drizzle
      .select()
      .from(licenseActivation)
      .where(eq(licenseActivation.isActive, true))
      .limit(1);

    return activation || null;
  } catch (error) {
    // If tables don't exist yet, return null
    logger.debug("Could not get local activation:", error);
    return null;
  }
}

/**
 * Store license activation in local database
 */
async function storeLocalActivation(data: {
  licenseKey: string;
  machineIdHash: string;
  terminalName: string;
  activationId: string;
  planId: string;
  planName: string;
  maxTerminals: number;
  features: string[];
  businessName: string | null;
  subscriptionStatus: string;
  expiresAt: string | null;
}) {
  const drizzle = getDrizzle();

  // Deactivate any existing activations
  await drizzle
    .update(licenseActivation)
    .set({ isActive: false })
    .where(eq(licenseActivation.isActive, true));

  // Insert new activation
  const [activation] = await drizzle
    .insert(licenseActivation)
    .values({
      licenseKey: data.licenseKey,
      machineIdHash: data.machineIdHash,
      terminalName: data.terminalName,
      activationId: data.activationId,
      planId: data.planId,
      planName: data.planName,
      maxTerminals: data.maxTerminals,
      features: data.features,
      businessName: data.businessName,
      subscriptionStatus: data.subscriptionStatus,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      isActive: true,
      activatedAt: new Date(),
      lastHeartbeat: new Date(),
      lastValidatedAt: new Date(),
    })
    .returning();

  return activation;
}

/**
 * Update last heartbeat timestamp
 */
async function updateHeartbeat(subscriptionStatus?: string) {
  const drizzle = getDrizzle();
  const updates: Record<string, any> = {
    lastHeartbeat: new Date(),
    lastValidatedAt: new Date(),
  };

  if (subscriptionStatus) {
    updates.subscriptionStatus = subscriptionStatus;
  }

  await drizzle
    .update(licenseActivation)
    .set(updates)
    .where(eq(licenseActivation.isActive, true));
}

/**
 * Deactivate a license by ID
 */
async function deactivateLocalLicense(licenseId: number) {
  const drizzle = getDrizzle();
  await drizzle
    .update(licenseActivation)
    .set({ isActive: false })
    .where(eq(licenseActivation.id, licenseId));
}

/**
 * Check if license is within grace period
 */
function isWithinGracePeriod(lastHeartbeat: Date | null): boolean {
  if (!lastHeartbeat) return false;
  const now = new Date();
  const gracePeriodEnd = new Date(lastHeartbeat.getTime() + OFFLINE_GRACE_PERIOD_MS);
  return now < gracePeriodEnd;
}

/**
 * Start periodic heartbeat
 */
function startHeartbeatTimer(licenseKey: string) {
  // Clear existing timer
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }

  // Schedule heartbeat every 24 hours (with some randomization)
  const interval = HEARTBEAT_INTERVAL_MS + Math.random() * 4 * 60 * 60 * 1000; // 24-28 hours

  heartbeatTimer = setInterval(async () => {
    try {
      const result = await sendHeartbeat(licenseKey);

      if (result.success) {
        await updateHeartbeat(result.data?.subscriptionStatus);
        await logValidationAttempt("heartbeat", "success", licenseKey);
      } else {
        await logValidationAttempt(
          "heartbeat",
          "failed",
          licenseKey,
          undefined,
          result.message
        );
      }
    } catch (error) {
      logger.error("Heartbeat failed:", error);
      await logValidationAttempt(
        "heartbeat",
        "error",
        licenseKey,
        undefined,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }, interval);

  logger.info(`Heartbeat timer started (interval: ${Math.round(interval / 1000 / 60 / 60)}h)`);
}

/**
 * Stop periodic heartbeat
 */
function stopHeartbeatTimer() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

export function registerLicenseHandlers() {
  /**
   * Get current activation status
   */
  ipcMain.handle("license:getStatus", async () => {
    try {
      const activation = await getLocalActivation();

      if (!activation) {
        return {
          success: true,
          isActivated: false,
          data: null,
        };
      }

      // Check if within grace period if offline
      const withinGracePeriod = isWithinGracePeriod(activation.lastHeartbeat);

      // Calculate days since last heartbeat
      const daysSinceHeartbeat = activation.lastHeartbeat
        ? Math.floor(
            (Date.now() - new Date(activation.lastHeartbeat).getTime()) /
              (24 * 60 * 60 * 1000)
          )
        : null;

      return {
        success: true,
        isActivated: true,
        data: {
          licenseKey: activation.licenseKey,
          terminalName: activation.terminalName,
          planId: activation.planId,
          planName: activation.planName,
          features: activation.features,
          businessName: activation.businessName,
          subscriptionStatus: activation.subscriptionStatus,
          expiresAt: activation.expiresAt?.toISOString() || null,
          activatedAt: activation.activatedAt?.toISOString(),
          lastHeartbeat: activation.lastHeartbeat?.toISOString(),
          daysSinceHeartbeat,
          withinGracePeriod,
          gracePeriodDays: 7,
        },
      };
    } catch (error) {
      logger.error("Failed to get license status:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to get license status",
      };
    }
  });

  /**
   * Activate a license key
   */
  ipcMain.handle(
    "license:activate",
    async (event, licenseKey: string, terminalName?: string) => {
      try {
        const machineIdHash = generateMachineFingerprint();

        logger.info("Activating license...");

        // Call activation API
        const result = await activateLicense({
          licenseKey,
          terminalName,
        });

        if (!result.success || !result.data) {
          await logValidationAttempt(
            "activation",
            "failed",
            licenseKey,
            machineIdHash,
            result.message
          );

          return {
            success: false,
            message: result.message,
          };
        }

        // Store activation locally
        await storeLocalActivation({
          licenseKey: licenseKey.toUpperCase().trim(),
          machineIdHash,
          terminalName: terminalName || result.data.businessName || "Terminal",
          activationId: result.data.activationId,
          planId: result.data.planId,
          planName: result.data.planName,
          maxTerminals: result.data.maxTerminals,
          features: result.data.features,
          businessName: result.data.businessName,
          subscriptionStatus: result.data.subscriptionStatus,
          expiresAt: result.data.expiresAt,
        });

        // Log successful activation
        await logValidationAttempt(
          "activation",
          "success",
          licenseKey,
          machineIdHash,
          undefined,
          result.data
        );

        // Start heartbeat timer
        startHeartbeatTimer(licenseKey.toUpperCase().trim());

        logger.info("License activated successfully:", {
          planId: result.data.planId,
          businessName: result.data.businessName,
        });

        return {
          success: true,
          message: "License activated successfully",
          data: result.data,
        };
      } catch (error) {
        logger.error("License activation failed:", error);
        return {
          success: false,
          message: error instanceof Error ? error.message : "Activation failed",
        };
      }
    }
  );

  /**
   * Validate current license (online check)
   */
  ipcMain.handle("license:validate", async () => {
    try {
      const activation = await getLocalActivation();

      if (!activation) {
        return {
          success: false,
          message: "No active license found",
        };
      }

      // Call validation API
      const result = await validateLicense(activation.licenseKey, true);

      if (result.success && result.data) {
        // Update local status
        await updateHeartbeat(result.data.subscriptionStatus);
        await logValidationAttempt("validation", "success", activation.licenseKey);

        return {
          success: true,
          data: {
            isValid: result.data.isValid,
            planId: result.data.planId,
            planName: result.data.planName,
            features: result.data.features,
            subscriptionStatus: result.data.subscriptionStatus,
            daysUntilExpiry: result.data.daysUntilExpiry,
          },
        };
      } else {
        // Online validation failed - check grace period
        const withinGracePeriod = isWithinGracePeriod(activation.lastHeartbeat);

        await logValidationAttempt(
          "validation",
          "failed",
          activation.licenseKey,
          undefined,
          result.message
        );

        if (withinGracePeriod) {
          return {
            success: true,
            message: "Offline - within grace period",
            data: {
              isValid: true,
              planId: activation.planId,
              planName: activation.planName,
              features: activation.features,
              subscriptionStatus: "offline_grace",
              offlineMode: true,
            },
          };
        }

        return {
          success: false,
          message: result.message || "License validation failed",
        };
      }
    } catch (error) {
      logger.error("License validation error:", error);

      // Check grace period for offline scenarios
      const activation = await getLocalActivation();
      if (activation && isWithinGracePeriod(activation.lastHeartbeat)) {
        return {
          success: true,
          message: "Offline - within grace period",
          data: {
            isValid: true,
            planId: activation.planId,
            planName: activation.planName,
            features: activation.features,
            subscriptionStatus: "offline_grace",
            offlineMode: true,
          },
        };
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : "Validation failed",
      };
    }
  });

  /**
   * Deactivate current license
   */
  ipcMain.handle("license:deactivate", async () => {
    try {
      const activation = await getLocalActivation();

      if (!activation) {
        return {
          success: false,
          message: "No active license found",
        };
      }

      // Call deactivation API
      const result = await deactivateLicense(activation.licenseKey);

      // Stop heartbeat timer
      stopHeartbeatTimer();

      // Deactivate locally regardless of API result (allow offline deactivation)
      await deactivateLocalLicense(activation.id);

      await logValidationAttempt(
        "deactivation",
        result.success ? "success" : "local_only",
        activation.licenseKey
      );

      logger.info("License deactivated");

      return {
        success: true,
        message: result.success
          ? "License deactivated successfully"
          : "License deactivated locally (offline)",
      };
    } catch (error) {
      logger.error("License deactivation error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Deactivation failed",
      };
    }
  });

  /**
   * Get machine info for display
   */
  ipcMain.handle("license:getMachineInfo", async () => {
    try {
      const machineInfo = getMachineInfo();
      const fingerprint = generateMachineFingerprint();

      return {
        success: true,
        data: {
          ...machineInfo,
          fingerprintPreview: fingerprint.substring(0, 20) + "...",
        },
      };
    } catch (error) {
      logger.error("Failed to get machine info:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to get machine info",
      };
    }
  });

  /**
   * Check if a feature is enabled for current plan
   */
  ipcMain.handle("license:hasFeature", async (event, featureName: string) => {
    try {
      const activation = await getLocalActivation();

      if (!activation || !activation.isActive) {
        return {
          success: true,
          hasFeature: false,
          reason: "No active license",
        };
      }

      const hasFeature = activation.features?.includes(featureName) || false;

      return {
        success: true,
        hasFeature,
        planId: activation.planId,
      };
    } catch (error) {
      logger.error("Feature check error:", error);
      return {
        success: false,
        hasFeature: false,
        message: error instanceof Error ? error.message : "Feature check failed",
      };
    }
  });

  /**
   * Send manual heartbeat
   */
  ipcMain.handle("license:sendHeartbeat", async () => {
    try {
      const activation = await getLocalActivation();

      if (!activation) {
        return {
          success: false,
          message: "No active license found",
        };
      }

      const result = await sendHeartbeat(activation.licenseKey);

      if (result.success) {
        await updateHeartbeat(result.data?.subscriptionStatus);
        await logValidationAttempt("heartbeat", "success", activation.licenseKey);
      } else {
        await logValidationAttempt(
          "heartbeat",
          "failed",
          activation.licenseKey,
          undefined,
          result.message
        );
      }

      return result;
    } catch (error) {
      logger.error("Manual heartbeat error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Heartbeat failed",
      };
    }
  });

  /**
   * Initialize license system on app start
   */
  ipcMain.handle("license:initialize", async () => {
    try {
      const activation = await getLocalActivation();

      if (!activation) {
        return {
          success: true,
          isActivated: false,
        };
      }

      // Start heartbeat timer for existing activation
      startHeartbeatTimer(activation.licenseKey);

      // Try to validate online (non-blocking)
      validateLicense(activation.licenseKey, true)
        .then(async (result) => {
          if (result.success) {
            await updateHeartbeat(result.data?.subscriptionStatus);
          }
        })
        .catch((error) => {
          logger.warn("Background validation failed:", error);
        });

      return {
        success: true,
        isActivated: true,
        data: {
          planId: activation.planId,
          planName: activation.planName,
          features: activation.features,
          businessName: activation.businessName,
        },
      };
    } catch (error) {
      logger.error("License initialization error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Initialization failed",
      };
    }
  });

  logger.info("License handlers registered");
}
