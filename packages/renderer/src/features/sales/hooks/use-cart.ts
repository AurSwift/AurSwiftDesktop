/**
 * Hook for managing cart operations
 * Handles cart session initialization, adding/removing items, and calculating totals
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { toast } from "sonner";
import type {
  CartSession,
  CartItemWithProduct,
} from "@/types/features/cart";
import type { Product } from "@/types/domain";
import type { Category } from "@/types/domain/category";

import { getLogger } from "@/shared/utils/logger";
const logger = getLogger("use-cart");
import {
  calculateItemPrice,
  calculateCategoryPrice,
  calculateCartTotals,
} from "../utils/price-calculations";
import {
  isWeightedProduct,
  getProductSalesUnit,
} from "../utils/product-helpers";
import {
  useSalesUnitSettings,
  getEffectiveSalesUnit,
} from "@/shared/hooks/use-sales-unit-settings";

interface UseCartProps {
  userId: string | undefined;
  businessId: string | undefined;
  userRole: string | undefined;
  activeShift: { id: string } | null;
  todaySchedule: { id: string } | null;
}

/**
 * Hook for managing cart
 * @param props - Cart configuration props
 * @returns Cart state and operations
 */
export function useCart({
  userId,
  businessId,
  userRole,
  activeShift,
  todaySchedule,
}: UseCartProps) {
  const salesUnitSettings = useSalesUnitSettings(businessId);
  const [cartSession, setCartSession] = useState<CartSession | null>(null);
  const [cartItems, setCartItems] = useState<CartItemWithProduct[]>([]);
  const [loadingCart, setLoadingCart] = useState(false);

  /**
   * Initialize or recover cart session
   */
  const initializeCartSession =
    useCallback(async (): Promise<CartSession | null> => {
      if (!businessId || !userId) {
        logger.warn("Cannot initialize cart: missing user data");
        return null;
      }

      // For cashiers/managers, check if shift exists first
      if (userRole === "cashier" || userRole === "manager") {
        if (!activeShift) {
          setLoadingCart(false);
          return null; // Don't proceed if no shift
        }
      }

      try {
        setLoadingCart(true);

        // Try to get active session first
        const activeSessionResponse = await window.cartAPI.getActiveSession(
          userId
        );

        if (activeSessionResponse.success && activeSessionResponse.data) {
          // Recover existing session
          const session = activeSessionResponse.data as CartSession;
          setCartSession(session);

          // Load items for this session
          const itemsResponse = await window.cartAPI.getItems(session.id);
          if (itemsResponse.success && itemsResponse.data) {
            const items = itemsResponse.data as CartItemWithProduct[];
            setCartItems(items);
            if (items.length > 0) {
              toast.info(`Recovered cart with ${items.length} item(s)`);
            }
          }
          return session;
        } else {
          // Create new session
          // For admin/owner mode, shiftId can be null/undefined
          // For cashier/manager mode, activeShift is required
          const requiresShift =
            userRole === "cashier" || userRole === "manager";
          if (requiresShift && !activeShift) {
            setLoadingCart(false);
            return null;
          }

          const newSessionResponse = await window.cartAPI.createSession({
            cashierId: userId,
            shiftId: activeShift?.id, // Can be undefined for admin mode
            businessId,
          });

          if (newSessionResponse.success && newSessionResponse.data) {
            const session = newSessionResponse.data as CartSession;
            setCartSession(session);
            setCartItems([]);
            return session;
          } else {
            logger.error("Failed to create cart session:", newSessionResponse);
            return null;
          }
        }
      } catch (error) {
        logger.error("Error initializing cart session:", error);
        return null;
      } finally {
        setLoadingCart(false);
      }
    }, [userId, businessId, userRole, activeShift]);

  /**
   * Add product to cart
   */
  const addToCart = useCallback(
    async (
      product: Product,
      weight?: number,
      customPrice?: number,
      ageVerified: boolean = false,
      sessionOverride?: CartSession | null,
      batchData?: {
        batchId: string;
        batchNumber: string;
        expiryDate: Date;
      } | null,
      scaleReading?: {
        weight: number;
        stable: boolean;
      } | null
    ) => {
      // Check if operations are disabled (no active shift but has scheduled shift)
      const operationsDisabled =
        (userRole === "cashier" || userRole === "manager") &&
        !activeShift &&
        todaySchedule;

      if (operationsDisabled) {
        toast.error("Please start your shift before adding items to cart");
        return;
      }

      // Ensure cart session is initialized before adding items
      let currentSession =
        sessionOverride !== undefined ? sessionOverride : cartSession;
      if (!currentSession) {
        logger.info("🛒 Cart session not found, initializing...");
        try {
          const newSession = await initializeCartSession();
          if (!newSession) {
            toast.error("Failed to initialize cart session. Please try again.");
            return;
          }
          currentSession = newSession;
        } catch (error) {
          logger.error("Error initializing cart session:", error);
          toast.error("Failed to initialize cart session. Please try again.");
          return;
        }
      }

      const isWeighted = isWeightedProduct(product);
      const productSalesUnit = getProductSalesUnit(product);
      const salesUnit = getEffectiveSalesUnit(
        productSalesUnit,
        salesUnitSettings
      );

      // Validate weight for weighted items
      if (isWeighted && (!weight || weight <= 0)) {
        toast.error(
          `Please enter a weight for ${product.name}. Weighted items require a weight value.`
        );
        return;
      }

      // Determine item type
      const itemType: "UNIT" | "WEIGHT" = isWeighted ? "WEIGHT" : "UNIT";

      logger.info(
        `🛒 Adding to cart: ${product.name} ${
          isWeighted && weight ? `(${weight.toFixed(2)} ${salesUnit})` : ""
        } ${customPrice ? `@ £${customPrice}` : ""}`
      );

      try {
        // Fetch latest cart items to ensure we have up-to-date data
        const itemsResponse = await window.cartAPI.getItems(currentSession.id);
        const latestCartItems =
          itemsResponse.success && itemsResponse.data
            ? (itemsResponse.data as CartItemWithProduct[])
            : [];

        // Update state with latest cart items to keep it in sync
        if (itemsResponse.success && itemsResponse.data) {
          setCartItems(itemsResponse.data as CartItemWithProduct[]);
        }

        // Calculate pricing using utility function
        let priceCalculation;
        try {
          priceCalculation = calculateItemPrice(product, weight, customPrice);
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Invalid price calculation";
          toast.error(errorMessage);
          return;
        }

        const { unitPrice, totalPrice, taxAmount } = priceCalculation;

        // Check for existing item to update quantity/weight
        const existingItem = latestCartItems.find(
          (item) => item.productId === product.id && item.itemType === itemType
        );

        if (existingItem) {
          // Update existing item
          // For weighted items: quantity = number of items (always increments by 1), weight = total weight
          // For unit items: quantity = number of units (increments by 1)
          const newQuantity =
            existingItem.itemType === "UNIT"
              ? (existingItem.quantity || 0) + 1
              : existingItem.itemType === "WEIGHT"
              ? (existingItem.quantity || 0) + 1 // Each addition = 1 item
              : existingItem.quantity;
          const newWeight =
            existingItem.itemType === "WEIGHT"
              ? (existingItem.weight || 0) + (weight || 0) // Accumulate weight for pricing
              : existingItem.weight;

          // Recalculate totals for updated item
          const newSubtotal =
            existingItem.itemType === "UNIT"
              ? unitPrice * (newQuantity || 1)
              : unitPrice * (newWeight || 0);
          const newTaxAmount = newSubtotal * (product.taxRate ?? 0.08);
          const finalTotalPrice = newSubtotal + newTaxAmount;

          const updateResponse = await window.cartAPI.updateItem(
            existingItem.id,
            {
              quantity: newQuantity ?? undefined,
              weight: newWeight ?? undefined,
              totalPrice: finalTotalPrice,
              taxAmount: newTaxAmount,
            }
          );

          if (updateResponse.success) {
            // Reload cart items
            const itemsResponse = await window.cartAPI.getItems(
              currentSession.id
            );
            if (itemsResponse.success && itemsResponse.data) {
              setCartItems(itemsResponse.data as CartItemWithProduct[]);
            }

            toast.success(
              `Added ${product.name}${
                existingItem.itemType === "UNIT"
                  ? ` (${newQuantity}x)`
                  : ` - ${(newWeight || 0).toFixed(2)} ${salesUnit}`
              }`
            );
          } else {
            const errorMessage =
              updateResponse.message || "Failed to update cart item";
            logger.error("Failed to update cart item:", errorMessage);
            toast.error(errorMessage);
          }
        } else {
          // Add new item to cart (1 item per addition, regardless of weight/price)
          // For weighted items: quantity = 1 (count items), weight = actual weight (for batch deduction & pricing)
          // For unit items: quantity = 1 (one unit to deduct from batch)
          // Note: Transaction handler uses item.weight for weighted items and item.quantity for unit items
          const itemQuantity =
            itemType === "UNIT"
              ? 1 // Each addition = 1 unit (will deduct 1 from batch)
              : itemType === "WEIGHT"
              ? 1 // Each addition = 1 item (quantity always 1, weight stored separately)
              : undefined;

          const addResponse = await window.cartAPI.addItem({
            cartSessionId: currentSession.id,
            productId: product.id,
            itemName: product.name,
            itemType,
            quantity: itemQuantity,
            weight: itemType === "WEIGHT" ? weight ?? undefined : undefined,
            unitOfMeasure: salesUnit,
            unitPrice,
            totalPrice,
            taxAmount,
            batchId: batchData?.batchId,
            batchNumber: batchData?.batchNumber,
            expiryDate: batchData?.expiryDate,
            ageRestrictionLevel: product.ageRestrictionLevel || "NONE",
            ageVerified,
            scaleReadingWeight: scaleReading?.weight,
            scaleReadingStable: scaleReading?.stable ?? true,
          });

          if (addResponse.success) {
            // Reload cart items
            const itemsResponse = await window.cartAPI.getItems(
              currentSession.id
            );
            if (itemsResponse.success && itemsResponse.data) {
              setCartItems(itemsResponse.data as CartItemWithProduct[]);
            }

            toast.success(
              `Added ${product.name}${
                isWeighted && weight
                  ? ` - ${weight.toFixed(2)} ${salesUnit}`
                  : ""
              }`
            );
          } else {
            const errorMessage =
              addResponse.message || "Failed to add item to cart";
            logger.error("Failed to add item to cart:", errorMessage);
            toast.error(errorMessage);
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to add item to cart";
        logger.error("Error adding to cart:", error);
        toast.error(errorMessage);
      }
    },
    [
      cartSession,
      userRole,
      activeShift,
      todaySchedule,
      initializeCartSession,
      salesUnitSettings,
    ]
  );

  /**
   * Add category to cart with custom price
   */
  const addCategoryToCart = useCallback(
    async (
      category: Category,
      price: number,
      sessionOverride?: CartSession | null
    ) => {
      // Check if operations are disabled
      const operationsDisabled =
        (userRole === "cashier" || userRole === "manager") &&
        !activeShift &&
        todaySchedule;

      if (operationsDisabled) {
        toast.error("Please start your shift before adding items to cart");
        return;
      }

      // Ensure cart session is initialized
      let currentSession =
        sessionOverride !== undefined ? sessionOverride : cartSession;
      if (!currentSession) {
        logger.info("🛒 Cart session not found, initializing...");
        try {
          const newSession = await initializeCartSession();
          if (!newSession) {
            toast.error("Failed to initialize cart session. Please try again.");
            return;
          }
          currentSession = newSession;
        } catch (error) {
          logger.error("Error initializing cart session:", error);
          toast.error("Failed to initialize cart session. Please try again.");
          return;
        }
      }

      // Calculate pricing using utility function
      let priceCalculation;
      try {
        priceCalculation = calculateCategoryPrice(price);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Invalid price";
        toast.error(errorMessage);
        return;
      }

      const { unitPrice, totalPrice, taxAmount } = priceCalculation;

      logger.info(`🛒 Adding category to cart: ${category.name} @ £${price}`);

      try {
        // Always create a new row for category items since prices can differ each time
        // This allows cashiers to add the same category multiple times with different prices
        const addResponse = await window.cartAPI.addItem({
          cartSessionId: currentSession.id,
          categoryId: category.id,
          itemName: category.name,
          itemType: "UNIT",
          quantity: 1,
          unitOfMeasure: "each",
          unitPrice,
          totalPrice,
          taxAmount,
          ageRestrictionLevel: "NONE",
          ageVerified: false,
        });

        if (addResponse.success) {
          // Reload cart items
          const itemsResponse = await window.cartAPI.getItems(
            currentSession.id
          );
          if (itemsResponse.success && itemsResponse.data) {
            setCartItems(itemsResponse.data as CartItemWithProduct[]);
          }

          toast.success(`Added ${category.name} @ £${price.toFixed(2)}`);
        } else {
          const errorMessage =
            addResponse.message || "Failed to add item to cart";
          logger.error("Failed to add item to cart:", errorMessage);
          toast.error(errorMessage);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to add item to cart";
        logger.error("Error adding category to cart:", error);
        toast.error(errorMessage);
      }
    },
    [cartSession, userRole, activeShift, todaySchedule, initializeCartSession]
  );

  /**
   * Remove item from cart
   */
  const removeFromCart = useCallback(
    async (itemId: string) => {
      if (!cartSession) return;

      try {
        const response = await window.cartAPI.removeItem(itemId);
        if (response.success) {
          // Reload cart items
          const itemsResponse = await window.cartAPI.getItems(cartSession.id);
          if (itemsResponse.success && itemsResponse.data) {
            setCartItems(itemsResponse.data as CartItemWithProduct[]);
          }
          toast.success("Item removed from cart");
        } else {
          toast.error("Failed to remove item from cart");
        }
      } catch (error: unknown) {
        logger.error("Error removing from cart:", error);
        toast.error("Failed to remove item from cart");
      }
    },
    [cartSession]
  );

  /**
   * Update item quantity or weight
   */
  const updateItemQuantity = useCallback(
    async (
      itemId: string,
      quantity?: number,
      weight?: number
    ) => {
      if (!cartSession) {
        toast.error("No active cart session");
        return;
      }

      try {
        // Refresh cart items to ensure we have the latest data with products
        const itemsResponse = await window.cartAPI.getItems(cartSession.id);
        if (!itemsResponse.success || !itemsResponse.data) {
          toast.error("Failed to load cart items");
          return;
        }
        const freshItems = itemsResponse.data as CartItemWithProduct[];
        
        // Find the item to get product info
        const item = freshItems.find((i) => i.id === itemId);
        if (!item) {
          toast.error("Item not found in cart");
          return;
        }

        // Get product for price calculation
        const product = item.product;
        if (!product) {
          toast.error("Product information not available");
          return;
        }

        // Calculate new price based on updated quantity/weight
        let priceCalculation;
        try {
          if (item.itemType === "WEIGHT" && weight !== undefined) {
            priceCalculation = calculateItemPrice(product, weight);
          } else if (item.itemType === "UNIT" && quantity !== undefined) {
            priceCalculation = calculateItemPrice(product, undefined, undefined);
            // For unit items, multiply by quantity
            priceCalculation.totalPrice = priceCalculation.unitPrice * quantity;
            priceCalculation.taxAmount =
              priceCalculation.totalPrice * (product.taxRate ?? 0.08);
          } else {
            toast.error("Invalid quantity or weight");
            return;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Invalid price calculation";
          toast.error(errorMessage);
          return;
        }

        const { totalPrice, taxAmount } = priceCalculation;

        // Update the item
        const updateResponse = await window.cartAPI.updateItem(itemId, {
          quantity: quantity ?? undefined,
          weight: weight ?? undefined,
          totalPrice,
          taxAmount,
        });

        if (updateResponse.success) {
          // Reload cart items after update to get the updated item
          const updatedItemsResponse = await window.cartAPI.getItems(cartSession.id);
          if (updatedItemsResponse.success && updatedItemsResponse.data) {
            setCartItems(updatedItemsResponse.data as CartItemWithProduct[]);
          }

          const salesUnit = item.unitOfMeasure || "each";
          const effectiveUnit = getEffectiveSalesUnit(
            salesUnit,
            salesUnitSettings
          );

          toast.success(
            `Updated ${item.itemName}${
              item.itemType === "UNIT"
                ? ` (${quantity}x)`
                : ` - ${weight?.toFixed(3) || "0.000"} ${effectiveUnit}`
            }`
          );
        } else {
          const errorMessage =
            updateResponse.message || "Failed to update item";
          logger.error("Failed to update item:", errorMessage);
          toast.error(errorMessage);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to update item quantity";
        logger.error("Error updating item quantity:", error);
        toast.error(errorMessage);
      }
    },
    [cartSession, cartItems, salesUnitSettings]
  );

  /**
   * Save current basket
   */
  const saveBasket = useCallback(
    async (
      basketName: string,
      customerEmail?: string | null,
      notes?: string | null
    ) => {
      if (!cartSession || !businessId || !userId) {
        toast.error("Cannot save basket: missing cart or user data");
        return null;
      }

      if (cartItems.length === 0) {
        toast.error("Cart is empty. Add items before saving.");
        return null;
      }

      try {
        const response = await window.basketAPI.saveBasket({
          cartSessionId: cartSession.id,
          basketName: basketName || `Basket ${new Date().toLocaleString()}`,
          businessId,
          savedBy: userId,
          shiftId: activeShift?.id || null,
          customerEmail: customerEmail || null,
          notes: notes || null,
          expirationDays: 7,
        });

        if (response.success && response.data) {
          toast.success(`Basket "${response.data.basket.name}" saved successfully`);
          return response.data;
        } else {
          const errorMessage =
            response.message || "Failed to save basket";
          logger.error("Failed to save basket:", errorMessage);
          toast.error(errorMessage);
          return null;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to save basket";
        logger.error("Error saving basket:", error);
        toast.error(errorMessage);
        return null;
      }
    },
    [cartSession, cartItems, businessId, userId, activeShift]
  );

  /**
   * Retrieve a saved basket (load items into current or new cart)
   */
  const retrieveBasket = useCallback(
    async (basketCode: string, replaceCurrentCart: boolean = false) => {
      if (!businessId || !userId) {
        toast.error("Cannot retrieve basket: missing user data");
        return null;
      }

      try {
        // Get basket by code
        const getResponse = await window.basketAPI.getBasketByCode(basketCode);

        if (!getResponse.success || !getResponse.data) {
          const errorMessage =
            getResponse.message || "Basket not found or invalid code";
          toast.error(errorMessage);
          return null;
        }

        const { basket, cartSession: _savedCartSession } = getResponse.data; // Reserved for future use

        // Check if basket is valid
        if (basket.status !== "active") {
          toast.error(`Basket is ${basket.status} and cannot be retrieved`);
          return null;
        }

        // Check expiration
        if (basket.expiresAt && new Date(basket.expiresAt) < new Date()) {
          toast.error("Basket has expired");
          return null;
        }

        // Check if current cart has items
        if (cartItems.length > 0 && !replaceCurrentCart) {
          // Ask user to confirm (this should be handled by the UI component)
          toast.info("Current cart has items. Please clear it first or confirm replacement.");
          return null;
        }

        // Get or create cart session
        let targetSession = cartSession;
        if (!targetSession || replaceCurrentCart) {
          // Clear current cart if replacing
          if (targetSession && replaceCurrentCart) {
            await window.cartAPI.clearCart(targetSession.id);
          }

          // Create new session or use existing
          const sessionResponse = await initializeCartSession();
          if (!sessionResponse) {
            toast.error("Failed to create cart session for basket retrieval");
            return null;
          }
          targetSession = sessionResponse;
        }

        // Retrieve basket items into target session
        const retrieveResponse = await window.basketAPI.retrieveBasket({
          basketId: basket.id,
          newCartSessionId: targetSession.id,
          businessId,
        });

        if (retrieveResponse.success && retrieveResponse.data) {
          const { items: _items, warnings } = retrieveResponse.data; // items reloaded from API below

          // Reload cart items
          const itemsResponse = await window.cartAPI.getItems(targetSession.id);
          if (itemsResponse.success && itemsResponse.data) {
            setCartItems(itemsResponse.data as CartItemWithProduct[]);
            setCartSession(targetSession);
          }

          // Show warnings if any
          if (warnings && warnings.length > 0) {
            toast.warning(
              `Basket loaded with ${warnings.length} warning(s). Some items may have changed.`
            );
          } else {
            toast.success(`Basket "${basket.name}" loaded successfully`);
          }

          return retrieveResponse.data;
        } else {
          const errorMessage =
            retrieveResponse.message || "Failed to retrieve basket";
          logger.error("Failed to retrieve basket:", errorMessage);
          toast.error(errorMessage);
          return null;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to retrieve basket";
        logger.error("Error retrieving basket:", error);
        toast.error(errorMessage);
        return null;
      }
    },
    [cartSession, cartItems, businessId, userId, initializeCartSession]
  );

  /**
   * Clear all items from cart
   */
  const clearCart = useCallback(async () => {
    if (!cartSession) {
      toast.error("No active cart session");
      return;
    }

    try {
      const response = await window.cartAPI.clearCart(cartSession.id);
      if (response.success) {
        setCartItems([]);
        toast.success("Cart cleared successfully");
      } else {
        toast.error("Failed to clear cart");
      }
    } catch (error) {
      logger.error("Error clearing cart:", error);
      toast.error("Failed to clear cart");
    }
  }, [cartSession]);

  /**
   * Calculate cart totals
   */
  const { subtotal, tax, total } = useMemo(() => {
    return calculateCartTotals(cartItems);
  }, [cartItems]);

  /**
   * Update cart session totals when items change
   */
  useEffect(() => {
    if (cartSession && cartSession.status === "ACTIVE") {
      window.cartAPI
        .updateSession(cartSession.id, {
          totalAmount: total,
          taxAmount: tax,
        })
        .catch((error: unknown) =>
          logger.error("Failed to update cart session", error)
        );
    }
  }, [total, tax, cartSession]);

  return {
    cartSession,
    cartItems,
    loadingCart,
    subtotal,
    tax,
    total,
    initializeCartSession,
    addToCart,
    addCategoryToCart,
    removeFromCart,
    updateItemQuantity,
    clearCart,
    saveBasket,
    retrieveBasket,
  };
}
