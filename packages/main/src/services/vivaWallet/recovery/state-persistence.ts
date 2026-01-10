/**
 * State Persistence for Viva Wallet transactions
 * Stores transaction state for recovery on app restart
 */

import { getLogger } from "../../../utils/logger.js";
import type { TransactionStateMachine } from "../transaction-state-machine.js";
import type { Terminal, VivaWalletSaleRequest } from "../types.js";
import { getDatabase } from "../../../database/index.js";

const logger = getLogger("StatePersistence");

// =============================================================================
// STATE PERSISTENCE
// =============================================================================

interface PersistentTransactionState {
  id: string;
  terminalTransactionId: string;
  terminalId: string;
  request: VivaWalletSaleRequest;
  stateMachine: {
    currentState: string;
    previousState: string;
    stateHistory: Array<{
      state: string;
      timestamp: string;
      reason?: string;
    }>;
  };
  startedAt: string;
  lastUpdatedAt: string;
  version: number; // For migration support
}

export class StatePersistence {
  private readonly STORAGE_KEY = "viva_wallet_transaction_states";
  private readonly CURRENT_VERSION = 1;

  /**
   * Save transaction state
   */
  async saveState(
    transactionId: string,
    terminalTransactionId: string,
    terminalId: string,
    request: VivaWalletSaleRequest,
    stateMachine: TransactionStateMachine,
    startedAt: Date,
    lastUpdatedAt: Date
  ): Promise<void> {
    try {
      const states = await this.getAllStates();

      const state: PersistentTransactionState = {
        id: transactionId,
        terminalTransactionId,
        terminalId,
        request,
        stateMachine: {
          currentState: stateMachine.getCurrentState(),
          previousState: stateMachine.getPreviousState(),
          stateHistory: stateMachine.getStateHistory().map((h) => ({
            state: h.state,
            timestamp: h.timestamp.toISOString(),
            reason: h.reason,
          })),
        },
        startedAt: startedAt.toISOString(),
        lastUpdatedAt: lastUpdatedAt.toISOString(),
        version: this.CURRENT_VERSION,
      };

      const existingIndex = states.findIndex((s) => s.id === transactionId);
      if (existingIndex >= 0) {
        states[existingIndex] = state;
      } else {
        states.push(state);
      }

      await this.saveAllStates(states);
    } catch (error) {
      logger.error(
        `Failed to save state for transaction ${transactionId}:`,
        error
      );
    }
  }

  /**
   * Load transaction state
   */
  async loadState(
    transactionId: string
  ): Promise<PersistentTransactionState | null> {
    try {
      const states = await this.getAllStates();
      const state = states.find((s) => s.id === transactionId);

      if (!state) {
        return null;
      }

      // Migrate state if needed
      if (state.version < this.CURRENT_VERSION) {
        return await this.migrateState(state);
      }

      return state;
    } catch (error) {
      logger.error(
        `Failed to load state for transaction ${transactionId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Get all persisted states
   */
  async getAllStates(): Promise<PersistentTransactionState[]> {
    try {
      const db = await getDatabase();

      const stored = db.settings.getSetting(this.STORAGE_KEY);
      if (!stored) {
        return [];
      }

      const states = JSON.parse(stored);
      return Array.isArray(states) ? states : [];
    } catch (error) {
      logger.error("Failed to get all states:", error);
      return [];
    }
  }

  /**
   * Save all states
   */
  private async saveAllStates(
    states: PersistentTransactionState[]
  ): Promise<void> {
    try {
      const db = await getDatabase();

      // Clean up old states (older than 24 hours)
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      const filtered = states.filter((state) => {
        const lastUpdated = new Date(state.lastUpdatedAt).getTime();
        return lastUpdated > oneDayAgo;
      });

      db.settings.setSetting(this.STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      logger.error("Failed to save all states:", error);
      throw error;
    }
  }

  /**
   * Remove transaction state
   */
  async removeState(transactionId: string): Promise<void> {
    try {
      const states = await this.getAllStates();
      const filtered = states.filter((s) => s.id !== transactionId);
      await this.saveAllStates(filtered);
    } catch (error) {
      logger.error(
        `Failed to remove state for transaction ${transactionId}:`,
        error
      );
    }
  }

  /**
   * Clean up old states
   */
  async cleanupOldStates(maxAgeHours: number = 24): Promise<number> {
    try {
      const states = await this.getAllStates();
      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000;
      const cutoff = now - maxAge;

      const filtered = states.filter((state) => {
        const lastUpdated = new Date(state.lastUpdatedAt).getTime();
        return lastUpdated > cutoff;
      });

      const removed = states.length - filtered.length;

      if (removed > 0) {
        await this.saveAllStates(filtered);
        logger.info(`Cleaned up ${removed} old transaction state(s)`);
      }

      return removed;
    } catch (error) {
      logger.error("Failed to cleanup old states:", error);
      return 0;
    }
  }

  /**
   * Migrate state to current version
   */
  private async migrateState(
    state: PersistentTransactionState
  ): Promise<PersistentTransactionState> {
    logger.info(
      `Migrating transaction state ${state.id} from version ${state.version} to ${this.CURRENT_VERSION}`
    );

    // Future: Add migration logic here when schema changes
    return {
      ...state,
      version: this.CURRENT_VERSION,
    };
  }

  /**
   * Get state statistics
   */
  async getStateStats(): Promise<{
    total: number;
    byState: Record<string, number>;
    oldest: Date | null;
    newest: Date | null;
  }> {
    try {
      const states = await this.getAllStates();

      const byState: Record<string, number> = {};
      let oldest: Date | null = null;
      let newest: Date | null = null;

      for (const state of states) {
        const currentState = state.stateMachine.currentState;
        byState[currentState] = (byState[currentState] || 0) + 1;

        const lastUpdated = new Date(state.lastUpdatedAt);
        if (!oldest || lastUpdated < oldest) {
          oldest = lastUpdated;
        }
        if (!newest || lastUpdated > newest) {
          newest = lastUpdated;
        }
      }

      return {
        total: states.length,
        byState,
        oldest,
        newest,
      };
    } catch (error) {
      logger.error("Failed to get state stats:", error);
      return {
        total: 0,
        byState: {},
        oldest: null,
        newest: null,
      };
    }
  }
}
