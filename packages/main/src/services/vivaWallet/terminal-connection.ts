/**
 * Terminal Connection Manager for Viva Wallet
 * Manages terminal connections, health monitoring, and reconnection logic
 */

import { getLogger } from "../../utils/logger.js";
import { VivaWalletHTTPClient } from "./http-client.js";
import type { Terminal } from "./types.js";

const logger = getLogger("TerminalConnection");

// =============================================================================
// TERMINAL CONNECTION
// =============================================================================

export class TerminalConnection {
  private connectionState:
    | "disconnected"
    | "connecting"
    | "connected"
    | "error" = "disconnected";
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastHealthCheck: Date | null = null;
  private connectionMetrics = {
    latency: 0,
    uptime: 0,
    lastConnectedAt: null as Date | null,
    reconnectAttempts: 0,
  };

  /**
   * Connect to terminal
   */
  async connect(terminal: Terminal): Promise<boolean> {
    this.connectionState = "connecting";

    try {
      const httpClient = new VivaWalletHTTPClient(terminal);
      const health = await httpClient.healthCheck({ timeout: 10000 });

      if (health.success) {
        this.connectionState = "connected";
        this.connectionMetrics.lastConnectedAt = new Date();
        this.connectionMetrics.reconnectAttempts = 0;
        this.startHealthMonitoring(terminal);
        logger.info(`Connected to terminal: ${terminal.id}`);
        return true;
      }

      this.connectionState = "error";
      return false;
    } catch (error) {
      this.connectionState = "error";
      logger.error(`Failed to connect to terminal ${terminal.id}:`, error);
      return false;
    }
  }

  /**
   * Disconnect from terminal
   */
  disconnect(): void {
    this.stopHealthMonitoring();
    this.connectionState = "disconnected";
    this.connectionMetrics = {
      latency: 0,
      uptime: 0,
      lastConnectedAt: null,
      reconnectAttempts: 0,
    };
    logger.info("Disconnected from terminal");
  }

  /**
   * Get connection state
   */
  getConnectionState(): "disconnected" | "connecting" | "connected" | "error" {
    return this.connectionState;
  }

  /**
   * Get connection metrics
   */
  getConnectionMetrics() {
    return {
      ...this.connectionMetrics,
      connectionState: this.connectionState,
      lastHealthCheck: this.lastHealthCheck,
    };
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(terminal: Terminal): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        const startTime = Date.now();
        const httpClient = new VivaWalletHTTPClient(terminal);
        const health = await httpClient.healthCheck({ timeout: 5000 });
        const latency = Date.now() - startTime;

        this.connectionMetrics.latency = latency;
        this.lastHealthCheck = new Date();

        if (!health.success) {
          this.connectionState = "error";
          await this.handleConnectionLoss(terminal);
        } else {
          this.connectionState = "connected";
          // Update uptime
          if (this.connectionMetrics.lastConnectedAt) {
            this.connectionMetrics.uptime =
              Date.now() - this.connectionMetrics.lastConnectedAt.getTime();
          }
        }
      } catch (error) {
        logger.warn(`Health check failed for ${terminal.id}:`, error);
        this.connectionState = "error";
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Handle connection loss
   */
  private async handleConnectionLoss(terminal: Terminal): Promise<void> {
    logger.warn(`Connection lost to terminal: ${terminal.id}`);
    // Could implement automatic reconnection logic here if needed
  }
}
