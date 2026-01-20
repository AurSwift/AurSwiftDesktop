/**
 * Viva Wallet Service for Electron Main Process
 * Main orchestrator service for Viva Wallet Local Terminal API integration
 */

import { ipcMain } from "electron";
import { getLogger } from "../../utils/logger.js";
import { VivaWalletConfigManager } from "./config.js";
import { TerminalDiscovery } from "./terminal-discovery.js";
import { TransactionManager } from "./transaction-manager.js";
import { VivaWalletHTTPClient } from "./http-client.js";
import type {
  Terminal,
  VivaWalletConfig,
  VivaWalletSaleRequest,
  VivaWalletRefundRequest,
  DiscoverTerminalsResponse,
  ConnectTerminalResponse,
  TransactionResponse,
  VivaWalletTransactionResponse,
} from "./types.js";

const logger = getLogger("VivaWalletService");

// =============================================================================
// VIVA WALLET SERVICE
// =============================================================================

export class VivaWalletService {
  private configManager: VivaWalletConfigManager;
  private terminalDiscovery: TerminalDiscovery;
  private transactionManager: TransactionManager;
  private connectedTerminal: Terminal | null = null;
  private isInitialized = false;

  constructor() {
    this.configManager = new VivaWalletConfigManager();
    this.terminalDiscovery = new TerminalDiscovery();
    this.transactionManager = new TransactionManager();
    this.setupIpcHandlers();
    logger.info("VivaWalletService initialized");
  }

  /**
   * Fetch the raw terminal transaction status payload.
   *
   * Used by the POS to persist card-slip metadata (authCode/card brand/last4/type)
   * for later receipt printing/reprints.
   */
  async fetchTerminalTransactionResponse(
    terminalTransactionId: string
  ): Promise<VivaWalletTransactionResponse | null> {
    try {
      if (!this.connectedTerminal) return null;
      const httpClient = new VivaWalletHTTPClient(this.connectedTerminal);
      const response = await httpClient.get<VivaWalletTransactionResponse>(
        `/api/transactions/${terminalTransactionId}/status`
      );
      return response;
    } catch (error) {
      logger.warn(
        `Failed to fetch terminal transaction status for ${terminalTransactionId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Setup IPC handlers for renderer communication
   */
  private setupIpcHandlers(): void {
    // Terminal Discovery
    ipcMain.handle("viva:discover-terminals", async () => {
      try {
        logger.info("Discovering terminals...");
        const terminals = await this.terminalDiscovery.discoverTerminals();
        return {
          success: true,
          terminals,
        } as DiscoverTerminalsResponse;
      } catch (error) {
        logger.error("Terminal discovery failed:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Discovery failed",
          terminals: [],
        } as DiscoverTerminalsResponse;
      }
    });

    // Connect Terminal
    ipcMain.handle(
      "viva:connect-terminal",
      async (event, terminalId: string) => {
        try {
          const config = await this.configManager.loadConfig();
          const terminal = config.terminals.find((t) => t.id === terminalId);

          if (!terminal) {
            return {
              success: false,
              error: "Terminal not found",
            } as ConnectTerminalResponse;
          }

          // Verify connection
          const terminalForConnection: Terminal = {
            id: terminal.id,
            name: terminal.name,
            ipAddress: terminal.ipAddress,
            port: terminal.port,
            status: "online",
            capabilities: [],
            lastSeen: new Date(),
            connectionType: "wifi",
            terminalType: terminal.terminalType || "dedicated",
            paymentCapabilities: {
              supportsNFC: false,
              supportsCardReader: false,
              supportsChip: false,
              supportsSwipe: false,
              supportsTap: false,
            },
            apiKey: terminal.apiKey,
          };

          const isConnected = await this.terminalDiscovery.verifyConnection(
            terminalForConnection
          );

          if (isConnected) {
            // Detect capabilities
            const capabilities =
              await this.terminalDiscovery.detectTerminalCapabilities(
                terminalForConnection
              );
            terminalForConnection.paymentCapabilities = {
              supportsNFC: capabilities.nfcEnabled,
              supportsCardReader: capabilities.hasCardReader,
              supportsChip:
                capabilities.supportedPaymentMethods.includes("chip"),
              supportsSwipe:
                capabilities.supportedPaymentMethods.includes("swipe"),
              supportsTap: capabilities.supportedPaymentMethods.includes("tap"),
            };
            terminalForConnection.terminalType = capabilities.isDeviceBased
              ? "device-based"
              : "dedicated";
            if (capabilities.deviceType) {
              terminalForConnection.deviceInfo = {
                platform: capabilities.deviceType,
              };
            }

            this.connectedTerminal = terminalForConnection;
            logger.info(`Connected to terminal: ${terminalId}`);

            return {
              success: true,
              terminal: terminalForConnection,
            } as ConnectTerminalResponse;
          } else {
            return {
              success: false,
              error: "Failed to connect to terminal",
            } as ConnectTerminalResponse;
          }
        } catch (error) {
          logger.error("Terminal connection failed:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : "Connection failed",
          } as ConnectTerminalResponse;
        }
      }
    );

    // Disconnect Terminal
    ipcMain.handle("viva:disconnect-terminal", async () => {
      try {
        this.connectedTerminal = null;
        logger.info("Terminal disconnected");
        return { success: true };
      } catch (error) {
        logger.error("Terminal disconnection failed:", error);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Disconnection failed",
        };
      }
    });

    // Get Terminal Status
    ipcMain.handle("viva:terminal-status", async () => {
      try {
        if (!this.connectedTerminal) {
          return {
            success: false,
            error: "No terminal connected",
          };
        }

        const status = await this.terminalDiscovery.verifyConnection(
          this.connectedTerminal
        );
        return {
          success: true,
          status: status ? "connected" : "disconnected",
          terminal: this.connectedTerminal,
        };
      } catch (error) {
        logger.error("Get terminal status failed:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Status check failed",
        };
      }
    });

    // Initiate Sale
    ipcMain.handle(
      "viva:initiate-sale",
      async (event, amount: number, currency: string) => {
        try {
          if (!this.connectedTerminal) {
            return {
              success: false,
              error: "No terminal connected",
            } as TransactionResponse;
          }

          const request: VivaWalletSaleRequest = {
            amount: Math.round(amount * 100), // Convert to minor units (cents)
            currency: currency.toUpperCase(),
            reference: `POS-${Date.now()}-${Math.random()
              .toString(36)
              .substring(2, 9)
              .toUpperCase()}`,
            description: `Payment ${amount} ${currency}`,
          };

          const result = await this.transactionManager.initiateSale(
            this.connectedTerminal,
            request
          );

          return {
            success: true,
            transactionId: result.transactionId,
            terminalTransactionId: result.terminalTransactionId,
          } as TransactionResponse;
        } catch (error) {
          logger.error("Transaction initiation failed:", error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Transaction initiation failed",
          } as TransactionResponse;
        }
      }
    );

    // Get Transaction Status
    ipcMain.handle(
      "viva:transaction-status",
      async (event, transactionId: string) => {
        try {
          if (!this.connectedTerminal) {
            return {
              success: false,
              error: "No terminal connected",
            };
          }

          const activeTransaction =
            this.transactionManager.getActiveTransaction(transactionId);
          if (!activeTransaction) {
            return {
              success: false,
              error: "Transaction not found",
            };
          }

          const status = await this.transactionManager.getTransactionStatus(
            this.connectedTerminal,
            activeTransaction.terminalTransactionId
          );

          if (!status) {
            return {
              success: false,
              error: "Failed to get transaction status",
            };
          }

          return {
            success: true,
            status,
          };
        } catch (error) {
          logger.error("Get transaction status failed:", error);
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Status check failed",
          };
        }
      }
    );

    // Initiate Refund
    ipcMain.handle(
      "viva:initiate-refund",
      async (event, originalTransactionId: string, amount: number, currency: string) => {
        try {
          if (!this.connectedTerminal) {
            return {
              success: false,
              error: "No terminal connected",
            } as TransactionResponse;
          }

          const requestBuilder = this.transactionManager.getRequestBuilder();
          const request: VivaWalletRefundRequest = requestBuilder.buildRefundRequest({
            originalTransactionId,
            amount: amount / 100, // Convert from minor units if passed as such
            currency: currency.toUpperCase(),
            description: `Refund for transaction ${originalTransactionId}`,
          });

          const result = await this.transactionManager.initiateRefund(
            this.connectedTerminal,
            request
          );

          return {
            success: true,
            transactionId: result.transactionId,
            terminalTransactionId: result.terminalTransactionId,
          } as TransactionResponse;
        } catch (error) {
          logger.error("Refund initiation failed:", error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Refund initiation failed",
          } as TransactionResponse;
        }
      }
    );

    // Cancel Transaction
    ipcMain.handle(
      "viva:cancel-transaction",
      async (event, transactionId: string) => {
        try {
          if (!this.connectedTerminal) {
            return {
              success: false,
              error: "No terminal connected",
            };
          }

          const activeTransaction =
            this.transactionManager.getActiveTransaction(transactionId);
          if (!activeTransaction) {
            return {
              success: false,
              error: "Transaction not found",
            };
          }

          const cancelled = await this.transactionManager.cancelTransaction(
            this.connectedTerminal,
            activeTransaction.terminalTransactionId
          );

          if (cancelled) {
            this.transactionManager.removeActiveTransaction(transactionId);
          }

          return {
            success: cancelled,
            error: cancelled ? undefined : "Failed to cancel transaction",
          };
        } catch (error) {
          logger.error("Transaction cancellation failed:", error);
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Cancellation failed",
          };
        }
      }
    );

    // Get Configuration
    ipcMain.handle("viva:get-config", async () => {
      try {
        const config = await this.configManager.loadConfig();
        // Don't expose API keys in response
        const safeConfig = {
          ...config,
          terminals: config.terminals.map((t) => ({
            ...t,
            apiKey: undefined, // Remove API key from response
          })),
        };
        return {
          success: true,
          config: safeConfig,
        };
      } catch (error) {
        logger.error("Get config failed:", error);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to load config",
        };
      }
    });

    // Save Configuration
    ipcMain.handle(
      "viva:save-config",
      async (event, config: VivaWalletConfig) => {
        try {
          await this.configManager.saveConfig(config);
          return { success: true };
        } catch (error) {
          logger.error("Save config failed:", error);
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Failed to save config",
          };
        }
      }
    );

    // Test Connection
    ipcMain.handle(
      "viva:test-connection",
      async (event, terminalId: string) => {
        try {
          const config = await this.configManager.loadConfig();
          const terminal = config.terminals.find((t) => t.id === terminalId);

          if (!terminal) {
            return {
              success: false,
              error: "Terminal not found",
            };
          }

          const terminalForTest: Terminal = {
            id: terminal.id,
            name: terminal.name,
            ipAddress: terminal.ipAddress,
            port: terminal.port,
            status: "online",
            capabilities: [],
            lastSeen: new Date(),
            connectionType: "wifi",
            terminalType: terminal.terminalType || "dedicated",
            paymentCapabilities: {
              supportsNFC: false,
              supportsCardReader: false,
              supportsChip: false,
              supportsSwipe: false,
              supportsTap: false,
            },
            apiKey: terminal.apiKey,
          };

          const isConnected = await this.terminalDiscovery.verifyConnection(
            terminalForTest
          );
          return {
            success: isConnected,
            error: isConnected ? undefined : "Connection test failed",
          };
        } catch (error) {
          logger.error("Connection test failed:", error);
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Connection test failed",
          };
        }
      }
    );

    logger.info("Viva Wallet IPC handlers registered");
  }

  /**
   * Get connected terminal
   */
  getConnectedTerminal(): Terminal | null {
    return this.connectedTerminal;
  }

  /**
   * Initiate refund transaction (public method for use by other services)
   */
  async initiateRefund(
    originalTransactionId: string,
    amount: number,
    currency: string
  ): Promise<TransactionResponse> {
    try {
      if (!this.connectedTerminal) {
        return {
          success: false,
          error: "No terminal connected",
        } as TransactionResponse;
      }

      const requestBuilder = this.transactionManager.getRequestBuilder();
      const request: VivaWalletRefundRequest = requestBuilder.buildRefundRequest({
        originalTransactionId,
        amount: amount / 100, // Convert from minor units if passed as such
        currency: currency.toUpperCase(),
        description: `Refund for transaction ${originalTransactionId}`,
      });

      const result = await this.transactionManager.initiateRefund(
        this.connectedTerminal,
        request
      );

      return {
        success: true,
        transactionId: result.transactionId,
        terminalTransactionId: result.terminalTransactionId,
      } as TransactionResponse;
    } catch (error) {
      logger.error("Refund initiation failed:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Refund initiation failed",
      } as TransactionResponse;
    }
  }
}

// Export singleton instance
export const vivaWalletService = new VivaWalletService();
