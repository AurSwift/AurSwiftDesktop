/**
 * User-Friendly Error Messages for Viva Wallet
 * Maps technical error codes to user-friendly messages with actionable suggestions
 */

import { ErrorCode, VivaWalletError } from "../types.js";

// =============================================================================
// USER-FRIENDLY ERROR INTERFACE
// =============================================================================

export interface UserFriendlyError {
  title: string;
  message: string;
  suggestions: string[];
  helpLink?: string;
  canRetry: boolean;
  requiresAction: boolean;
}

// =============================================================================
// ERROR MESSAGE MAPPER
// =============================================================================

export class ErrorMessageMapper {
  /**
   * Get user-friendly error message for a Viva Wallet error
   */
  getUserFriendlyError(
    error: VivaWalletError,
    context?: { terminalName?: string; amount?: number; transactionId?: string }
  ): UserFriendlyError {
    const mapper = this.getMessageMapper(error.code);
    return mapper(error, context);
  }

  /**
   * Get error message mapper function for a specific error code
   */
  private getMessageMapper(
    code: ErrorCode
  ): (error: VivaWalletError, context?: any) => UserFriendlyError {
    const mappers: Partial<
      Record<
        ErrorCode,
        (error: VivaWalletError, context?: any) => UserFriendlyError
      >
    > = {
      [ErrorCode.NETWORK_CONNECTION_REFUSED]: (_error, context) => ({
        title: "Cannot Connect to Terminal",
        message: context?.terminalName
          ? `Cannot connect to ${context.terminalName}. Please ensure the terminal is powered on and connected to the network.`
          : "Cannot connect to payment terminal. Please check the connection.",
        suggestions: [
          "Verify terminal is powered on",
          "Check network connection",
          "Verify terminal IP address in settings",
          "Ensure terminal is on the same network",
          "Check if Viva.com Terminal app is running",
          "Verify Peer-to-Peer mode is enabled in terminal app",
        ],
        canRetry: true,
        requiresAction: true,
        helpLink: "https://developer.viva.com/",
      }),

      [ErrorCode.NETWORK_TIMEOUT]: () => ({
        title: "Connection Timeout",
        message:
          "The connection to the terminal timed out. This may be due to network issues.",
        suggestions: [
          "Check network connectivity",
          "Verify terminal is responding",
          "Try again in a moment",
          "Check firewall settings",
          "Verify terminal IP address is correct",
        ],
        canRetry: true,
        requiresAction: false,
      }),

      [ErrorCode.NETWORK_UNREACHABLE]: () => ({
        title: "Network Unreachable",
        message:
          "Cannot reach the payment terminal. Please check your network connection.",
        suggestions: [
          "Check network cable/WiFi connection",
          "Verify both devices are on the same network",
          "Check router/switch status",
          "Try pinging the terminal IP address",
        ],
        canRetry: true,
        requiresAction: true,
      }),

      [ErrorCode.DNS_RESOLUTION_FAILED]: () => ({
        title: "Network Configuration Error",
        message:
          "DNS resolution failed. Please check your network configuration and terminal IP address.",
        suggestions: [
          "Verify terminal IP address in settings",
          "Check network configuration",
          "Try using IP address instead of hostname",
          "Check DNS settings",
        ],
        canRetry: true,
        requiresAction: true,
      }),

      [ErrorCode.TERMINAL_OFFLINE]: (_error, context) => ({
        title: "Terminal Offline",
        message: context?.terminalName
          ? `${context.terminalName} appears to be offline.`
          : "Payment terminal is offline.",
        suggestions: [
          "Check if terminal is powered on",
          "Verify network connection",
          "Restart the terminal app",
          "Check terminal settings",
          "Verify Peer-to-Peer mode is enabled",
        ],
        canRetry: true,
        requiresAction: true,
      }),

      [ErrorCode.TERMINAL_BUSY]: () => ({
        title: "Terminal Busy",
        message:
          "The terminal is currently processing another transaction. Please wait.",
        suggestions: [
          "Wait a moment and try again",
          "Check if another transaction is in progress",
          "Cancel the current transaction if possible",
        ],
        canRetry: true,
        requiresAction: false,
      }),

      [ErrorCode.TERMINAL_AUTH_FAILED]: () => ({
        title: "Authentication Failed",
        message:
          "Authentication failed with the terminal. Please check the API key in settings.",
        suggestions: [
          "Verify API key in terminal settings",
          "Check API key format and validity",
          "Re-enter API key from terminal app",
          "Check terminal Peer-to-Peer settings",
        ],
        canRetry: false,
        requiresAction: true,
      }),

      [ErrorCode.TERMINAL_NOT_FOUND]: () => ({
        title: "Terminal Not Found",
        message:
          "Terminal not found. Please verify terminal configuration and try discovering terminals again.",
        suggestions: [
          "Run terminal discovery",
          "Check terminal IP address and port",
          "Verify terminal is on the network",
          "Check terminal app is running",
        ],
        canRetry: true,
        requiresAction: true,
      }),

      [ErrorCode.TRANSACTION_DECLINED]: () => ({
        title: "Card Declined",
        message:
          "The card was declined by the bank. Please try a different payment method.",
        suggestions: [
          "Try a different card",
          "Check card balance",
          "Contact your bank",
          "Use cash or another payment method",
          "Verify card is not expired or blocked",
        ],
        canRetry: false,
        requiresAction: true,
      }),

      [ErrorCode.TRANSACTION_INSUFFICIENT_FUNDS]: () => ({
        title: "Insufficient Funds",
        message: `Insufficient funds to complete this transaction.`,
        suggestions: [
          "Use a different card",
          "Pay with cash",
          "Split payment across multiple methods",
          "Check account balance",
        ],
        canRetry: false,
        requiresAction: true,
      }),

      [ErrorCode.TRANSACTION_EXPIRED_CARD]: () => ({
        title: "Expired Card",
        message: "The card has expired. Please use a different card.",
        suggestions: [
          "Use a different card",
          "Check card expiry date",
          "Contact card issuer for replacement",
        ],
        canRetry: false,
        requiresAction: true,
      }),

      [ErrorCode.TRANSACTION_TIMEOUT]: () => ({
        title: "Transaction Timeout",
        message: "The transaction took too long to complete. Please try again.",
        suggestions: [
          "Try the transaction again",
          "Check network connection",
          "Ensure card is properly presented",
          "Check terminal is responsive",
        ],
        canRetry: true,
        requiresAction: false,
      }),

      [ErrorCode.TRANSACTION_CANCELLED]: () => ({
        title: "Transaction Cancelled",
        message: "The transaction was cancelled.",
        suggestions: [
          "Start a new transaction if needed",
          "Check if payment was actually cancelled",
        ],
        canRetry: false,
        requiresAction: false,
      }),

      [ErrorCode.CONFIG_INVALID_IP]: () => ({
        title: "Invalid IP Address",
        message: "The terminal IP address format is invalid.",
        suggestions: [
          "Enter a valid IP address (e.g., 192.168.1.100)",
          "Check IP address format",
          "Use terminal discovery to find correct IP",
        ],
        canRetry: false,
        requiresAction: true,
      }),

      [ErrorCode.CONFIG_INVALID_PORT]: () => ({
        title: "Invalid Port",
        message: "The terminal port number is invalid.",
        suggestions: [
          "Enter a valid port number (1-65535)",
          "Check terminal app for correct port",
          "Use default port 8080 if unsure",
        ],
        canRetry: false,
        requiresAction: true,
      }),

      [ErrorCode.CONFIG_MISSING_API_KEY]: () => ({
        title: "Missing API Key",
        message: "API key is required for terminal authentication.",
        suggestions: [
          "Enter API key from terminal app",
          "Check terminal Peer-to-Peer settings",
          "Generate new API key if needed",
        ],
        canRetry: false,
        requiresAction: true,
      }),

      [ErrorCode.SYSTEM_UNKNOWN_ERROR]: (error) => ({
        title: "Error Occurred",
        message:
          error.message || "An unexpected error occurred. Please try again.",
        suggestions: [
          "Try again",
          "Check settings",
          "Restart the application",
          "Contact support if problem persists",
        ],
        canRetry: error.retryable,
        requiresAction: true,
      }),
    };

    return (
      mappers[code] ||
      ((error) => ({
        title: "Error Occurred",
        message:
          error.message || "An unexpected error occurred. Please try again.",
        suggestions: [
          "Try again",
          "Check settings",
          "Contact support if problem persists",
        ],
        canRetry: error.retryable,
        requiresAction: true,
      }))
    );
  }
}
