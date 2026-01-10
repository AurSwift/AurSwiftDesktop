/**
 * License Service
 *
 * HTTP client for communicating with the web license API.
 * Handles activation, validation, heartbeat, and deactivation.
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Offline detection and graceful degradation
 * - Request/response logging for debugging
 * - Timeout handling
 * - Secure API URL validation
 */

import { getLogger } from "../utils/logger.js";
import {
  generateMachineFingerprint,
  getMachineInfo,
} from "../utils/machineFingerprint.js";
import { getLocalIPAddress } from "../utils/networkInfo.js";
import { app } from "electron";

const logger = getLogger("licenseService");

// API Configuration
const DEFAULT_API_BASE_URL =
  process.env.LICENSE_API_URL || "http://localhost:3000";
const API_TIMEOUT_MS = 90000; // 90 seconds (allows for Neon free tier cold start)
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // Base delay, will be multiplied exponentially

// Allowed domains for API requests (security)
const ALLOWED_API_DOMAINS = [
  "localhost",
  "127.0.0.1",
  "auraswift.io",
  "api.auraswift.io",
  "www.auraswift.io",
  // Add staging/dev domains as needed
  "staging.auraswift.io",
  "dev.auraswift.io",
] as const;

// ============================================================================
// URL VALIDATION (SECURITY)
// ============================================================================

/**
 * Validate that an API URL is from an allowed domain
 * Prevents SSRF attacks and ensures requests only go to trusted servers
 */
function validateApiUrl(urlString: string): { valid: boolean; error?: string } {
  try {
    const url = new URL(urlString);

    // Only allow http/https protocols
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return {
        valid: false,
        error: `Invalid protocol: ${url.protocol}. Only http/https allowed.`,
      };
    }

    // Check if hostname is in allowed list
    const hostname = url.hostname.toLowerCase();
    const isAllowed = ALLOWED_API_DOMAINS.some((domain) => {
      // Exact match
      if (hostname === domain) return true;
      // Subdomain match (e.g., api.auraswift.io matches *.auraswift.io)
      if (domain.includes(".") && hostname.endsWith(`.${domain}`)) return true;
      return false;
    });

    if (!isAllowed) {
      return {
        valid: false,
        error: `Domain not allowed: ${hostname}. Contact support if this is unexpected.`,
      };
    }

    // Block localhost in production
    const isProduction =
      app.isPackaged || process.env.NODE_ENV === "production";
    if (
      isProduction &&
      (hostname === "localhost" || hostname === "127.0.0.1")
    ) {
      return {
        valid: false,
        error: "Localhost not allowed in production builds.",
      };
    }

    // Block private IP ranges (SSRF protection)
    const privateIpPatterns = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^0\./,
      /^169\.254\./,
    ];

    for (const pattern of privateIpPatterns) {
      if (pattern.test(hostname) && hostname !== "127.0.0.1") {
        return {
          valid: false,
          error: "Private IP addresses are not allowed.",
        };
      }
    }

    return { valid: true };
  } catch {
    return {
      valid: false,
      error: "Invalid URL format.",
    };
  }
}

/**
 * Get validated API base URL
 */
function getValidatedApiBaseUrl(customUrl?: string): string {
  const urlToUse = customUrl || DEFAULT_API_BASE_URL;
  const validation = validateApiUrl(urlToUse);

  if (!validation.valid) {
    logger.error("API URL validation failed:", validation.error);
    throw new Error(`Invalid API URL: ${validation.error}`);
  }

  return urlToUse;
}

// ============================================================================
// TYPES
// ============================================================================

export interface ActivationRequest {
  licenseKey: string;
  terminalName?: string;
}

export interface ActivationResponse {
  success: boolean;
  message: string;
  data?: {
    activationId: string;
    planId: string;
    planName: string;
    maxTerminals: number;
    currentActivations: number;
    features: string[];
    expiresAt: string | null;
    subscriptionStatus: string;
    businessName: string | null;
  };
}

export interface ValidationResponse {
  success: boolean;
  message: string;
  code?: string; // e.g., "LICENSE_REVOKED" for revoked licenses
  revocationReason?: string; // Reason for revocation
  data?: {
    isValid: boolean;
    planId: string;
    planName: string;
    features: string[];
    subscriptionStatus: string;
    expiresAt: string | null;
    daysUntilExpiry: number | null;
  };
}

export interface HeartbeatResponse {
  success: boolean;
  message: string;
  data?: {
    isValid: boolean;
    planId: string;
    subscriptionStatus: string;
    shouldDisable: boolean;
    gracePeriodRemaining: number | null;
    heartbeatIntervalMs?: number; // Dynamic interval from server
  };
}

export interface DeactivationResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// HTTP CLIENT UTILITIES
// ============================================================================

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make HTTP request with retry logic and secure URL validation
 */
async function makeRequest<T>(
  endpoint: string,
  options: {
    method: "GET" | "POST";
    body?: object;
    apiBaseUrl?: string;
  }
): Promise<{ success: boolean; data?: T; error?: string; offline?: boolean }> {
  const { method, body, apiBaseUrl } = options;

  // Validate and get API base URL (throws on invalid URL)
  let validatedBaseUrl: string;
  try {
    validatedBaseUrl = getValidatedApiBaseUrl(apiBaseUrl);
  } catch (error) {
    logger.error("URL validation failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Invalid API URL",
    };
  }

  const url = `${validatedBaseUrl}/api/license/${endpoint}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Log without sensitive data
      logger.debug(`License API request (attempt ${attempt}/${MAX_RETRIES}):`, {
        endpoint,
        method,
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": `aurswift-Desktop/${app.getVersion()}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      logger.debug("License API response:", {
        status: response.status,
        success: data.success,
      });

      return {
        success: data.success,
        data: data as T,
        error: data.success ? undefined : data.message,
      };
    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Check if offline
      if (
        errorMessage.includes("ENOTFOUND") ||
        errorMessage.includes("ECONNREFUSED") ||
        errorMessage.includes("network") ||
        errorMessage.includes("fetch failed")
      ) {
        logger.warn(
          `License API offline (attempt ${attempt}/${MAX_RETRIES}):`,
          errorMessage
        );

        if (isLastAttempt) {
          return {
            success: false,
            error:
              "Unable to connect to license server. Please check your internet connection.",
            offline: true,
          };
        }
      } else if (errorMessage.includes("aborted")) {
        logger.warn(`License API timeout (attempt ${attempt}/${MAX_RETRIES})`);

        if (isLastAttempt) {
          return {
            success: false,
            error: "License server request timed out. Please try again.",
            offline: true,
          };
        }
      } else {
        logger.error(
          `License API error (attempt ${attempt}/${MAX_RETRIES}):`,
          error
        );

        if (isLastAttempt) {
          return {
            success: false,
            error: `License server error: ${errorMessage}`,
          };
        }
      }

      // Exponential backoff before retry
      await sleep(RETRY_DELAY_MS * Math.pow(2, attempt - 1));
    }
  }

  return {
    success: false,
    error: "Maximum retry attempts exceeded",
  };
}

// ============================================================================
// LICENSE API METHODS
// ============================================================================

/**
 * Activate a license key for this machine
 */
export async function activateLicense(
  request: ActivationRequest,
  apiBaseUrl?: string
): Promise<ActivationResponse> {
  try {
    // Generate machine fingerprint
    const machineIdHash = generateMachineFingerprint();
    const machineInfo = getMachineInfo();

    // Try to get local IP, but don't fail if unavailable
    let localIP: string | null = null;
    try {
      localIP = getLocalIPAddress();
    } catch (error) {
      logger.warn("Failed to get local IP address:", error);
    }

    logger.info("Activating license:", {
      licenseKey: request.licenseKey.substring(0, 15) + "...",
      terminalName: request.terminalName,
      machine: machineInfo.hostname,
      ip: localIP || "unavailable",
    });

    const result = await makeRequest<ActivationResponse>("activate", {
      method: "POST",
      body: {
        licenseKey: request.licenseKey,
        machineIdHash,
        terminalName:
          request.terminalName || `${machineInfo.hostname} - Terminal`,
        appVersion: app.getVersion(),
        ...(localIP && { ipAddress: localIP }),
        location: {
          platform: machineInfo.platform,
          arch: machineInfo.arch,
        },
      },
      apiBaseUrl,
    });

    if (!result.success) {
      return {
        success: false,
        message: result.error || "Activation failed",
      };
    }

    const response = result.data!;

    if (response.success && response.data) {
      logger.info("License activated successfully:", {
        planId: response.data.planId,
        activationId: response.data.activationId,
      });
    }

    return response;
  } catch (error) {
    logger.error("License activation error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Activation failed",
    };
  }
}

/**
 * Validate an activated license
 */
export async function validateLicense(
  licenseKey: string,
  checkMachine: boolean = true,
  apiBaseUrl?: string
): Promise<ValidationResponse> {
  try {
    const machineIdHash = checkMachine
      ? generateMachineFingerprint()
      : undefined;

    logger.debug("Validating license:", {
      licenseKey: licenseKey.substring(0, 15) + "...",
      checkMachine,
    });

    const result = await makeRequest<ValidationResponse>("validate", {
      method: "POST",
      body: {
        licenseKey,
        machineIdHash,
      },
      apiBaseUrl,
    });

    // Log the full response for debugging
    logger.debug("Validation result:", {
      success: result.success,
      code: (result.data as any)?.code,
      message: result.error || (result.data as any)?.message,
    });

    if (!result.success) {
      // Pass through the full response including code and revocationReason
      const responseData = result.data as any;
      return {
        success: false,
        message: result.error || responseData?.message || "Validation failed",
        code: responseData?.code,
        revocationReason: responseData?.revocationReason,
      } as ValidationResponse;
    }

    return result.data!;
  } catch (error) {
    logger.error("License validation error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Validation failed",
    };
  }
}

/**
 * Send heartbeat to maintain activation
 */
export async function sendHeartbeat(
  licenseKey: string,
  metadata?: {
    sessionCount?: number;
    transactionCount?: number;
  },
  apiBaseUrl?: string
): Promise<HeartbeatResponse> {
  try {
    const machineIdHash = generateMachineFingerprint();

    logger.debug("Sending heartbeat:", {
      licenseKey: licenseKey.substring(0, 15) + "...",
    });

    const result = await makeRequest<HeartbeatResponse>("heartbeat", {
      method: "POST",
      body: {
        licenseKey,
        machineIdHash,
        appVersion: app.getVersion(),
        ...metadata,
      },
      apiBaseUrl,
    });

    if (!result.success) {
      // If offline, return a special response that allows grace period
      if (result.offline) {
        return {
          success: false,
          message: result.error || "Heartbeat failed - offline",
          data: {
            isValid: true, // Allow grace period
            planId: "",
            subscriptionStatus: "offline",
            shouldDisable: false,
            gracePeriodRemaining: null,
          },
        };
      }

      // 🔴 CRITICAL FIX: Pass through the server's data object which contains shouldDisable
      // The server returns { success: false, message: "...", data: { shouldDisable: true, ... } }
      // result.data is the FULL server response, so we need result.data.data for the inner data
      const serverResponse = result.data as HeartbeatResponse | undefined;
      return {
        success: false,
        message: result.error || "Heartbeat failed",
        data: serverResponse?.data,
      };
    }

    return result.data!;
  } catch (error) {
    logger.error("Heartbeat error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Heartbeat failed",
    };
  }
}

/**
 * Deactivate license on this machine
 */
export async function deactivateLicense(
  licenseKey: string,
  apiBaseUrl?: string
): Promise<DeactivationResponse> {
  try {
    const machineIdHash = generateMachineFingerprint();

    logger.info("Deactivating license:", {
      licenseKey: licenseKey.substring(0, 15) + "...",
    });

    const result = await makeRequest<DeactivationResponse>("deactivate", {
      method: "POST",
      body: {
        licenseKey,
        machineIdHash,
      },
      apiBaseUrl,
    });

    if (!result.success) {
      return {
        success: false,
        message: result.error || "Deactivation failed",
      };
    }

    return result.data!;
  } catch (error) {
    logger.error("License deactivation error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Deactivation failed",
    };
  }
}

/**
 * Get machine fingerprint (for display in activation UI)
 */
export function getMachineFingerprint(): string {
  return generateMachineFingerprint();
}

/**
 * Get machine info for display
 */
export { getMachineInfo };
