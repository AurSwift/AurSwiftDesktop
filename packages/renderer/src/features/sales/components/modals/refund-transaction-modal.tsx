import React, { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence } from "@/components/animate-presence";
import { useAuth } from "@/shared/hooks/use-auth";
import { getUserRoleName } from "@/shared/utils/rbac-helpers";
import { toast } from "sonner";
import { AdaptiveKeyboard } from "@/features/adaptive-keyboard/adaptive-keyboard";
import { AdaptiveTextarea } from "@/features/adaptive-keyboard/adaptive-textarea";
import { useKeyboardWithRHF } from "@/shared/hooks";
import { cn } from "@/shared/utils/cn";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("refund-transaction-modal");

// Types
interface Transaction {
  id: string;
  receiptNumber: string;
  timestamp: string;
  total: number;
  paymentMethod: "cash" | "card" | "mixed";
  items: TransactionItem[];
  type: "sale" | "refund" | "void";
}

interface TransactionItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  refundedQuantity?: number;
}

interface RefundItem {
  originalItemId: string;
  productId: string;
  productName: string;
  originalQuantity: number;
  refundQuantity: number;
  unitPrice: number;
  refundAmount: number;
  reason: string;
  restockable: boolean;
}

const REFUND_REASONS = [
  "Defective/Damaged Item",
  "Wrong Item/Size",
  "Customer Dissatisfaction",
  "Pricing Error",
  "Duplicate Purchase",
  "Item Not as Described",
  "Changed Mind",
  "Store Error",
  "Other",
];

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefundProcessed: () => void;
  activeShiftId?: string | null;
}

const RefundTransactionModal: React.FC<RefundModalProps> = ({
  isOpen,
  onClose,
  onRefundProcessed,
  activeShiftId,
}) => {
  const [currentView, setCurrentView] = useState<"search" | "refund">("search");
  const [searchType, setSearchType] = useState<
    "receipt" | "transaction" | "recent"
  >("receipt");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [originalTransaction, setOriginalTransaction] =
    useState<Transaction | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
    [],
  );
  const [selectedItems, setSelectedItems] = useState<Map<string, RefundItem>>(
    new Map(),
  );
  const [refundReason, setRefundReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<
    "original" | "store_credit" | "cash" | "card"
  >("original");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { user } = useAuth();

  // #region agent log
  const renderCountRef = React.useRef(0);
  const prevViewRef = React.useRef<"search" | "refund">("search");
  const prevIsOpenRef = React.useRef(isOpen);
  const lastLogTsRef = React.useRef(0);
  renderCountRef.current += 1;
  const n = renderCountRef.current;
  const now = Date.now();
  if (isOpen && (n <= 5 || n % 15 === 0 || now - lastLogTsRef.current > 800)) {
    lastLogTsRef.current = now;
    fetch("http://127.0.0.1:7242/ingest/67864e30-bd53-4239-ad4d-5897056f6093", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "refund-transaction-modal.tsx:modal-render",
        message: "modal-render",
        data: {
          hypothesisId: "H1",
          renderCount: n,
          isOpen,
          activeShiftId: activeShiftId ?? null,
          currentView,
          ts: now,
        },
        timestamp: now,
        sessionId: "debug-session",
      }),
    }).catch(() => {});
  }
  if (prevViewRef.current !== currentView) {
    prevViewRef.current = currentView;
    fetch("http://127.0.0.1:7242/ingest/67864e30-bd53-4239-ad4d-5897056f6093", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "refund-transaction-modal.tsx:currentView-changed",
        message: "currentView-changed",
        data: { hypothesisId: "H4", currentView, ts: Date.now() },
        timestamp: Date.now(),
        sessionId: "debug-session",
      }),
    }).catch(() => {});
  }
  if (prevIsOpenRef.current !== isOpen) {
    prevIsOpenRef.current = isOpen;
    fetch("http://127.0.0.1:7242/ingest/67864e30-bd53-4239-ad4d-5897056f6093", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "refund-transaction-modal.tsx:isOpen-changed",
        message: "isOpen-changed",
        data: { hypothesisId: "H2", isOpen, ts: Date.now() },
        timestamp: Date.now(),
        sessionId: "debug-session",
      }),
    }).catch(() => {});
  }
  // #endregion

  // Reset modal when closed
  useEffect(() => {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/67864e30-bd53-4239-ad4d-5897056f6093", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "refund-transaction-modal.tsx:reset-effect",
        message: "reset-effect-ran",
        data: { hypothesisId: "H2", isOpen, ts: Date.now() },
        timestamp: Date.now(),
        sessionId: "debug-session",
      }),
    }).catch(() => {});
    // #endregion
    if (!isOpen) {
      setCurrentView("search");
      setOriginalTransaction(null);
      setSelectedItems(new Map());
      setSearchQuery("");
      setRefundReason("");
      setRefundMethod("original");
    }
  }, [isOpen]);

  // Load recent transactions
  const loadRecentTransactions = useCallback(async () => {
    if (!user?.businessId) return;

    try {
      setIsSearching(true);

      const userRole = getUserRoleName(user);
      let response;

      if ((userRole === "cashier" || userRole === "manager") && activeShiftId) {
        response = await window.refundAPI.getShiftTransactions(
          activeShiftId,
          10,
        );
        logger.info(
          `Loading transactions for ${userRole} shift: ${activeShiftId}`,
        );
      } else {
        response = await window.refundAPI.getRecentTransactions(
          user.businessId,
          10,
        );
        logger.info(`Loading recent transactions for ${userRole}`);
      }

      if (response.success && "transactions" in response) {
        const transactionsResponse = response as {
          success: boolean;
          transactions: Transaction[];
        };
        setRecentTransactions(transactionsResponse.transactions || []);
      }
    } catch (error: unknown) {
      logger.error("Failed to load recent transactions:", error);
      toast.error("Failed to load recent transactions");
    } finally {
      setIsSearching(false);
    }
  }, [user?.businessId, user, activeShiftId]);

  // Search for transaction
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a search term");
      return;
    }

    setIsSearching(true);
    try {
      const response =
        searchType === "receipt"
          ? await window.refundAPI.getTransactionByReceipt(searchQuery.trim())
          : await window.refundAPI.getTransactionById(searchQuery.trim());

      if (response.success && "transaction" in response) {
        const transactionResponse = response as {
          success: boolean;
          transaction: Transaction;
        };
        setOriginalTransaction(transactionResponse.transaction);
        setCurrentView("refund");
      } else {
        toast.error("Transaction not found");
      }
    } catch (error: unknown) {
      logger.error("Search failed:", error);
      toast.error("Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  // Select transaction from recent list
  const selectTransaction = (transaction: Transaction) => {
    setOriginalTransaction(transaction);
    setCurrentView("refund");
  };

  // Item management functions
  const addItemToRefund = (item: TransactionItem) => {
    const availableQuantity = item.quantity - (item.refundedQuantity || 0);
    if (availableQuantity <= 0) {
      toast.error("This item has already been fully refunded");
      return;
    }

    const refundItem: RefundItem = {
      originalItemId: item.id,
      productId: item.productId,
      productName: item.productName,
      originalQuantity: item.quantity,
      refundQuantity: 1,
      unitPrice: item.unitPrice,
      refundAmount: item.unitPrice,
      reason: REFUND_REASONS[0],
      restockable: true,
    };

    setSelectedItems((prev) => new Map(prev.set(item.id, refundItem)));
  };

  const removeItemFromRefund = (itemId: string) => {
    setSelectedItems((prev) => {
      const newMap = new Map(prev);
      newMap.delete(itemId);
      return newMap;
    });
  };

  const updateRefundQuantity = (itemId: string, newQuantity: number) => {
    const item = selectedItems.get(itemId);
    if (!item) return;

    const originalItem = originalTransaction?.items.find(
      (i) => i.id === itemId,
    );
    if (!originalItem) return;

    const availableQuantity =
      originalItem.quantity - (originalItem.refundedQuantity || 0);
    const clampedQuantity = Math.max(
      1,
      Math.min(newQuantity, availableQuantity),
    );

    const updatedItem = {
      ...item,
      refundQuantity: clampedQuantity,
      refundAmount: item.unitPrice * clampedQuantity,
    };

    setSelectedItems((prev) => new Map(prev.set(itemId, updatedItem)));
  };

  const updateRefundReason = (itemId: string, reason: string) => {
    const item = selectedItems.get(itemId);
    if (!item) return;
    setSelectedItems((prev) => new Map(prev.set(itemId, { ...item, reason })));
  };

  const updateRestockable = (itemId: string, restockable: boolean) => {
    const item = selectedItems.get(itemId);
    if (!item) return;
    setSelectedItems(
      (prev) => new Map(prev.set(itemId, { ...item, restockable })),
    );
  };

  const refundTotal = Array.from(selectedItems.values()).reduce(
    (sum, item) => sum + item.refundAmount,
    0,
  );

  // Process refund
  const processRefund = async () => {
    if (
      !originalTransaction ||
      !user ||
      selectedItems.size === 0 ||
      !refundReason.trim()
    ) {
      toast.error("Please complete all required fields");
      return;
    }

    setIsProcessing(true);
    try {
      const shiftResponse = await window.shiftAPI.getActive(user.id);
      if (!shiftResponse.success) {
        toast.error("No active shift found");
        return;
      }

      const shiftData = shiftResponse.data as { id: string };
      const refundData = {
        originalTransactionId: originalTransaction.id,
        shiftId: shiftData.id,
        businessId: user.businessId,
        refundItems: Array.from(selectedItems.values()),
        refundReason: refundReason.trim(),
        refundMethod,
        cashierId: user.id,
      };

      const mightBeVivaWalletRefund =
        refundMethod === "card" ||
        (refundMethod === "original" &&
          originalTransaction.paymentMethod === "card");

      let vivaWalletRefundTransactionId: string | undefined;

      const sessionToken = await window.authStore.get("token");
      if (!sessionToken) {
        toast.error("Session expired. Please log in again.");
        setIsProcessing(false);
        setShowConfirmDialog(false);
        return;
      }

      const response = await window.refundAPI.createRefundTransaction(
        sessionToken,
        refundData,
      );

      if (response.success) {
        if (
          mightBeVivaWalletRefund &&
          (response as any).vivaWalletRefundTransactionId
        ) {
          vivaWalletRefundTransactionId = (response as any)
            .vivaWalletRefundTransactionId;

          if (window.vivaWalletAPI && vivaWalletRefundTransactionId) {
            toast.info("Processing Viva Wallet refund, please wait...");

            const pollRefundStatus = async (): Promise<boolean> => {
              const maxAttempts = 60;
              let attempts = 0;

              while (attempts < maxAttempts) {
                try {
                  const statusResult =
                    await window.vivaWalletAPI?.getTransactionStatus(
                      vivaWalletRefundTransactionId!,
                    );

                  if (statusResult?.success && statusResult.status) {
                    const status = statusResult.status.status;

                    if (status === "completed") {
                      toast.success(
                        "Viva Wallet refund processed successfully",
                      );
                      return true;
                    } else if (status === "failed") {
                      toast.error(
                        statusResult.status.error?.message ||
                          "Viva Wallet refund failed",
                      );
                      return false;
                    } else if (status === "cancelled") {
                      toast.warning("Viva Wallet refund was cancelled");
                      return false;
                    }
                  }

                  await new Promise((resolve) => setTimeout(resolve, 1000));
                  attempts++;
                } catch (error) {
                  logger.error("Failed to poll refund status:", error);
                  attempts++;
                }
              }

              toast.warning(
                "Viva Wallet refund is taking longer than expected. Please check terminal status.",
              );
              return false;
            };

            const refundComplete = await pollRefundStatus();
            if (!refundComplete) {
              logger.warn("Viva Wallet refund did not complete successfully");
            }
          }
        } else {
          toast.success("Refund processed successfully");
        }

        onRefundProcessed();
        onClose();
      } else {
        toast.error(response.message || "Failed to process refund");
      }
    } catch (error: unknown) {
      logger.error("Failed to process refund:", error);
      toast.error("Failed to process refund");
    } finally {
      setIsProcessing(false);
      setShowConfirmDialog(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Main Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[calc(100vw-1.5rem)] sm:max-w-6xl max-h-[90vh] flex flex-col animate-modal-enter-95">
          {/* Header - Fixed */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 shrink-0">
            <div className="min-w-0 flex-1 pr-2">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                Process Refund
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Find and refund items from previous transactions
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors touch-manipulation shrink-0"
            >
              <svg
                className="w-5 h-5 sm:w-6 sm:h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content - no scroll in refund view so right-column keyboard stays at bottom */}
          <div
            className={`flex-1 min-h-0 ${
              currentView === "refund" ? "overflow-hidden flex flex-col" : "overflow-y-auto"
            }`}
          >
            <AnimatePresence
              mode="wait"
              exitAnimation="slide-left-exit"
              exitDuration={200}
            >
              {currentView === "search" ? (
                <SearchView
                  key="search"
                  searchType={searchType}
                  setSearchType={setSearchType}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  isSearching={isSearching}
                  recentTransactions={recentTransactions}
                  onSearch={handleSearch}
                  onSelectTransaction={selectTransaction}
                  onLoadRecent={loadRecentTransactions}
                />
              ) : (
                <RefundView
                  key="refund"
                  originalTransaction={originalTransaction}
                  selectedItems={selectedItems}
                  refundReason={refundReason}
                  setRefundReason={setRefundReason}
                  refundMethod={refundMethod}
                  setRefundMethod={setRefundMethod}
                  refundTotal={refundTotal}
                  onAddItem={addItemToRefund}
                  onRemoveItem={removeItemFromRefund}
                  onUpdateQuantity={updateRefundQuantity}
                  onUpdateReason={updateRefundReason}
                  onUpdateRestockable={updateRestockable}
                  onBack={() => {
                    setCurrentView("search");
                    setOriginalTransaction(null);
                    setSelectedItems(new Map());
                  }}
                  onProcess={() => setShowConfirmDialog(true)}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AnimatePresence exitAnimation="modal-exit-95" exitDuration={200}>
        {showConfirmDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-[calc(100vw-2rem)] sm:max-w-md w-full p-4 sm:p-6 animate-modal-enter-95">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                  <svg
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-slate-900">
                  Confirm Refund
                </h3>
              </div>

              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                <div className="bg-slate-50 rounded-lg p-3 sm:p-4">
                  <h4 className="font-medium mb-2 text-sm sm:text-base">
                    Refund Summary:
                  </h4>
                  <div className="space-y-1.5 sm:space-y-2">
                    {Array.from(selectedItems.values()).map((item) => (
                      <div
                        key={item.originalItemId}
                        className="flex justify-between text-xs sm:text-sm"
                      >
                        <span className="line-clamp-1">
                          {item.productName} × {item.refundQuantity}
                        </span>
                        <span className="ml-2 shrink-0">
                          £{item.refundAmount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t mt-2 pt-2 flex justify-between font-semibold text-sm sm:text-base">
                    <span>Total:</span>
                    <span className="text-red-600">
                      £{refundTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="text-xs sm:text-sm text-slate-600">
                  <p>
                    <strong>Method:</strong>{" "}
                    {refundMethod === "original"
                      ? "Original Payment Method"
                      : refundMethod}
                  </p>
                  <p className="line-clamp-2">
                    <strong>Reason:</strong> {refundReason}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50 h-10 sm:h-11 text-sm sm:text-base touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  onClick={processRefund}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center h-10 sm:h-11 text-sm sm:text-base touch-manipulation"
                >
                  {isProcessing ? (
                    <>
                      <svg
                        className="w-4 h-4 animate-spin mr-2 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        ></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    "Confirm Refund"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

// Search View Component
const SearchView: React.FC<{
  searchType: string;
  setSearchType: (type: "receipt" | "transaction" | "recent") => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearching: boolean;
  recentTransactions: Transaction[];
  onSearch: () => void;
  onSelectTransaction: (transaction: Transaction) => void;
  onLoadRecent: () => void;
}> = ({
  searchType,
  setSearchType,
  searchQuery,
  setSearchQuery,
  isSearching,
  recentTransactions,
  onSearch,
  onSelectTransaction,
  onLoadRecent,
}) => {
  return (
    <div className="p-4 sm:p-6 animate-slide-right">
      <div className="max-w-2xl mx-auto w-full space-y-4 sm:space-y-6">
        {/* Search Type Tabs */}
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { key: "receipt" as const, label: "Receipt Number" },
              { key: "transaction" as const, label: "Transaction ID" },
              { key: "recent" as const, label: "Recent Sales" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setSearchType(key);
                if (key === "recent") onLoadRecent();
              }}
              className={`px-2 sm:px-4 py-2 sm:py-3 rounded-lg border transition-all text-xs sm:text-sm touch-manipulation ${
                searchType === key
                  ? "border-green-500 bg-green-50 text-green-700 font-medium"
                  : "border-slate-300 text-slate-600 hover:border-slate-400"
              }`}
            >
              <span className="line-clamp-1">{label}</span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        {searchType !== "recent" && (
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <input
              type="text"
              placeholder={`Enter ${
                searchType === "receipt" ? "receipt number" : "transaction ID"
              }`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && onSearch()}
              className="flex-1 px-3 sm:px-4 py-2 sm:py-3 border border-slate-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 h-10 sm:h-11 text-sm sm:text-base"
            />
            <button
              onClick={onSearch}
              disabled={isSearching}
              className="px-4 sm:px-6 py-2 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 h-10 sm:h-11 text-sm sm:text-base touch-manipulation"
            >
              {isSearching ? (
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  ></path>
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              )}
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>
        )}

        {/* Recent Transactions */}
        {searchType === "recent" && (
          <div className="space-y-2 sm:space-y-3">
            {recentTransactions.length === 0 ? (
              <div className="text-center py-8 sm:py-12 text-slate-500">
                <svg
                  className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-3 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <p className="text-xs sm:text-sm">
                  No recent transactions found
                </p>
              </div>
            ) : (
              recentTransactions.map((transaction) => (
                <button
                  key={transaction.id}
                  onClick={() => onSelectTransaction(transaction)}
                  className="w-full p-3 sm:p-4 border border-slate-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors text-left touch-manipulation"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-0">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 text-sm sm:text-base">
                        #{transaction.receiptNumber}
                      </div>
                      <div className="text-xs sm:text-sm text-slate-500">
                        {new Date(transaction.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="font-bold text-green-600 text-sm sm:text-base">
                        £{transaction.total.toFixed(2)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {transaction.items.length} items
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Refund View Component - KEYBOARD IN RIGHT COLUMN ONLY
const RefundView: React.FC<{
  originalTransaction: Transaction | null;
  selectedItems: Map<string, RefundItem>;
  refundReason: string;
  setRefundReason: (reason: string) => void;
  refundMethod: string;
  setRefundMethod: (
    method: "original" | "store_credit" | "cash" | "card",
  ) => void;
  refundTotal: number;
  onAddItem: (item: TransactionItem) => void;
  onRemoveItem: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onUpdateReason: (itemId: string, reason: string) => void;
  onUpdateRestockable: (itemId: string, restockable: boolean) => void;
  onBack: () => void;
  onProcess: () => void;
}> = ({
  originalTransaction,
  selectedItems,
  refundReason,
  setRefundReason,
  refundMethod,
  setRefundMethod,
  refundTotal,
  onAddItem,
  onRemoveItem,
  onUpdateQuantity,
  onUpdateReason,
  onUpdateRestockable,
  onBack,
  onProcess,
}) => {
  const textareaRef = useRef<HTMLDivElement>(null);
  const rightColumnScrollRef = useRef<HTMLDivElement>(null);

  // Form state for keyboard integration
  const [refundReasonForm, setRefundReasonForm] = useState({
    refundReason: refundReason,
  });

  // Keyboard integration hook
  const keyboard = useKeyboardWithRHF({
    setValue: ((name: string, value: string) => {
      if (name === "refundReason") {
        setRefundReasonForm((prev) => ({ ...prev, [name]: value }));
        setRefundReason(value);
      }
    }) as any,
    watch: (() => refundReasonForm) as any,
    fieldConfigs: {
      refundReason: { keyboardMode: "qwerty" },
    },
  });

  // Sync form state with prop
  useEffect(() => {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/67864e30-bd53-4239-ad4d-5897056f6093", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "refund-transaction-modal.tsx:RefundView-sync-effect",
        message: "refundReason-sync-ran",
        data: {
          hypothesisId: "H3",
          refundReasonLen: (refundReason ?? "").length,
          ts: Date.now(),
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
      }),
    }).catch(() => {});
    // #endregion
    setRefundReasonForm({ refundReason });
  }, [refundReason]);

  // Auto-scroll textarea into view when keyboard opens
  useEffect(() => {
    if (
      keyboard.showKeyboard &&
      textareaRef.current &&
      rightColumnScrollRef.current
    ) {
      // Small delay to ensure keyboard is rendered and heights are calculated
      const timeoutId = setTimeout(() => {
        if (!textareaRef.current || !rightColumnScrollRef.current) return;

        // Scroll textarea into view with smooth behavior
        textareaRef.current.scrollIntoView({
          behavior: "smooth",
          block: "nearest", // Keep it visible but don't force to top
          inline: "nearest",
        });

        // Additional scroll adjustment to ensure some padding above textarea
        setTimeout(() => {
          if (!textareaRef.current || !rightColumnScrollRef.current) return;
          const container = rightColumnScrollRef.current;
          const textarea = textareaRef.current;
          const textareaRect = textarea.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          // If textarea is too close to keyboard, scroll it up a bit more
          const distanceFromBottom = containerRect.bottom - textareaRect.bottom;
          if (distanceFromBottom < 100) {
            // Less than 100px from keyboard
            container.scrollTop += 50; // Scroll down 50px more to show textarea better
          }
        }, 400); // After smooth scroll completes
      }, 150);

      return () => clearTimeout(timeoutId);
    }
  }, [keyboard.showKeyboard]);

  if (!originalTransaction) return null;

  return (
    <div className="animate-slide-right flex-1 min-h-0 flex flex-col">
      {/* Grid layout - each column gets equal height */}
      <div className="grid lg:grid-cols-2 flex-1 min-h-0">
        {/* Left Panel - Transaction Details (scrollable, unaffected by keyboard) */}
        <div className="border-b lg:border-b-0 lg:border-r border-slate-200 p-3 sm:p-4 lg:p-6 max-h-[60vh] lg:max-h-[calc(90vh-8rem)] overflow-y-auto">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 lg:mb-6 sticky top-0 bg-white pb-2 z-10">
            <button
              onClick={onBack}
              className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-lg transition-colors touch-manipulation shrink-0"
            >
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-slate-900 truncate">
              Transaction Details
            </h3>
          </div>

          <div className="space-y-6">
            {/* Transaction Info */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 p-2 sm:p-3 lg:p-4 bg-slate-50 rounded-lg">
              <div className="min-w-0">
                <label className="text-caption lg:text-sm font-medium text-slate-600">
                  Receipt Number
                </label>
                <div className="font-semibold mt-0.5 sm:mt-1 text-xs sm:text-sm lg:text-base truncate">
                  #{originalTransaction.receiptNumber}
                </div>
              </div>
              <div className="min-w-0">
                <label className="text-caption lg:text-sm font-medium text-slate-600">
                  Date & Time
                </label>
                <div className="font-semibold mt-0.5 sm:mt-1 text-caption lg:text-sm">
                  {new Date(originalTransaction.timestamp).toLocaleString()}
                </div>
              </div>
              <div className="min-w-0">
                <label className="text-caption lg:text-sm font-medium text-slate-600">
                  Total Amount
                </label>
                <div className="font-bold text-green-600 text-sm sm:text-base lg:text-lg mt-0.5 sm:mt-1">
                  £{originalTransaction.total.toFixed(2)}
                </div>
              </div>
              <div className="min-w-0">
                <label className="text-caption lg:text-sm font-medium text-slate-600">
                  Payment Method
                </label>
                <div className="font-semibold mt-0.5 sm:mt-1 capitalize text-xs sm:text-sm lg:text-base">
                  {originalTransaction.paymentMethod}
                </div>
              </div>
            </div>

            {/* Items List */}
            <div>
              <h4 className="font-medium text-slate-900 mb-2 sm:mb-3 text-xs sm:text-sm lg:text-base">
                Items ({originalTransaction.items.length})
              </h4>
              <div className="space-y-2 sm:space-y-3">
                {originalTransaction.items.map((item) => {
                  const availableQuantity =
                    item.quantity - (item.refundedQuantity || 0);
                  const isSelected = selectedItems.has(item.id);

                  return (
                    <div
                      key={item.id}
                      className={`p-2 sm:p-3 lg:p-4 border rounded-lg transition-all ${
                        isSelected
                          ? "border-green-300 bg-green-50"
                          : availableQuantity === 0
                            ? "border-slate-200 bg-slate-50 opacity-60"
                            : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 text-xs sm:text-sm lg:text-base truncate">
                            {item.productName}
                          </div>
                          <div className="text-caption lg:text-sm text-slate-600 mt-0.5 sm:mt-1">
                            Qty: {item.quantity} × £{item.unitPrice.toFixed(2)}
                            {item.refundedQuantity ? (
                              <span className="text-red-600 ml-1 sm:ml-2">
                                ({item.refundedQuantity} refunded)
                              </span>
                            ) : null}
                          </div>
                          <div className="font-medium text-slate-900 mt-0.5 sm:mt-1 text-xs sm:text-sm lg:text-base">
                            £{item.totalPrice.toFixed(2)}
                          </div>
                        </div>
                        <div className="shrink-0">
                          {availableQuantity > 0 && !isSelected && (
                            <button
                              onClick={() => onAddItem(item)}
                              className="px-2 py-1 bg-green-600 text-white text-caption lg:text-sm rounded hover:bg-green-700 touch-manipulation whitespace-nowrap"
                            >
                              Add to Refund
                            </button>
                          )}
                          {isSelected && (
                            <button
                              onClick={() => onRemoveItem(item.id)}
                              className="px-2 py-1 border border-red-300 text-red-600 text-caption lg:text-sm rounded hover:bg-red-50 touch-manipulation"
                            >
                              Remove
                            </button>
                          )}
                          {availableQuantity === 0 && (
                            <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-slate-200 text-slate-600 text-caption lg:text-xs rounded whitespace-nowrap">
                              Fully Refunded
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Refund Configuration; keyboard fixed at bottom */}
        <div className="flex flex-col min-h-0 h-full max-h-[60vh] lg:max-h-[calc(90vh-8rem)] overflow-hidden">
          {/* Scrollable Content Area - takes remaining space above keyboard */}
          <div
            ref={rightColumnScrollRef}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-6"
          >
            <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-slate-900 mb-3 sm:mb-4 lg:mb-6 sticky top-0 bg-white pb-2 z-10">
              Refund Configuration
            </h3>

            {selectedItems.size > 0 ? (
              <div className="space-y-4 sm:space-y-6">
                {/* Selected Items */}
                <div>
                  <h4 className="font-medium text-slate-900 mb-2 sm:mb-3 text-xs sm:text-sm lg:text-base">
                    Selected Items ({selectedItems.size})
                  </h4>
                  <div className="space-y-3 sm:space-y-4">
                    {Array.from(selectedItems.values()).map((item) => (
                      <div
                        key={item.originalItemId}
                        className="p-2 sm:p-3 lg:p-4 border border-green-300 rounded-lg bg-green-50"
                      >
                        <div className="space-y-3 sm:space-y-4">
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-slate-900 text-xs sm:text-sm lg:text-base truncate">
                                {item.productName}
                              </div>
                              <div className="text-caption lg:text-sm text-slate-600">
                                £{item.unitPrice.toFixed(2)} each
                              </div>
                            </div>
                            <div className="font-bold text-green-600 text-sm sm:text-base lg:text-lg shrink-0">
                              £{item.refundAmount.toFixed(2)}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
                            <div>
                              <label className="text-caption lg:text-sm font-medium block mb-1">
                                Quantity
                              </label>
                              <div className="flex items-center gap-1 sm:gap-2">
                                <button
                                  onClick={() =>
                                    onUpdateQuantity(
                                      item.originalItemId,
                                      item.refundQuantity - 1,
                                    )
                                  }
                                  disabled={item.refundQuantity <= 1}
                                  className="w-6 h-6 sm:w-8 sm:h-8 border border-slate-300 rounded disabled:opacity-30 hover:bg-slate-50 text-xs sm:text-sm"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  value={item.refundQuantity}
                                  onChange={(e) =>
                                    onUpdateQuantity(
                                      item.originalItemId,
                                      parseInt(e.target.value) || 1,
                                    )
                                  }
                                  className="w-10 sm:w-14 lg:w-16 h-6 sm:h-8 border border-slate-300 rounded text-center text-xs sm:text-sm"
                                  min="1"
                                  max={item.originalQuantity}
                                />
                                <button
                                  onClick={() =>
                                    onUpdateQuantity(
                                      item.originalItemId,
                                      item.refundQuantity + 1,
                                    )
                                  }
                                  disabled={
                                    item.refundQuantity >= item.originalQuantity
                                  }
                                  className="w-6 h-6 sm:w-8 sm:h-8 border border-slate-300 rounded disabled:opacity-30 hover:bg-slate-50 text-xs sm:text-sm"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="text-caption lg:text-sm font-medium block mb-1">
                                Reason
                              </label>
                              <select
                                value={item.reason}
                                onChange={(e) =>
                                  onUpdateReason(
                                    item.originalItemId,
                                    e.target.value,
                                  )
                                }
                                className="w-full h-6 sm:h-8 border border-slate-300 rounded px-1 sm:px-2 text-caption lg:text-sm"
                              >
                                {REFUND_REASONS.map((reason) => (
                                  <option key={reason} value={reason}>
                                    {reason}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <label className="flex items-center gap-1.5 sm:gap-2 text-caption lg:text-sm">
                            <input
                              type="checkbox"
                              checked={item.restockable}
                              onChange={(e) =>
                                onUpdateRestockable(
                                  item.originalItemId,
                                  e.target.checked,
                                )
                              }
                              className="rounded border-slate-300 w-3 h-3 sm:w-4 sm:h-4"
                            />
                            Return to inventory
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Refund Method */}
                <div>
                  <label className="text-caption lg:text-sm font-medium text-slate-900 block mb-1 sm:mb-2">
                    Refund Method
                  </label>
                  <select
                    value={refundMethod}
                    onChange={(e) =>
                      setRefundMethod(
                        e.target.value as
                          | "original"
                          | "store_credit"
                          | "cash"
                          | "card",
                      )
                    }
                    className="w-full p-2 sm:p-3 border border-slate-300 rounded-lg focus:outline-none focus:border-green-500 text-xs sm:text-sm lg:text-base"
                  >
                    <option value="original">Original Payment Method</option>
                    <option value="cash">Cash Refund</option>
                    <option value="card">Card Refund</option>
                    <option value="store_credit">Store Credit</option>
                  </select>
                </div>

                {/* Refund Reason Textarea */}
                <div ref={textareaRef}>
                  <label className="text-caption lg:text-sm font-medium text-slate-900 block mb-1 sm:mb-2">
                    Overall Refund Reason
                  </label>
                  <AdaptiveTextarea
                    id="refundReason"
                    label=""
                    value={String(
                      keyboard.formValues?.refundReason || refundReason || "",
                    )}
                    placeholder="Provide a detailed reason for this refund..."
                    readOnly
                    onClick={() => keyboard.handleFieldFocus("refundReason")}
                    onFocus={() => keyboard.handleFieldFocus("refundReason")}
                    className={cn(
                      "w-full p-2 sm:p-3 border border-slate-300 rounded-lg focus:outline-none min-h-16 sm:min-h-20 lg:min-h-24 resize-vertical text-xs sm:text-sm lg:text-base cursor-pointer",
                      keyboard.activeField === "refundReason" &&
                        "ring-2 ring-primary border-primary",
                    )}
                  />
                </div>

                {/* Refund Total + Submit - Always visible at bottom of scroll */}
                <div className="border-t pt-4 sm:pt-6 pb-2">
                  <div className="flex justify-between items-center text-base sm:text-lg lg:text-xl font-bold mb-3 sm:mb-4">
                    <span>Refund Total:</span>
                    <span className="text-red-600">
                      £{refundTotal.toFixed(2)}
                    </span>
                  </div>
                  <button
                    onClick={onProcess}
                    disabled={!refundReason.trim()}
                    className="w-full p-2.5 sm:p-3 lg:p-4 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-semibold text-xs sm:text-sm lg:text-base h-10 sm:h-12 lg:h-14 touch-manipulation"
                  >
                    Process Refund
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 sm:py-8 lg:py-12 text-slate-500">
                <svg
                  className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 mx-auto mb-2 sm:mb-3 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
                <h4 className="text-sm sm:text-base lg:text-lg font-medium text-slate-600 mb-1 sm:mb-2">
                  No Items Selected
                </h4>
                <p className="text-xs sm:text-sm">
                  Select items from the transaction to configure your refund
                </p>
              </div>
            )}
          </div>

          {/* Keyboard - Pinned to bottom of right column */}
          {keyboard.showKeyboard && (
            <div className="shrink-0 w-full border-t border-slate-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.08)]">
              <AdaptiveKeyboard
                visible={keyboard.showKeyboard}
                initialMode={
                  (
                    keyboard.activeFieldConfig as {
                      keyboardMode?: "qwerty" | "numeric" | "symbols";
                    }
                  )?.keyboardMode || "qwerty"
                }
                onInput={keyboard.handleInput}
                onBackspace={keyboard.handleBackspace}
                onClear={keyboard.handleClear}
                onEnter={keyboard.handleCloseKeyboard}
                onClose={keyboard.handleCloseKeyboard}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RefundTransactionModal;
