import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { toast } from "sonner";

// Hooks
import { useAuth } from "@/shared/hooks/use-auth";
import { useActiveShift } from "@/features/dashboard/hooks/use-active-shift";
import {
  useReceiptPrintingFlow,
  useThermalPrinter,
} from "@/services/hardware/printer";
import {
  useCart,
  useProducts,
  useCategories,
  useWeightInput,
  useCategoryPriceInput,
  useShift,
  usePayment,
  useBarcodeScanner,
  usePaginatedProducts,
  useVirtualCategories,
} from "../hooks";
import { useSalesMode } from "../hooks/use-sales-mode";
import {
  USE_VIRTUALIZED_PRODUCTS,
  USE_VIRTUAL_CATEGORIES,
} from "@/shared/config/feature-flags";

// Components
import {
  LoadingState,
  ShiftBanner,
  OvertimeWarning,
  TimeChangeBanner,
  StartShiftDialog,
  NoActiveShiftModal,
  ProductSelectionPanel,
  CartPanel,
  PaymentPanel,
  WeightInputDisplay,
  CategoryPriceInputDisplay,
} from "../components";
import { ReceiptOptionsModal } from "../components/payment/receipt-options-modal";
import { LockTillBreakDialog } from "../components/lock-till-break-dialog";
import { LockScreen } from "../components/lock-screen";

// Shared Components
import {
  QuickActionsCarousel,
  QuickActionButtons,
  NumericKeypad,
} from "../components/shared";
import {
  AgeVerificationModal,
  BatchSelectionModal,
  GenericItemPriceModal,
  RefundTransactionView,
  CashDrawerCountModal,
  QuantityModal,
  SaveBasketModal,
  ItemEnquiryModal,
} from "../components/modals";
import type {
  AgeVerificationData,
  SelectedBatchData,
} from "../components/modals";
import { ScaleDisplay } from "../components/input/ScaleDisplay";

// Types
import type { Product, Category } from "@/types/domain";
import type { PrinterConfig } from "@/types/features/printer";
import type { CartItemWithProduct } from "@/types/features/cart";

// Utils
import { isWeightedProduct } from "../utils/product-helpers";
import { getUserRoleName } from "@/shared/utils/rbac-helpers";
import { autoSelectBatches } from "../utils/batch-selection";
import {
  useSalesUnitSettings,
  getEffectiveSalesUnit,
} from "@/shared/hooks/use-sales-unit-settings";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("index");

// Constants
const DOUBLE_CLICK_DELAY = 300;

interface NewTransactionViewProps {
  onBack: () => void;
  /**
   * Whether this view is embedded within a DashboardLayout.
   * When true, hides redundant layout elements like admin mode indicator.
   * @default false
   */
  embeddedInDashboard?: boolean;
}

export function NewTransactionView({
  onBack,
  embeddedInDashboard = false,
}: NewTransactionViewProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const salesUnitSettings = useSalesUnitSettings(user?.businessId);
  void embeddedInDashboard;

  // Active shift hook for break integration
  const {
    shift: activeShift,
    activeBreak,
    refresh: refreshShift,
  } = useActiveShift(user?.id);

  // Lock till state
  const [isTillLocked, setIsTillLocked] = useState(false);
  const [showLockDialog, setShowLockDialog] = useState(false);

  // Search query state
  const [searchQuery] = useState("");
  const [lastClickTime, setLastClickTime] = useState<{
    productId: string;
    timestamp: number;
  } | null>(null);

  // Modal states
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showCountModal, setShowCountModal] = useState(false);
  const [showAgeVerificationModal, setShowAgeVerificationModal] =
    useState(false);
  const [showGenericPriceModal, setShowGenericPriceModal] = useState(false);
  const [
    pendingProductForAgeVerification,
    setPendingProductForAgeVerification,
  ] = useState<Product | null>(null);
  const [pendingWeightForAgeVerification, setPendingWeightForAgeVerification] =
    useState<number | undefined>(undefined);
  const [
    pendingBatchDataForAgeVerification,
    setPendingBatchDataForAgeVerification,
  ] = useState<{
    batchId: string;
    batchNumber: string;
    expiryDate: Date;
  } | null>(null);
  // Track age verification state per product to prevent race conditions
  const [ageVerifiedForProduct, setAgeVerifiedForProduct] = useState<
    Record<string, boolean>
  >({});
  const [pendingGenericProduct, setPendingGenericProduct] =
    useState<Product | null>(null);
  const [showScaleDisplay, setShowScaleDisplay] = useState(false);

  // Selected cart item (EPOS-style selection for actions like quantity, enquiry, line void)
  const [selectedCartItem, setSelectedCartItem] =
    useState<CartItemWithProduct | null>(null);

  // Quantity modal state
  const [showQuantityModal, setShowQuantityModal] = useState(false);

  // Item enquiry modal state
  const [showItemEnquiryModal, setShowItemEnquiryModal] = useState(false);

  // Save basket modal state
  const [showSaveBasketModal, setShowSaveBasketModal] = useState(false);

  // Batch selection modal states
  const [showBatchSelectionModal, setShowBatchSelectionModal] = useState(false);
  const [pendingProductForBatchSelection, setPendingProductForBatchSelection] =
    useState<Product | null>(null);
  const [
    pendingQuantityForBatchSelection,
    setPendingQuantityForBatchSelection,
  ] = useState<number>(1);
  const [pendingWeightForBatchSelection, setPendingWeightForBatchSelection] =
    useState<number | undefined>(undefined);

  // Receipt printing flow - enhanced with status and error states
  const {
    isShowingStatus,
    startPrintingFlow,
    handleSkipReceipt,
    handleRetryPrint,
    handleCancelPrint,
    printStatus,
    printerError,
  } = useReceiptPrintingFlow();

  // Thermal printer
  const { connectPrinter: connectPrinterInternal } = useThermalPrinter();

  // Wrapper for connect printer with localStorage save
  const connectPrinter = useCallback(
    async (config: PrinterConfig): Promise<boolean> => {
      const result = await connectPrinterInternal(config);
      if (result) {
        localStorage.setItem("printer_config", JSON.stringify(config));
      }
      return result;
    },
    [connectPrinterInternal],
  );

  // Shared state for current category (used by both products and categories hooks)
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(
    null,
  );

  // Products hook - use paginated version for large datasets
  const legacyProducts = useProducts(
    USE_VIRTUALIZED_PRODUCTS ? undefined : user?.businessId,
  );
  const paginatedProducts = usePaginatedProducts({
    businessId: USE_VIRTUALIZED_PRODUCTS ? user?.businessId : undefined,
    categoryId: currentCategoryId, // Reactive - updates when category navigation changes
  });

  // Unified products interface
  const products = USE_VIRTUALIZED_PRODUCTS
    ? {
        products: paginatedProducts.products,
        loading: paginatedProducts.initialLoading,
        error: paginatedProducts.error,
        loadProducts: paginatedProducts.refresh,
      }
    : legacyProducts;

  // Weight input hook
  const weightInput = useWeightInput();

  // Category price input hook
  const categoryPriceInput = useCategoryPriceInput();

  // Sales mode detection
  const salesMode = useSalesMode();

  // Shift hook (only used for cashier mode)
  const shift = useShift({
    userId: user?.id,
    userRole: user ? getUserRoleName(user) : undefined,
    businessId: user?.businessId,
    onCartSessionInit: async () => {
      await cart.initializeCartSession();
      return;
    },
  });

  // Cart hook
  const cart = useCart({
    userId: user?.id,
    businessId: user?.businessId,
    userRole: user ? getUserRoleName(user) : undefined,
    activeShift: salesMode.activeShift || shift.activeShift, // Use salesMode activeShift if available
    todaySchedule: shift.todaySchedule,
  });

  // Categories hook - use virtual version for large category trees
  const legacyCategories = useCategories({
    businessId: USE_VIRTUAL_CATEGORIES ? undefined : user?.businessId,
    products: products.products,
    onCategorySelectForPriceInput: (category) => {
      categoryPriceInput.setPendingCategory(category);
      weightInput.resetWeightInput();
    },
  });
  const virtualCategories = useVirtualCategories({
    businessId: USE_VIRTUAL_CATEGORIES ? user?.businessId : undefined,
    products: products.products,
    onCategorySelectForPriceInput: (category) => {
      categoryPriceInput.setPendingCategory(category);
      weightInput.resetWeightInput();
    },
  });

  // Wrap category handlers to sync with shared currentCategoryId for product filtering
  const wrappedCategoryClick = useCallback(
    async (category: Category, addToCart?: boolean) => {
      if (USE_VIRTUAL_CATEGORIES) {
        await virtualCategories.handleCategoryClick(category, addToCart);
        // Sync the category ID for product filtering
        if (!addToCart) {
          setCurrentCategoryId(category.id);
        }
      } else {
        legacyCategories.handleCategoryClick(category, addToCart);
        setCurrentCategoryId(category.id);
      }
    },
    [virtualCategories, legacyCategories],
  );

  const wrappedBreadcrumbClick = useCallback(
    async (index: number) => {
      if (USE_VIRTUAL_CATEGORIES) {
        await virtualCategories.handleBreadcrumbClick(index);
        // Get the target category ID from breadcrumb
        const targetId = virtualCategories.breadcrumb[index]?.id ?? null;
        setCurrentCategoryId(targetId);
      } else {
        legacyCategories.handleBreadcrumbClick(index);
        const targetId = legacyCategories.breadcrumb[index]?.id ?? null;
        setCurrentCategoryId(targetId);
      }
    },
    [virtualCategories, legacyCategories],
  );

  // Unified categories interface with wrapped handlers
  const categories = USE_VIRTUAL_CATEGORIES
    ? {
        ...virtualCategories,
        handleCategoryClick: wrappedCategoryClick,
        handleBreadcrumbClick: wrappedBreadcrumbClick,
      }
    : {
        ...legacyCategories,
        handleCategoryClick: wrappedCategoryClick,
        handleBreadcrumbClick: wrappedBreadcrumbClick,
      };

  // Payment hook
  const payment = usePayment({
    cartSession: cart.cartSession,
    cartItems: cart.cartItems,
    subtotal: cart.subtotal,
    tax: cart.tax,
    total: cart.total,
    userId: user?.id,
    businessId: user?.businessId,
    userFirstName: user?.firstName,
    userLastName: user?.lastName,
    userBusinessName: user?.businessName,
    startPrintingFlow,
    isShowingStatus,
    onResetPrintStatus: handleSkipReceipt,
    onCartSessionInit: async () => {
      await cart.initializeCartSession();
      return;
    },
    activeShift: salesMode.activeShift || shift.activeShift, // Use salesMode activeShift
    requiresShift: salesMode.requiresShift, // Pass shift requirement
  });

  // Check if operations should be disabled (only for cashier mode)
  const isOperationsDisabled =
    salesMode.requiresShift &&
    !salesMode.activeShift &&
    shift.todaySchedule !== null;

  // Check if shift has ended and no future shift is available
  const shiftHasEnded = useMemo(() => {
    if (!shift.todaySchedule) return false;
    const now = new Date();
    const scheduledEnd = new Date(shift.todaySchedule.endTime);
    const timeFromEnd = now.getTime() - scheduledEnd.getTime();
    const minutesAfterEnd = timeFromEnd / (1000 * 60);
    // Shift has ended if it's more than 60 minutes past the end time
    return minutesAfterEnd > 60;
  }, [shift.todaySchedule]);

  // Handle product click
  const handleProductClick = useCallback(
    async (product: Product, weight?: number) => {
      if (isOperationsDisabled) {
        const errorMessage = salesMode.requiresShift
          ? "Please start your shift before adding items to cart"
          : "Unable to add items to cart";
        toast.error(errorMessage);
        return;
      }

      // Check if product requires batch tracking (expiry checking)
      const requiresBatchTracking = product.requiresBatchTracking === true;

      // Check if product requires age verification
      const requiresAgeVerification =
        product.ageRestrictionLevel && product.ageRestrictionLevel !== "NONE";

      if (isWeightedProduct(product)) {
        // For weighted products, check age verification FIRST (before scale display)
        if (requiresAgeVerification && weight === undefined) {
          // Age verification required and no weight yet - show age verification modal FIRST
          setPendingProductForAgeVerification(product);
          setShowAgeVerificationModal(true);
          // After age verification, the scale display will be shown
          return; // Exit early - scale display will be shown after age verification
        }

        // Age verification either not required or already completed
        if (weight !== undefined && weight > 0) {
          // Weight provided, proceed with batch selection
          // Check if age verification was already completed for this product
          const ageVerified = ageVerifiedForProduct[product.id] || false;

          if (requiresBatchTracking) {
            // Each cart addition = 1 item (quantity = 1, regardless of weight value)
            // Check if batch has enough quantity (1 item) available
            const batchResult = await autoSelectBatches(
              product,
              1, // Check batch has >= 1 item available (quantity check, not weight)
              false, // Don't allow partial - need exactly 1 item
            );

            if (batchResult.success && batchResult.primaryBatch) {
              // Batch has enough quantity (>= 1) - add 1 item to cart
              // Cart item: quantity = 1 (for batch deduction), weight = weight value (for pricing only)
              await cart.addToCart(
                product,
                weight, // Weight value (stored in item.weight, used for pricing only)
                undefined,
                ageVerified,
                undefined,
                batchResult.primaryBatch,
              );

              // Show success message
              toast.success(`Added ${product.name} to cart`);

              weightInput.resetWeightInput();
              // Clear age verification for this product after use
              setAgeVerifiedForProduct((prev) => {
                const next = { ...prev };
                delete next[product.id];
                return next;
              });
              setShowScaleDisplay(false);
            } else if (batchResult.shouldShowModal) {
              // Show batch selection modal for manual selection
              setPendingWeightForBatchSelection(weight);
              setPendingProductForBatchSelection(product);
              setPendingQuantityForBatchSelection(weight);
              setShowBatchSelectionModal(true);
              weightInput.resetWeightInput();
              setShowScaleDisplay(false);
            } else {
              // No batches available - show error
              toast.error(
                batchResult.error || "No batches available for this product",
              );
              weightInput.resetWeightInput();
              setShowScaleDisplay(false);
            }
          } else {
            // No batch tracking, add directly (age verification already completed if required)
            await cart.addToCart(product, weight, undefined, ageVerified);
            weightInput.resetWeightInput();
            // Clear age verification for this product after use
            setAgeVerifiedForProduct((prev) => {
              const next = { ...prev };
              delete next[product.id];
              return next;
            });
            setShowScaleDisplay(false);
          }
        } else {
          // No weight provided - show scale display
          // Age verification already completed if required
          categoryPriceInput.resetPriceInput();
          setShowScaleDisplay(true);
          weightInput.setSelectedWeightProduct(product);
        }
      } else {
        // Regular product (unit items)
        if (requiresBatchTracking) {
          // Each cart addition = 1 item
          // Check if batch has enough quantity (1 unit) for this item
          const batchResult = await autoSelectBatches(product, 1, false);

          if (batchResult.success && batchResult.primaryBatch) {
            // Check age verification if needed
            if (requiresAgeVerification) {
              setPendingProductForAgeVerification(product);
              setPendingBatchDataForAgeVerification({
                batchId: batchResult.primaryBatch.batchId,
                batchNumber: batchResult.primaryBatch.batchNumber,
                expiryDate: batchResult.primaryBatch.expiryDate,
              });
              setShowAgeVerificationModal(true);
            } else {
              // Add to cart with automatically selected batch
              await cart.addToCart(
                product,
                undefined,
                undefined,
                false,
                undefined,
                batchResult.primaryBatch,
              );
            }
          } else if (batchResult.shouldShowModal) {
            // Show batch selection modal for manual selection
            setPendingProductForBatchSelection(product);
            setPendingQuantityForBatchSelection(1);
            setShowBatchSelectionModal(true);
          } else {
            // No batches available - show error
            toast.error(
              batchResult.error || "No batches available for this product",
            );
          }
        } else if (requiresAgeVerification) {
          // Then check age verification
          setPendingProductForAgeVerification(product);
          setShowAgeVerificationModal(true);
        } else {
          // No batch tracking or age verification, add directly
          await cart.addToCart(product);
        }
      }
    },
    [
      isOperationsDisabled,
      salesMode.requiresShift,
      ageVerifiedForProduct,
      cart,
      weightInput,
      categoryPriceInput,
    ],
  );

  // Handle generic item click
  const handleGenericItemClick = useCallback(
    async (product: Product) => {
      if (isOperationsDisabled) {
        const errorMessage = salesMode.requiresShift
          ? "Please start your shift before adding items to cart"
          : "Unable to add items to cart";
        toast.error(errorMessage);
        return;
      }

      setPendingGenericProduct(product);
      setShowGenericPriceModal(true);
    },
    [isOperationsDisabled, salesMode.requiresShift],
  );

  // Handle basket QR code scan
  const handleBasketCodeScanned = useCallback(
    async (basketCode: string) => {
      if (!user?.businessId) {
        toast.error("Cannot retrieve basket: missing business information");
        return;
      }

      // Check if current cart has items
      if (cart.cartItems.length > 0) {
        // Ask user to confirm replacement
        const confirmed = window.confirm(
          "You have items in your cart. Do you want to replace them with the saved basket?",
        );
        if (!confirmed) {
          return;
        }
      }

      // Retrieve the basket
      const result = await cart.retrieveBasket(basketCode, true);
      if (result) {
        toast.success("Basket loaded successfully");
      }
    },
    [cart, user?.businessId],
  );

  // Barcode scanner hook - handles keyboard events from barcode scanner
  // This integrates with handleProductClick to ensure scanned products go through
  // the same validation flow (age verification, scale, batch selection) as manual selection
  // Also handles saved basket QR code scanning
  useBarcodeScanner({
    products: products.products,
    businessId: user?.businessId,
    onProductFound: handleProductClick,
    onBasketCodeScanned: handleBasketCodeScanned,
    selectedWeightProduct: weightInput.selectedWeightProduct,
    weightInput: weightInput.weightInput,
    weightDisplayPrice: weightInput.weightDisplayPrice,
    onSetSelectedWeightProduct: weightInput.setSelectedWeightProduct,
    onSetWeightInput: weightInput.setWeightInput,
    onSetWeightDisplayPrice: weightInput.setWeightDisplayPrice,
    onClearCategorySelection: categoryPriceInput.resetPriceInput,
    audioEnabled: true,
  });

  // Handle age verification complete - creates audit record and proceeds with next step
  const handleAgeVerificationComplete = useCallback(
    async (verificationData: AgeVerificationData) => {
      if (!pendingProductForAgeVerification) return;

      if (verificationData.verified) {
        try {
          // Create age verification audit record
          if (user?.id && user?.businessId) {
            const auditResponse = await window.ageVerificationAPI.create({
              productId: pendingProductForAgeVerification.id,
              verificationMethod: verificationData.verificationMethod,
              customerBirthdate: verificationData.customerBirthdate,
              calculatedAge: verificationData.calculatedAge,
              verifiedBy: user.id,
              managerOverrideId: verificationData.managerId,
              overrideReason: verificationData.overrideReason,
              businessId: user.businessId,
            });

            if (!auditResponse.success) {
              logger.error(
                "Failed to create age verification record:",
                auditResponse.message,
              );
              // Continue even if audit fails - we don't want to block sales
            }
          }

          // Check if this is a weighted product
          const isWeighted = isWeightedProduct(
            pendingProductForAgeVerification,
          );

          if (isWeighted && pendingWeightForAgeVerification === undefined) {
            // Weighted product but no weight yet - show scale display after age verification
            const productToWeigh = pendingProductForAgeVerification;
            setShowAgeVerificationModal(false);
            setPendingProductForAgeVerification(null);
            // Mark that age verification is completed for this product
            setAgeVerifiedForProduct((prev) => ({
              ...prev,
              [productToWeigh.id]: true,
            }));
            // Don't reset weight input - we'll use it for the scale display
            categoryPriceInput.resetPriceInput();
            setShowScaleDisplay(true);
            weightInput.setSelectedWeightProduct(productToWeigh);
            // Store age verification data for later use when adding to cart
            // The age verification is already recorded, so we just need to mark it as verified
            return; // Exit - scale display will handle the rest
          } else {
            // Non-weighted product OR weighted product with weight already provided
            // Add item to cart with ageVerified flag and batch data if available
            if (pendingWeightForAgeVerification !== undefined) {
              await cart.addToCart(
                pendingProductForAgeVerification,
                pendingWeightForAgeVerification,
                undefined,
                true,
                undefined,
                pendingBatchDataForAgeVerification || undefined,
              );
            } else {
              await cart.addToCart(
                pendingProductForAgeVerification,
                undefined,
                undefined,
                true,
                undefined,
                pendingBatchDataForAgeVerification || undefined,
              );
            }

            // Reset everything after adding to cart
            setShowAgeVerificationModal(false);
            setPendingProductForAgeVerification(null);
            setPendingWeightForAgeVerification(undefined);
            setPendingBatchDataForAgeVerification(null);
            // Clear age verification for the product after use
            if (pendingProductForAgeVerification) {
              setAgeVerifiedForProduct((prev) => {
                const next = { ...prev };
                delete next[pendingProductForAgeVerification.id];
                return next;
              });
            }
            weightInput.resetWeightInput();
            setShowScaleDisplay(false);
          }
        } catch (error) {
          logger.error("Error during age verification completion:", error);
          toast.error("Failed to complete age verification");
        }
      } else {
        // Age verification failed or cancelled
        setShowAgeVerificationModal(false);
        setPendingProductForAgeVerification(null);
        setPendingWeightForAgeVerification(undefined);
        setPendingBatchDataForAgeVerification(null);
        // Clear age verification for the product after cancellation
        if (pendingProductForAgeVerification) {
          setAgeVerifiedForProduct((prev) => {
            const next = { ...prev };
            delete next[pendingProductForAgeVerification.id];
            return next;
          });
        }
        weightInput.resetWeightInput();
      }
    },
    [
      pendingProductForAgeVerification,
      pendingWeightForAgeVerification,
      pendingBatchDataForAgeVerification,
      cart,
      weightInput,
      categoryPriceInput,
      user,
    ],
  );

  // Handle generic price complete
  const handleGenericPriceComplete = useCallback(
    async (price: number) => {
      if (!pendingGenericProduct) return;

      await cart.addToCart(pendingGenericProduct, undefined, price);

      setShowGenericPriceModal(false);
      setPendingGenericProduct(null);
    },
    [pendingGenericProduct, cart],
  );

  // Handle batch selection complete - adds item with specific batch info
  const handleBatchSelectionComplete = useCallback(
    async (batchData: SelectedBatchData) => {
      if (!pendingProductForBatchSelection) return;

      const product = pendingProductForBatchSelection;
      const isWeighted = isWeightedProduct(product);
      const weight = pendingWeightForBatchSelection;

      // Check if age verification was already completed for this product
      // (This happens when age verification was shown first, then scale, then batch selection)
      const ageVerified = ageVerifiedForProduct[product.id] || false;

      // Check if product requires age verification after batch selection
      const requiresAgeVerification =
        product.ageRestrictionLevel && product.ageRestrictionLevel !== "NONE";

      if (requiresAgeVerification && !ageVerified) {
        // Age verification not yet completed - show age verification modal
        // Store weight and batch data if it's a weighted product
        if (isWeighted && weight !== undefined) {
          setPendingWeightForAgeVerification(weight);
        }
        setPendingBatchDataForAgeVerification({
          batchId: batchData.batchId,
          batchNumber: batchData.batchNumber,
          expiryDate: batchData.expiryDate,
        });
        setPendingProductForAgeVerification(product);
        setShowAgeVerificationModal(true);
      } else {
        // Age verification already completed OR not required - add to cart with batch info
        if (isWeighted && weight !== undefined) {
          await cart.addToCart(
            product,
            weight,
            undefined,
            ageVerified, // Use the tracked age verification status
            undefined,
            {
              batchId: batchData.batchId,
              batchNumber: batchData.batchNumber,
              expiryDate: batchData.expiryDate,
            },
          );
        } else {
          await cart.addToCart(
            product,
            undefined,
            undefined,
            ageVerified, // Use the tracked age verification status
            undefined,
            {
              batchId: batchData.batchId,
              batchNumber: batchData.batchNumber,
              expiryDate: batchData.expiryDate,
            },
          );
        }

        toast.success(
          `Added ${product.name}${
            isWeighted && weight ? ` (${weight.toFixed(2)}kg)` : ""
          } from batch ${batchData.batchNumber}`,
        );

        // Clear age verification for this product after use
        setAgeVerifiedForProduct((prev) => {
          const next = { ...prev };
          delete next[product.id];
          return next;
        });
      }

      setShowBatchSelectionModal(false);
      setPendingProductForBatchSelection(null);
      setPendingQuantityForBatchSelection(1);
      setPendingWeightForBatchSelection(undefined);
      setShowScaleDisplay(false);
    },
    [
      pendingProductForBatchSelection,
      pendingWeightForBatchSelection,
      ageVerifiedForProduct,
      cart,
    ],
  );

  // Handle auto-select batch (FEFO) - This is now the default behavior, but kept for manual override
  const handleAutoSelectBatch = useCallback(async () => {
    if (!pendingProductForBatchSelection) return;

    const product = pendingProductForBatchSelection;
    const isWeighted = isWeightedProduct(product);
    const weight = pendingWeightForBatchSelection;

    // Each cart addition = 1 item (quantity = 1, regardless of weight value)
    // Check if batch has enough quantity (1 item) available
    const batchResult = await autoSelectBatches(
      product,
      1, // Check batch has >= 1 item available (quantity check, not weight)
      false, // Don't allow partial - need exactly 1 item
    );

    if (batchResult.success && batchResult.primaryBatch) {
      // Check if product requires age verification after batch selection
      const requiresAgeVerification =
        product.ageRestrictionLevel && product.ageRestrictionLevel !== "NONE";

      if (requiresAgeVerification) {
        // Store weight and batch data for age verification
        if (isWeighted && weight !== undefined) {
          setPendingWeightForAgeVerification(weight);
        }
        setPendingBatchDataForAgeVerification({
          batchId: batchResult.primaryBatch.batchId,
          batchNumber: batchResult.primaryBatch.batchNumber,
          expiryDate: batchResult.primaryBatch.expiryDate,
        });
        setPendingProductForAgeVerification(product);
        setShowAgeVerificationModal(true);
      } else {
        // Batch has enough quantity (>= 1) - add 1 item to cart
        if (isWeighted && weight !== undefined) {
          // For weighted items: quantity = 1 (for batch deduction), weight = weight value (for pricing only)
          await cart.addToCart(
            product,
            weight, // Weight value (stored in item.weight, used for pricing only)
            undefined,
            false,
            undefined,
            batchResult.primaryBatch,
          );
        } else {
          // For unit items: quantity = 1 (will deduct 1 from batch during transaction)
          await cart.addToCart(
            product,
            undefined, // Unit items don't have weight
            undefined,
            false,
            undefined,
            batchResult.primaryBatch,
          );
        }
      }
    } else {
      toast.error(batchResult.error || "No batches available for this product");
    }

    setShowBatchSelectionModal(false);
    setPendingProductForBatchSelection(null);
    setPendingQuantityForBatchSelection(1);
    setPendingWeightForBatchSelection(undefined);
  }, [pendingProductForBatchSelection, pendingWeightForBatchSelection, cart]);

  // Handle batch selection cancel
  const handleBatchSelectionCancel = useCallback(() => {
    setShowBatchSelectionModal(false);
    setPendingProductForBatchSelection(null);
    setPendingQuantityForBatchSelection(1);
    setPendingWeightForBatchSelection(undefined);
  }, []);

  // Handle cart item selection (EPOS-style: click item to select it)
  const handleCartItemSelect = useCallback((item: CartItemWithProduct) => {
    setSelectedCartItem(item);
  }, []);

  // Handle quantity button - operate on selected item
  const handleQuantityClick = useCallback(() => {
    if (!selectedCartItem) {
      toast.error("Please select an item from the cart first.");
      return;
    }
    setShowQuantityModal(true);
  }, [selectedCartItem]);

  // Handle quantity update
  const handleQuantityUpdate = useCallback(
    async (quantity?: number, weight?: number) => {
      if (!selectedCartItem) return;
      await cart.updateItemQuantity(selectedCartItem.id, quantity, weight);
      setShowQuantityModal(false);
      // Keep the item selected after quantity update
    },
    [selectedCartItem, cart],
  );

  // Handle line void - remove selected item (EPOS-style)
  const handleLineVoid = useCallback(() => {
    if (!selectedCartItem) {
      toast.error("Please select an item from the cart first.");
      return;
    }
    const itemName = selectedCartItem.itemName || "item";
    cart.removeFromCart(selectedCartItem.id);
    setSelectedCartItem(null);
    toast.success(`Removed ${itemName} from cart`);
  }, [selectedCartItem, cart]);

  // Handle void basket - clear entire cart
  const handleVoidBasket = useCallback(() => {
    if (cart.cartItems.length === 0) {
      toast.error("Cart is already empty.");
      return;
    }
    // Remove all items
    cart.cartItems.forEach((item) => {
      cart.removeFromCart(item.id);
    });
    toast.success("Cart cleared");
  }, [cart]);

  // Placeholder handlers for other buttons
  const handlePriceOverride = useCallback(() => {
    toast.info("Price override feature coming soon");
  }, []);

  const handleLockTill = useCallback(() => {
    setShowLockDialog(true);
  }, []);

  const handleLockConfirmed = useCallback(() => {
    setIsTillLocked(true);
    logger.info("Till locked");
  }, []);

  const handleUnlock = useCallback(async () => {
    setIsTillLocked(false);
    await refreshShift(); // Refresh to update break status
    logger.info("Till unlocked");
  }, [refreshShift]);

  const handleBreakStarted = useCallback(async () => {
    await refreshShift();
  }, [refreshShift]);

  const handleSaveBasket = useCallback(() => {
    if (cart.cartItems.length === 0) {
      toast.error("Cart is empty. Add items before saving.");
      return;
    }
    setShowSaveBasketModal(true);
  }, [cart.cartItems]);

  // Handle item enquiry - operate on selected item (EPOS-style)
  const handleItemEnquiry = useCallback(() => {
    if (!selectedCartItem) {
      toast.error("Please select an item from the cart first.");
      return;
    }
    setShowItemEnquiryModal(true);
  }, [selectedCartItem]);

  const handleReceipts = useCallback(() => {
    toast.info("Receipts feature coming soon");
  }, []);

  // Clear selected item if it's no longer in the cart (EPOS-style)
  useEffect(() => {
    if (selectedCartItem) {
      const itemStillInCart = cart.cartItems.some(
        (item) => item.id === selectedCartItem.id,
      );
      if (!itemStillInCart) {
        setSelectedCartItem(null);
      }
    }
  }, [cart.cartItems, selectedCartItem]);

  // Initialize cart session on mount
  useEffect(() => {
    if (!user) return;

    // For admin/owner mode (no shift required), initialize immediately
    // For cashier/manager mode, wait for active shift
    const shouldInitialize =
      !salesMode.requiresShift ||
      !!shift.activeShift ||
      !!salesMode.activeShift;

    if (shouldInitialize) {
      cart
        .initializeCartSession()
        .catch((error) =>
          logger.error("Failed to initialize cart session", error),
        );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, shift.activeShift, salesMode.requiresShift, salesMode.activeShift]);

  // Initialize printer on mount
  useEffect(() => {
    const initPrinter = async () => {
      try {
        if (!window.printerAPI) return;

        const savedConfig = localStorage.getItem("printer_config");
        if (savedConfig) {
          let config: PrinterConfig;
          try {
            config = JSON.parse(savedConfig) as PrinterConfig;
          } catch {
            return;
          }

          const status = await window.printerAPI.getStatus();
          if (!status.connected) {
            const iface = String(
              (config as unknown as { interface?: unknown })?.interface || "",
            );
            if (!iface) return;

            // Avoid noisy auto-connect attempts when the saved port isn't currently present
            // (e.g. printer unplugged). For non-port interfaces like tcp:// or printer:Name,
            // we still attempt to connect.
            const isNonPortInterface =
              iface.startsWith("tcp://") || iface.startsWith("printer:");

            if (isNonPortInterface) {
              await connectPrinter(config);
              return;
            }

            try {
              const available =
                await window.printerAPI.getAvailableInterfaces();
              const isAvailable = Array.isArray(available)
                ? available.some(
                    (p: { address?: string }) => p.address === iface,
                  )
                : false;

              if (isAvailable) {
                await connectPrinter(config);
              } else {
                logger.info(
                  "Skipping printer auto-connect: saved interface not available",
                  {
                    interface: iface,
                  },
                );
              }
            } catch (error) {
              logger.warn(
                "Skipping printer auto-connect: failed to scan interfaces",
                error,
              );
            }
          }
        }
      } catch (error) {
        logger.error("Printer auto-connect failed:", error);
      }
    };
    initPrinter();
  }, [connectPrinter]);

  // Ensure printer status modal doesn't show when receipt options modal should be shown
  // This prevents flicker when completing cash payments
  useEffect(() => {
    if (payment.showReceiptOptions && isShowingStatus) {
      handleSkipReceipt();
    }
  }, [payment.showReceiptOptions, isShowingStatus, handleSkipReceipt]);

  // Early returns
  if (!user) {
    navigate("/");
    return null;
  }

  // Show loading state while checking shift (only for cashier mode)
  if (shift.isLoadingShift && salesMode.requiresShift && salesMode.isLoading) {
    return <LoadingState message="Loading shift data..." />;
  }

  // Show blocking UI if no scheduled shift OR if shift has ended with no future shift (only for cashier mode)
  if (
    salesMode.requiresShift &&
    !shift.isLoadingShift &&
    !salesMode.isLoading &&
    !salesMode.activeShift &&
    (!shift.todaySchedule || shiftHasEnded)
  ) {
    return (
      <NoActiveShiftModal shiftHasEnded={shiftHasEnded} onLogout={logout} />
    );
  }

  // Get products to display
  // In virtualized mode, filtering is done server-side, so we use products directly
  // In legacy mode, we filter client-side using getFilteredProducts
  const displayProducts = USE_VIRTUALIZED_PRODUCTS
    ? products.products // Server-side filtering already applied
    : searchQuery
      ? legacyProducts.getFilteredProducts(searchQuery)
      : categories.getCurrentCategoryProducts();

  return (
    <>
      {/* Shift Banners (only shown for cashier mode) */}
      {salesMode.requiresShift && (
        <>
          <OvertimeWarning
            show={shift.showOvertimeWarning}
            minutes={shift.overtimeMinutes}
          />
          <TimeChangeBanner
            show={shift.timeChangeDetected}
            timeDifferenceMs={shift.timeChangeInfo?.timeDifference ?? null}
            onDismiss={shift.dismissTimeChange}
          />
          <ShiftBanner
            isOperationsDisabled={isOperationsDisabled}
            todaySchedule={shift.todaySchedule}
            shiftTimingInfo={shift.shiftTimingInfo}
            onStartShift={shift.handleStartShiftClick}
          />
        </>
      )}

      {/* Main Layout */}
      <div className="flex p-2 sm:p-3 lg:p-4 flex-col lg:flex-row gap-2 sm:gap-3 h-screen overflow-hidden">
        {/* Left Column - Product Selection */}
        <div className="flex mb-0 lg:mb-2 flex-col flex-1 min-h-0 min-w-0 gap-2 sm:gap-3">
          <ProductSelectionPanel
            products={displayProducts}
            categories={categories.categories}
            currentCategories={categories.currentCategories}
            breadcrumb={categories.breadcrumb}
            searchQuery={searchQuery}
            selectedWeightProductId={
              weightInput.selectedWeightProduct?.id || null
            }
            loading={products.loading}
            error={products.error}
            lastClickTime={lastClickTime}
            onProductClick={handleProductClick}
            onGenericItemClick={handleGenericItemClick}
            onCategoryClick={categories.handleCategoryClick}
            onBreadcrumbClick={categories.handleBreadcrumbClick}
            onSetLastClickTime={setLastClickTime}
            onRetry={() => {
              products.loadProducts();
              categories.loadCategories();
            }}
            DOUBLE_CLICK_DELAY={DOUBLE_CLICK_DELAY}
            onLoadMore={
              USE_VIRTUALIZED_PRODUCTS ? paginatedProducts.loadMore : undefined
            }
            hasMore={
              USE_VIRTUALIZED_PRODUCTS ? paginatedProducts.hasMore : false
            }
            isLoadingMore={
              USE_VIRTUALIZED_PRODUCTS ? paginatedProducts.loading : false
            }
          />
          {!payment.paymentStep && (
            <div className="shrink-0">
              <QuickActionButtons
                onQuantity={handleQuantityClick}
                onLineVoid={handleLineVoid}
                onPriceOverride={handlePriceOverride}
                onLockTill={handleLockTill}
                onVoidBasket={handleVoidBasket}
                onSaveBasket={handleSaveBasket}
                onItemEnquiry={handleItemEnquiry}
              />
            </div>
          )}
        </div>

        {/* Right Column - Cart & Payment */}
        <div className="flex flex-col w-full lg:flex-[0_1_480px] lg:w-[480px] lg:max-w-[520px] min-h-0">
          <QuickActionsCarousel
            onRefund={() => setShowRefundModal(true)}
            onCount={() => setShowCountModal(true)}
            onDashboard={onBack}
            onReceipts={handleReceipts}
            onLogOff={logout}
            hasActiveShift={!!shift.activeShift}
          />

          {/**input for products */}
          <CardContent className="p-1">
            {/* Scale Display for Weighted Products (shown by default) */}
            {weightInput.selectedWeightProduct &&
              isWeightedProduct(weightInput.selectedWeightProduct) &&
              !categoryPriceInput.pendingCategory &&
              showScaleDisplay && (
                <div className="mt-1 space-y-2">
                  <ScaleDisplay
                    selectedProduct={{
                      id: weightInput.selectedWeightProduct.id,
                      name: weightInput.selectedWeightProduct.name,
                      productType: "WEIGHTED",
                      basePrice: weightInput.selectedWeightProduct.basePrice,
                      pricePerUnit:
                        weightInput.selectedWeightProduct.pricePerKg,
                      unitOfMeasure: getEffectiveSalesUnit(
                        weightInput.selectedWeightProduct.salesUnit || "KG",
                        salesUnitSettings,
                      ),
                    }}
                    onWeightConfirmed={async (weight, scaleReading) => {
                      const product = weightInput.selectedWeightProduct;
                      if (!product) return;

                      // Check if product requires batch tracking (expiry checking)
                      const requiresBatchTracking =
                        product.requiresBatchTracking === true;

                      // Age verification should already be completed at this point
                      // (it was shown first before the scale display)

                      if (requiresBatchTracking) {
                        // Each cart addition = 1 item (quantity = 1, regardless of weight value)
                        // Check if batch has enough quantity (1 item) available
                        const batchResult = await autoSelectBatches(
                          product,
                          1, // Check batch has >= 1 item available (quantity check, not weight)
                          false, // Don't allow partial - need exactly 1 item
                        );

                        if (batchResult.success && batchResult.primaryBatch) {
                          // Batch has enough quantity (>= 1) - add 1 item to cart
                          // Cart item: quantity = 1 (for batch deduction), weight = weight value (for pricing only)
                          const ageVerified =
                            ageVerifiedForProduct[product.id] || false;

                          await cart.addToCart(
                            product,
                            weight, // Weight value (stored in item.weight, used for pricing only)
                            undefined,
                            ageVerified,
                            undefined,
                            batchResult.primaryBatch,
                            scaleReading,
                          );

                          // Show success message
                          toast.success(`Added ${product.name} to cart`);

                          weightInput.resetWeightInput();
                          // Clear age verification for this product after use
                          setAgeVerifiedForProduct((prev) => {
                            const next = { ...prev };
                            delete next[product.id];
                            return next;
                          });
                          setShowScaleDisplay(false);
                        } else if (batchResult.shouldShowModal) {
                          // Show batch selection modal for manual selection
                          setPendingWeightForBatchSelection(weight);
                          setPendingProductForBatchSelection(product);
                          setPendingQuantityForBatchSelection(weight);
                          setShowBatchSelectionModal(true);
                          weightInput.resetWeightInput();
                          setShowScaleDisplay(false);
                        } else {
                          // No batches available - show error
                          toast.error(
                            batchResult.error ||
                              "No batches available for this product",
                          );
                          weightInput.resetWeightInput();
                          setShowScaleDisplay(false);
                        }
                      } else {
                        // No batch tracking, add directly with age verification (already completed)
                        // Check if age verification was completed for this product
                        const ageVerified =
                          ageVerifiedForProduct[product.id] || false;
                        await cart.addToCart(
                          product,
                          weight,
                          undefined,
                          ageVerified, // Use the tracked age verification status
                          undefined,
                          null,
                          scaleReading || null,
                        );
                        weightInput.resetWeightInput();
                        // Clear age verification for this product after use
                        setAgeVerifiedForProduct((prev) => {
                          const next = { ...prev };
                          delete next[product.id];
                          return next;
                        });
                        setShowScaleDisplay(false);
                      }
                    }}
                    onCancel={() => {
                      setShowScaleDisplay(false);
                      weightInput.resetWeightInput();
                    }}
                    onManualEntryRequest={() => setShowScaleDisplay(false)}
                    autoAddOnStable={true}
                    minWeight={0.001}
                    maxWeight={50}
                  />
                </div>
              )}

            {/* Weight Input Display for Weighted Products (manual entry) */}
            {weightInput.selectedWeightProduct &&
              isWeightedProduct(weightInput.selectedWeightProduct) &&
              !categoryPriceInput.pendingCategory &&
              !showScaleDisplay && (
                <WeightInputDisplay
                  selectedProduct={weightInput.selectedWeightProduct}
                  weightDisplayPrice={weightInput.weightDisplayPrice}
                  businessId={user?.businessId}
                  onShowScaleDisplay={() => setShowScaleDisplay(true)}
                />
              )}

            {/* Category Price Input Display */}
            {categoryPriceInput.pendingCategory &&
              !weightInput.selectedWeightProduct && (
                <CategoryPriceInputDisplay
                  pendingCategory={categoryPriceInput.pendingCategory}
                  categoryDisplayPrice={categoryPriceInput.categoryDisplayPrice}
                />
              )}
          </CardContent>

          <CartPanel
            cartItems={cart.cartItems}
            loadingCart={cart.loadingCart}
            subtotal={cart.subtotal}
            tax={cart.tax}
            total={cart.total}
            onRemoveItem={(itemId) => {
              cart.removeFromCart(itemId);
              // Clear selection if the selected item was removed
              if (selectedCartItem?.id === itemId) {
                setSelectedCartItem(null);
              }
            }}
            selectedItemId={selectedCartItem?.id || null}
            onItemSelect={handleCartItemSelect}
          />

          {/* Payment Panel */}
          <PaymentPanel
            paymentStep={payment.paymentStep}
            paymentMethod={payment.paymentMethod}
            total={cart.total}
            cashAmount={payment.cashAmount}
            cardReaderReady={true}
            onPaymentMethodSelect={payment.handlePayment}
            onCashAmountChange={payment.setCashAmount}
            onCompleteTransaction={() => payment.completeTransaction()}
            onCancel={() => {
              payment.setPaymentStep(false);
              payment.setPaymentMethod(null);
            }}
          />

          {/* Transaction Complete Message */}
          {payment.transactionComplete && !payment.showReceiptOptions && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-70 p-4 animate-fade-in">
              <div className="bg-white p-4 sm:p-6 rounded-lg text-center w-full max-w-sm animate-modal-enter">
                <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 text-green-500 mx-auto mb-3 sm:mb-4" />
                <h2 className="text-lg sm:text-xl font-bold mb-2 text-slate-800">
                  Transaction Complete!
                </h2>
                <p className="text-sm sm:text-base text-slate-600">
                  Thank you for shopping with us.
                </p>
                <p className="mt-2 text-sm sm:text-base text-slate-700 font-semibold">
                  Total: £{cart.total.toFixed(2)}
                </p>
                <Button
                  className="mt-4 bg-sky-600 hover:bg-sky-700 min-h-[44px] h-10 sm:h-11 text-sm sm:text-base touch-manipulation"
                  onClick={() => {
                    payment.setTransactionComplete(false);
                  }}
                >
                  OK
                </Button>
              </div>
            </div>
          )}

          {/* Numeric Keypad */}
          <div className="shrink-0">
            <NumericKeypad
              onInput={async (value) => {
                // Handle weight input
                if (
                  weightInput.selectedWeightProduct &&
                  !categoryPriceInput.pendingCategory
                ) {
                  const weightValue = weightInput.handleWeightInput(value);
                  if (
                    value === "Enter" &&
                    weightValue !== undefined &&
                    weightValue > 0
                  ) {
                    await handleProductClick(
                      weightInput.selectedWeightProduct,
                      weightValue,
                    );
                    setShowScaleDisplay(false); // Reset scale display after adding via keypad
                  }
                  return;
                }

                // Handle category price input
                if (categoryPriceInput.pendingCategory) {
                  const priceValue = categoryPriceInput.handlePriceInput(value);
                  if (
                    value === "Enter" &&
                    priceValue !== undefined &&
                    priceValue > 0
                  ) {
                    await cart.addCategoryToCart(
                      categoryPriceInput.pendingCategory!,
                      priceValue,
                    );
                    categoryPriceInput.resetPriceInput();
                  }
                  return;
                }

                // Handle other numeric keypad input
              }}
              keysOverride={[
                ["7", "8", "9", "Enter"],
                ["4", "5", "6", "Clear"],
                [
                  "1",
                  "2",
                  "3",
                  weightInput.selectedWeightProduct &&
                  !categoryPriceInput.pendingCategory ? (
                    "."
                  ) : categoryPriceInput.pendingCategory ? (
                    "."
                  ) : !payment.paymentStep ? (
                    <Button
                      className="w-full h-full min-h-[44px] py-3 sm:py-4 font-semibold text-sm sm:text-lg rounded transition-colors bg-sky-600 hover:bg-sky-700 text-white touch-manipulation"
                      style={{ minHeight: 44, minWidth: 0 }}
                      onClick={() => payment.setPaymentStep(true)}
                      disabled={
                        cart.cartItems.length === 0 || !cart.cartSession
                      }
                    >
                      Checkout
                    </Button>
                  ) : (
                    <Button
                      className="w-full h-full min-h-[44px] py-3 sm:py-4 font-semibold text-sm sm:text-lg rounded transition-colors bg-slate-200 hover:bg-slate-300 text-slate-700 touch-manipulation"
                      style={{ minHeight: 44, minWidth: 0 }}
                      onClick={() => payment.setPaymentStep(false)}
                    >
                      Back to Cart
                    </Button>
                  ),
                ],
                ["0", "00", "", ""],
              ]}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <StartShiftDialog
        open={shift.showStartShiftDialog}
        onOpenChange={shift.setShowStartShiftDialog}
        startingCash={shift.startingCash}
        onStartingCashChange={shift.setStartingCash}
        onConfirm={shift.confirmStartShift}
        lateStartMinutes={shift.lateStartMinutes}
        showLateStartConfirm={shift.showLateStartConfirm}
        onLateStartConfirm={shift.confirmLateStart}
        onLateStartCancel={() => {
          shift.setShowLateStartConfirm(false);
        }}
      />

      {pendingProductForAgeVerification && (
        <AgeVerificationModal
          isOpen={showAgeVerificationModal}
          product={pendingProductForAgeVerification}
          onVerify={handleAgeVerificationComplete}
          onCancel={() => {
            setShowAgeVerificationModal(false);
            setPendingProductForAgeVerification(null);
            setPendingWeightForAgeVerification(undefined);
            setPendingBatchDataForAgeVerification(null);
            // Reset weight input but keep scale display visible for retry
            weightInput.resetWeightInput();
            // Keep scale display visible so user can retry
          }}
          currentUser={
            user ? { id: user.id, role: getUserRoleName(user) } : null
          }
        />
      )}

      {pendingGenericProduct && (
        <GenericItemPriceModal
          isOpen={showGenericPriceModal}
          product={pendingGenericProduct}
          onConfirm={handleGenericPriceComplete}
          onCancel={() => {
            setShowGenericPriceModal(false);
            setPendingGenericProduct(null);
          }}
        />
      )}

      {/* Batch Selection Modal - for products that require batch tracking */}
      {pendingProductForBatchSelection && user?.businessId && (
        <BatchSelectionModal
          isOpen={showBatchSelectionModal}
          product={pendingProductForBatchSelection}
          requestedQuantity={pendingQuantityForBatchSelection}
          onSelect={handleBatchSelectionComplete}
          onAutoSelect={handleAutoSelectBatch}
          onCancel={handleBatchSelectionCancel}
          businessId={user.businessId}
          cartItems={cart.cartItems.map((item) => ({
            batchId: item.batchId,
            itemType: item.itemType,
            quantity: item.quantity,
            weight: item.weight,
          }))}
        />
      )}

      {showRefundModal && (
        <RefundTransactionView
          isOpen={showRefundModal}
          onClose={() => setShowRefundModal(false)}
          onRefundProcessed={() => {
            setShowRefundModal(false);
            toast.success("Refund processed successfully!");
          }}
          activeShiftId={salesMode.activeShift?.id || shift.activeShift?.id}
        />
      )}

      {showCountModal && user && (
        <CashDrawerCountModal
          isOpen={showCountModal}
          onClose={() => setShowCountModal(false)}
          onCountComplete={() => {
            setShowCountModal(false);
            toast.success("Cash count completed successfully!");
          }}
          activeShiftId={user.id}
          countType="mid-shift"
          startingCash={0}
        />
      )}

      {/* Receipt Options Modal */}
      {payment.showReceiptOptions && payment.completedTransactionData && (
        <ReceiptOptionsModal
          isOpen={payment.showReceiptOptions}
          transactionData={payment.completedTransactionData}
          onPrint={payment.handlePrintReceipt}
          onDownload={payment.handleDownloadReceipt}
          onEmail={payment.handleEmailReceiptOption}
          onClose={payment.handleCloseReceiptOptions}
          onCancel={payment.handleCancelPayment}
          printerStatus={payment.printerStatus}
          // Enhanced print status props
          printStatus={printStatus}
          printerError={printerError}
          onRetryPrint={handleRetryPrint}
          onCancelPrint={handleCancelPrint}
        />
      )}

      {/* Quantity Modal */}
      {selectedCartItem && (
        <QuantityModal
          isOpen={showQuantityModal}
          item={selectedCartItem}
          businessId={user?.businessId}
          onConfirm={handleQuantityUpdate}
          onCancel={() => {
            setShowQuantityModal(false);
          }}
        />
      )}

      {/* Item Enquiry Modal */}
      {selectedCartItem && (
        <ItemEnquiryModal
          isOpen={showItemEnquiryModal}
          item={selectedCartItem}
          onClose={() => {
            setShowItemEnquiryModal(false);
          }}
        />
      )}

      {/* Save Basket Modal */}
      <SaveBasketModal
        isOpen={showSaveBasketModal}
        cartItems={cart.cartItems}
        cartSessionId={cart.cartSession?.id || null}
        businessId={user?.businessId}
        userId={user?.id}
        shiftId={shift.activeShift?.id || null}
        onSave={cart.saveBasket}
        onClose={() => setShowSaveBasketModal(false)}
        onClearCart={async () => {
          if (cart.cartSession) {
            await cart.clearCart();
          }
        }}
      />

      {/* Lock Till & Break Dialog */}
      <LockTillBreakDialog
        isOpen={showLockDialog}
        onClose={() => setShowLockDialog(false)}
        shiftId={activeShift?.id || null}
        userId={user!.id}
        businessId={user?.businessId}
        shiftStartTime={activeShift?.clockInEvent?.timestamp}
        onBreakStarted={handleBreakStarted}
        onLockConfirmed={handleLockConfirmed}
      />

      {/* Lock Screen Overlay */}
      {isTillLocked && user && (
        <LockScreen
          isLocked={isTillLocked}
          onUnlock={handleUnlock}
          lockedByUserId={user.id}
          activeBreak={activeBreak}
          userName={`${user.firstName || ""} ${user.lastName || ""}`.trim()}
        />
      )}
    </>
  );
}

export default NewTransactionView;
