/**
 * Transaction Request Builder for Viva Wallet
 * Builds and validates transaction requests
 */

import type {
  VivaWalletSaleRequest,
  VivaWalletRefundRequest,
} from "./types.js";

// =============================================================================
// TRANSACTION BUILDER
// =============================================================================

export class TransactionRequestBuilder {
  private readonly MAX_TRANSACTION_AMOUNT = 99999999; // Maximum transaction amount in minor units
  private readonly MIN_TRANSACTION_AMOUNT = 1; // Minimum transaction amount in minor units

  /**
   * Build sale transaction request
   */
  buildSaleRequest(params: {
    amount: number;
    currency: string;
    description?: string;
    metadata?: Record<string, string>;
    receiptNumber?: string;
  }): VivaWalletSaleRequest {
    // Validate amount (convert to minor units if needed)
    const amountInMinorUnits = this.convertToMinorUnits(
      params.amount,
      params.currency
    );

    if (amountInMinorUnits <= 0) {
      throw new Error("Transaction amount must be greater than 0");
    }

    if (amountInMinorUnits < this.MIN_TRANSACTION_AMOUNT) {
      throw new Error(
        `Transaction amount is too small (minimum: ${
          this.MIN_TRANSACTION_AMOUNT / 100
        })`
      );
    }

    if (amountInMinorUnits > this.MAX_TRANSACTION_AMOUNT) {
      throw new Error(
        `Transaction amount exceeds maximum: ${
          this.MAX_TRANSACTION_AMOUNT / 100
        }`
      );
    }

    const reference = this.generateReference();

    const metadata: Record<string, string> = {
      ...params.metadata,
      timestamp: new Date().toISOString(),
      posVersion: process.env.APP_VERSION || "unknown",
      reference: reference,
    };

    // Only include receiptNumber if provided
    if (params.receiptNumber) {
      metadata.receiptNumber = params.receiptNumber;
    }

    return {
      amount: amountInMinorUnits,
      currency: params.currency.toUpperCase(),
      reference: reference,
      description:
        params.description ||
        `Transaction ${params.receiptNumber || reference}`.trim(),
      metadata,
    };
  }

  /**
   * Convert amount to minor units (cents)
   */
  private convertToMinorUnits(amount: number, currency: string): number {
    // Most currencies use 2 decimal places (cents)
    // Some use 0 (JPY) or 3 (BHD, JOD, etc.)
    const decimalPlaces = this.getCurrencyDecimalPlaces(currency);
    return Math.round(amount * Math.pow(10, decimalPlaces));
  }

  /**
   * Get decimal places for currency
   */
  private getCurrencyDecimalPlaces(currency: string): number {
    const currencyUpper = currency.toUpperCase();

    // Currencies with 0 decimal places
    const zeroDecimalCurrencies = ["JPY", "KRW", "VND"];
    if (zeroDecimalCurrencies.includes(currencyUpper)) {
      return 0;
    }

    // Currencies with 3 decimal places
    const threeDecimalCurrencies = ["BHD", "JOD", "KWD", "OMR", "TND"];
    if (threeDecimalCurrencies.includes(currencyUpper)) {
      return 3;
    }

    // Default to 2 decimal places
    return 2;
  }

  /**
   * Generate unique transaction reference
   */
  private generateReference(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9).toUpperCase();
    return `POS-${timestamp}-${random}`;
  }

  /**
   * Build refund transaction request
   */
  buildRefundRequest(params: {
    originalTransactionId: string;
    amount: number;
    currency: string;
    description?: string;
    metadata?: Record<string, string>;
    receiptNumber?: string;
  }): VivaWalletRefundRequest {
    // Validate amount (convert to minor units if needed)
    const amountInMinorUnits = this.convertToMinorUnits(
      params.amount,
      params.currency
    );

    if (amountInMinorUnits <= 0) {
      throw new Error("Refund amount must be greater than 0");
    }

    if (amountInMinorUnits < this.MIN_TRANSACTION_AMOUNT) {
      throw new Error(
        `Refund amount is too small (minimum: ${
          this.MIN_TRANSACTION_AMOUNT / 100
        })`
      );
    }

    if (amountInMinorUnits > this.MAX_TRANSACTION_AMOUNT) {
      throw new Error(
        `Refund amount exceeds maximum: ${this.MAX_TRANSACTION_AMOUNT / 100}`
      );
    }

    const reference = this.generateRefundReference();

    const metadata: Record<string, string> = {
      ...params.metadata,
      timestamp: new Date().toISOString(),
      posVersion: process.env.APP_VERSION || "unknown",
      reference: reference,
      originalTransactionId: params.originalTransactionId,
    };

    // Only include receiptNumber if provided
    if (params.receiptNumber) {
      metadata.receiptNumber = params.receiptNumber;
    }

    return {
      originalTransactionId: params.originalTransactionId,
      amount: amountInMinorUnits,
      currency: params.currency.toUpperCase(),
      reference: reference,
      description:
        params.description ||
        `Refund ${params.receiptNumber || reference}`.trim(),
      metadata,
    };
  }

  /**
   * Generate unique refund transaction reference
   */
  private generateRefundReference(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9).toUpperCase();
    return `REF-${timestamp}-${random}`;
  }

  /**
   * Validate transaction amount
   */
  validateAmount(
    amount: number,
    currency: string
  ): {
    valid: boolean;
    error?: string;
    amountInMinorUnits?: number;
  } {
    try {
      const amountInMinorUnits = this.convertToMinorUnits(amount, currency);

      if (amountInMinorUnits <= 0) {
        return {
          valid: false,
          error: "Transaction amount must be greater than 0",
        };
      }

      if (amountInMinorUnits < this.MIN_TRANSACTION_AMOUNT) {
        return {
          valid: false,
          error: `Transaction amount is too small (minimum: ${
            this.MIN_TRANSACTION_AMOUNT / 100
          })`,
        };
      }

      if (amountInMinorUnits > this.MAX_TRANSACTION_AMOUNT) {
        return {
          valid: false,
          error: `Transaction amount exceeds maximum: ${
            this.MAX_TRANSACTION_AMOUNT / 100
          }`,
        };
      }

      return {
        valid: true,
        amountInMinorUnits,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Invalid amount",
      };
    }
  }
}
