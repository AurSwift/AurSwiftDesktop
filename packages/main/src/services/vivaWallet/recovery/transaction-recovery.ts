/**
 * Transaction Recovery for Viva Wallet
 * Handles recovery of pending transactions on app restart and network interruptions
 */

import { getLogger } from "../../../utils/logger.js";
import { VivaWalletHTTPClient } from "../http-client.js";
import { TransactionPoller } from "../transaction-poller.js";
import { TransactionStateMachine } from "../transaction-state-machine.js";
import type {
  Terminal,
  VivaWalletTransactionResponse,
  TransactionStatus,
} from "../types.js";
import { getDatabase } from "../../../database/index.js";
import { VivaWalletConfigManager } from "../config.js";

const logger = getLogger("TransactionRecovery");

// =============================================================================
// TYPES
// =============================================================================

interface PendingTransaction {
  id: string;
  terminalTransactionId: string;
  terminalId: string;
  terminal: Terminal;
  amount: number;
  currency: string;
  status: string;
  startedAt: Date;
  lastPolledAt: Date;
}

interface RecoveryStatus {
  status: "recovered" | "failed" | "orphaned";
  reason?: string;
}

interface RecoveryResult {
  recovered: PendingTransaction[];
  failed: Array<{ transaction: PendingTransaction; reason: string }>;
  orphaned: PendingTransaction[];
}

// =============================================================================
// TRANSACTION RECOVERY
// =============================================================================

export class TransactionRecovery {
  private transactionPoller: TransactionPoller;
  private pendingTransactionsStorage: PendingTransactionStorage;

  constructor(
    transactionPoller: TransactionPoller,
    storage: PendingTransactionStorage
  ) {
    this.transactionPoller = transactionPoller;
    this.pendingTransactionsStorage = storage;
  }

  /**
   * Recover all pending transactions
   */
  async recoverPendingTransactions(): Promise<RecoveryResult> {
    const result: RecoveryResult = {
      recovered: [],
      failed: [],
      orphaned: [],
    };

    logger.info("Starting transaction recovery...");

    // Get all pending transactions from storage
    const pendingTransactions =
      await this.pendingTransactionsStorage.getPendingTransactions();

    logger.info(
      `Found ${pendingTransactions.length} pending transaction(s) to recover`
    );

    for (const tx of pendingTransactions) {
      try {
        // Check if transaction is stale
        if (this.isStale(tx)) {
          logger.warn(`Transaction ${tx.id} is stale, marking as failed`);
          result.failed.push({
            transaction: tx,
            reason: "Transaction is stale (exceeded recovery time window)",
          });
          await this.pendingTransactionsStorage.removePendingTransaction(tx.id);
          continue;
        }

        const recoveryStatus = await this.recoverTransaction(tx);

        switch (recoveryStatus.status) {
          case "recovered":
            result.recovered.push(tx);
            logger.info(`Recovered transaction: ${tx.id}`);
            break;
          case "failed":
            result.failed.push({
              transaction: tx,
              reason: recoveryStatus.reason || "Unknown reason",
            });
            await this.pendingTransactionsStorage.removePendingTransaction(
              tx.id
            );
            break;
          case "orphaned":
            result.orphaned.push(tx);
            logger.warn(`Orphaned transaction: ${tx.id}`);
            await this.pendingTransactionsStorage.removePendingTransaction(
              tx.id
            );
            break;
        }
      } catch (error) {
        logger.error(`Failed to recover transaction ${tx.id}:`, error);
        result.failed.push({
          transaction: tx,
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    logger.info(
      `Transaction recovery complete: ${result.recovered.length} recovered, ${result.failed.length} failed, ${result.orphaned.length} orphaned`
    );

    return result;
  }

  /**
   * Recover a single transaction
   */
  private async recoverTransaction(
    transaction: PendingTransaction
  ): Promise<RecoveryStatus> {
    try {
      // Query terminal for transaction status
      const httpClient = new VivaWalletHTTPClient(transaction.terminal);
      const statusResponse =
        await httpClient.get<VivaWalletTransactionResponse>(
          `/api/transactions/${transaction.terminalTransactionId}/status`
        );

      // Check transaction status on terminal
      if (
        statusResponse.status === "pending" ||
        statusResponse.status === "processing"
      ) {
        // Transaction is still pending on terminal, resume polling
        await this.resumePolling(transaction);
        return { status: "recovered" };
      }

      // Transaction completed on terminal but not in our system
      if (statusResponse.status === "completed") {
        await this.finalizeTransaction(transaction, statusResponse);
        return { status: "recovered" };
      }

      // Transaction failed or cancelled
      if (
        statusResponse.status === "failed" ||
        statusResponse.status === "cancelled"
      ) {
        await this.markTransactionAsFailed(transaction, statusResponse);
        return {
          status: "failed",
          reason: statusResponse.status,
        };
      }

      return { status: "failed", reason: "Unknown status" };
    } catch (error: any) {
      // Check if transaction not found (orphaned)
      if (
        error.code === "TRANSACTION_NOT_FOUND" ||
        error.response?.status === 404
      ) {
        return { status: "orphaned" };
      }

      throw error;
    }
  }

  /**
   * Resume polling for a recovered transaction
   */
  private async resumePolling(transaction: PendingTransaction): Promise<void> {
    logger.info(`Resuming polling for transaction: ${transaction.id}`);
    await this.transactionPoller.startPolling(
      transaction.id,
      transaction.terminalTransactionId,
      transaction.terminal
    );
  }

  /**
   * Finalize a completed transaction
   */
  private async finalizeTransaction(
    transaction: PendingTransaction,
    statusResponse: VivaWalletTransactionResponse
  ): Promise<void> {
    logger.info(`Finalizing recovered transaction: ${transaction.id}`);
    // Update transaction in database/system
    // Remove from pending transactions
    await this.pendingTransactionsStorage.removePendingTransaction(
      transaction.id
    );
  }

  /**
   * Mark transaction as failed
   */
  private async markTransactionAsFailed(
    transaction: PendingTransaction,
    statusResponse: VivaWalletTransactionResponse
  ): Promise<void> {
    logger.info(`Marking transaction as failed: ${transaction.id}`);
    await this.pendingTransactionsStorage.removePendingTransaction(
      transaction.id
    );
  }

  /**
   * Check if transaction is stale
   */
  private isStale(transaction: PendingTransaction): boolean {
    const staleThreshold = 30 * 60 * 1000; // 30 minutes
    const elapsed = Date.now() - transaction.startedAt.getTime();
    return elapsed > staleThreshold;
  }
}

// =============================================================================
// PENDING TRANSACTION STORAGE
// =============================================================================

export class PendingTransactionStorage {
  private readonly STORAGE_KEY = "viva_wallet_pending_transactions";

  /**
   * Store pending transaction for recovery
   */
  async storePendingTransaction(
    transaction: PendingTransaction
  ): Promise<void> {
    try {
      const db = await getDatabase();

      const pending = await this.getPendingTransactions();
      const existing = pending.find((t) => t.id === transaction.id);

      if (existing) {
        // Update existing
        const index = pending.findIndex((t) => t.id === transaction.id);
        pending[index] = transaction;
      } else {
        // Add new
        pending.push(transaction);
      }

      // Store in database settings
      db.settings.setSetting(
        this.STORAGE_KEY,
        JSON.stringify(pending.map((t) => this.serializeTransaction(t)))
      );
    } catch (error) {
      logger.error("Failed to store pending transaction:", error);
      throw error;
    }
  }

  /**
   * Get all pending transactions
   */
  async getPendingTransactions(): Promise<PendingTransaction[]> {
    try {
      const db = await getDatabase();

      const stored = db.settings.getSetting(this.STORAGE_KEY);
      if (!stored) {
        return [];
      }

      const data = JSON.parse(stored);
      return data.map((t: any) => this.deserializeTransaction(t));
    } catch (error) {
      logger.error("Failed to get pending transactions:", error);
      return [];
    }
  }

  /**
   * Remove pending transaction
   */
  async removePendingTransaction(transactionId: string): Promise<void> {
    try {
      const db = await getDatabase();

      const pending = await this.getPendingTransactions();
      const filtered = pending.filter((t) => t.id !== transactionId);

      if (filtered.length === 0) {
        db.settings.deleteSetting(this.STORAGE_KEY);
      } else {
        db.settings.setSetting(
          this.STORAGE_KEY,
          JSON.stringify(filtered.map((t) => this.serializeTransaction(t)))
        );
      }
    } catch (error) {
      logger.error("Failed to remove pending transaction:", error);
    }
  }

  /**
   * Serialize transaction for storage
   */
  private serializeTransaction(tx: PendingTransaction): any {
    return {
      id: tx.id,
      terminalTransactionId: tx.terminalTransactionId,
      terminalId: tx.terminalId,
      amount: tx.amount,
      currency: tx.currency,
      status: tx.status,
      startedAt: tx.startedAt.toISOString(),
      lastPolledAt: tx.lastPolledAt.toISOString(),
      terminal: {
        id: tx.terminal.id,
        ipAddress: tx.terminal.ipAddress,
        port: tx.terminal.port,
        // Don't store API key
      },
    };
  }

  /**
   * Deserialize transaction from storage
   */
  private async deserializeTransaction(data: any): Promise<PendingTransaction> {
    // Load terminal from config
    const configManager = new VivaWalletConfigManager();
    const config = await configManager.loadConfig();
    const terminalConfig = config.terminals.find(
      (t) => t.id === data.terminalId
    );

    if (!terminalConfig) {
      throw new Error(`Terminal ${data.terminalId} not found in configuration`);
    }

    const terminal: Terminal = {
      id: terminalConfig.id,
      name: terminalConfig.name,
      ipAddress: terminalConfig.ipAddress,
      port: terminalConfig.port,
      status: "offline",
      capabilities: [],
      lastSeen: new Date(),
      connectionType: "wifi",
      terminalType: terminalConfig.terminalType || "dedicated",
      paymentCapabilities: {
        supportsNFC: false,
        supportsCardReader: false,
        supportsChip: false,
        supportsSwipe: false,
        supportsTap: false,
      },
      apiKey: terminalConfig.apiKey,
    };

    return {
      id: data.id,
      terminalTransactionId: data.terminalTransactionId,
      terminalId: data.terminalId,
      terminal,
      amount: data.amount,
      currency: data.currency,
      status: data.status,
      startedAt: new Date(data.startedAt),
      lastPolledAt: new Date(data.lastPolledAt),
    };
  }
}
