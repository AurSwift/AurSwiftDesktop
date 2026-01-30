# Cart Total Calculation Logic

This document explains how cart totals are calculated in the AuraSwift desktop application, covering both frontend and backend responsibilities.

## Overview

The cart calculation logic is distributed between the frontend (Renderer) for immediate UI feedback and the backend (Main Process) for data persistence and source of truth.

- **Frontend**: Calculates individual item prices (including tax) before adding/updating them in the cart. It also aggregates these values to display the cart subtotal, tax, and total.
- **Backend**: Recalculates and persists session totals whenever an item is added, updated, or removed to ensure data integrity.

## Core concepts

### 1. Price Components
Every item in the cart has the following price components:
- `unitPrice`: The price per unit (or per kg for weighted items).
- `quantity` (Unit items) or `weight` (Weighted items): The multiplier.
- `subtotal`: The price before tax (`unitPrice * quantity` or `unitPrice * weight`).
- `taxAmount`: The calculated tax (`subtotal * taxRate`).
- `totalPrice`: The final price (`subtotal + taxAmount`).

### 2. Tax CalculationStrategy
Tax is calculated **per item** and then summed up. This avoids rounding errors that could occur if tax were calculated on the cart subtotal.

Formula:
```typescript
Item Tax = Item Subtotal * Product Tax Rate
Item Total = Item Subtotal + Item Tax
```

## Frontend Calculation

### Item Price Calculation
Located in: `desktop/packages/renderer/src/features/sales/utils/price-calculations.ts`

The `calculateItemPrice` function handles logic for both Unit and Weighted items:

- **Weighted Items**:
  - `unitPrice` = `pricePerKg` (or `basePrice` if per-kg not set).
  - `subtotal` = `unitPrice * weight`.
- **Unit Items**:
  - `unitPrice` = `customPrice` (if provided) or `basePrice`.
  - `subtotal` = `unitPrice * quantity`.

### Cart Totals Aggregation
Located in: `desktop/packages/renderer/src/features/sales/utils/price-calculations.ts` -> `calculateCartTotals`

The frontend aggregates the totals from the list of cart items to display immediate feedback to the user via the `useCart` hook.

```typescript
// Logic simplified
Subtotal (Before Tax) = Sum(Item.totalPrice - Item.taxAmount)
Total Tax = Sum(Item.taxAmount)
Total Amount = Subtotal + Total Tax
```
*Note: We derive the "true" subtotal by subtracting the tax from the total price because `item.totalPrice` is the primary stored value that includes tax.*

## Backend Calculation

### Session Totals Recalculation
Located in: `desktop/packages/main/src/database/managers/cartManager.ts` -> `recalculateSessionTotals`

The backend serves as the source of truth. Whenever the `CartManager` modifies items (add, update, remove), it triggers `recalculateSessionTotals`.

1. **Fetch Items**: Retrieves all items for the given `cartSessionId`.
2. **Sum Totals**:
   - `totalAmount` = Sum of all `item.totalPrice`.
   - `taxAmount` = Sum of all `item.taxAmount`.
3. **Persist**: Updates the `cartSessions` table with the new `totalAmount` and `taxAmount`.

## Data Reconciliation

To ensure the frontend and backend stay in sync:
1. **Action**: User adds/updates an item.
2. **Frontend**: Calculates expected prices and sends them to the Backend API.
3. **Backend**: Saves the item with the provided prices, then recalculates the Session Total in the DB.
4. **Refresh**: The Frontend re-fetches the latest items (and implicitly the session status) to ensure the UI reflects the persistent state.
5. **Session Update Loop**: The `useCart` hook has a `useEffect` that updates the session totals on the backend based on the frontend's local calculation.
   *   *Note: This acts as a secondary sync mechanism, ensuring the session record reflects what is currently "seen" by the user.*

## Key Files & Functions

| Layer | File | Key Functions |
|-------|------|---------------|
| **Frontend** | `.../renderer/src/features/sales/hooks/use-cart.ts` | `addToCart`, `updateItemQuantity`, `removeFromCart` |
| **Utilities** | `.../renderer/src/features/sales/utils/price-calculations.ts` | `calculateItemPrice`, `calculateCategoryPrice`, `calculateCartTotals` |
| **Backend** | `.../main/src/database/managers/cartManager.ts` | `addItem`, `updateItem`, `recalculateSessionTotals` |
| **Display** | `.../renderer/src/features/sales/components/cart/cart-summary.tsx` | Calculates weighted average tax rate for display |
