/**
 * License IPC Handlers
 *
 * Handles all license-related IPC communication between main and renderer processes.
 * Manages license activation, validation, heartbeat, and local storage.
 *
 * Real-time sync with SSE (Server-Sent Events) for instant subscription notifications.
 * Falls back to polling every 15 minutes as backup.
 */

import { ipcMain, BrowserWindow } from "electron";
import { eq } from "drizzle-orm";
import { getDrizzle } from "../database/drizzle.js";
import { licenseActivation, licenseValidationLog, terminals } from "../database/schema.js";
import { getLogger } from "../utils/logger.js";
import {
  generateMachineFingerprint,
  getMachineInfo,
} from "../utils/machineFingerprint.js";
import {
  activateLicense,
  validateLicense,
  sendHeartbeat,
  deactivateLicense,
} from "../services/licenseService.js";
import {
  initializeSSEClient,
  disconnectSSEClient,
  getSSEClient,
  type SubscriptionEvent,
} from "../services/subscriptionEventClient.js";

const logger = getLogger("licenseHandlers");

// Grace period for offline operation (7 days in milliseconds)
const OFFLINE_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

// Heartbeat interval - REDUCED from 24 hours to 15 minutes for backup sync
// SSE provides real-time updates, but polling ensures we catch any missed events
const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// Track heartbeat timer
let heartbeatTimer: NodeJS.Timeout | null = null;

// Track consecutive heartbeat failures for error recovery
let consecutiveHeartbeatFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 5;

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
 * Uses upsert to handle re-activation after deactivation from dashboard
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
  trialEnd: string | null;
}) {
  const drizzle = getDrizzle();

  // Deactivate any OTHER activations (different license keys)
  await drizzle
    .update(licenseActivation)
    .set({ isActive: false })
    .where(eq(licenseActivation.isActive, true));

  // Check if activation with this license key already exists
  const [existing] = await drizzle
    .select()
    .from(licenseActivation)
    .where(eq(licenseActivation.licenseKey, data.licenseKey))
    .limit(1);

  if (existing) {
    // Update existing activation (re-activation scenario)
    const [activation] = await drizzle
      .update(licenseActivation)
      .set({
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
        trialEnd: data.trialEnd ? new Date(data.trialEnd) : null,
        isActive: true,
        lastHeartbeat: new Date(),
        lastValidatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(licenseActivation.licenseKey, data.licenseKey))
      .returning();

    logger.info("License re-activated (updated existing record):", {
      licenseKey: data.licenseKey.substring(0, 15) + "...",
    });

    return activation;
  }

  // Insert new activation (first-time activation)
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
      trialEnd: data.trialEnd ? new Date(data.trialEnd) : null,
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
async function updateHeartbeat(
  subscriptionStatus?: string,
  trialEnd?: string | null
) {
  const drizzle = getDrizzle();
  const updates: Record<string, any> = {
    lastHeartbeat: new Date(),
    lastValidatedAt: new Date(),
  };

  if (subscriptionStatus) {
    updates.subscriptionStatus = subscriptionStatus;
  }

  if (trialEnd !== undefined) {
    updates.trialEnd = trialEnd ? new Date(trialEnd) : null;
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
  const gracePeriodEnd = new Date(
    lastHeartbeat.getTime() + OFFLINE_GRACE_PERIOD_MS
  );
  return now < gracePeriodEnd;
}

/**
 * Start periodic heartbeat
 * Now runs every 15 minutes as backup to SSE real-time events
 */
function startHeartbeatTimer(licenseKey: string, customIntervalMs?: number) {
  // Clear existing timer
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }

  // Use custom interval if provided, otherwise default to 15 minutes
  // During trial: Server returns 2 minutes (120000ms)
  // After trial: Server returns 15 minutes (900000ms)
  const baseInterval = customIntervalMs || HEARTBEAT_INTERVAL_MS;
  const interval = baseInterval + Math.random() * 5 * 60 * 1000; // Add 0-5 min randomization

  logger.info(
    `Heartbeat timer starting with interval: ${baseInterval}ms (${
      baseInterval / 60000
    } minutes)`
  );

  heartbeatTimer = setInterval(async () => {
    try {
      const result = await sendHeartbeat(licenseKey);

      if (result.success) {
        consecutiveHeartbeatFailures = 0; // Reset failure counter
        const previousStatus = (await getLocalActivation())?.subscriptionStatus;
        await updateHeartbeat(
          result.data?.subscriptionStatus,
          result.data?.trialEnd
        );
        await logValidationAttempt("heartbeat", "success", licenseKey);

        // 🔄 DYNAMIC INTERVAL: Update timer if server returns new interval
        if (
          result.data?.heartbeatIntervalMs &&
          result.data.heartbeatIntervalMs !== baseInterval
        ) {
          logger.info(
            `Server requested new heartbeat interval: ${result.data.heartbeatIntervalMs}ms`
          );
          startHeartbeatTimer(licenseKey, result.data.heartbeatIntervalMs);
          return; // Exit - new timer will continue
        }

        // 🔴 CRITICAL: Enforce shouldDisable flag
        if (result.data?.shouldDisable) {
          logger.warn("Server indicated license should be disabled");

          // Stop timers
          stopHeartbeatTimer();
          disconnectSSEClient();

          // Deactivate locally
          const activation = await getLocalActivation();
          if (activation) {
            await deactivateLocalLicense(activation.id);
          }

          // Notify renderer process
          emitLicenseEvent("license:disabled", {
            reason: "Subscription expired or cancelled",
            subscriptionStatus: result.data?.subscriptionStatus,
            gracePeriodRemaining: result.data?.gracePeriodRemaining,
          });
          return;
        }

        // Notify UI if status changed
        if (
          previousStatus &&
          previousStatus !== result.data?.subscriptionStatus
        ) {
          emitLicenseEvent("license:statusChanged", {
            previousStatus,
            newStatus: result.data?.subscriptionStatus,
            shouldDisable: result.data?.shouldDisable || false,
          });
        }
      } else {
        consecutiveHeartbeatFailures++;
        await logValidationAttempt(
          "heartbeat",
          "failed",
          licenseKey,
          undefined,
          result.message
        );

        // Notify user after consecutive failures
        if (consecutiveHeartbeatFailures >= MAX_CONSECUTIVE_FAILURES) {
          emitLicenseEvent("license:connectionIssue", {
            failureCount: consecutiveHeartbeatFailures,
            message:
              "Unable to verify license. Please check your internet connection.",
          });
        }
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

  logger.info(
    `Heartbeat timer started (interval: ${Math.round(interval / 1000 / 60)}min)`
  );
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
// UI NOTIFICATION HELPERS
// ============================================================================

/**
 * Emit license event to all renderer windows
 */
function emitLicenseEvent(channel: string, data: object): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    try {
      win.webContents.send(channel, data);
      logger.debug(`Emitted ${channel} to window ${win.id}`);
    } catch (error) {
      logger.error(`Failed to emit ${channel} to window:`, error);
    }
  }
}

// ============================================================================
// SSE EVENT HANDLERS
// ============================================================================

/**
 * Handle incoming SSE subscription events
 * (Phase 4: Added event acknowledgment tracking)
 */
async function handleSSEEvent(event: SubscriptionEvent): Promise<void> {
  logger.info(`SSE event received: ${event.type}`, { eventId: event.id });

  const activation = await getLocalActivation();
  if (!activation) {
    logger.warn("SSE event received but no local activation - skipping event");

    // Send acknowledgment as "skipped"
    try {
      const sseClient = getSSEClient();
      if (sseClient) {
        await sseClient.sendAcknowledgment(
          event.id,
          "skipped",
          "No local activation found"
        );
      }
    } catch (ackError) {
      logger.warn("Failed to send skipped acknowledgment:", ackError);
    }
    return;
  }

  // Track processing time for acknowledgment
  const startTime = Date.now();
  let processingStatus: "success" | "failed" = "success";
  let errorMessage: string | undefined;

  try {
    switch (event.type) {
      case "subscription_cancelled": {
        const data = event.data as {
          cancelledAt: string;
          cancelImmediately: boolean;
          gracePeriodEnd: string | null;
          reason?: string;
        };

        logger.warn("Subscription cancelled via SSE", {
          immediate: data.cancelImmediately,
          reason: data.reason,
        });

        if (data.cancelImmediately) {
          // Immediate cancellation - disable license NOW
          logger.error("License deactivated due to immediate cancellation");

          await deactivateLocalLicense(activation.id);
          stopHeartbeatTimer();
          disconnectSSEClient();

          emitLicenseEvent("license:disabled", {
            reason: data.reason || "Subscription cancelled",
            gracePeriodEnd: null,
            immediate: true,
          });
        } else {
          // Scheduled cancellation - still has access until grace period ends
          logger.warn("Subscription will cancel at period end");

          await updateHeartbeat("cancelled");

          emitLicenseEvent("license:cancelScheduled", {
            cancelAt: data.gracePeriodEnd,
            reason: data.reason,
            gracePeriodEnd: data.gracePeriodEnd,
          });
        }
        break;
      }

      case "subscription_reactivated": {
        const data = event.data as {
          subscriptionStatus: string;
          planId: string;
        };

        logger.info("Subscription reactivated via SSE");

        // Update local status
        await updateHeartbeat(data.subscriptionStatus);

        emitLicenseEvent("license:reactivated", {
          subscriptionStatus: data.subscriptionStatus,
          planId: data.planId,
        });
        break;
      }

      case "subscription_updated": {
        const data = event.data as {
          previousStatus: string;
          newStatus: string;
          shouldDisable: boolean;
          gracePeriodRemaining: number | null;
          trialEnd?: string | null;
        };

        logger.info(
          `Subscription status changed: ${data.previousStatus} -> ${data.newStatus}`
        );

        if (data.shouldDisable) {
          // Grace period expired - disable
          await deactivateLocalLicense(activation.id);
          stopHeartbeatTimer();
          disconnectSSEClient();

          emitLicenseEvent("license:disabled", {
            reason: `Subscription ${data.newStatus}`,
            previousStatus: data.previousStatus,
          });
        } else {
          // Update status and trial end date
          await updateHeartbeat(data.newStatus, data.trialEnd);

          emitLicenseEvent("license:statusChanged", {
            previousStatus: data.previousStatus,
            newStatus: data.newStatus,
            gracePeriodRemaining: data.gracePeriodRemaining,
          });
        }
        break;
      }

      case "subscription_past_due": {
        const data = event.data as {
          gracePeriodEnd: string;
          amountDue: number;
          currency: string;
        };

        logger.warn("Subscription is past due");

        await updateHeartbeat("past_due");

        emitLicenseEvent("license:paymentRequired", {
          gracePeriodEnd: data.gracePeriodEnd,
          amountDue: data.amountDue,
          currency: data.currency,
          message:
            "Your payment failed. Please update your payment method to continue using the software.",
        });
        break;
      }

      case "subscription_payment_succeeded": {
        const data = event.data as {
          subscriptionStatus: string;
        };

        logger.info("Payment succeeded - subscription restored");

        await updateHeartbeat(data.subscriptionStatus);

        emitLicenseEvent("license:paymentSucceeded", {
          subscriptionStatus: data.subscriptionStatus,
          message: "Your payment was successful. Thank you!",
        });
        break;
      }

      case "license_revoked": {
        const data = event.data as {
          reason: string;
        };

        logger.error("License revoked by server", {
          reason: data.reason,
          activationId: activation.id,
        });

        await deactivateLocalLicense(activation.id);
        logger.info("License deactivated locally");

        stopHeartbeatTimer();
        logger.info("Heartbeat timer stopped");

        disconnectSSEClient();
        logger.info("SSE client disconnected");

        emitLicenseEvent("license:disabled", {
          reason: data.reason,
          revoked: true,
        });
        logger.info("Emitted license:disabled event to UI");
        break;
      }

      case "license_reactivated": {
        const data = event.data as {
          planId: string;
          features: string[];
        };

        logger.info("License reactivated by server");

        // Update local activation with new features
        const drizzle = getDrizzle();
        await drizzle
          .update(licenseActivation)
          .set({
            planId: data.planId,
            features: data.features,
            isActive: true,
            subscriptionStatus: "active",
          })
          .where(eq(licenseActivation.id, activation.id));

        emitLicenseEvent("license:reactivated", {
          planId: data.planId,
          features: data.features,
        });
        break;
      }

      case "plan_changed": {
        const data = event.data as {
          previousPlanId: string;
          newPlanId: string;
          newFeatures: string[];
          effectiveAt: string;
        };

        logger.info(
          `Plan changed: ${data.previousPlanId} -> ${data.newPlanId}`
        );

        // ⚠️ NOTE: Plan changes now require reactivation with a new license key
        // The license_revoked event will follow this event and handle deactivation
        // This event is mainly for logging and UI notifications

        logger.warn(
          "Plan change detected - license revocation will follow. User will need to reactivate with new license key."
        );

        emitLicenseEvent("license:planChanged", {
          previousPlanId: data.previousPlanId,
          newPlanId: data.newPlanId,
          newFeatures: data.newFeatures,
          requiresReactivation: true,
        });
        break;
      }

      default:
        logger.debug(`Unhandled SSE event type: ${event.type}`);
    }

    // Send acknowledgment to server (Phase 4: Event Durability & Reliability)
    try {
      const processingTimeMs = Date.now() - startTime;
      const sseClient = getSSEClient();

      if (sseClient) {
        await sseClient.sendAcknowledgment(
          event.id,
          processingStatus,
          errorMessage,
          processingTimeMs
        );
        logger.debug(
          `Sent ${processingStatus} acknowledgment for event ${event.id} (${processingTimeMs}ms)`
        );
      }
    } catch (ackError) {
      logger.warn("Failed to send event acknowledgment:", ackError);
      // Don't fail event processing if acknowledgment fails
    }
  } catch (eventProcessingError) {
    // Event processing failed
    processingStatus = "failed";
    errorMessage =
      eventProcessingError instanceof Error
        ? eventProcessingError.message
        : "Unknown error";

    logger.error("Failed to process SSE event:", eventProcessingError);

    // Send failure acknowledgment
    try {
      const processingTimeMs = Date.now() - startTime;
      const sseClient = getSSEClient();

      if (sseClient) {
        await sseClient.sendAcknowledgment(
          event.id,
          "failed",
          errorMessage,
          processingTimeMs
        );
      }
    } catch (ackError) {
      logger.warn("Failed to send failure acknowledgment:", ackError);
    }
  }
}

/**
 * Initialize SSE connection for real-time subscription updates
 */
function initializeSSE(
  licenseKey: string,
  machineIdHash: string,
  apiBaseUrl: string
): void {
  try {
    const client = initializeSSEClient(licenseKey, machineIdHash, apiBaseUrl);

    // Handle events
    client.on("event", (event: SubscriptionEvent) => {
      handleSSEEvent(event).catch((error) => {
        logger.error("Error handling SSE event:", error);
      });
    });

    // Handle connection state changes
    client.on("connected", () => {
      logger.info("SSE connected - real-time subscription sync enabled");
      emitLicenseEvent("license:sseConnected", { connected: true });
    });

    client.on("disconnected", () => {
      logger.warn("SSE disconnected - falling back to polling");
      emitLicenseEvent("license:sseConnected", { connected: false });
    });

    // 🔴 NEW: Handle 401 Unauthorized - license may be revoked
    client.on(
      "license_validation_required",
      async (data: { reason: string; statusCode: number }) => {
        logger.warn(
          "SSE returned 401 - triggering immediate validation",
          data
        );

        try {
          const result = await sendHeartbeat(licenseKey);

          logger.debug("Heartbeat result", {
            success: result.success,
            shouldDisable: result.data?.shouldDisable,
            subscriptionStatus: result.data?.subscriptionStatus,
            message: result.message,
          });

          // License is revoked if:
          // 1. Heartbeat fails AND shouldDisable is true, OR
          // 2. Heartbeat succeeds AND shouldDisable is true
          const shouldDeactivate = result.data?.shouldDisable === true;

          if (shouldDeactivate) {
            logger.error("License validation confirmed: license should be disabled");

            // Stop timers
            stopHeartbeatTimer();
            disconnectSSEClient();

            // Deactivate locally
            const activation = await getLocalActivation();
            if (activation) {
              await deactivateLocalLicense(activation.id);
              logger.info("Local license deactivated");
            }

            // Notify renderer process
            emitLicenseEvent("license:disabled", {
              reason:
                result.message ||
                "License has been revoked (plan changed or cancelled)",
              subscriptionStatus: result.data?.subscriptionStatus || "revoked",
            });
            logger.info("UI notified - should show activation screen");
          } else {
            logger.info(
              "License is still valid, SSE rejection may be transient - continuing reconnection attempts"
            );
          }
        } catch (error) {
          logger.error("Failed to validate license after 401:", error);
        }
      }
    );

    // Start connection
    client.connect();
  } catch (error) {
    logger.error("Failed to initialize SSE:", error);
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
          trialEnd: activation.trialEnd?.toISOString() || null,
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
        message:
          error instanceof Error
            ? error.message
            : "Failed to get license status",
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
          terminalName: result.data.terminalName || terminalName || "Terminal", // Use terminal name from server response, fallback to provided name or default
          activationId: result.data.activationId,
          planId: result.data.planId,
          planName: result.data.planName,
          maxTerminals: result.data.maxTerminals,
          features: result.data.features,
          businessName: result.data.businessName,
          subscriptionStatus: result.data.subscriptionStatus,
          expiresAt: result.data.expiresAt,
          trialEnd: result.data.trialEnd ?? null,
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

        // Update terminal name in terminals table if provided
        if (terminalName) {
          try {
            const drizzle = getDrizzle();

            // Get current user's business to find their terminal
            const [terminal] = drizzle
              .select()
              .from(terminals)
              .where(eq(terminals.type, "pos"))
              .limit(1)
              .all();

            if (terminal) {
              drizzle
                .update(terminals)
                .set({
                  name: terminalName,
                  updatedAt: new Date(),
                })
                .where(eq(terminals.id, terminal.id))
                .run();

              logger.info("Updated terminal name in database:", terminalName);
            }
          } catch (error) {
            logger.error("Failed to update terminal name:", error);
            // Don't fail activation if terminal update fails
          }
        }

        const apiBaseUrl =
          process.env.LICENSE_API_URL || "http://localhost:3000";

        // Initialize SSE for real-time subscription updates
        initializeSSE(
          licenseKey.toUpperCase().trim(),
          machineIdHash,
          apiBaseUrl
        );

        // Start backup heartbeat timer
        startHeartbeatTimer(licenseKey.toUpperCase().trim());

        logger.info("License activated successfully:", {
          planId: result.data.planId,
          businessName: result.data.businessName,
          sseEnabled: true,
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
        await logValidationAttempt(
          "validation",
          "success",
          activation.licenseKey
        );

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

      // Stop heartbeat timer and SSE connection
      stopHeartbeatTimer();
      disconnectSSEClient();

      // Deactivate locally regardless of API result (allow offline deactivation)
      await deactivateLocalLicense(activation.id);

      await logValidationAttempt(
        "deactivation",
        result.success ? "success" : "local_only",
        activation.licenseKey
      );

      logger.info("License deactivated (SSE disconnected)");

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
        message:
          error instanceof Error ? error.message : "Failed to get machine info",
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
        message:
          error instanceof Error ? error.message : "Feature check failed",
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
        await logValidationAttempt(
          "heartbeat",
          "success",
          activation.licenseKey
        );

        // 🔴 CRITICAL: Check if server wants us to disable
        if (result.data?.shouldDisable) {
          logger.error(
            "Manual heartbeat: Server indicated license should be disabled"
          );

          // Stop timers
          stopHeartbeatTimer();
          disconnectSSEClient();

          // Deactivate locally
          await deactivateLocalLicense(activation.id);

          // Notify renderer process
          emitLicenseEvent("license:disabled", {
            reason: "License no longer valid on server",
            subscriptionStatus: result.data?.subscriptionStatus,
            gracePeriodRemaining: result.data?.gracePeriodRemaining,
          });

          return {
            success: false,
            message: "License has been deactivated",
            data: result.data,
          };
        }
      } else {
        await logValidationAttempt(
          "heartbeat",
          "failed",
          activation.licenseKey,
          undefined,
          result.message
        );

        // 🔴 CRITICAL: If heartbeat fails and indicates we should disable, do it
        if (result.data?.shouldDisable) {
          logger.error("Manual heartbeat failed: License should be disabled");

          // Stop timers
          stopHeartbeatTimer();
          disconnectSSEClient();

          // Deactivate locally
          await deactivateLocalLicense(activation.id);

          // Notify renderer process
          emitLicenseEvent("license:disabled", {
            reason: result.message || "License validation failed",
            subscriptionStatus: result.data?.subscriptionStatus,
            gracePeriodRemaining: result.data?.gracePeriodRemaining,
          });
        }
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
   * NOW WITH: Startup validation (blocking), SSE real-time sync, backup polling
   *
   * FINGERPRINT MIGRATION: If validation fails due to fingerprint mismatch
   * (e.g., MAC address changed), automatically re-activate using stored license key.
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

      const machineIdHash = generateMachineFingerprint();
      const apiBaseUrl = process.env.LICENSE_API_URL || "http://localhost:3000";

      // Check if fingerprint has changed from stored value
      const fingerprintChanged = activation.machineIdHash !== machineIdHash;
      if (fingerprintChanged) {
        logger.warn("Machine fingerprint has changed!", {
          storedFingerprint: activation.machineIdHash?.substring(0, 20) + "...",
          newFingerprint: machineIdHash.substring(0, 20) + "...",
        });
      }

      // 🔴 CRITICAL: Startup validation (BLOCKING) - ensure subscription is still valid
      logger.info("Performing startup license validation...");

      try {
        const validationResult = await validateLicense(
          activation.licenseKey,
          true
        );

        // Check for license revocation first
        if (!validationResult.success) {
          // Check if license was explicitly revoked
          if (validationResult.code === "LICENSE_REVOKED") {
            logger.error("Startup validation: License has been revoked", {
              reason: validationResult.revocationReason,
            });
            await deactivateLocalLicense(activation.id);
            stopHeartbeatTimer();

            return {
              success: false,
              isActivated: false,
              licenseRevoked: true,
              message:
                validationResult.revocationReason ||
                "Your license has been revoked. Please contact support or reactivate.",
            };
          }

          // 🔄 FINGERPRINT MIGRATION: If validation failed and fingerprint changed,
          // attempt auto-reactivation instead of failing. This handles cases where
          // network interfaces changed, VPN adapters were added/removed, etc.
          const isNotActivatedError =
            validationResult.message?.toLowerCase().includes("not activated") ||
            validationResult.message?.toLowerCase().includes("machine not found") ||
            validationResult.message?.toLowerCase().includes("not activated on this device");

          if (fingerprintChanged || isNotActivatedError) {
            logger.info(
              "Attempting auto-reactivation due to fingerprint change...",
              { fingerprintChanged, isNotActivatedError }
            );

            try {
              const reactivationResult = await activateLicense({
                licenseKey: activation.licenseKey,
                terminalName: activation.terminalName,
              });

              if (reactivationResult.success && reactivationResult.data) {
                logger.info(
                  "Auto-reactivation successful! License migrated to new fingerprint."
                );

                // Update local activation with new fingerprint
                await storeLocalActivation({
                  licenseKey: activation.licenseKey,
                  machineIdHash,
                  terminalName: reactivationResult.data.terminalName || activation.terminalName,
                  activationId: reactivationResult.data.activationId,
                  planId: reactivationResult.data.planId,
                  planName: reactivationResult.data.planName,
                  maxTerminals: reactivationResult.data.maxTerminals,
                  features: reactivationResult.data.features,
                  businessName: reactivationResult.data.businessName,
                  subscriptionStatus: reactivationResult.data.subscriptionStatus,
                  expiresAt: reactivationResult.data.expiresAt,
                  trialEnd: reactivationResult.data.trialEnd ?? null,
                });

                await logValidationAttempt(
                  "fingerprint_migration",
                  "success",
                  activation.licenseKey,
                  machineIdHash
                );

                // Continue with normal initialization flow
                initializeSSE(activation.licenseKey, machineIdHash, apiBaseUrl);
                startHeartbeatTimer(activation.licenseKey);

                return {
                  success: true,
                  isActivated: true,
                  fingerprintMigrated: true,
                  data: {
                    planId: reactivationResult.data.planId,
                    planName: reactivationResult.data.planName,
                    features: reactivationResult.data.features,
                    businessName: reactivationResult.data.businessName,
                    subscriptionStatus: reactivationResult.data.subscriptionStatus,
                    sseEnabled: true,
                  },
                };
              } else {
                logger.warn("Auto-reactivation failed:", reactivationResult.message);
                await logValidationAttempt(
                  "fingerprint_migration",
                  "failed",
                  activation.licenseKey,
                  machineIdHash,
                  reactivationResult.message
                );
                // Continue to check grace period below
              }
            } catch (reactivationError) {
              logger.error("Auto-reactivation error:", reactivationError);
              // Continue to check grace period below
            }
          }

          // Other validation failures - check grace period
          const withinGracePeriod = isWithinGracePeriod(
            activation.lastHeartbeat
          );

          if (!withinGracePeriod) {
            logger.warn("Startup validation failed and grace period expired");
            await deactivateLocalLicense(activation.id);

            return {
              success: false,
              isActivated: false,
              message: "Unable to verify license and grace period has expired.",
            };
          }

          logger.warn(
            "Startup validation failed, but within grace period:",
            validationResult.message
          );
          await logValidationAttempt(
            "startup_validation",
            "failed_grace",
            activation.licenseKey,
            undefined,
            validationResult.message
          );
        }

        if (validationResult.success && validationResult.data) {
          // Update local status from server
          await updateHeartbeat(validationResult.data.subscriptionStatus);
          await logValidationAttempt(
            "startup_validation",
            "success",
            activation.licenseKey
          );

          // Check if subscription should be disabled
          if (
            ["cancelled", "past_due"].includes(
              validationResult.data.subscriptionStatus
            )
          ) {
            // Check grace period from server
            const daysUntilExpiry = validationResult.data.daysUntilExpiry;
            if (daysUntilExpiry !== null && daysUntilExpiry <= 0) {
              // Grace period expired - disable license
              logger.warn(
                "Startup validation: License disabled - grace period expired"
              );
              await deactivateLocalLicense(activation.id);

              return {
                success: false,
                isActivated: false,
                message:
                  "Your subscription has expired. Please reactivate or renew.",
                subscriptionStatus: validationResult.data.subscriptionStatus,
              };
            }
          }

          logger.info("Startup validation successful:", {
            subscriptionStatus: validationResult.data.subscriptionStatus,
            planId: validationResult.data.planId,
          });
        }
      } catch (validationError) {
        // Network error - check grace period
        const withinGracePeriod = isWithinGracePeriod(activation.lastHeartbeat);

        if (!withinGracePeriod) {
          logger.error(
            "Startup validation network error and grace period expired"
          );
          await deactivateLocalLicense(activation.id);

          return {
            success: false,
            isActivated: false,
            message:
              "Unable to connect to license server and offline grace period has expired.",
          };
        }

        logger.warn(
          "Startup validation network error, but within grace period:",
          validationError
        );
      }

      // ✅ Initialize SSE for real-time subscription updates
      initializeSSE(activation.licenseKey, machineIdHash, apiBaseUrl);

      // ✅ Start backup heartbeat polling (every 15 minutes)
      startHeartbeatTimer(activation.licenseKey);

      // Re-fetch activation in case it was updated
      const currentActivation = await getLocalActivation();
      if (!currentActivation) {
        return {
          success: false,
          isActivated: false,
          message: "License was deactivated during validation",
        };
      }

      return {
        success: true,
        isActivated: true,
        data: {
          planId: currentActivation.planId,
          planName: currentActivation.planName,
          features: currentActivation.features,
          businessName: currentActivation.businessName,
          subscriptionStatus: currentActivation.subscriptionStatus,
          sseEnabled: true,
        },
      };
    } catch (error) {
      logger.error("License initialization error:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Initialization failed",
      };
    }
  });

  /**
   * Get SSE connection status
   */
  ipcMain.handle("license:getSSEStatus", async () => {
    const client = getSSEClient();
    if (!client) {
      return { connected: false, lastHeartbeat: null };
    }
    return client.getConnectionState();
  });

  logger.info("License handlers registered");
}
