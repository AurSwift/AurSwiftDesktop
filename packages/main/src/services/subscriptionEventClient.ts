/**
 * Subscription Event Client (SSE)
 *
 * Real-time event client using Server-Sent Events (SSE) for instant
 * subscription notifications from the web server.
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Event deduplication (idempotency)
 * - Heartbeat monitoring
 * - Graceful degradation to polling if SSE unavailable
 *
 * Events handled:
 * - subscription_cancelled: Immediate or scheduled cancellation
 * - subscription_reactivated: Subscription restored
 * - subscription_updated: Status change (active, past_due, etc.)
 * - subscription_past_due: Payment failed, grace period active
 * - subscription_payment_succeeded: Payment recovered
 * - license_revoked: License disabled by admin
 * - license_reactivated: License restored
 * - plan_changed: Plan upgrade/downgrade
 * - heartbeat_ack: Connection health check
 */

import { EventEmitter } from "events";
import { getLogger } from "../utils/logger.js";
import { app } from "electron";
import { IncomingMessage } from "http";
import https from "https";
import http from "http";

const logger = getLogger("subscriptionEventClient");

// ============================================================================
// CONFIGURATION
// ============================================================================

// Reconnection settings
const INITIAL_RECONNECT_DELAY_MS = 1000; // 1 second
const MAX_RECONNECT_DELAY_MS = 5 * 60 * 1000; // 5 minutes
const RECONNECT_BACKOFF_MULTIPLIER = 2;

// Heartbeat monitoring
const HEARTBEAT_TIMEOUT_MS = 60 * 1000; // Expect heartbeat every 60s (server sends every 30s)

// Event deduplication window
const EVENT_DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// TYPES
// ============================================================================

export type SubscriptionEventType =
  | "subscription_cancelled"
  | "subscription_reactivated"
  | "subscription_updated"
  | "subscription_past_due"
  | "subscription_payment_succeeded"
  | "license_revoked"
  | "license_reactivated"
  | "plan_changed"
  | "heartbeat_ack";

export interface SubscriptionEvent {
  id: string;
  type: SubscriptionEventType;
  timestamp: string;
  licenseKey: string;
  data: Record<string, unknown>;
}

export interface ConnectionState {
  connected: boolean;
  lastHeartbeat: Date | null;
  reconnectAttempts: number;
  error: string | null;
}

// Event handler type
type EventHandler = (event: SubscriptionEvent) => void;

// ============================================================================
// SSE CLIENT CLASS (Native Node.js Implementation)
// ============================================================================

export class SubscriptionEventClient extends EventEmitter {
  private licenseKey: string;
  private machineIdHash: string;
  private apiBaseUrl: string;

  private httpRequest: http.ClientRequest | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatTimeout: NodeJS.Timeout | null = null;
  private reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
  private reconnectAttempts = 0;

  // Event deduplication
  private processedEvents = new Map<string, number>(); // eventId -> timestamp

  // State
  private isConnecting = false;
  private shouldReconnect = true;
  private lastHeartbeat: Date | null = null;
  private lastEventTimestamp: Date | null = null; // Track last event for missed event fetching
  private connected = false;

  // Terminal coordination (Phase 6)
  private heartbeatIntervalId: NodeJS.Timeout | null = null;
  private terminalSessionId: string | null = null;

  constructor(licenseKey: string, machineIdHash: string, apiBaseUrl: string) {
    super();
    this.licenseKey = licenseKey.toUpperCase();
    this.machineIdHash = machineIdHash;
    this.apiBaseUrl = apiBaseUrl;

    // Cleanup old processed events periodically
    setInterval(() => this.cleanupProcessedEvents(), EVENT_DEDUP_WINDOW_MS);
  }

  // =========================================================================
  // CONNECTION MANAGEMENT
  // =========================================================================

  /**
   * Connect to the SSE endpoint
   */
  connect(): void {
    if (this.httpRequest || this.isConnecting) {
      logger.debug("Already connected or connecting");
      return;
    }

    this.shouldReconnect = true;
    this.isConnecting = true;

    const url = `${this.apiBaseUrl}/api/events/${encodeURIComponent(
      this.licenseKey
    )}?machineId=${encodeURIComponent(this.machineIdHash)}`;

    logger.info("Connecting to SSE endpoint:", {
      licenseKey: this.licenseKey.substring(0, 15) + "...",
      machineIdHash: this.machineIdHash.substring(0, 20) + "...",
      fullUrl: url,
      attempt: this.reconnectAttempts + 1,
    });

    try {
      // Parse URL to determine http or https
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === "https:";
      const httpModule = isHttps ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      };

      this.httpRequest = httpModule.request(
        options,
        (response: IncomingMessage) => {
          if (response.statusCode !== 200) {
            // Read response body for error details
            let errorBody = "";
            response.on("data", (chunk: Buffer) => {
              errorBody += chunk.toString();
            });
            response.on("end", () => {
              logger.error("SSE connection rejected by server", {
                statusCode: response.statusCode,
                statusMessage: response.statusMessage,
                errorBody: errorBody.substring(0, 500),
                url: `${parsedUrl.hostname}${parsedUrl.pathname}`,
              });

              // 🔴 CRITICAL: If we get 401, the license is likely revoked
              // Emit event to trigger immediate validation instead of waiting for next heartbeat
              if (response.statusCode === 401) {
                logger.warn(
                  "401 Unauthorized - license may be revoked, triggering immediate validation"
                );
                this.emit("license_validation_required", {
                  reason: "SSE connection rejected with 401",
                  statusCode: 401,
                });
              }
            });
            this.handleDisconnect();
            return;
          }

          this.isConnecting = false;
          this.connected = true;
          this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
          this.reconnectAttempts = 0;

          logger.info("SSE connection established successfully", {
            licenseKey: this.licenseKey.substring(0, 15) + "...",
          });
          this.emit("connected");
          this.startHeartbeatMonitor();

          // Register terminal session (Phase 6)
          this.registerTerminalSession();

          let buffer = "";

          response.on("data", (chunk: Buffer) => {
            buffer += chunk.toString();

            // Process complete SSE messages
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || ""; // Keep incomplete message in buffer

            for (const message of lines) {
              this.parseSSEMessage(message);
            }
          });

          response.on("end", () => {
            logger.info("SSE connection ended by server");
            this.handleDisconnect();
          });

          response.on("error", (error) => {
            logger.error("SSE response error:", error);
            this.handleDisconnect();
          });
        }
      );

      this.httpRequest.on("error", (error) => {
        logger.error("SSE request error:", error);
        logger.error("SSE request error:", error);
        this.isConnecting = false;
        this.handleDisconnect();
      });

      this.httpRequest.end();
    } catch (error) {
        logger.error("Failed to create SSE connection:", error);
      logger.error("Failed to create SSE connection:", error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Parse SSE message format
   */
  private parseSSEMessage(message: string): void {
    const lines = message.split("\n");
    let eventType = "message";
    let data = "";
    let eventId = "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        data += line.slice(5).trim();
      } else if (line.startsWith("id:")) {
        eventId = line.slice(3).trim();
      }
    }

    if (data) {
      this.handleEventMessage(eventType, data, eventId);
    }
  }

  /**
   * Handle parsed SSE event
   */
  private handleEventMessage(
    eventType: string,
    data: string,
    eventId: string
  ): void {
    try {
      logger.debug("Received SSE message", {
        eventType,
        eventId,
        dataPreview: data.substring(0, 100),
      });

      // Handle heartbeat - these are not stored as events
      if (eventType === "heartbeat" || eventType === "heartbeat_ack") {
        this.lastHeartbeat = new Date();
        this.resetHeartbeatTimeout();
        logger.debug("Heartbeat received from server");
        return;
      }

      logger.debug("Processing non-heartbeat event", { eventType });

      // Deduplicate events
      if (eventId && this.processedEvents.has(eventId)) {
        logger.debug("Skipping duplicate event", { eventId });
        return;
      }

      if (eventId) {
        this.processedEvents.set(eventId, Date.now());
      }

      // Parse and emit event
      const parsedData = JSON.parse(data);
      const event: SubscriptionEvent = {
        id: eventId || `${Date.now()}`,
        type: eventType as SubscriptionEventType,
        timestamp: new Date().toISOString(),
        licenseKey: this.licenseKey,
        data: parsedData,
      };

      // Track last event timestamp for missed event fetching
      this.lastEventTimestamp = new Date(event.timestamp);

      logger.info("SSE event received, emitting to handlers", {
        type: eventType,
        id: eventId,
      });
      this.emit("event", event);
    } catch (error) {
      logger.error("Failed to parse SSE event:", error);
    }
  }

  /**
   * Disconnect from the SSE endpoint
   */
  disconnect(): void {
    this.shouldReconnect = false;

    // Disconnect terminal session (Phase 6)
    this.disconnectTerminalSession();

    this.cleanup();
    logger.info("SSE client disconnected");
    this.emit("disconnected");
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return {
      connected: this.connected,
      lastHeartbeat: this.lastHeartbeat,
      reconnectAttempts: this.reconnectAttempts,
      error: null,
    };
  }

  // =========================================================================
  // EVENT HANDLING
  // =========================================================================
  // (Event subscription handled in parseSSEMessage)
  // =========================================================================

  /**
   * Handle incoming event
   */
  private handleEvent(eventType: SubscriptionEventType, data: string): void {
    try {
      const event = JSON.parse(data) as SubscriptionEvent;

      // Deduplicate events
      if (this.processedEvents.has(event.id)) {
        logger.debug(`Ignoring duplicate event: ${event.id}`);
        return;
      }
      this.processedEvents.set(event.id, Date.now());

      // Handle heartbeat separately
      if (eventType === "heartbeat_ack") {
        this.handleHeartbeat(event);
        return;
      }

      logger.info(`Received subscription event: ${eventType}`, {
        eventId: event.id,
        licenseKey: event.licenseKey.substring(0, 15) + "...",
      });

      // Emit the event for handlers to process
      this.emit("event", event);
      this.emit(eventType, event);
    } catch (error) {
      logger.error("Failed to process event:", error);
    }
  }

  /**
   * Handle heartbeat event
   */
  private handleHeartbeat(event: SubscriptionEvent): void {
    this.lastHeartbeat = new Date();
    this.resetHeartbeatTimeout();
    logger.debug("Heartbeat received from server");
  }

  // =========================================================================
  // HEARTBEAT MONITORING
  // =========================================================================

  /**
   * Start monitoring for heartbeats
   */
  private startHeartbeatMonitor(): void {
    this.resetHeartbeatTimeout();
  }

  /**
   * Reset heartbeat timeout
   */
  private resetHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
    }

    this.heartbeatTimeout = setTimeout(() => {
      logger.warn("Heartbeat timeout - reconnecting");
      this.handleDisconnect();
    }, HEARTBEAT_TIMEOUT_MS);
  }

  // =========================================================================
  // RECONNECTION LOGIC
  // =========================================================================

  /**
   * Handle disconnection
   */
  private handleDisconnect(): void {
    this.cleanup();

    if (this.shouldReconnect) {
      this.emit("disconnected");
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    logger.info(`Scheduling reconnect in ${this.reconnectDelay / 1000}s`);

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectAttempts++;

      // Fetch missed events before resuming SSE connection
      await this.fetchMissedEvents();

      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff
    this.reconnectDelay = Math.min(
      this.reconnectDelay * RECONNECT_BACKOFF_MULTIPLIER,
      MAX_RECONNECT_DELAY_MS
    );
  }

  /**
   * Fetch events missed during disconnection
   */
  private async fetchMissedEvents(): Promise<void> {
    // Only fetch if we have a last event timestamp
    if (!this.lastEventTimestamp) {
      logger.debug(
        "No lastEventTimestamp recorded, skipping missed events fetch"
      );
      return;
    }

    try {
      const url = `${this.apiBaseUrl}/api/events/${encodeURIComponent(
        this.licenseKey
      )}/missed?since=${encodeURIComponent(
        this.lastEventTimestamp.toISOString()
      )}`;

      logger.info("Fetching missed events since:", {
        timestamp: this.lastEventTimestamp.toISOString(),
      });

      // Parse URL to determine http or https
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === "https:";
      const httpModule = isHttps ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      };

      const response = await new Promise<{
        events: SubscriptionEvent[];
        count: number;
        hasMore: boolean;
      }>((resolve, reject) => {
        const request = httpModule.request(options, (res: IncomingMessage) => {
          if (res.statusCode !== 200) {
            reject(
              new Error(
                `HTTP ${res.statusCode}: ${
                  res.statusMessage || "Unknown error"
                }`
              )
            );
            return;
          }

          let body = "";
          res.on("data", (chunk: Buffer) => {
            body += chunk.toString();
          });
          res.on("end", () => {
            try {
              const parsed = JSON.parse(body);
              resolve(parsed);
            } catch (error) {
              reject(error);
            }
          });
        });

        request.on("error", reject);
        request.end();
      });

      if (response.events.length > 0) {
        logger.info(
          `Fetched ${response.count} missed events (hasMore: ${response.hasMore})`
        );

        // Process missed events in chronological order (oldest first)
        const sortedEvents = response.events.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        for (const event of sortedEvents) {
          // Skip if already processed (deduplication)
          if (this.processedEvents.has(event.id)) {
            logger.debug(`Skipping already processed event: ${event.id}`);
            continue;
          }

          this.processedEvents.set(event.id, Date.now());
          this.lastEventTimestamp = new Date(event.timestamp);

          logger.info("Processing missed event:", {
            type: event.type,
            id: event.id,
          });
          this.emit("event", event);
        }

        if (response.hasMore) {
          logger.warn(
            "More than 100 missed events detected. Some events may be lost. Consider reducing disconnection time."
          );
        }
      } else {
        logger.debug("No missed events");
      }
    } catch (error) {
      logger.error("Failed to fetch missed events:", error);
      // Don't fail reconnection if missed events fetch fails
      // We'll continue with normal SSE connection
    }
  }

  // =========================================================================
  // EVENT ACKNOWLEDGMENT (Phase 4: Event Durability & Reliability)
  // =========================================================================

  /**
   * Send acknowledgment to server after processing an event
   * This enables the server to track successful event delivery and identify failures
   */
  async sendAcknowledgment(
    eventId: string,
    status: "success" | "failed" | "skipped",
    errorMessage?: string,
    processingTimeMs?: number
  ): Promise<void> {
    try {
      const url = `${this.apiBaseUrl}/api/events/acknowledge`;
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === "https:";
      const httpModule = isHttps ? https : http;

      const payload = JSON.stringify({
        eventId,
        licenseKey: this.licenseKey,
        machineIdHash: this.machineIdHash,
        status,
        errorMessage,
        processingTimeMs,
      });

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      };

      await new Promise<void>((resolve, reject) => {
        const request = httpModule.request(options, (res: IncomingMessage) => {
          if (res.statusCode !== 200) {
            logger.warn(
              `Failed to send acknowledgment for ${eventId}: HTTP ${res.statusCode}`
            );
            // Don't reject - acknowledgment is best-effort
            resolve();
            return;
          }

          let body = "";
          res.on("data", (chunk: Buffer) => {
            body += chunk.toString();
          });
          res.on("end", () => {
            logger.debug(`Acknowledgment sent for event ${eventId}`);
            resolve();
          });
        });

        request.on("error", (error) => {
          logger.warn(`Failed to send acknowledgment for ${eventId}:`, error);
          // Don't reject - acknowledgment is best-effort
          resolve();
        });

        request.write(payload);
        request.end();
      });
    } catch (error) {
      logger.warn(`Failed to send acknowledgment for ${eventId}:`, error);
      // Acknowledgment is best-effort - don't fail event processing
    }
  }

  // =========================================================================
  // CLEANUP
  // =========================================================================

  /**
   * Clean up resources
   */
  private cleanup(): void {
    this.isConnecting = false;
    this.connected = false;

    if (this.httpRequest) {
      this.httpRequest.destroy();
      this.httpRequest = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Clean up old processed events to prevent memory leak
   */
  private cleanupProcessedEvents(): void {
    const now = Date.now();
    for (const [eventId, timestamp] of this.processedEvents) {
      if (now - timestamp > EVENT_DEDUP_WINDOW_MS) {
        this.processedEvents.delete(eventId);
      }
    }
  }

  // =========================================================================
  // TERMINAL COORDINATION (Phase 6)
  // =========================================================================

  /**
   * Register Terminal Session
   * Called when terminal connects to track multi-terminal deployments
   */
  private async registerTerminalSession(): Promise<void> {
    try {
      const os = await import("os");

      const terminalInfo = {
        terminalName: os.hostname(),
        hostname: os.hostname(),
        appVersion: app.getVersion(),
        metadata: {
          platform: process.platform,
          arch: process.arch,
          osRelease: os.release(),
        },
      };

      const response = await this.makeApiRequest(
        "/api/terminal-sessions",
        "POST",
        {
          action: "register",
          licenseKey: this.licenseKey,
          machineIdHash: this.machineIdHash,
          terminalInfo,
        }
      );

      if (response.success) {
        this.terminalSessionId = response.sessionId;
        logger.info("Terminal session registered", {
          sessionId: response.sessionId,
        });

        // Start heartbeat updates (every 2 minutes)
        this.startTerminalHeartbeat();
      }
    } catch (error) {
      logger.error("Failed to register terminal session:", error);
    }
  }

  /**
   * Start Terminal Heartbeat
   * Sends periodic heartbeat to keep terminal session alive
   */
  private startTerminalHeartbeat(): void {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
    }

    this.heartbeatIntervalId = setInterval(async () => {
      try {
        await this.makeApiRequest("/api/terminal-sessions", "POST", {
          action: "heartbeat",
          licenseKey: this.licenseKey,
          machineIdHash: this.machineIdHash,
        });
        logger.debug("Terminal heartbeat sent");
      } catch (error) {
        logger.error("Failed to send terminal heartbeat:", error);
      }
    }, 2 * 60 * 1000); // Every 2 minutes
  }

  /**
   * Disconnect Terminal Session
   * Called when terminal disconnects or app closes
   */
  private async disconnectTerminalSession(): Promise<void> {
    try {
      if (this.heartbeatIntervalId) {
        clearInterval(this.heartbeatIntervalId);
        this.heartbeatIntervalId = null;
      }

      await this.makeApiRequest("/api/terminal-sessions", "POST", {
        action: "disconnect",
        licenseKey: this.licenseKey,
        machineIdHash: this.machineIdHash,
      });

      logger.info("Terminal session disconnected");
    } catch (error) {
      logger.error("Failed to disconnect terminal session:", error);
    }
  }

  /**
   * Make API Request Helper
   */
  private async makeApiRequest(
    path: string,
    method: "GET" | "POST" | "PATCH" = "GET",
    body?: unknown
  ): Promise<any> {
    const url = `${this.apiBaseUrl}${path}`;

    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === "https:";
    const httpModule = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: {
          "Content-Type": "application/json",
        },
      };

      const req = httpModule.request(options, (res: IncomingMessage) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (
              res.statusCode &&
              res.statusCode >= 200 &&
              res.statusCode < 300
            ) {
              resolve(json);
            } else {
              reject(new Error(json.error || `HTTP ${res.statusCode}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on("error", (error: Error) => {
        reject(error);
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }
}

// ============================================================================
// SINGLETON INSTANCE & FACTORY
// ============================================================================

let sseClientInstance: SubscriptionEventClient | null = null;

/**
 * Initialize the SSE client
 */
export function initializeSSEClient(
  licenseKey: string,
  machineIdHash: string,
  apiBaseUrl: string
): SubscriptionEventClient {
  // Clean up existing instance
  if (sseClientInstance) {
    sseClientInstance.disconnect();
  }

  sseClientInstance = new SubscriptionEventClient(
    licenseKey,
    machineIdHash,
    apiBaseUrl
  );

  return sseClientInstance;
}

/**
 * Get the current SSE client instance
 */
export function getSSEClient(): SubscriptionEventClient | null {
  return sseClientInstance;
}

/**
 * Disconnect and cleanup the SSE client
 */
export function disconnectSSEClient(): void {
  if (sseClientInstance) {
    sseClientInstance.disconnect();
    sseClientInstance = null;
  }
}
