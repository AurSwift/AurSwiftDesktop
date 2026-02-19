/**
 * Error handling utilities for Viva Wallet service
 * Includes error classification, retry logic, and error message mapping
 */

import {
  ErrorCode,
  ErrorSeverity,
  VivaWalletError,
} from "./types.js";

// Re-export ErrorCode for use in other modules
export { ErrorCode } from "./types.js";

// =============================================================================
// ERROR CLASSES
// =============================================================================

export class NetworkError extends Error implements VivaWalletError {
  readonly code: ErrorCode;
  readonly severity: ErrorSeverity;
  readonly retryable: boolean;
  readonly terminalId?: string;
  readonly timestamp: Date;
  readonly context?: Record<string, any>;
  readonly originalError?: Error;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      terminalId?: string;
      retryable?: boolean;
      context?: Record<string, any>;
      originalError?: Error;
    }
  ) {
    super(message);
    this.name = "NetworkError";
    this.code = code;
    this.severity = this.determineSeverity(code);
    this.retryable = options?.retryable ?? this.isRetryable();
    this.terminalId = options?.terminalId;
    this.context = options?.context;
    this.originalError = options?.originalError;
    this.timestamp = new Date();
  }

  private determineSeverity(code: ErrorCode): ErrorSeverity {
    const severityMap: Partial<Record<ErrorCode, ErrorSeverity>> = {
      [ErrorCode.NETWORK_CONNECTION_REFUSED]: ErrorSeverity.HIGH,
      [ErrorCode.NETWORK_TIMEOUT]: ErrorSeverity.MEDIUM,
      [ErrorCode.NETWORK_UNREACHABLE]: ErrorSeverity.HIGH,
      [ErrorCode.DNS_RESOLUTION_FAILED]: ErrorSeverity.HIGH,
      [ErrorCode.SSL_HANDSHAKE_FAILED]: ErrorSeverity.CRITICAL,
    };
    return severityMap[code] || ErrorSeverity.MEDIUM;
  }

  private isRetryable(): boolean {
    // Network errors are generally retryable
    return true;
  }
}

export class TerminalError extends Error implements VivaWalletError {
  readonly code: ErrorCode;
  readonly severity: ErrorSeverity;
  readonly retryable: boolean;
  readonly terminalId?: string;
  readonly timestamp: Date;
  readonly context?: Record<string, any>;

  constructor(
    code: ErrorCode,
    message: string,
    terminalId?: string,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = "TerminalError";
    this.code = code;
    this.severity = this.determineSeverity(code);
    this.retryable = this.isRetryable(code);
    this.terminalId = terminalId;
    this.context = context;
    this.timestamp = new Date();
  }

  private determineSeverity(code: ErrorCode): ErrorSeverity {
    const severityMap: Partial<Record<ErrorCode, ErrorSeverity>> = {
      [ErrorCode.TERMINAL_OFFLINE]: ErrorSeverity.HIGH,
      [ErrorCode.TERMINAL_BUSY]: ErrorSeverity.MEDIUM,
      [ErrorCode.TERMINAL_ERROR]: ErrorSeverity.HIGH,
      [ErrorCode.TERMINAL_FIRMWARE_MISMATCH]: ErrorSeverity.CRITICAL,
      [ErrorCode.TERMINAL_NOT_FOUND]: ErrorSeverity.HIGH,
      [ErrorCode.TERMINAL_AUTH_FAILED]: ErrorSeverity.CRITICAL,
    };
    return severityMap[code] || ErrorSeverity.MEDIUM;
  }

  private isRetryable(code: ErrorCode): boolean {
    const retryableCodes = [
      ErrorCode.TERMINAL_BUSY,
      ErrorCode.TERMINAL_OFFLINE,
      ErrorCode.TERMINAL_ERROR,
    ];
    return retryableCodes.includes(code);
  }
}

export class TransactionErrorClass extends Error implements VivaWalletError {
  readonly code: ErrorCode;
  readonly severity: ErrorSeverity;
  readonly retryable: boolean;
  readonly transactionId?: string;
  readonly terminalId?: string;
  readonly timestamp: Date;
  readonly context?: Record<string, any>;

  constructor(
    code: ErrorCode,
    message: string,
    transactionId?: string,
    terminalId?: string,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = "TransactionError";
    this.code = code;
    this.severity = this.determineSeverity(code);
    this.retryable = this.isRetryable(code);
    this.transactionId = transactionId;
    this.terminalId = terminalId;
    this.context = context;
    this.timestamp = new Date();
  }

  private determineSeverity(code: ErrorCode): ErrorSeverity {
    const severityMap: Partial<Record<ErrorCode, ErrorSeverity>> = {
      [ErrorCode.TRANSACTION_DECLINED]: ErrorSeverity.MEDIUM,
      [ErrorCode.TRANSACTION_INSUFFICIENT_FUNDS]: ErrorSeverity.MEDIUM,
      [ErrorCode.TRANSACTION_EXPIRED_CARD]: ErrorSeverity.MEDIUM,
      [ErrorCode.TRANSACTION_CANCELLED]: ErrorSeverity.LOW,
      [ErrorCode.TRANSACTION_TIMEOUT]: ErrorSeverity.HIGH,
      [ErrorCode.TRANSACTION_INVALID_AMOUNT]: ErrorSeverity.MEDIUM,
    };
    return severityMap[code] || ErrorSeverity.MEDIUM;
  }

  private isRetryable(code: ErrorCode): boolean {
    const retryableCodes = [ErrorCode.TRANSACTION_TIMEOUT];
    return retryableCodes.includes(code);
  }
}

export class ConfigurationError extends Error implements VivaWalletError {
  readonly code: ErrorCode;
  readonly severity: ErrorSeverity;
  readonly retryable: boolean;
  readonly timestamp: Date;
  readonly context?: Record<string, any>;

  constructor(code: ErrorCode, message: string, context?: Record<string, any>) {
    super(message);
    this.name = "ConfigurationError";
    this.code = code;
    this.severity = this.determineSeverity(code);
    this.retryable = false; // Configuration errors are never retryable
    this.context = context;
    this.timestamp = new Date();
  }

  private determineSeverity(code: ErrorCode): ErrorSeverity {
    const severityMap: Partial<Record<ErrorCode, ErrorSeverity>> = {
      [ErrorCode.CONFIG_INVALID_IP]: ErrorSeverity.HIGH,
      [ErrorCode.CONFIG_INVALID_PORT]: ErrorSeverity.HIGH,
      [ErrorCode.CONFIG_MISSING_API_KEY]: ErrorSeverity.HIGH,
      [ErrorCode.CONFIG_INVALID_CREDENTIALS]: ErrorSeverity.CRITICAL,
      [ErrorCode.CONFIG_TERMINAL_NOT_CONFIGURED]: ErrorSeverity.HIGH,
    };
    return severityMap[code] || ErrorSeverity.HIGH;
  }
}

// =============================================================================
// ERROR CLASSIFIER
// =============================================================================

export class ErrorClassifier {
  classify(
    error: unknown,
    context?: { terminalId?: string; transactionId?: string }
  ): VivaWalletError {
    // Handle fetch/HTTP errors (from Node fetch API)
    if (this.isFetchError(error)) {
      return this.classifyFetchError(error, context);
    }

    // Handle native errors
    if (error && typeof error === "object" && "message" in error && error instanceof Error) {
      return this.classifyNativeError(error, context);
    }

    // Handle unknown errors
    return this.createUnknownError(error, context);
  }

  private classifyFetchError(
    error: Error & { code?: string; response?: { status: number; data?: any } },
    context?: { terminalId?: string; transactionId?: string }
  ): VivaWalletError {
    if (!error.response) {
      // Network-level error (no response from server)
      return this.classifyNetworkError(error, context);
    }

    const status = error.response.status;
    const data = error.response.data as any;

    // Check for terminal-specific error codes
    if (data?.error?.code) {
      return this.classifyTerminalError(data.error, context);
    }

    // Check for transaction-specific error codes
    if (data?.transactionError) {
      return this.classifyTransactionError(data.transactionError, context);
    }

    // Classify by HTTP status code
    switch (status) {
      case 401:
        return new TerminalError(
          ErrorCode.TERMINAL_AUTH_FAILED,
          "Authentication failed. Please check API key.",
          context?.terminalId
        );
      case 404:
        return new TerminalError(
          ErrorCode.TERMINAL_NOT_FOUND,
          "Terminal not found. Please verify terminal configuration.",
          context?.terminalId
        );
      case 503:
        return new TerminalError(
          ErrorCode.TERMINAL_BUSY,
          "Terminal is busy. Please try again in a moment.",
          context?.terminalId,
          { statusCode: status }
        );
      default:
        return this.classifyNetworkError(error, context);
    }
  }

  private classifyNetworkError(
    error: Error & { code?: string },
    context?: { terminalId?: string }
  ): NetworkError {
    if (error.code === "ECONNREFUSED") {
      return new NetworkError(
        ErrorCode.NETWORK_CONNECTION_REFUSED,
        "Connection refused. Terminal may be offline or unreachable.",
        {
          terminalId: context?.terminalId,
          retryable: true,
          originalError: error,
        }
      );
    }

    if (error.code === "ETIMEDOUT" || error.code === "ECONNABORTED") {
      return new NetworkError(
        ErrorCode.NETWORK_TIMEOUT,
        "Connection timeout. Please check network connectivity.",
        {
          terminalId: context?.terminalId,
          retryable: true,
          originalError: error,
        }
      );
    }

    if (error.code === "ENOTFOUND" || error.code === "EAI_AGAIN") {
      return new NetworkError(
        ErrorCode.DNS_RESOLUTION_FAILED,
        "DNS resolution failed. Please check network configuration.",
        {
          terminalId: context?.terminalId,
          retryable: true,
          originalError: error,
        }
      );
    }

    return new NetworkError(
      ErrorCode.NETWORK_UNREACHABLE,
      "Network error occurred. Please check connectivity.",
      {
        terminalId: context?.terminalId,
        retryable: true,
        originalError: error,
      }
    );
  }

  private classifyTerminalError(
    errorData: any,
    context?: { terminalId?: string; transactionId?: string }
  ): TerminalError {
    const errorCode = (errorData.code as ErrorCode) || ErrorCode.TERMINAL_ERROR;
    const message = errorData.message || "Terminal error occurred";

    return new TerminalError(errorCode, message, context?.terminalId, {
      transactionId: context?.transactionId,
      terminalError: errorData,
    });
  }

  private classifyTransactionError(
    errorData: any,
    context?: { terminalId?: string; transactionId?: string }
  ): TransactionErrorClass {
    // Map terminal transaction error codes to our error codes
    const codeMap: Record<string, ErrorCode> = {
      DECLINED: ErrorCode.TRANSACTION_DECLINED,
      INSUFFICIENT_FUNDS: ErrorCode.TRANSACTION_INSUFFICIENT_FUNDS,
      EXPIRED_CARD: ErrorCode.TRANSACTION_EXPIRED_CARD,
      CANCELLED: ErrorCode.TRANSACTION_CANCELLED,
      TIMEOUT: ErrorCode.TRANSACTION_TIMEOUT,
    };

    const errorCode = codeMap[errorData.code] || ErrorCode.TRANSACTION_DECLINED;
    const message = errorData.message || "Transaction failed";

    return new TransactionErrorClass(
      errorCode,
      message,
      context?.transactionId,
      context?.terminalId,
      {
        transactionError: errorData,
      }
    );
  }

  private classifyNativeError(
    error: Error,
    context?: { terminalId?: string; transactionId?: string }
  ): VivaWalletError {
    // Check if it's already a VivaWalletError by checking for required properties
    if (
      "code" in error &&
      typeof error.code === "string" &&
      error.code in ErrorCode
    ) {
      return error as VivaWalletError;
    }

    // Create generic error
    return new TerminalError(
      ErrorCode.SYSTEM_UNKNOWN_ERROR,
      error.message || "An unexpected error occurred",
      context?.terminalId,
      { originalError: error }
    );
  }

  private createUnknownError(
    error: unknown,
    context?: { terminalId?: string; transactionId?: string }
  ): VivaWalletError {
    return new TerminalError(
      ErrorCode.SYSTEM_UNKNOWN_ERROR,
      `Unknown error: ${String(error)}`,
      context?.terminalId,
      { error }
    );
  }

  private isFetchError(error: unknown): error is Error & { code?: string; response?: { status: number; data?: any } } {
    // Check if it's a fetch error (has code property like ECONNREFUSED, ETIMEDOUT, etc.)
    // or has response property (HTTP error)
    return (
      typeof error === "object" &&
      error !== null &&
      error instanceof Error &&
      (("code" in error && typeof (error as any).code === "string") ||
       ("response" in error && typeof (error as any).response === "object"))
    );
  }
}

// =============================================================================
// RETRY MANAGER
// =============================================================================

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors: ErrorCode[];
}

export class RetryManager {
  private readonly defaultConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
    retryableErrors: [
      ErrorCode.NETWORK_CONNECTION_REFUSED,
      ErrorCode.NETWORK_TIMEOUT,
      ErrorCode.TERMINAL_BUSY,
      ErrorCode.TERMINAL_OFFLINE,
    ],
  };

  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    config?: Partial<RetryConfig>,
    onRetry?: (attempt: number, error: Error) => void
  ): Promise<T> {
    const finalConfig = { ...this.defaultConfig, ...config };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < finalConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const vivaError = error as VivaWalletError;

        // Check if error is retryable
        if (!this.isRetryable(vivaError, finalConfig.retryableErrors)) {
          throw error;
        }

        // Check if we've reached max attempts
        if (attempt === finalConfig.maxAttempts - 1) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt, finalConfig);

        // Call retry callback
        if (onRetry) {
          onRetry(attempt + 1, lastError);
        }

        // Wait before retry
        await this.sleep(delay);
      }
    }

    throw lastError || new Error("Retry failed");
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);

    // Add jitter (random variation to prevent thundering herd)
    if (config.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay = delay + (Math.random() * jitterAmount * 2 - jitterAmount);
    }

    // Cap at max delay
    return Math.min(Math.round(delay), config.maxDelay);
  }

  private isRetryable(
    error: VivaWalletError,
    retryableErrors: ErrorCode[]
  ): boolean {
    // Check if error has retryable property and code matches
    if ("retryable" in error && "code" in error) {
      return error.retryable && retryableErrors.includes(error.code);
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
