/**
 * Transaction State Machine for Viva Wallet transactions
 * Manages transaction state transitions and validation
 */

import { getLogger } from "../../utils/logger.js";

const logger = getLogger("TransactionStateMachine");

// =============================================================================
// TYPES
// =============================================================================

export type TransactionState =
  | "idle"
  | "initiating"
  | "pending"
  | "processing"
  | "awaiting_card"
  | "card_present"
  | "authorizing"
  | "completed"
  | "failed"
  | "cancelled"
  | "refunded";

// =============================================================================
// STATE MACHINE
// =============================================================================

export class TransactionStateMachine {
  private currentState: TransactionState;
  private previousState: TransactionState;
  private stateHistory: Array<{
    state: TransactionState;
    timestamp: Date;
    reason?: string;
  }>;
  private readonly transitions: Map<TransactionState, TransactionState[]>;

  constructor(initialState: TransactionState = "idle") {
    this.currentState = initialState;
    this.previousState = initialState;
    this.stateHistory = [
      { state: initialState, timestamp: new Date(), reason: "Initial state" },
    ];

    // Define valid state transitions
    this.transitions = new Map([
      ["idle", ["initiating"]],
      ["initiating", ["pending", "failed"]],
      ["pending", ["processing", "failed", "cancelled"]],
      [
        "processing",
        ["awaiting_card", "authorizing", "completed", "failed", "cancelled"],
      ],
      ["awaiting_card", ["card_present", "failed", "cancelled"]],
      ["card_present", ["authorizing", "failed", "cancelled"]],
      ["authorizing", ["completed", "failed", "cancelled"]],
      ["completed", ["refunded"]],
      ["failed", []], // Terminal state
      ["cancelled", []], // Terminal state
      ["refunded", []], // Terminal state
    ]);
  }

  /**
   * Transition to a new state
   */
  transition(newState: TransactionState, reason?: string): void {
    if (!this.canTransition(newState)) {
      const error = `Invalid state transition from ${this.currentState} to ${newState}`;
      logger.error(error);
      throw new Error(error);
    }

    this.previousState = this.currentState;
    this.currentState = newState;

    this.stateHistory.push({
      state: newState,
      timestamp: new Date(),
      reason: reason || `Transitioned from ${this.previousState}`,
    });

    logger.debug(
      `Transaction state: ${this.previousState} -> ${newState}${
        reason ? ` (${reason})` : ""
      }`
    );
  }

  /**
   * Check if transition to new state is valid
   */
  canTransition(to: TransactionState): boolean {
    const allowedTransitions = this.transitions.get(this.currentState);
    if (!allowedTransitions) {
      return false;
    }

    return allowedTransitions.includes(to);
  }

  /**
   * Get next possible states
   */
  getNextStates(): TransactionState[] {
    return this.transitions.get(this.currentState) || [];
  }

  /**
   * Get current state
   */
  getCurrentState(): TransactionState {
    return this.currentState;
  }

  /**
   * Get previous state
   */
  getPreviousState(): TransactionState {
    return this.previousState;
  }

  /**
   * Get state history
   */
  getStateHistory(): Array<{
    state: TransactionState;
    timestamp: Date;
    reason?: string;
  }> {
    return [...this.stateHistory];
  }

  /**
   * Check if state is terminal (final) state
   */
  isTerminalState(): boolean {
    return ["completed", "failed", "cancelled", "refunded"].includes(
      this.currentState
    );
  }

  /**
   * Check if state is active (can still change)
   */
  isActiveState(): boolean {
    return !this.isTerminalState();
  }

  /**
   * Reset state machine
   */
  reset(): void {
    this.previousState = this.currentState;
    this.currentState = "idle";
    this.stateHistory = [
      { state: "idle", timestamp: new Date(), reason: "Reset state machine" },
    ];
  }
}
