/**
 * Hook for managing payment processing
 * Handles payment method selection, cash/card payments, transaction completion, and receipt handling
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import type { PaymentMethod } from "@/types/domain/payment";
import type { TransactionData } from "@/types/domain/transaction";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("use-payment");
import type { CartSession, CartItemWithProduct } from "@/types/features/cart";
import {
  validateCashPayment,
  validateCart,
  validateBusinessId,
} from "../utils/validation";
import { getUserRoleName } from "@/shared/utils/rbac-helpers";

interface UsePaymentProps {
  cartSession: CartSession | null;
  cartItems: CartItemWithProduct[];
  subtotal: number;
  tax: number;
  total: number;
  userId: string | undefined;
  businessId: string | undefined;
  userFirstName: string | undefined;
  userLastName: string | undefined;
  userBusinessName: string | undefined;
  startPrintingFlow: (data: TransactionData) => Promise<boolean>;
  isShowingStatus: boolean;
  onResetPrintStatus?: () => void;
  onCartSessionInit?: () => Promise<void>;
  activeShift?: any; // NEW: Active shift (optional for admin mode)
  requiresShift?: boolean; // NEW: Whether shift is required
}

/**
 * Helper: Calculate payment amounts based on payment method
 */
const calculatePaymentAmounts = (
  paymentMethod: PaymentMethod["type"],
  cashAmount: number,
  total: number,
): { cashAmount: number | undefined; cardAmount: number | undefined } => {
  switch (paymentMethod) {
    case "cash":
      return { cashAmount, cardAmount: undefined };
    case "card":
    case "mobile":
      return { cashAmount: undefined, cardAmount: total };
    case "voucher":
    case "split":
    default:
      return { cashAmount: undefined, cardAmount: undefined };
  }
};

/**
 * Helper: Get success message for transaction completion
 * FIX #14: Centralized success message logic to avoid duplication
 * This function is used consistently for all transaction completion success messages
 */
const getTransactionSuccessMessage = (
  paymentMethod: PaymentMethod | null,
  cashAmount: number,
  total: number,
  skipPaymentValidation: boolean,
): string => {
  if (paymentMethod?.type === "cash") {
    const change = cashAmount - total;
    return change > 0
      ? `Transaction complete! Change: £${change.toFixed(2)}`
      : "Transaction complete! Exact change received.";
  }

  if (skipPaymentValidation) {
    return "Transaction complete! Paid by card";
  }

  return `Transaction complete! Paid by ${paymentMethod?.type || "unknown"}`;
};

/**
 * Helper: Create receipt data from transaction details
 */
const createReceiptData = (
  receiptNumber: string,
  cartItems: CartItemWithProduct[],
  subtotal: number,
  tax: number,
  total: number,
  userId: string,
  userFirstName: string | undefined,
  userLastName: string | undefined,
  businessId: string,
  userBusinessName: string | undefined,
  paymentMethod: PaymentMethod | null,
  cashAmount: number,
  skipPaymentValidation: boolean,
  transactionId: string, // Required: actual database transaction ID
): TransactionData => {
  if (!transactionId) {
    throw new Error("Transaction ID is required for receipt generation");
  }

  const amountPaid = skipPaymentValidation
    ? total
    : paymentMethod?.type === "cash"
      ? cashAmount
      : total;

  const change = skipPaymentValidation
    ? 0
    : paymentMethod?.type === "cash"
      ? Math.max(0, cashAmount - total)
      : 0;

  return {
    id: transactionId, // Use actual transaction ID (required, no fallback)
    timestamp: new Date(),
    cashierId: userId,
    cashierName: `${userFirstName || ""} ${userLastName || ""}`.trim(),
    businessId,
    businessName: userBusinessName || "aurswift POS",
    items: cartItems.map((item) => ({
      id: item.id || "",
      transactionId: "", // Will be set when transaction is created
      productId: item.productId || undefined,
      categoryId: item.categoryId || undefined,
      productName: item.itemName || item.product?.name || "Unknown Item",
      itemType: item.itemType || "UNIT",
      quantity: item.itemType === "UNIT" ? item.quantity || 1 : undefined,
      weight: item.itemType === "WEIGHT" ? item.weight : undefined,
      unitOfMeasure: item.unitOfMeasure,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      taxAmount: item.taxAmount || 0,
      batchId: item.batchId,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate,
      ageRestrictionLevel: item.ageRestrictionLevel,
      ageVerified: item.ageVerified,
      cartItemId: item.id,
    })),
    subtotal,
    tax,
    discount: 0,
    total,
    amountPaid,
    change,
    paymentMethods: [
      {
        type: skipPaymentValidation ? "card" : paymentMethod?.type || "cash",
        amount: skipPaymentValidation
          ? total
          : paymentMethod?.type === "cash"
            ? cashAmount
            : paymentMethod?.amount || total,
      },
    ],
    receiptNumber,
  };
};

/**
 * Hook for managing payment
 * @param props - Payment configuration props
 * @returns Payment state and operations
 */
export function usePayment({
  cartSession,
  cartItems,
  subtotal,
  tax,
  total,
  userId,
  businessId,
  userFirstName,
  userLastName,
  userBusinessName,
  startPrintingFlow,
  isShowingStatus: _isShowingStatus, // Unused - kept for interface compatibility, will be used in future
  onResetPrintStatus,
  onCartSessionInit,
  activeShift: _activeShift,
  requiresShift = true, // Default to true for backward compatibility
}: UsePaymentProps) {
  const [paymentStep, setPaymentStep] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    null,
  );
  const [cashAmount, setCashAmount] = useState(0);
  const [transactionComplete, setTransactionComplete] = useState(false);
  const [showReceiptOptions, setShowReceiptOptions] = useState(false);
  const [completedTransactionData, setCompletedTransactionData] =
    useState<TransactionData | null>(null);
  const [printerStatus, setPrinterStatus] = useState<{
    connected: boolean;
    error: string | null;
  }>({ connected: true, error: null });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Race condition protection: prevent concurrent transaction processing
  const isProcessingRef = useRef(false);

  /**
   * Cleanup timeout on unmount
   */
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  /**
   * Reset payment state to initial values
   */
  const resetPaymentState = useCallback(() => {
    setPaymentStep(false);
    setPaymentMethod(null);
    setTransactionComplete(false);
    setCashAmount(0);
    setCompletedTransactionData(null);
    setPrinterStatus({ connected: true, error: null });
  }, []);

  /**
   * Reset payment state and initialize new cart session
   */
  const resetAndInitCart = useCallback(async () => {
    try {
      resetPaymentState();
      if (onCartSessionInit) {
        await onCartSessionInit();
      }
    } catch (error) {
      logger.error("Failed to reset and init cart:", error);
      toast.error("Failed to reset cart. Please refresh the page.");
    }
  }, [resetPaymentState, onCartSessionInit]);

  /**
   * Check printer status and handle warnings
   */
  const checkPrinterStatus = useCallback(async (): Promise<{
    connected: boolean;
    error: string | null;
  }> => {
    let status = { connected: true, error: null as string | null };

    if (!window.printerAPI) {
      return status;
    }

    try {
      const apiStatus = await window.printerAPI.getStatus();
      status = {
        connected: apiStatus.connected,
        error: apiStatus.error ?? null,
      };

      if (!status.connected) {
        toast.warning(
          "Printer is not connected. You can still complete the transaction and print later.",
          { duration: 5000 },
        );
      }
    } catch (error) {
      logger.error("Failed to check printer status:", error);
      status = {
        connected: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

    return status;
  }, []);

  /**
   * Handle receipt generation and display after successful transaction
   * Shows receipt options modal for all payment types
   */
  const handleReceiptAfterTransaction = useCallback(
    async (
      receiptNumber: string,
      printerStatusResult: { connected: boolean; error: string | null },
      skipPaymentValidation: boolean,
      validatedUserId: string,
      validatedBusinessId: string,
      transactionId: string, // Required: actual database transaction ID
    ) => {
      if (!transactionId) {
        logger.error("Transaction ID is missing - cannot generate receipt");
        toast.error("Failed to generate receipt: Transaction ID is missing");
        return;
      }

      // Create receipt data
      const receiptData = createReceiptData(
        receiptNumber,
        cartItems,
        subtotal,
        tax,
        total,
        validatedUserId,
        userFirstName,
        userLastName,
        validatedBusinessId,
        userBusinessName,
        paymentMethod,
        cashAmount,
        skipPaymentValidation,
        transactionId, // Pass actual transaction ID from database (required)
      );

      // FIX #5: Wrap state updates in try-catch to handle partial state update failures
      try {
        // Reset print status if callback provided
        if (onResetPrintStatus) {
          flushSync(() => {
            onResetPrintStatus();
          });
        }

        // Set printer status and show receipt options modal for all payment types
        setPrinterStatus(printerStatusResult);

        flushSync(() => {
          setCompletedTransactionData(receiptData);
          setShowReceiptOptions(true);
        });

        // Show success message
        const successMessage = getTransactionSuccessMessage(
          paymentMethod,
          cashAmount,
          total,
          skipPaymentValidation,
        );
        toast.success(successMessage);
      } catch (error) {
        logger.error("Failed to update UI state after transaction:", error);
        toast.error(
          "Transaction completed but UI update failed. Please refresh the page.",
          { duration: 10000 },
        );
        // Still show receipt options even if some state updates failed
        // This ensures user can still access receipt functionality
        try {
          setCompletedTransactionData(receiptData);
          setShowReceiptOptions(true);
        } catch (retryError) {
          logger.error("Failed to set receipt data on retry:", retryError);
        }
      }
    },
    [
      cartItems,
      subtotal,
      tax,
      total,
      userFirstName,
      userLastName,
      userBusinessName,
      paymentMethod,
      cashAmount,
      onResetPrintStatus,
    ],
  );

  /**
   * Complete transaction - handles only transaction creation and cart completion
   */
  const completeTransaction = useCallback(
    async (
      skipPaymentValidation = false,
      actualPaymentMethod?: PaymentMethod["type"],
      vivaWalletTransactionId?: string,
    ) => {
      // CRITICAL FIX #2: Race condition protection
      if (isProcessingRef.current) {
        toast.warning("Transaction is already being processed. Please wait...");
        return;
      }

      if (transactionComplete) {
        toast.warning("Transaction already completed.");
        return;
      }

      isProcessingRef.current = true;

      try {
        // Validate payment method
        if (!skipPaymentValidation) {
          if (!paymentMethod) {
            toast.error("Please select a payment method");
            isProcessingRef.current = false;
            return;
          }

          // CRITICAL FIX #3: Validate split and voucher payments
          if (paymentMethod.type === "split") {
            // For split payments, we need both cash and card amounts
            // Note: This assumes split payment UI provides both amounts
            // If not implemented yet, show error
            toast.error(
              "Split payment requires both cash and card amounts. Please select a different payment method.",
            );
            isProcessingRef.current = false;
            return;
          }

          if (paymentMethod.type === "voucher") {
            // Voucher payments need voucher validation
            // If not implemented yet, show error
            toast.error(
              "Voucher payment is not yet implemented. Please select a different payment method.",
            );
            isProcessingRef.current = false;
            return;
          }

          if (paymentMethod.type === "cash") {
            const validation = validateCashPayment(cashAmount, total);
            if (!validation.valid) {
              toast.error(validation.error || "Invalid cash payment");
              isProcessingRef.current = false;
              return;
            }
          }
        }

        // Validate prerequisites
        const cartValidation = validateCart(cartItems);
        if (!cartValidation.valid) {
          toast.error(cartValidation.error || "Cart validation failed");
          isProcessingRef.current = false;
          return;
        }

        if (!userId) {
          toast.error("User ID not found");
          isProcessingRef.current = false;
          return;
        }

        if (!cartSession) {
          toast.error("Cart session not found");
          isProcessingRef.current = false;
          return;
        }

        if (!businessId) {
          toast.error("Business ID not found");
          isProcessingRef.current = false;
          return;
        }

        const businessValidation = validateBusinessId(businessId);
        if (!businessValidation.valid) {
          toast.error(businessValidation.error || "Business validation failed");
          isProcessingRef.current = false;
          return;
        }

        // Check printer status (non-blocking)
        let printerStatusResult = {
          connected: true,
          error: null as string | null,
        };
        try {
          printerStatusResult = await checkPrinterStatus();
        } catch (error) {
          logger.warn("Failed to check printer status:", error);
          // Continue with transaction - printer check is not critical
        }

        try {
          // Get session token for authentication
          const sessionToken = await window.authStore.get("token");
          if (!sessionToken) {
            toast.error("Session expired. Please log in again.");
            isProcessingRef.current = false;
            return;
          }

          // Get current user to check role-based shift requirements
          const userDataStr = await window.authStore.get("user");
          const userData = userDataStr ? JSON.parse(userDataStr) : null;

          // Use effective role (activeRole if set, otherwise primary role)
          const effectiveRole = getUserRoleName(userData);

          // Determine if shift is required based on EFFECTIVE role
          // This allows admin/manager to switch to "cashier mode" requiring shifts
          const shiftRequired = ["cashier", "supervisor"].includes(
            effectiveRole || "",
          );

          let shiftIdForTransaction: { id: string } | null = null;

          if (shiftRequired) {
            // Get active shift - REQUIRED for cashiers/supervisors
            const shiftResponse = await window.shiftAPI.getActive(userId);
            if (!shiftResponse.success || !shiftResponse.data) {
              toast.error(
                "No active shift found. Please start your shift first.",
              );
              isProcessingRef.current = false;
              return;
            }

            // FIX #13: Validate shift data structure before using
            const shiftData = shiftResponse.data;
            if (
              !shiftData ||
              typeof shiftData !== "object" ||
              !("id" in shiftData) ||
              typeof shiftData.id !== "string"
            ) {
              toast.error("Invalid shift data received. Please try again.");
              // FIX #6: Cleanup timeout before returning on error
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
              }
              isProcessingRef.current = false;
              return;
            }
            shiftIdForTransaction = shiftData as { id: string };
          } else {
            // Admin/Manager/Owner - shift is optional
            try {
              const shiftResponse = await window.shiftAPI.getActive(userId);
              if (shiftResponse.success && shiftResponse.data) {
                shiftIdForTransaction = shiftResponse.data as { id: string };
              }
              // If no shift exists, that's OK for admin/manager
            } catch (error) {
              logger.info("Admin/Manager operating without shift");
            }
          }
          // FIX #9: Add random component to prevent receipt number collision
          const receiptNumber = `RCP-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 7)}`;

          // Determine payment details - FIX #4: Use actual payment method when provided
          let backendPaymentMethod: PaymentMethod["type"];
          if (skipPaymentValidation) {
            // When skipping validation, use the actual payment method if provided
            // Otherwise default to card (only valid if we know card payment was processed)
            backendPaymentMethod = actualPaymentMethod || "card";

            // Add validation warning if no payment method context
            if (!actualPaymentMethod && !paymentMethod) {
              logger.warn(
                "skipPaymentValidation is true but no payment method context provided",
              );
            }
          } else {
            backendPaymentMethod = paymentMethod?.type || "cash";
          }

          const { cashAmount: finalCashAmount, cardAmount: finalCardAmount } =
            calculatePaymentAmounts(backendPaymentMethod, cashAmount, total);

          // Create transaction
          // shiftId is optional - null for admin/owner mode, required for cashier/manager
          const shiftId =
            requiresShift && shiftIdForTransaction
              ? shiftIdForTransaction.id
              : null;
          // Prepare transaction data
          const transactionData: any = {
            cartSessionId: cartSession.id,
            shiftId: shiftId || undefined, // Pass undefined instead of empty string for admin mode
            businessId: businessId!,
            paymentMethod: backendPaymentMethod,
            cashAmount: finalCashAmount,
            cardAmount: finalCardAmount,
            receiptNumber,
          };

          // Add Viva Wallet transaction IDs if payment method is viva_wallet
          if (
            backendPaymentMethod === "viva_wallet" &&
            vivaWalletTransactionId
          ) {
            transactionData.vivaWalletTransactionId = vivaWalletTransactionId;
            // Terminal ID will be retrieved by backend from connected terminal
          }

          const transactionResponse =
            await window.transactionAPI.createFromCart(
              sessionToken, // Pass sessionToken as first argument
              transactionData,
            );

          if (!transactionResponse.success) {
            const errorMessage =
              transactionResponse.message || "Failed to record transaction";
            logger.error("Transaction creation error:", errorMessage);
            toast.error(errorMessage);
            // FIX #6: Cleanup timeout before returning on error
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            isProcessingRef.current = false;
            return;
          }

          // Get transaction ID for potential rollback and receipt generation
          const transactionId =
            (transactionResponse.data as { id?: string })?.id || null;

          if (!transactionId) {
            logger.error("Transaction created but ID is missing from response");
            toast.error(
              "Transaction created but receipt cannot be generated. Please contact support.",
              { duration: 10000 },
            );
            // FIX #6: Cleanup timeout before returning on error
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            isProcessingRef.current = false;
            return;
          }

          // CRITICAL FIX #1: Complete cart session with rollback on failure
          try {
            await window.cartAPI.completeSession(cartSession.id);
          } catch (error) {
            logger.error("Failed to complete cart session:", error);

            toast.error(
              "Transaction was created but cart update failed. Please contact support.",
              { duration: 10000 },
            );
            // FIX #6: Cleanup timeout before returning on error
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            isProcessingRef.current = false;
            return;
          }

          // Mark transaction as complete
          setTransactionComplete(true);

          // Invalidate dashboard statistics cache to show updated data immediately
          if (window.invalidateDashboardCache) {
            window.invalidateDashboardCache(businessId);
          }

          // Handle receipt generation and display after successful transaction
          await handleReceiptAfterTransaction(
            receiptNumber,
            printerStatusResult,
            skipPaymentValidation,
            userId,
            businessId,
            transactionId, // Pass actual transaction ID from database
          );
        } catch (error) {
          logger.error("Transaction error:", error);
          // FIX #11: Consistent error message formatting with details
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Failed to complete transaction";
          toast.error(`Transaction failed: ${errorMessage}`);
          // FIX #6: Cleanup timeout before returning on error
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          return;
        }
      } finally {
        // CRITICAL FIX #2: Always reset processing flag
        isProcessingRef.current = false;
      }
    },
    [
      paymentMethod,
      cashAmount,
      total,
      cartSession,
      cartItems,
      userId,
      businessId,
      checkPrinterStatus,
      handleReceiptAfterTransaction,
      transactionComplete,
    ],
  );

  /**
   * Handle payment method selection and process card payments
   * Viva Wallet handles all contactless card payments
   */
  const handlePayment = useCallback(
    async (method: PaymentMethod["type"]) => {
      setPaymentMethod({
        type: method,
        amount: method === "cash" ? total : total,
      });

      if (method === "cash") {
        // Start empty (cashier will enter received cash in the modal)
        setCashAmount(0);
        return;
      }

      // Viva Wallet payment handling is done in payment panel component
      // The transaction is initiated automatically when viva_wallet is selected
      if (method === "viva_wallet") {
        // Payment panel will handle transaction initiation
        return;
      }

      // Handle legacy card/mobile payments (deprecated, use viva_wallet)
      if (method === "card" || method === "mobile") {
        toast.error(
          "Card payment is now handled by Viva Wallet. Please select Card payment method.",
        );
        return;
      }
    },
    [total],
  );

  /**
   * Handler for downloading receipt as PDF
   */
  const handleDownloadReceipt = useCallback(async () => {
    if (!completedTransactionData || !userId) return;

    const loadingToast = toast.loading("Generating PDF receipt...");

    try {
      if (!businessId) {
        throw new Error("Business ID is required to generate receipt");
      }

      // Validate transaction ID is present
      if (!completedTransactionData.id) {
        throw new Error(
          "Transaction ID is required for PDF receipt generation",
        );
      }

      // Prepare receipt data for PDF
      // Business details will be fetched from database in the PDF service
      const receiptData = {
        businessId: businessId,
        receiptNumber: completedTransactionData.receiptNumber,
        transactionId: completedTransactionData.id, // Use actual transaction ID (required, no fallback)
        date: new Date(completedTransactionData.timestamp).toLocaleDateString(
          "en-GB",
        ),
        time: new Date(completedTransactionData.timestamp).toLocaleTimeString(
          "en-GB",
          { hour: "2-digit", minute: "2-digit" },
        ),
        cashierId: userId || "unknown",
        cashierName: completedTransactionData.cashierName || "Unknown",
        items: completedTransactionData.items.map((item) => ({
          name: item.productName,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          sku: item.productId || "",
        })),
        subtotal: completedTransactionData.subtotal,
        tax: completedTransactionData.tax,
        total: completedTransactionData.total,
        paymentMethod:
          completedTransactionData.paymentMethods[0]?.type || "cash",
        cashAmount:
          completedTransactionData.paymentMethods[0]?.type === "cash"
            ? completedTransactionData.amountPaid
            : undefined,
        cardAmount:
          completedTransactionData.paymentMethods[0]?.type === "card" ||
          completedTransactionData.paymentMethods[0]?.type === "mobile"
            ? completedTransactionData.total
            : undefined,
        change: completedTransactionData.change,
      };

      // Generate PDF
      const result = await window.pdfReceiptAPI.generatePDF(receiptData);

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to generate PDF");
      }

      // Decode and download PDF
      const binaryString = atob(result.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Receipt_${completedTransactionData.receiptNumber}.pdf`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast.success("PDF receipt downloaded successfully!", {
        id: loadingToast,
      });

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      logger.error("Error generating PDF receipt:", error);
      toast.error("Failed to generate PDF receipt. Please try again.", {
        id: loadingToast,
      });
    }
  }, [completedTransactionData, userId, businessId]);

  /**
   * Handler for closing receipt options modal
   */
  const handleCloseReceiptOptions = useCallback(async () => {
    setShowReceiptOptions(false);
    await resetAndInitCart();
    toast.success("Ready for next customer!");
  }, [resetAndInitCart]);

  /**
   * Handler for printing receipt
   * Returns a Promise<boolean> indicating success/failure
   * Status is now handled by PrintStatusIndicator in the modal
   */
  const handlePrintReceipt = useCallback(async (): Promise<boolean> => {
    if (!completedTransactionData) return false;

    try {
      // startPrintingFlow now handles all status updates via the hook
      // It will show: checking-connection → connecting → printing → success/error
      const printResult = await startPrintingFlow(completedTransactionData);

      if (printResult) {
        // Auto-close after successful print (delay allows user to see success state)
        setTimeout(() => {
          handleCloseReceiptOptions();
        }, 2000);
        return true;
      }
      // Error state is shown by PrintStatusIndicator
      return false;
    } catch (error) {
      logger.error("Print error:", error);
      return false;
    }
  }, [completedTransactionData, startPrintingFlow, handleCloseReceiptOptions]);

  /**
   * Handler for emailing receipt
   */
  const handleEmailReceiptOption = useCallback(async () => {
    if (!completedTransactionData) return;

    // Show email modal - modal will handle the actual sending
    // This is a placeholder that will be replaced with modal state management
    toast.info("Opening email dialog...");

    // The modal integration will be handled in the view component
    // This callback signals that email option was selected
  }, [completedTransactionData]);

  /**
   * Handler for canceling payment from receipt modal
   */
  const handleCancelPayment = useCallback(async () => {
    const confirmed = window.confirm(
      "⚠️ Cancel Receipt?\n\n" +
        "The transaction has already been completed and saved.\n" +
        "Are you sure you want to skip the receipt?\n\n" +
        "You can print it later from transaction history.",
    );

    if (confirmed) {
      setShowReceiptOptions(false);
      setCompletedTransactionData(null);
      setTransactionComplete(false);
      setPrinterStatus({ connected: true, error: null });
      await resetAndInitCart();
      toast.info("Receipt skipped. Transaction saved in history.");
    }
  }, [resetAndInitCart]);

  return {
    paymentStep,
    paymentMethod,
    cashAmount,
    transactionComplete,
    showReceiptOptions,
    completedTransactionData,
    printerStatus,
    setPaymentStep,
    setCashAmount,
    setPaymentMethod: (method: PaymentMethod | null) =>
      setPaymentMethod(method),
    setTransactionComplete: (complete: boolean) =>
      setTransactionComplete(complete),
    handlePayment,
    completeTransaction,
    handleDownloadReceipt,
    handlePrintReceipt,
    handleEmailReceiptOption,
    handleCloseReceiptOptions,
    handleCancelPayment,
  };
}
