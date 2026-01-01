# Add to Cart Flow Documentation

This document describes the complete flow of how clicking a rectangle item (product or category) results in adding it to the cart table, including all intermediate steps like age verification, scale weight measurement, and amount/weight entry.

## Overview

When a user clicks on a product or category item in the transaction view, the system goes through a series of validation and data collection steps before adding the item to the cart. The flow varies depending on:
- Product type (Standard, Weighted, Generic)
- Age restriction requirements
- Batch tracking requirements
- Whether the item is a product or category

## Flow Diagram

```
User Clicks Item (Product/Category)
    ↓
Check Operations Status (Shift Active?)
    ↓
┌─────────────────────────────────────┐
│  PRODUCT CLICK FLOW                 │
└─────────────────────────────────────┘
    ↓
Is Weighted Product?
    ├─ YES → Check Age Verification (if required)
    │         ├─ Required → Show Age Verification Modal
    │         │              ↓
    │         │         Age Verified?
    │         │              ├─ YES → Show Scale Display
    │         │              └─ NO → Cancel
    │         │
    │         └─ Not Required → Show Scale Display
    │                            ↓
    │                    Weight Confirmed?
    │                            ├─ YES → Check Batch Tracking
    │                            └─ NO → Manual Entry or Cancel
    │
    └─ NO → Check Batch Tracking
              ├─ Required → Auto-select Batch
              │              ├─ Success → Check Age Verification
              │              │              ├─ Required → Show Age Verification Modal
              │              │              └─ Not Required → Add to Cart
              │              │
              │              └─ Show Modal → User Selects Batch
              │                              ↓
              │                         Check Age Verification
              │                              ↓
              │                         Add to Cart
              │
              └─ Not Required → Check Age Verification
                                 ├─ Required → Show Age Verification Modal
                                 │              ↓
                                 │         Age Verified?
                                 │              ├─ YES → Add to Cart
                                 │              └─ NO → Cancel
                                 │
                                 └─ Not Required → Add to Cart

┌─────────────────────────────────────┐
│  CATEGORY CLICK FLOW                │
└─────────────────────────────────────┘
    ↓
Single Click → Show Price Input
    ↓
User Enters Price
    ↓
Add Category to Cart
```

## Detailed Flow Steps

### 1. Initial Click Handler

**File**: `packages/renderer/src/features/sales/views/new-transaction-view.tsx`

**Function**: `handleProductClick` (line ~346)

When a product card is clicked:
- Checks if operations are disabled (shift status)
- Determines product type (weighted vs standard)
- Checks for age verification requirements
- Checks for batch tracking requirements
- Routes to appropriate flow

**Related Components**:
- `packages/renderer/src/features/sales/components/product-selection/product-card.tsx` - Product card UI component
- `packages/renderer/src/features/sales/components/product-selection/category-navigation.tsx` - Category navigation with click handlers

### 2. Age Verification Flow

**File**: `packages/renderer/src/features/sales/components/modals/age-verification-modal.tsx`

**When Triggered**:
- Product has `ageRestrictionLevel` set (not "NONE")
- For weighted products: Before scale display (if no weight yet)
- For standard products: Before adding to cart

**Process**:
1. Modal displays with product information
2. User selects verification method:
   - **Manual**: Enter customer date of birth
   - **ID Scan**: (Placeholder - coming soon)
   - **Override**: Manager override with reason
3. System calculates age and validates against minimum age
4. On verification:
   - Creates audit record via `window.ageVerificationAPI.create()`
   - Stores verification status in `ageVerifiedForProduct` state
   - Proceeds to next step (scale display or add to cart)

**Handler Function**: `handleAgeVerificationComplete` (line ~570 in new-transaction-view.tsx)

**API Integration**:
- `packages/main/src/ipc/age-verification.handlers.ts` - IPC handler for age verification
- `packages/main/src/database/managers/ageVerificationManager.ts` - Database manager

### 3. Scale Weight Measurement Flow

**File**: `packages/renderer/src/features/sales/components/input/ScaleDisplay.tsx`

**When Triggered**:
- Product is weighted (`productType === "WEIGHTED"` or `usesScale === true`)
- Age verification completed (if required)
- No weight provided yet

**Process**:
1. Scale display component shows:
   - Real-time weight readings from scale hardware
   - Stability status (stable/unstable)
   - Calculated price based on weight
   - Connection status
2. User options:
   - **Auto-add on stable**: Automatically adds when weight stabilizes (if enabled)
   - **Manual entry**: Enter weight manually via dialog
   - **Tare scale**: Zero the scale
   - **Confirm weight**: Manually confirm current reading
3. On weight confirmation:
   - Calls `onWeightConfirmed` callback with weight and scale reading metadata
   - Proceeds to batch selection (if required) or add to cart

**Hardware Integration**:
- `packages/renderer/src/services/hardware/scale/index.ts` - Scale service hook
- `packages/renderer/src/services/hardware/scale/hooks/use-scale-manager.ts` - Scale manager hook
- `packages/main/src/services/scale-service.ts` - Main process scale service

**Weight Input State**:
- `packages/renderer/src/features/sales/hooks/use-weight-input.ts` - Weight input state management

### 4. Batch Selection Flow

**File**: `packages/renderer/src/features/sales/components/modals/batch-selection-modal.tsx`

**When Triggered**:
- Product has `requiresBatchTracking === true`
- Auto-selection fails or multiple batches available
- User needs to manually select batch

**Process**:
1. System attempts auto-selection using FEFO (First-Expiry-First-Out):
   - `packages/renderer/src/features/sales/utils/batch-selection.ts` - Auto-selection logic
2. If auto-selection fails or modal required:
   - Modal displays available batches sorted by expiry date
   - Shows batch information: batch number, expiry date, available quantity
   - User selects batch
3. On batch selection:
   - Returns `SelectedBatchData` with batch ID, number, expiry date
   - Proceeds to age verification (if required) or add to cart

**Handler Function**: `handleBatchSelectionComplete` (line ~705 in new-transaction-view.tsx)

**API Integration**:
- `packages/preload/src/api/batches.ts` - Batch API
- `packages/main/src/database/managers/batchManager.ts` - Batch database manager

### 5. Category Price Input Flow

**File**: `packages/renderer/src/features/sales/components/input/category-price-input-display.tsx`

**When Triggered**:
- User single-clicks a category item
- Category requires custom price entry

**Process**:
1. Category price input display shows
2. User enters price using numeric keypad
3. Price is validated and stored
4. Category added to cart with custom price

**Handler Function**: `addCategoryToCart` in `use-cart.ts` hook

**Category Click Handler**:
- `packages/renderer/src/features/sales/components/product-selection/category-navigation.tsx` - Handles category clicks
- Single click: Add to cart (show price input)
- Double click: Navigate to category (show nested items)

### 6. Generic Item Price Entry

**File**: `packages/renderer/src/features/sales/components/modals/generic-item-price-modal.tsx`

**When Triggered**:
- Product has `isGenericButton === true`
- User clicks generic product

**Process**:
1. Generic price modal displays
2. User enters price using numeric keypad
3. Price validated and confirmed
4. Generic item added to cart with custom price

**Handler Function**: `handleGenericPriceComplete` (line ~692 in new-transaction-view.tsx)

### 7. Add to Cart

**File**: `packages/renderer/src/features/sales/hooks/use-cart.ts`

**Function**: `addToCart` (line ~135)

**Process**:
1. Validates shift status
2. Initializes cart session if needed
3. Validates weight for weighted items
4. Calculates pricing:
   - `packages/renderer/src/features/sales/utils/price-calculations.ts` - Price calculation utilities
5. Checks for existing cart item:
   - If exists: Updates quantity/weight
   - If new: Creates new cart item
6. Calls IPC handler: `window.cartAPI.addItem()`
7. Updates cart state
8. Shows success toast

**IPC Handler**:
- `packages/main/src/ipc/cart.handlers.ts` - `cart:addItem` handler (line ~137)

**Database Manager**:
- `packages/main/src/database/managers/cartManager.ts` - Cart database operations

**Database Schema**:
- `packages/main/src/database/schema.ts` - Cart items table schema (line ~1023)

## File Structure

### Main View Component
```
packages/renderer/src/features/sales/views/
└── new-transaction-view.tsx
    ├── handleProductClick() - Main product click handler
    ├── handleAgeVerificationComplete() - Age verification handler
    ├── handleBatchSelectionComplete() - Batch selection handler
    ├── handleGenericPriceComplete() - Generic item handler
    └── State management for modals and pending items
```

### UI Components
```
packages/renderer/src/features/sales/components/
├── product-selection/
│   ├── product-card.tsx - Product rectangle item
│   ├── category-navigation.tsx - Category rectangle items
│   └── product-selection-panel.tsx - Product selection panel
├── modals/
│   ├── age-verification-modal.tsx - Age verification UI
│   ├── batch-selection-modal.tsx - Batch selection UI
│   └── generic-item-price-modal.tsx - Generic item price UI
└── input/
    ├── ScaleDisplay.tsx - Scale weight display
    └── category-price-input-display.tsx - Category price input
```

### Hooks
```
packages/renderer/src/features/sales/hooks/
├── use-cart.ts - Cart operations (addToCart, addCategoryToCart)
├── use-weight-input.ts - Weight input state management
├── use-category-price-input.ts - Category price input state
└── use-barcode-scanner.ts - Barcode scanner integration
```

### Utilities
```
packages/renderer/src/features/sales/utils/
├── product-helpers.ts - Product type checking (isWeightedProduct)
├── batch-selection.ts - Batch auto-selection logic
└── price-calculations.ts - Price calculation utilities
```

### Hardware Services
```
packages/renderer/src/services/hardware/
└── scale/
    ├── index.ts - Scale service exports
    └── hooks/
        └── use-scale-manager.ts - Scale manager hook
```

### Main Process (IPC & Database)
```
packages/main/src/
├── ipc/
│   ├── cart.handlers.ts - Cart IPC handlers
│   └── age-verification.handlers.ts - Age verification IPC handlers
├── database/
│   ├── managers/
│   │   ├── cartManager.ts - Cart database operations
│   │   ├── batchManager.ts - Batch database operations
│   │   └── ageVerificationManager.ts - Age verification database operations
│   └── schema.ts - Database schema definitions
└── services/
    └── scale-service.ts - Scale hardware service
```

### Preload API
```
packages/preload/src/
├── api/
│   ├── cart.ts - Cart API methods
│   └── batches.ts - Batch API methods
└── types/
    └── api/
        ├── cart.ts - Cart API types
        └── batch.ts - Batch API types
```

## State Management

### Key State Variables (new-transaction-view.tsx)

```typescript
// Age Verification State
const [showAgeVerificationModal, setShowAgeVerificationModal] = useState(false);
const [pendingProductForAgeVerification, setPendingProductForAgeVerification] = useState<Product | null>(null);
const [pendingWeightForAgeVerification, setPendingWeightForAgeVerification] = useState<number | undefined>(undefined);
const [pendingBatchDataForAgeVerification, setPendingBatchDataForAgeVerification] = useState<{...} | null>(null);
const [ageVerifiedForProduct, setAgeVerifiedForProduct] = useState<Record<string, boolean>>({});

// Scale Display State
const [showScaleDisplay, setShowScaleDisplay] = useState(false);

// Batch Selection State
const [showBatchSelectionModal, setShowBatchSelectionModal] = useState(false);
const [pendingProductForBatchSelection, setPendingProductForBatchSelection] = useState<Product | null>(null);
const [pendingWeightForBatchSelection, setPendingWeightForBatchSelection] = useState<number | undefined>(undefined);

// Generic Item State
const [showGenericPriceModal, setShowGenericPriceModal] = useState(false);
const [pendingGenericProduct, setPendingGenericProduct] = useState<Product | null>(null);
```

## Data Flow

### Product Click → Add to Cart

1. **User Action**: Click product card
   - Component: `product-card.tsx`
   - Handler: `onProductClick(product)`

2. **Product Click Handler**: `handleProductClick(product, weight?)`
   - File: `new-transaction-view.tsx` (line ~346)
   - Checks: Shift status, product type, age verification, batch tracking

3. **Age Verification** (if required):
   - Modal: `age-verification-modal.tsx`
   - Handler: `handleAgeVerificationComplete(verificationData)`
   - API: `window.ageVerificationAPI.create()`
   - State: `ageVerifiedForProduct[productId] = true`

4. **Scale Display** (if weighted):
   - Component: `ScaleDisplay.tsx`
   - Hook: `useScaleManager()` from `@/services/hardware/scale`
   - Callback: `onWeightConfirmed(weight, scaleReading)`

5. **Batch Selection** (if required):
   - Utility: `autoSelectBatches()` from `batch-selection.ts`
   - Modal: `batch-selection-modal.tsx` (if auto-selection fails)
   - Handler: `handleBatchSelectionComplete(batchData)`

6. **Add to Cart**:
   - Hook: `cart.addToCart(product, weight, price, ageVerified, session, batchData, scaleReading)`
   - File: `use-cart.ts` (line ~135)
   - IPC: `window.cartAPI.addItem(itemData)`
   - Handler: `cart.handlers.ts` → `cartManager.addItem()`
   - Database: `cartManager.ts` → Insert into `cart_items` table

### Category Click → Add to Cart

1. **User Action**: Single-click category
   - Component: `category-navigation.tsx`
   - Handler: `onCategoryClick(category, true)` (addToCart = true)

2. **Category Price Input**:
   - Display: `category-price-input-display.tsx`
   - Hook: `useCategoryPriceInput()` - manages price input state
   - User enters price via numeric keypad

3. **Add Category to Cart**:
   - Hook: `cart.addCategoryToCart(category, price)`
   - File: `use-cart.ts` (line ~369)
   - IPC: `window.cartAPI.addItem()` with `categoryId`
   - Database: Insert category item into `cart_items` table

## Cart Item Data Structure

When an item is added to cart, the following data is stored:

```typescript
{
  cartSessionId: string;
  productId?: string;           // For products
  categoryId?: string;           // For categories
  itemName: string;
  itemType: "UNIT" | "WEIGHT";
  quantity?: number;             // For unit items
  weight?: number;                // For weighted items
  unitOfMeasure: string;          // "each", "kg", "g", etc.
  unitPrice: number;
  totalPrice: number;
  taxAmount: number;
  batchId?: string;               // If batch tracking required
  batchNumber?: string;
  expiryDate?: Date;
  ageRestrictionLevel?: string;   // "NONE", "AGE_16", "AGE_18", "AGE_21"
  ageVerified?: boolean;          // Age verification status
  scaleReadingWeight?: number;    // Actual scale reading (for audit)
  scaleReadingStable?: boolean;   // Whether reading was stable
}
```

## Error Handling

### Common Error Scenarios

1. **Shift Not Active**:
   - Check: `isOperationsDisabled` in `handleProductClick`
   - Error: "Please start your shift before adding items to cart"

2. **Weight Required for Weighted Items**:
   - Check: `isWeighted && (!weight || weight <= 0)`
   - Error: "Please enter a weight for {product.name}"

3. **No Batches Available**:
   - Check: `batchResult.success === false`
   - Error: "No batches available for this product"

4. **Age Verification Failed**:
   - Check: `calculatedAge < requiredAge`
   - Error: "Customer is {age} years old. Minimum age required: {requiredAge}"

5. **Cart Session Not Initialized**:
   - Check: `!cartSession`
   - Action: Auto-initialize cart session
   - Error: "Failed to initialize cart session"

## Testing

### Test Files

- `tests/components/features/sales/ProductCard.test.tsx` - Product card component tests
- `tests/unit/renderer/features/sales/utils/cartCalculations.test.ts` - Cart calculation tests

### Key Test Scenarios

1. Product click triggers correct flow
2. Age verification modal appears for age-restricted products
3. Scale display shows for weighted products
4. Batch selection modal appears when needed
5. Items are added to cart with correct data
6. Category items require price input
7. Generic items require price entry

## Related Documentation

- [Hardware Services README](../../services/hardware/README.md) - Hardware integration overview
- [Cart Management](../hooks/use-cart.ts) - Cart hook documentation
- [Batch Selection Utils](../utils/batch-selection.ts) - Batch selection logic
- [Price Calculations](../utils/price-calculations.ts) - Pricing logic

## Notes

- Age verification is checked **before** scale display for weighted products to ensure compliance
- Batch selection uses FEFO (First-Expiry-First-Out) algorithm for automatic selection
- Each cart addition represents 1 item (quantity = 1), regardless of weight value
- Scale readings are stored for audit purposes even if manual weight is entered
- Category items always create new cart rows (no quantity updates) to allow different prices
- Generic items require manual price entry every time

