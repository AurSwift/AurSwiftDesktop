# Add to Cart Flow - Complete Technical Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Directory Structure](#directory-structure)
4. [Entry Points - Click vs Barcode Scan](#entry-points---click-vs-barcode-scan)
5. [Complete Flow Execution Path](#complete-flow-execution-path)
6. [Detailed Component Analysis](#detailed-component-analysis)
7. [State Management](#state-management)
8. [Database Schema](#database-schema)
9. [IPC Communication Layer](#ipc-communication-layer)
10. [Error Handling & Edge Cases](#error-handling--edge-cases)
11. [Appendix](#appendix)

---

## Introduction

This document provides an **exhaustive technical breakdown** of the add-to-cart flow in the Aurswift POS system. It covers every file, function, parameter, database interaction, IPC call, and state transition involved when a user clicks a product or category item, **or scans a barcode**.

### What This Document Covers

- **Complete execution path**: From UI click OR barcode scan → Database insertion
- **Barcode scanning integration**: Hardware scanner and manual barcode input
- **Product identification fields**: barcode, SKU, PLU lookup
- **All intermediate processing**: Age verification, scale weighing, batch selection, price calculation
- **Every file and function involved**: With exact line numbers and parameter details
- **State transitions**: How React state flows through the component tree
- **Database operations**: Schema, managers, and transaction handling
- **IPC communication**: Renderer → Preload → Main process architecture
- **Error scenarios**: All validation and error handling paths

### Flow Variations

The system handles different flows based on:

- **Entry Method**: UI Click vs Barcode Scan (both follow identical downstream flow)
- **Product Type**: Standard (UNIT), Weighted (WEIGHT), Generic (custom price)
- **Age Restriction**: None, AGE_16, AGE_18, AGE_21
- **Batch Tracking**: Whether product requires expiry date tracking
- **Item Type**: Product vs Category

### Key Principle: Unified Flow

**CRITICAL**: Both UI clicks and barcode scans converge to the **exact same** `handleProductClick` handler, ensuring:

- Same age verification flow
- Same scale weighing flow
- Same batch selection flow
- Same price calculation
- Same cart addition logic

---

## Architecture Overview

The application follows Electron's multi-process architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                      RENDERER PROCESS                            │
│  (React UI - Chromium Browser Environment)                      │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Views Layer (new-transaction-view.tsx)                   │  │
│  │  - UI Components                                          │  │
│  │  - Event Handlers                                         │  │
│  │  - State Management                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Hooks Layer (use-cart.ts, etc.)                          │  │
│  │  - Business Logic                                         │  │
│  │  - Data Processing                                        │  │
│  │  - API Calls via Window API                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Utils Layer                                               │  │
│  │  - Price Calculations                                     │  │
│  │  - Product Helpers                                        │  │
│  │  - Batch Selection Logic                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                           ↓ IPC
┌─────────────────────────────────────────────────────────────────┐
│                      PRELOAD PROCESS                             │
│  (Context Bridge - Secure IPC Exposure)                         │
│                                                                   │
│  window.cartAPI.addItem()                                       │
│  window.batchesAPI.selectForSale()                              │
│  window.ageVerificationAPI.create()                             │
└─────────────────────────────────────────────────────────────────┘
                           ↓ IPC
┌─────────────────────────────────────────────────────────────────┐
│                        MAIN PROCESS                              │
│  (Node.js - Full System Access)                                 │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ IPC Handlers (cart.handlers.ts)                          │  │
│  │  - cart:addItem                                           │  │
│  │  - cart:createSession                                     │  │
│  │  - cart:getItems                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Database Managers (cartManager.ts)                       │  │
│  │  - addItem()                                              │  │
│  │  - createSession()                                        │  │
│  │  - recalculateSessionTotals()                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Database Layer (Drizzle ORM)                             │  │
│  │  - SQLite Database                                        │  │
│  │  - cart_sessions table                                    │  │
│  │  - cart_items table                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

### Complete Project Structure

```
desktop/
├── packages/
│   ├── main/                           # Main Process (Node.js)
│   │   └── src/
│   │       ├── ipc/                    # IPC Handlers
│   │       │   ├── cart.handlers.ts    # Cart IPC handlers
│   │       │   └── age-verification.handlers.ts
│   │       ├── database/               # Database Layer
│   │       │   ├── index.ts            # DB initialization
│   │       │   ├── schema.ts           # Drizzle schema definitions
│   │       │   └── managers/           # Database managers
│   │       │       ├── cartManager.ts
│   │       │       ├── batchManager.ts
│   │       │       └── ageVerificationManager.ts
│   │       └── services/               # Hardware/System Services
│   │           ├── scale-service.ts    # Weight scale integration
│   │           └── barcode-scanner/    # Barcode scanner service
│   │               └── scanner-service.ts
│   │
│   ├── preload/                        # Preload Scripts (Context Bridge)
│   │   └── src/
│   │       ├── api/                    # API Definitions
│   │       │   ├── cart.ts             # Cart API methods
│   │       │   ├── batches.ts          # Batch API methods
│   │       │   └── age-verification.ts
│   │       └── types/                  # Type Definitions
│   │           └── api/
│   │               ├── cart.ts
│   │               └── batch.ts
│   │
│   └── renderer/                       # Renderer Process (React)
│       └── src/
│           ├── features/
│           │   └── sales/
│           │       ├── views/          # Main Views
│           │       │   └── new-transaction-view.tsx
│           │       ├── components/     # UI Components
│           │       │   ├── product-selection/
│           │       │   │   ├── product-card.tsx
│           │       │   │   ├── category-navigation.tsx
│           │       │   │   └── product-selection-panel.tsx
│           │       │   ├── modals/
│           │       │   │   ├── age-verification-modal.tsx
│           │       │   │   ├── batch-selection-modal.tsx
│           │       │   │   └── generic-item-price-modal.tsx
│           │       │   ├── input/
│           │       │   │   ├── ScaleDisplay.tsx
│           │       │   │   └── category-price-input-display.tsx
│           │       │   └── cart/
│           │       │       └── cart-panel.tsx
│           │       ├── hooks/          # Custom Hooks
│           │       │   ├── use-cart.ts              # Cart operations
│           │       │   ├── use-barcode-scanner.ts   # Barcode scanner handling
│           │       │   ├── use-weight-input.ts      # Weight/scale input
│           │       │   └── use-category-price-input.ts
│           │       └── utils/          # Utility Functions
│           │           ├── price-calculations.ts
│           │           ├── product-helpers.ts
│           │           └── batch-selection.ts
│           └── services/
│               └── hardware/
│                   └── scale/
│                       ├── index.ts
│                       └── hooks/
│                           └── use-scale-manager.ts
│
└── data/
    └── pos_system.db                   # SQLite Database File
```

---

## Entry Points - Click vs Barcode Scan

Both entry methods converge to the same `handleProductClick` handler:

```
┌───────────────────────────────────────────────────────────────────────────┐
│                        ENTRY POINT CONVERGENCE                            │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   UI CLICK PATH                        BARCODE SCAN PATH                  │
│   ─────────────                        ─────────────────                  │
│                                                                           │
│   ProductCard.tsx                      use-barcode-scanner.ts             │
│        │                                    │                             │
│        │ onClick()                          │ onScan(barcode)             │
│        │                                    │                             │
│        ▼                                    ▼                             │
│   onProductClick(product)             ┌─────────────────────┐             │
│        │                              │ Product Lookup:     │             │
│        │                              │  1. barcode field   │             │
│        │                              │  2. sku field       │             │
│        │                              │  3. plu field       │             │
│        │                              │  4. id field        │             │
│        │                              └──────────┬──────────┘             │
│        │                                         │                        │
│        │                              onProductFound(product)             │
│        │                                         │                        │
│        │                                         │                        │
│        └──────────────────┬──────────────────────┘                        │
│                           │                                               │
│                           ▼                                               │
│           ┌───────────────────────────────────┐                           │
│           │     handleProductClick(product)   │                           │
│           │   (new-transaction-view.tsx)      │                           │
│           └───────────────────────────────────┘                           │
│                           │                                               │
│                           ▼                                               │
│                   SAME FLOW FOR BOTH:                                     │
│                   - Age verification                                      │
│                   - Scale weighing                                        │
│                   - Batch selection                                       │
│                   - Cart addition                                         │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Complete Flow Execution Path

### 1. User Interaction - Product Click

**Entry Point: Product Card Component**

**File**: `packages/renderer/src/features/sales/components/product-selection/product-card.tsx`

```typescript
// Lines 17-80
export function ProductCard({
  product,
  isSelected,
  onProductClick, // Callback to parent handler
  onGenericItemClick, // Special callback for generic items
}: ProductCardProps) {
  const handleClick = async () => {
    // Generic items get special handling (custom price entry)
    if (product.isGenericButton && onGenericItemClick) {
      await onGenericItemClick(product);
      return;
    }
    // Normal products - proceed to main flow
    await onProductClick(product);
  };

  return (
    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
      <Button
        variant="outline"
        onClick={handleClick}
        onTouchEnd={async (e) => {
          e.preventDefault();
          await handleClick();
        }}
      >
        {/* Product UI rendering */}
      </Button>
    </motion.div>
  );
}
```

**Flow**:

1. User clicks/taps product card
2. `handleClick()` is triggered
3. Checks if product is generic (requires custom price)
4. Calls parent's `onProductClick(product)` callback
5. Callback propagates to `new-transaction-view.tsx`

---

### 1A. Alternative Entry Point - Barcode Scanner

**CRITICAL**: Barcode scanning uses the **EXACT SAME** `handleProductClick` handler as UI clicks, ensuring identical downstream flow.

**File**: `packages/renderer/src/features/sales/hooks/use-barcode-scanner.ts`

```typescript
// Hook interface
interface BarcodeScannerConfig {
  products: Product[]; // Full product list to search
  onProductFound: (product: Product) => void; // Same as handleProductClick!
  onScanComplete?: (barcode: string, product: Product | null) => void;
  searchEnabled?: boolean;
  weightConfirmationHandler?: (product: Product, barcode: string) => void;
  enabled?: boolean;
}
```

#### Product Lookup Fields (Priority Order)

When a barcode is scanned, the system searches products using these fields:

1. **`barcode`** - Primary barcode field (exact match, case-insensitive)
2. **`sku`** - Stock Keeping Unit (case-insensitive)
3. **`plu`** - Price Look-Up code (case-insensitive)
4. **`id`** - Product UUID (exact match)

```typescript
// Lines 67-85 - Hardware Scanner Handler
const handleHardwareScan = useCallback(
  (barcode: string) => {
    const foundProduct = products.find(
      (p) =>
        // Check barcode field first
        p.barcode === barcode ||
        p.barcode?.toLowerCase() === barcode.toLowerCase() ||
        // Then SKU
        p.sku === barcode ||
        p.sku?.toLowerCase() === barcode.toLowerCase() ||
        // Then PLU
        p.plu === barcode ||
        p.plu?.toLowerCase() === barcode.toLowerCase() ||
        // Finally ID
        p.id === barcode
    );

    if (foundProduct) {
      // CRITICAL: Calls exact same handler as UI clicks!
      onProductFound(foundProduct);
    } else {
      toast.error(`Product not found for barcode: ${barcode}`);
    }
  },
  [products, onProductFound]
);
```

#### Weighted Product Handling in Scanner

```typescript
// Lines 90-130 - Weighted Product Special Flow
const handleBarcodeScan = useCallback(
  async (barcode: string) => {
    const foundProduct = products.find(/* same lookup logic */);

    if (foundProduct) {
      // Check if it's a weighted product
      if (foundProduct.productType === "WEIGHT") {
        // Option 1: If weight confirmation handler provided
        if (weightConfirmationHandler) {
          weightConfirmationHandler(foundProduct, barcode);
          return;
        }
        // Option 2: Show toast prompting scale usage
        toast.info(`Please place ${foundProduct.name} on the scale`);
      }

      // Proceed to same flow as clicks
      onProductFound(foundProduct);
    }
  },
  [products, onProductFound, weightConfirmationHandler]
);
```

#### Integration in New Transaction View

**File**: `packages/renderer/src/features/sales/views/new-transaction-view.tsx`

```typescript
// Lines 550-567 - Barcode Scanner Hook Setup
useBarcodeScanner({
  products,
  onProductFound: handleProductClick, // SAME handler as UI clicks!
  onScanComplete: (barcode, product) => {
    console.log(`Scanned: ${barcode}, Found: ${product?.name || "Not found"}`);
  },
  searchEnabled: isOperationsEnabled,
  weightConfirmationHandler: (product, barcode) => {
    // Show scale for weighted products
    weightInput.setSelectedWeightProduct(product);
    setShowScaleDisplay(true);
    toast.info(`Place ${product.name} on scale and press Enter`);
  },
  enabled: !showAgeVerificationModal && !showBatchSelectionModal,
});
```

#### Barcode Scanner Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    BARCODE SCANNER FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │               HARDWARE SCANNER EVENT                     │    │
│  │                    (USB HID)                             │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              use-barcode-scanner.ts                      │    │
│  │  ┌─────────────────────────────────────────────────┐     │    │
│  │  │          PRODUCT LOOKUP (Priority)               │     │    │
│  │  │  1. barcode field (case-insensitive)             │     │    │
│  │  │  2. sku field (case-insensitive)                 │     │    │
│  │  │  3. plu field (case-insensitive)                 │     │    │
│  │  │  4. id field (exact match)                       │     │    │
│  │  └─────────────────────────────────────────────────┘     │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │                                     │
│              ┌────────────┴────────────┐                        │
│              │     Product Found?       │                        │
│              └────────────┬────────────┘                        │
│                    ┌──────┴──────┐                              │
│                    │             │                              │
│                    ▼             ▼                              │
│              ┌─────────┐   ┌─────────┐                          │
│              │   YES   │   │   NO    │                          │
│              └────┬────┘   └────┬────┘                          │
│                   │             │                               │
│                   │             ▼                               │
│                   │    ┌────────────────┐                       │
│                   │    │ toast.error()  │                       │
│                   │    │ "Not found"    │                       │
│                   │    └────────────────┘                       │
│                   │                                             │
│                   ▼                                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │           onProductFound(foundProduct)                   │    │
│  │           = handleProductClick(product)                  │    │
│  │                                                          │    │
│  │           *** SAME AS UI CLICK FROM HERE ***             │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │                                     │
│                           ▼                                     │
│          (Continues with standard handleProductClick flow)      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Manual Barcode Input

The hook also supports manual barcode entry via text input:

```typescript
// Manual input processing
const processManualBarcode = useCallback(
  (inputBarcode: string) => {
    if (!inputBarcode.trim()) return;
    handleBarcodeScan(inputBarcode.trim());
  },
  [handleBarcodeScan]
);
```

#### Key Points for Barcode Scanner

| Aspect                     | Detail                                                    |
| -------------------------- | --------------------------------------------------------- |
| **Entry Convergence**      | Both scanner and clicks use `handleProductClick`          |
| **Product Fields Checked** | barcode, sku, plu, id (in that order)                     |
| **Case Sensitivity**       | All fields checked case-insensitively                     |
| **Weighted Products**      | Triggers scale display, same as clicking weighted product |
| **Age Verification**       | Same modal flow triggered via `handleProductClick`        |
| **Batch Selection**        | Same auto-selection + modal flow                          |

---

### 2. Main Product Click Handler

**File**: `packages/renderer/src/features/sales/views/new-transaction-view.tsx`

**Function**: `handleProductClick` (Lines 346-550)

```typescript
const handleProductClick = useCallback(
  async (product: Product, weight?: number) => {
    // STEP 1: Operations Status Check
    if (isOperationsDisabled) {
      const errorMessage = salesMode.requiresShift ? "Please start your shift before adding items to cart" : "Unable to add items to cart";
      toast.error(errorMessage);
      return;
    }

    // STEP 2: Check Product Characteristics
    const requiresBatchTracking = product.requiresBatchTracking === true;
    const requiresAgeVerification = product.ageRestrictionLevel && product.ageRestrictionLevel !== "NONE";

    // STEP 3: Weighted Product Path
    if (isWeightedProduct(product)) {
      // 3A: Age verification BEFORE scale (if required and no weight yet)
      if (requiresAgeVerification && weight === undefined) {
        setPendingProductForAgeVerification(product);
        setShowAgeVerificationModal(true);
        return; // Exit - scale shown after age verification
      }

      // 3B: Weight is provided - proceed to batch or add to cart
      if (weight !== undefined && weight > 0) {
        const ageVerified = ageVerifiedForProduct[product.id] || false;

        if (requiresBatchTracking) {
          // Auto-select batch using FEFO algorithm
          const batchResult = await autoSelectBatches(
            product,
            1, // Check for 1 item availability
            false // Don't allow partial
          );

          if (batchResult.success && batchResult.primaryBatch) {
            // Batch selected - add to cart
            await cart.addToCart(product, weight, undefined, ageVerified, undefined, batchResult.primaryBatch);
            toast.success(`Added ${product.name} to cart`);
            weightInput.resetWeightInput();
            setShowScaleDisplay(false);
          } else if (batchResult.shouldShowModal) {
            // Need manual batch selection
            setPendingWeightForBatchSelection(weight);
            setPendingProductForBatchSelection(product);
            setShowBatchSelectionModal(true);
          } else {
            toast.error(batchResult.error || "No batches available");
          }
        } else {
          // No batch tracking - add directly
          await cart.addToCart(product, weight, undefined, ageVerified);
          weightInput.resetWeightInput();
          setShowScaleDisplay(false);
        }
      } else {
        // 3C: No weight yet - show scale display
        categoryPriceInput.resetPriceInput();
        setShowScaleDisplay(true);
        weightInput.setSelectedWeightProduct(product);
      }
    } else {
      // STEP 4: Regular (Unit) Product Path
      if (requiresBatchTracking) {
        // Attempt auto-batch selection
        const batchResult = await autoSelectBatches(product, 1, false);

        if (batchResult.success && batchResult.primaryBatch) {
          // Check age verification after successful batch selection
          if (requiresAgeVerification) {
            setPendingBatchDataForAgeVerification({
              batchId: batchResult.primaryBatch.batchId,
              batchNumber: batchResult.primaryBatch.batchNumber,
              expiryDate: batchResult.primaryBatch.expiryDate,
            });
            setPendingProductForAgeVerification(product);
            setShowAgeVerificationModal(true);
          } else {
            // No age verification needed - add directly
            await cart.addToCart(product, undefined, undefined, false, undefined, batchResult.primaryBatch);
            toast.success(`Added ${product.name} to cart`);
          }
        } else if (batchResult.shouldShowModal) {
          // Show batch selection modal
          setPendingProductForBatchSelection(product);
          setShowBatchSelectionModal(true);
        } else {
          toast.error(batchResult.error || "No batches available");
        }
      } else {
        // No batch tracking required
        if (requiresAgeVerification) {
          setPendingProductForAgeVerification(product);
          setShowAgeVerificationModal(true);
        } else {
          // No age verification, no batch tracking - add directly
          await cart.addToCart(product);
          toast.success(`Added ${product.name} to cart`);
        }
      }
    }
  },
  [isOperationsDisabled, salesMode, cart, weightInput, categoryPriceInput, ageVerifiedForProduct]
);
```

**Decision Tree**:

```
Product Click
    ↓
Operations Check ────────→ [FAIL] → Show Error
    ↓ [PASS]
Is Weighted?
    ├─ YES → Age Required & No Weight?
    │         ├─ YES → Show Age Verification
    │         └─ NO  → Has Weight?
    │                  ├─ YES → Batch Tracking?
    │                  │        ├─ YES → Auto-select Batch
    │                  │        └─ NO  → Add to Cart
    │                  └─ NO  → Show Scale Display
    │
    └─ NO  → Batch Tracking?
              ├─ YES → Auto-select Batch
              │        ├─ Success → Age Required?
              │        │             ├─ YES → Show Age Verification
              │        │             └─ NO  → Add to Cart
              │        └─ Fail → Show Batch Selection Modal
              │
              └─ NO  → Age Required?
                       ├─ YES → Show Age Verification
                       └─ NO  → Add to Cart
```

---

### 3. Age Verification Flow

**File**: `packages/renderer/src/features/sales/components/modals/age-verification-modal.tsx`

**Interface** (Lines 17-24):

```typescript
export interface AgeVerificationData {
  verified: boolean;
  verificationMethod: "manual" | "scan" | "override";
  customerBirthdate?: string;
  calculatedAge?: number;
  overrideReason?: string;
  managerId?: string;
}
```

**Component** (Lines 1-350):

```typescript
export const AgeVerificationModal: React.FC<AgeVerificationModalProps> = ({
  isOpen,
  product,
  onVerify, // Callback with verification data
  onCancel,
  currentUser,
}) => {
  const [verificationMethod, setVerificationMethod] = useState<"manual" | "scan" | "override">("manual");
  const [birthdate, setBirthdate] = useState("");
  const [calculatedAge, setCalculatedAge] = useState<number | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  // Get minimum age from product restriction level
  const getMinimumAge = (level: string): number => {
    switch (level) {
      case "AGE_16":
        return 16;
      case "AGE_18":
        return 18;
      case "AGE_21":
        return 21;
      default:
        return 0;
    }
  };

  const requiredAge = getMinimumAge(product.ageRestrictionLevel || "NONE");

  // Calculate customer age from birthdate
  const calculateAge = (dateString: string): number | null => {
    if (!dateString) return null;
    const birth = new Date(dateString);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const handleVerify = () => {
    if (verificationMethod === "manual") {
      if (!birthdate || !calculatedAge) {
        toast.error("Please enter customer date of birth");
        return;
      }

      if (calculatedAge < requiredAge) {
        toast.error(`Customer is ${calculatedAge} years old. ` + `Minimum age required: ${requiredAge}`);
        return;
      }

      // Age verification passed
      onVerify({
        verified: true,
        verificationMethod: "manual",
        customerBirthdate: birthdate,
        calculatedAge,
      });
    } else if (verificationMethod === "override") {
      if (!overrideReason.trim()) {
        toast.error("Please provide a reason for override");
        return;
      }

      onVerify({
        verified: true,
        verificationMethod: "override",
        overrideReason,
        managerId: currentUser?.id,
      });
    }
  };

  // UI renders verification form...
};
```

**Verification Handler** (new-transaction-view.tsx, Lines 570-690):

```typescript
const handleAgeVerificationComplete = useCallback(
  async (verificationData: AgeVerificationData) => {
    if (!pendingProductForAgeVerification) return;

    if (verificationData.verified) {
      try {
        // STEP 1: Create audit record in database
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
            logger.error("Failed to create age verification record");
            // Continue anyway - don't block sale
          }
        }

        // STEP 2: Determine next step based on product type
        const isWeighted = isWeightedProduct(pendingProductForAgeVerification);

        if (isWeighted && pendingWeightForAgeVerification === undefined) {
          // Weighted product, no weight yet → Show scale display
          const productToWeigh = pendingProductForAgeVerification;
          setShowAgeVerificationModal(false);
          setPendingProductForAgeVerification(null);

          // Mark age verification complete for this product
          setAgeVerifiedForProduct((prev) => ({
            ...prev,
            [productToWeigh.id]: true,
          }));

          // Show scale display
          setShowScaleDisplay(true);
          weightInput.setSelectedWeightProduct(productToWeigh);
          return;
        } else {
          // STEP 3: Add to cart with age verification flag
          if (pendingWeightForAgeVerification !== undefined) {
            // Weighted with weight already provided
            await cart.addToCart(
              pendingProductForAgeVerification,
              pendingWeightForAgeVerification,
              undefined,
              true, // ageVerified = true
              undefined,
              pendingBatchDataForAgeVerification || undefined
            );
          } else {
            // Unit item
            await cart.addToCart(
              pendingProductForAgeVerification,
              undefined,
              undefined,
              true, // ageVerified = true
              undefined,
              pendingBatchDataForAgeVerification || undefined
            );
          }

          // STEP 4: Clean up state
          setShowAgeVerificationModal(false);
          setPendingProductForAgeVerification(null);
          setPendingWeightForAgeVerification(undefined);
          setPendingBatchDataForAgeVerification(null);
          setAgeVerifiedForProduct((prev) => {
            const next = { ...prev };
            delete next[pendingProductForAgeVerification.id];
            return next;
          });
          weightInput.resetWeightInput();
          setShowScaleDisplay(false);
        }
      } catch (error) {
        logger.error("Error during age verification completion:", error);
        toast.error("Failed to complete age verification");
      }
    } else {
      // Verification cancelled
      setShowAgeVerificationModal(false);
      setPendingProductForAgeVerification(null);
      // ... cleanup state
    }
  },
  [pendingProductForAgeVerification, pendingWeightForAgeVerification, pendingBatchDataForAgeVerification, cart, weightInput, user]
);
```

**Database Audit** (via IPC):

```typescript
// Preload API: packages/preload/src/api/age-verification.ts
window.ageVerificationAPI.create({
  productId: string,
  verificationMethod: "manual" | "scan" | "override",
  customerBirthdate: string,
  calculatedAge: number,
  verifiedBy: string,
  managerOverrideId: string,
  overrideReason: string,
  businessId: string,
});
```

---

### 4. Scale Weight Measurement Flow

**File**: `packages/renderer/src/features/sales/components/input/ScaleDisplay.tsx`

**Purpose**: Captures weight for weighted products using hardware scale or manual entry

**Component Structure**:

```typescript
export interface ScaleDisplayProps {
  product: Product;
  onWeightConfirmed: (weight: number, scaleReading?: { weight: number; stable: boolean }) => void;
  onCancel: () => void;
  businessId: string;
  autoAddOnStable?: boolean; // Auto-add when weight stabilizes
}

export const ScaleDisplay: React.FC<ScaleDisplayProps> = ({ product, onWeightConfirmed, onCancel, businessId, autoAddOnStable = false }) => {
  // STEP 1: Connect to scale hardware
  const {
    isConnected, // Scale connection status
    weight, // Current weight reading
    isStable, // Weight stability status
    unit, // Weight unit (kg, g, lb)
    error, // Connection error
    tare, // Zero the scale
  } = useScaleManager();

  const [manualWeight, setManualWeight] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);

  // STEP 2: Auto-add when weight stabilizes (if enabled)
  useEffect(() => {
    if (autoAddOnStable && isStable && weight > 0) {
      handleConfirmWeight();
    }
  }, [autoAddOnStable, isStable, weight]);

  // STEP 3: Calculate price in real-time
  const calculatedPrice = useMemo(() => {
    if (!weight || weight <= 0) return 0;
    const pricePerKg = product.pricePerKg || product.price;
    return weight * pricePerKg;
  }, [weight, product]);

  // STEP 4: Confirm weight handler
  const handleConfirmWeight = () => {
    if (!weight || weight <= 0) {
      toast.error("Please wait for a valid weight reading");
      return;
    }

    if (!isStable) {
      toast.warning("Weight is not stable. Please wait...");
      return;
    }

    // Return weight with scale metadata
    onWeightConfirmed(weight, {
      weight: weight,
      stable: isStable,
    });
  };

  // STEP 5: Manual weight entry
  const handleManualEntry = () => {
    const weightValue = parseFloat(manualWeight);

    if (isNaN(weightValue) || weightValue <= 0) {
      toast.error("Please enter a valid weight");
      return;
    }

    // Manual entry has no scale reading metadata
    onWeightConfirmed(weightValue, undefined);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weigh: {product.name}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Scale Status */}
        <div className="status-indicator">
          {isConnected ? (
            <Badge variant="success">
              <CheckCircle className="w-4 h-4" />
              Connected
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="w-4 h-4" />
              Not Connected
            </Badge>
          )}
        </div>

        {/* Weight Display */}
        <div className="weight-display">
          <div className="text-6xl font-bold">
            {weight.toFixed(3)} {unit}
          </div>
          <div className="stability-indicator">{isStable ? <Badge variant="success">Stable</Badge> : <Badge variant="warning">Stabilizing...</Badge>}</div>
        </div>

        {/* Price Calculation */}
        <div className="price-display">
          <p className="text-xl">£{calculatedPrice.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">@ £{product.pricePerKg?.toFixed(2)}/kg</p>
        </div>

        {/* Actions */}
        <div className="actions">
          <Button onClick={tare} variant="outline">
            Tare Scale
          </Button>
          <Button onClick={() => setShowManualEntry(true)} variant="outline">
            Manual Entry
          </Button>
          <Button onClick={handleConfirmWeight} disabled={!isStable}>
            Confirm Weight
          </Button>
          <Button onClick={onCancel} variant="ghost">
            Cancel
          </Button>
        </div>

        {/* Manual Entry Dialog */}
        {showManualEntry && <Dialog>{/* Manual weight entry form */}</Dialog>}
      </CardContent>
    </Card>
  );
};
```

**Scale Manager Hook** (`packages/renderer/src/services/hardware/scale/hooks/use-scale-manager.ts`):

```typescript
export function useScaleManager() {
  const [isConnected, setIsConnected] = useState(false);
  const [weight, setWeight] = useState(0);
  const [isStable, setIsStable] = useState(false);
  const [unit, setUnit] = useState<"kg" | "g" | "lb">("kg");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to scale events from main process
    const unsubscribeWeight = window.scaleAPI.onWeightUpdate((data: { weight: number; stable: boolean; unit: string }) => {
      setWeight(data.weight);
      setIsStable(data.stable);
      setUnit(data.unit as "kg" | "g" | "lb");
      setIsConnected(true);
      setError(null);
    });

    const unsubscribeError = window.scaleAPI.onScaleError((errorMessage: string) => {
      setError(errorMessage);
      setIsConnected(false);
    });

    // Request initial connection
    window.scaleAPI.connect();

    return () => {
      unsubscribeWeight();
      unsubscribeError();
    };
  }, []);

  const tare = async () => {
    try {
      await window.scaleAPI.tare();
      toast.success("Scale zeroed");
    } catch (error) {
      toast.error("Failed to tare scale");
    }
  };

  return {
    isConnected,
    weight,
    isStable,
    unit,
    error,
    tare,
  };
}
```

**Hardware Service** (`packages/main/src/services/scale-service.ts`):

```typescript
// Main process - actual hardware communication
export class ScaleService {
  private port: SerialPort | null = null;
  private parser: ReadlineParser | null = null;

  async connect(portPath: string) {
    this.port = new SerialPort({
      path: portPath,
      baudRate: 9600,
    });

    this.parser = new ReadlineParser();
    this.port.pipe(this.parser);

    this.parser.on("data", (data: string) => {
      const reading = this.parseScaleData(data);
      if (reading) {
        // Send to renderer via IPC
        mainWindow?.webContents.send("scale:weight-update", {
          weight: reading.weight,
          stable: reading.stable,
          unit: reading.unit,
        });
      }
    });
  }

  parseScaleData(data: string): ScaleReading | null {
    // Parse scale-specific protocol
    // Example: "  1.234kg  S"  (S = Stable)
    // Returns: { weight: 1.234, stable: true, unit: "kg" }
  }

  async tare() {
    if (this.port) {
      this.port.write("T\r\n"); // Send tare command
    }
  }
}
```

**Weight Confirmation Flow**:

1. User places item on scale
2. Scale sends weight readings to main process
3. Main process parses and broadcasts to renderer
4. ScaleDisplay shows real-time weight
5. User confirms OR auto-confirms when stable
6. Calls `onWeightConfirmed(weight, scaleReading)`
7. Returns to `handleProductClick` with weight parameter

---

### 5. Batch Selection Flow

**File**: `packages/renderer/src/features/sales/utils/batch-selection.ts`

**Purpose**: Automatically select inventory batches using FEFO (First-Expiry-First-Out) rotation

**Function**: `autoSelectBatches` (Lines 45-275)

```typescript
export interface BatchAutoSelectionResult {
  success: boolean;
  primaryBatch?: {
    batchId: string;
    batchNumber: string;
    expiryDate: Date;
  };
  totalAvailable?: number;
  actualQuantity?: number;
  requestedQuantity: number;
  batches?: Array<{
    batchId: string;
    batchNumber: string;
    expiryDate: Date | string | number;
    quantity: number;
  }>;
  error?: string;
  shouldShowModal?: boolean; // Whether manual selection is needed
}

export async function autoSelectBatches(product: Product, requestedQuantity: number, allowPartial: boolean = false): Promise<BatchAutoSelectionResult> {
  // STEP 1: Validate inputs
  if (!product.id) {
    return {
      success: false,
      requestedQuantity,
      error: "Product ID is required",
    };
  }

  if (!requestedQuantity || requestedQuantity <= 0) {
    return {
      success: false,
      requestedQuantity,
      error: "Requested quantity must be greater than 0",
    };
  }

  const rotationMethod = product.stockRotationMethod || "FEFO";

  try {
    // STEP 2: Call batch selection API
    const batchResponse = await window.batchesAPI?.selectForSale(product.id, requestedQuantity, rotationMethod);

    // STEP 3: Process successful batch selection
    if (batchResponse?.success && batchResponse.batches?.length > 0) {
      const primaryBatch = batchResponse.batches[0];

      // Calculate total available from all selected batches
      const totalAvailable = batchResponse.batches.reduce((sum: number, batch: { quantity: number }) => sum + batch.quantity, 0);

      // Determine actual quantity
      const actualQuantity = totalAvailable < requestedQuantity ? (allowPartial ? totalAvailable : requestedQuantity) : requestedQuantity;

      // STEP 4: Check if sufficient stock
      if (!allowPartial && totalAvailable < requestedQuantity) {
        return {
          success: false,
          requestedQuantity,
          totalAvailable,
          shouldShowModal: true, // Request manual selection
          error: `Insufficient stock. Available: ${totalAvailable.toFixed(2)}, Requested: ${requestedQuantity.toFixed(2)}`,
        };
      }

      return {
        success: true,
        primaryBatch: {
          batchId: primaryBatch.batchId,
          batchNumber: primaryBatch.batchNumber,
          expiryDate: new Date(primaryBatch.expiryDate),
        },
        totalAvailable,
        actualQuantity,
        requestedQuantity,
        batches: batchResponse.batches,
      };
    } else {
      // STEP 5: No batches selected - check why
      const availableBatchesResponse = await window.batchesAPI?.getActiveBatches(product.id, rotationMethod);

      if (availableBatchesResponse?.success && availableBatchesResponse.batches?.length > 0) {
        // Batches exist but insufficient stock
        const totalAvailable = availableBatchesResponse.batches.reduce((sum: number, batch: { currentQuantity: number }) => sum + batch.currentQuantity, 0);

        if (allowPartial && totalAvailable > 0) {
          // Use first batch with partial quantity
          const firstBatch = availableBatchesResponse.batches[0];
          return {
            success: true,
            primaryBatch: {
              batchId: firstBatch.id,
              batchNumber: firstBatch.batchNumber,
              expiryDate: new Date(firstBatch.expiryDate),
            },
            totalAvailable,
            actualQuantity: totalAvailable,
            requestedQuantity,
          };
        }

        return {
          success: false,
          requestedQuantity,
          totalAvailable,
          shouldShowModal: true,
          error: `Insufficient stock. Available: ${totalAvailable.toFixed(2)}, Requested: ${requestedQuantity.toFixed(2)}`,
        };
      } else {
        // No batches available at all
        return {
          success: false,
          requestedQuantity,
          error: "No batches available for this product",
        };
      }
    }
  } catch (error) {
    logger.error("Error in autoSelectBatches:", error);
    return {
      success: false,
      requestedQuantity,
      error: error instanceof Error ? error.message : "Batch selection failed",
    };
  }
}
```

**Batch Selection API** (`packages/preload/src/api/batches.ts`):

```typescript
export const batchesAPI = {
  // Select batches for sale using rotation method
  selectForSale: (productId: string, quantity: number, rotationMethod: "FEFO" | "FIFO" | "LIFO") =>
    ipcRenderer.invoke("batches:selectForSale", {
      productId,
      quantity,
      rotationMethod,
    }),

  // Get all active batches sorted by rotation method
  getActiveBatches: (productId: string, rotationMethod: "FEFO" | "FIFO" | "LIFO") =>
    ipcRenderer.invoke("batches:getActiveBatches", {
      productId,
      rotationMethod,
    }),
};
```

**Manual Batch Selection Modal** (`packages/renderer/src/features/sales/components/modals/batch-selection-modal.tsx`)

**When Triggered**:

- Auto-selection fails (`shouldShowModal: true`)
- Insufficient stock for requested quantity
- User manually requests batch selection

**Interface**:

```typescript
export interface SelectedBatchData {
  batchId: string;
  batchNumber: string;
  expiryDate: Date;
  quantityFromBatch: number;
}

interface BatchSelectionModalProps {
  isOpen: boolean;
  product: Product;
  requestedQuantity: number;
  onSelect: (data: SelectedBatchData) => void;
  onAutoSelect: () => void;
  onCancel: () => void;
  businessId: string;
  cartItems?: Array<{
    batchId?: string;
    itemType: "UNIT" | "WEIGHT";
    quantity?: number;
    weight?: number;
  }>;
}
```

**Component Logic** (Lines 1-513):

```typescript
export const BatchSelectionModal: React.FC<BatchSelectionModalProps> = ({ isOpen, product, requestedQuantity, onSelect, onAutoSelect, onCancel, businessId, cartItems = [] }) => {
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // STEP 1: Load available batches when modal opens
  useEffect(() => {
    if (isOpen && product.id) {
      loadBatches();
    }
  }, [isOpen, product.id]);

  const loadBatches = async () => {
    setLoading(true);
    try {
      const rotationMethod = product.stockRotationMethod || "FEFO";
      const response = await window.batchesAPI?.getActiveBatches(product.id, rotationMethod);

      if (response?.success && response.batches) {
        // Filter to active batches with available quantity
        const availableBatches = response.batches.filter((batch: BatchInfo) => batch.status === "ACTIVE" && batch.currentQuantity > 0);
        setBatches(availableBatches);

        // Auto-select first batch (FEFO recommendation)
        if (availableBatches.length > 0) {
          setSelectedBatchId(availableBatches[0].id);
        }
      } else {
        setBatches([]);
        toast.error("No batches available for this product");
      }
    } catch (error) {
      logger.error("Failed to load batches:", error);
      toast.error("Failed to load batch information");
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Calculate already allocated quantities
  const allocatedByBatch = useMemo(() => {
    const allocated: Record<string, number> = {};

    cartItems.forEach((item) => {
      if (!item.batchId) return;

      if (item.itemType === "WEIGHT") {
        // Weighted items: use quantity field (number of items)
        allocated[item.batchId] = (allocated[item.batchId] || 0) + (item.quantity || 0);
      } else {
        // Unit items: use quantity field
        allocated[item.batchId] = (allocated[item.batchId] || 0) + (item.quantity || 0);
      }
    });

    return allocated;
  }, [cartItems]);

  // STEP 3: Calculate available quantity per batch
  const getAvailableQuantity = (batch: BatchInfo): number => {
    const allocated = allocatedByBatch[batch.id] || 0;
    return Math.max(0, batch.currentQuantity - allocated);
  };

  // STEP 4: Handle batch selection confirmation
  const handleConfirm = () => {
    if (!selectedBatchId) {
      toast.error("Please select a batch");
      return;
    }

    const selectedBatch = batches.find((b) => b.id === selectedBatchId);
    if (!selectedBatch) {
      toast.error("Selected batch not found");
      return;
    }

    const availableQty = getAvailableQuantity(selectedBatch);
    if (availableQty < requestedQuantity) {
      toast.warning(`Only ${availableQty} available. Adding partial quantity.`);
    }

    // Return selected batch data
    onSelect({
      batchId: selectedBatch.id,
      batchNumber: selectedBatch.batchNumber,
      expiryDate: new Date(selectedBatch.expiryDate),
      quantityFromBatch: Math.min(availableQty, requestedQuantity),
    });
  };

  // STEP 5: Render batch list with expiry indicators
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Batch - {product.name}</DialogTitle>
          <DialogDescription>Choose which batch to use for this sale. Batches are sorted by expiry date (oldest first).</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : batches.length === 0 ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>No batches available for this product</AlertDescription>
          </Alert>
        ) : (
          <RadioGroup value={selectedBatchId || ""} onValueChange={setSelectedBatchId}>
            {batches.map((batch) => {
              const daysUntilExpiry = getDaysUntilExpiry(batch.expiryDate);
              const availableQty = getAvailableQuantity(batch);
              const expiryColor = getExpiryStatusColor(daysUntilExpiry);

              return (
                <div key={batch.id} className={`flex items-center space-x-3 p-4 border rounded-lg ${selectedBatchId === batch.id ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}>
                  <RadioGroupItem value={batch.id} id={batch.id} />
                  <Label htmlFor={batch.id} className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Batch: {batch.batchNumber}</div>
                        <div className="text-sm text-gray-600">Expires: {formatExpiryDate(batch.expiryDate)}</div>
                        <div className="text-sm">Available: {availableQty.toFixed(2)}</div>
                      </div>
                      <div>
                        <Badge className={expiryColor}>{daysUntilExpiry < 0 ? "EXPIRED" : `${daysUntilExpiry}d remaining`}</Badge>
                      </div>
                    </div>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onAutoSelect}>
            Use Auto-Selection
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedBatchId}>
            Confirm Selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

**Batch Selection Handler** (new-transaction-view.tsx, Lines 705-820):

```typescript
const handleBatchSelectionComplete = useCallback(
  async (batchData: SelectedBatchData) => {
    if (!pendingProductForBatchSelection) return;

    const product = pendingProductForBatchSelection;
    const isWeighted = isWeightedProduct(product);
    const weight = pendingWeightForBatchSelection;

    // Check if age verification already completed
    const ageVerified = ageVerifiedForProduct[product.id] || false;

    // Check if age verification still required
    const requiresAgeVerification = product.ageRestrictionLevel && product.ageRestrictionLevel !== "NONE";

    if (requiresAgeVerification && !ageVerified) {
      // Age verification not yet done - show modal
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
      // Add to cart with batch info
      if (isWeighted && weight !== undefined) {
        await cart.addToCart(product, weight, undefined, ageVerified, undefined, {
          batchId: batchData.batchId,
          batchNumber: batchData.batchNumber,
          expiryDate: batchData.expiryDate,
        });
      } else {
        await cart.addToCart(product, undefined, undefined, ageVerified, undefined, {
          batchId: batchData.batchId,
          batchNumber: batchData.batchNumber,
          expiryDate: batchData.expiryDate,
        });
      }

      toast.success(`Added ${product.name}${isWeighted && weight ? ` (${weight.toFixed(2)}kg)` : ""} from batch ${batchData.batchNumber}`);

      // Clear age verification state
      setAgeVerifiedForProduct((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
    }

    // Clear batch selection state
    setShowBatchSelectionModal(false);
    setPendingProductForBatchSelection(null);
    setPendingQuantityForBatchSelection(1);
    setPendingWeightForBatchSelection(undefined);
    setShowScaleDisplay(false);
  },
  [pendingProductForBatchSelection, pendingWeightForBatchSelection, ageVerifiedForProduct, cart]
);
```

---

### 6. Price Calculations

**File**: `packages/renderer/src/features/sales/utils/price-calculations.ts`

**Function**: `calculateItemPrice` (Lines 17-73)

```typescript
export function calculateItemPrice(
  product: Product,
  weight?: number,
  customPrice?: number
): {
  unitPrice: number;
  subtotal: number;
  taxAmount: number;
  totalPrice: number;
} {
  const isWeighted = isWeightedProduct(product);
  const basePrice = getProductPrice(product);
  const pricePerKg = getProductPricePerKg(product);
  const taxRate = getProductTaxRate(product);

  let unitPrice: number;
  let subtotal: number;

  if (isWeighted) {
    // Weighted items: use pricePerKg
    unitPrice = pricePerKg ?? basePrice;
    if (!weight || weight <= 0) {
      throw new Error("Weight is required for weighted items");
    }
    subtotal = unitPrice * weight;
  } else {
    // Unit items: use customPrice if provided, otherwise basePrice
    unitPrice = customPrice ?? basePrice;
    subtotal = unitPrice * 1; // Quantity always 1 per cart addition
  }

  // Calculate tax
  const taxAmount = subtotal * taxRate;
  const totalPrice = subtotal + taxAmount;

  // Validation
  if (!unitPrice || unitPrice <= 0) {
    throw new Error("Invalid price for product");
  }

  if (!totalPrice || totalPrice <= 0) {
    throw new Error("Invalid total price calculation");
  }

  if (taxAmount < 0) {
    throw new Error("Invalid tax calculation");
  }

  return {
    unitPrice,
    subtotal,
    taxAmount,
    totalPrice,
  };
}
```

**Helper Functions** (`packages/renderer/src/features/sales/utils/product-helpers.ts`):

```typescript
export function isWeightedProduct(product: Product): boolean {
  return product.productType === "WEIGHTED" || product.usesScale === true;
}

export function getProductPrice(product: Product): number {
  return product.price || product.basePrice || 0;
}

export function getProductPricePerKg(product: Product): number {
  return product.pricePerKg || product.pricePerUnit || 0;
}

export function getProductTaxRate(product: Product): number {
  return product.taxRate ?? 0.08; // Default 8% VAT
}

export function getProductSalesUnit(product: Product): string {
  return product.salesUnit || product.unitOfMeasure || "each";
}
```

---

### 7. Add to Cart - Core Implementation

**File**: `packages/renderer/src/features/sales/hooks/use-cart.ts`

**Function**: `addToCart` (Lines 135-370)

**Complete Function Signature**:

```typescript
const addToCart = useCallback(
  async (
    product: Product, // Product to add
    weight?: number, // Weight for weighted items
    customPrice?: number, // Custom price for generic items
    ageVerified: boolean = false, // Age verification status
    sessionOverride?: CartSession | null, // Optional cart session override
    batchData?: {
      // Batch tracking data
      batchId: string;
      batchNumber: string;
      expiryDate: Date;
    } | null,
    scaleReading?: {
      // Scale hardware reading metadata
      weight: number;
      stable: boolean;
    } | null
  ) => {
    // ... implementation
  },
  [cartSession, userRole, activeShift, todaySchedule, initializeCartSession, salesUnitSettings]
);
```

**Step-by-Step Implementation**:

```typescript
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
    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: OPERATIONS CHECK
    // ═══════════════════════════════════════════════════════════════════
    const operationsDisabled = (userRole === "cashier" || userRole === "manager") && !activeShift && todaySchedule;

    if (operationsDisabled) {
      toast.error("Please start your shift before adding items to cart");
      return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: CART SESSION INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════
    let currentSession = sessionOverride !== undefined ? sessionOverride : cartSession;

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

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: PRODUCT TYPE DETERMINATION
    // ═══════════════════════════════════════════════════════════════════
    const isWeighted = isWeightedProduct(product);
    const productSalesUnit = getProductSalesUnit(product);
    const salesUnit = getEffectiveSalesUnit(productSalesUnit, salesUnitSettings);

    // Validate weight for weighted items
    if (isWeighted && (!weight || weight <= 0)) {
      toast.error(`Please enter a weight for ${product.name}. Weighted items require a weight value.`);
      return;
    }

    // Determine item type for database
    const itemType: "UNIT" | "WEIGHT" = isWeighted ? "WEIGHT" : "UNIT";

    logger.info(`🛒 Adding to cart: ${product.name} ${isWeighted && weight ? `(${weight.toFixed(2)} ${salesUnit})` : ""} ${customPrice ? `@ £${customPrice}` : ""}`);

    try {
      // ═══════════════════════════════════════════════════════════════════
      // STEP 4: FETCH LATEST CART ITEMS (Prevent race conditions)
      // ═══════════════════════════════════════════════════════════════════
      const itemsResponse = await window.cartAPI.getItems(currentSession.id);
      const latestCartItems = itemsResponse.success && itemsResponse.data ? (itemsResponse.data as CartItemWithProduct[]) : [];

      // Update state with latest cart items
      if (itemsResponse.success && itemsResponse.data) {
        setCartItems(itemsResponse.data as CartItemWithProduct[]);
      }

      // ═══════════════════════════════════════════════════════════════════
      // STEP 5: PRICE CALCULATION
      // ═══════════════════════════════════════════════════════════════════
      let priceCalculation;
      try {
        priceCalculation = calculateItemPrice(product, weight, customPrice);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Invalid price calculation";
        toast.error(errorMessage);
        return;
      }

      const { unitPrice, totalPrice, taxAmount } = priceCalculation;

      // ═══════════════════════════════════════════════════════════════════
      // STEP 6: CHECK FOR EXISTING ITEM (Update vs New)
      // ═══════════════════════════════════════════════════════════════════
      const existingItem = latestCartItems.find((item) => item.productId === product.id && item.itemType === itemType);

      if (existingItem) {
        // ───────────────────────────────────────────────────────────────
        // SCENARIO A: UPDATE EXISTING ITEM
        // ───────────────────────────────────────────────────────────────

        // Calculate new quantity
        // For both UNIT and WEIGHT items: quantity = number of items (always increments by 1)
        const newQuantity =
          existingItem.itemType === "UNIT"
            ? (existingItem.quantity || 0) + 1
            : existingItem.itemType === "WEIGHT"
            ? (existingItem.quantity || 0) + 1 // Each addition = 1 item
            : existingItem.quantity;

        // Calculate new weight (for weighted items only)
        const newWeight =
          existingItem.itemType === "WEIGHT"
            ? (existingItem.weight || 0) + (weight || 0) // Accumulate weight
            : existingItem.weight;

        // Recalculate totals
        const newSubtotal = existingItem.itemType === "UNIT" ? unitPrice * (newQuantity || 1) : unitPrice * (newWeight || 0); // Price based on total weight

        const newTaxAmount = newSubtotal * (product.taxRate ?? 0.08);
        const finalTotalPrice = newSubtotal + newTaxAmount;

        // Call IPC to update item
        const updateResponse = await window.cartAPI.updateItem(existingItem.id, {
          quantity: newQuantity ?? undefined,
          weight: newWeight ?? undefined,
          totalPrice: finalTotalPrice,
          taxAmount: newTaxAmount,
        });

        if (updateResponse.success) {
          // Reload cart items from database
          const itemsResponse = await window.cartAPI.getItems(currentSession.id);
          if (itemsResponse.success && itemsResponse.data) {
            setCartItems(itemsResponse.data as CartItemWithProduct[]);
          }

          toast.success(`Added ${product.name}${existingItem.itemType === "UNIT" ? ` (${newQuantity}x)` : ` - ${(newWeight || 0).toFixed(2)} ${salesUnit}`}`);
        } else {
          const errorMessage = updateResponse.message || "Failed to update cart item";
          logger.error("Failed to update cart item:", errorMessage);
          toast.error(errorMessage);
        }
      } else {
        // ───────────────────────────────────────────────────────────────
        // SCENARIO B: ADD NEW ITEM
        // ───────────────────────────────────────────────────────────────

        // For weighted items: quantity = 1 (item count), weight = actual weight
        // For unit items: quantity = 1 (unit count)
        const itemQuantity =
          itemType === "UNIT"
            ? 1 // Each addition = 1 unit
            : itemType === "WEIGHT"
            ? 1 // Each addition = 1 item (quantity), weight stored separately
            : undefined;

        // Call IPC to add new item
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
          // Reload cart items from database
          const itemsResponse = await window.cartAPI.getItems(currentSession.id);
          if (itemsResponse.success && itemsResponse.data) {
            setCartItems(itemsResponse.data as CartItemWithProduct[]);
          }

          toast.success(`Added ${product.name}${isWeighted && weight ? ` - ${weight.toFixed(2)} ${salesUnit}` : ""}`);
        } else {
          const errorMessage = addResponse.message || "Failed to add item to cart";
          logger.error("Failed to add item to cart:", errorMessage);
          toast.error(errorMessage);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to add item to cart";
      logger.error("Error adding to cart:", error);
      toast.error(errorMessage);
    }
  },
  [cartSession, userRole, activeShift, todaySchedule, initializeCartSession, salesUnitSettings]
);
```

**Cart Session Initialization** (Lines 60-130):

```typescript
const initializeCartSession = useCallback(async (): Promise<CartSession | null> => {
  if (!businessId || !userId) {
    logger.warn("Cannot initialize cart: missing user data");
    return null;
  }

  // For cashiers/managers, check shift requirement
  if (userRole === "cashier" || userRole === "manager") {
    if (!activeShift) {
      setLoadingCart(false);
      return null; // No shift = no cart
    }
  }

  try {
    setLoadingCart(true);

    // STEP 1: Try to recover existing active session
    const activeSessionResponse = await window.cartAPI.getActiveSession(userId);

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
      // STEP 2: Create new session
      const requiresShift = userRole === "cashier" || userRole === "manager";
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
```

---

## Detailed Component Analysis

### IPC Communication Layer

**Electron IPC (Inter-Process Communication)** enables secure communication between renderer and main processes.

#### Preload API Definition

**File**: `packages/preload/src/api/cart.ts`

```typescript
import { ipcRenderer } from "electron";

export const cartAPI = {
  // ═══════════════════════════════════════════════════════════════════
  // CART SESSION OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  createSession: (sessionData: {
    cashierId: string;
    shiftId?: string | null; // Optional for admin/owner mode
    businessId: string;
    stationId?: string;
  }) => ipcRenderer.invoke("cart:createSession", sessionData),

  getSession: (sessionId: string) => ipcRenderer.invoke("cart:getSession", sessionId),

  getActiveSession: (cashierId: string) => ipcRenderer.invoke("cart:getActiveSession", cashierId),

  updateSession: (
    sessionId: string,
    updates: {
      status?: "ACTIVE" | "COMPLETED" | "CANCELLED";
      totalAmount?: number;
      taxAmount?: number;
      customerAgeVerified?: boolean;
      verificationMethod?: "NONE" | "MANUAL" | "SCAN" | "OVERRIDE";
      verifiedBy?: string;
      completedAt?: Date | string;
    }
  ) => ipcRenderer.invoke("cart:updateSession", sessionId, updates),

  completeSession: (sessionId: string) => ipcRenderer.invoke("cart:completeSession", sessionId),

  cancelSession: (sessionId: string) => ipcRenderer.invoke("cart:cancelSession", sessionId),

  // ═══════════════════════════════════════════════════════════════════
  // CART ITEM OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  addItem: (itemData: {
    cartSessionId: string;
    productId?: string; // Either productId OR categoryId
    categoryId?: string; // Mutually exclusive with productId
    itemName?: string; // For category items or deleted products
    itemType: "UNIT" | "WEIGHT";
    quantity?: number; // Number of items/units
    weight?: number; // Weight value (for weighted items)
    unitOfMeasure?: string;
    unitPrice: number;
    totalPrice: number;
    taxAmount: number;
    batchId?: string;
    batchNumber?: string;
    expiryDate?: Date | string;
    ageRestrictionLevel?: "NONE" | "AGE_16" | "AGE_18" | "AGE_21";
    ageVerified?: boolean;
    scaleReadingWeight?: number;
    scaleReadingStable?: boolean;
  }) => ipcRenderer.invoke("cart:addItem", itemData),

  getItems: (sessionId: string) => ipcRenderer.invoke("cart:getItems", sessionId),

  updateItem: (
    itemId: string,
    updates: {
      quantity?: number;
      weight?: number;
      unitPrice?: number;
      totalPrice?: number;
      taxAmount?: number;
      ageVerified?: boolean;
    }
  ) => ipcRenderer.invoke("cart:updateItem", itemId, updates),

  removeItem: (itemId: string) => ipcRenderer.invoke("cart:removeItem", itemId),

  clearCart: (sessionId: string) => ipcRenderer.invoke("cart:clearCart", sessionId),
};
```

**Context Bridge Exposure** (`packages/preload/src/index.ts`):

```typescript
import { contextBridge } from "electron";
import { cartAPI } from "./api/cart";
import { batchesAPI } from "./api/batches";
import { ageVerificationAPI } from "./api/age-verification";

contextBridge.exposeInMainWorld("cartAPI", cartAPI);
contextBridge.exposeInMainWorld("batchesAPI", batchesAPI);
contextBridge.exposeInMainWorld("ageVerificationAPI", ageVerificationAPI);
```

---

#### IPC Handlers (Main Process)

**File**: `packages/main/src/ipc/cart.handlers.ts`

```typescript
import { ipcMain } from "electron";
import { getDatabase } from "../database/index.js";
import { getLogger } from "../utils/logger.js";

const logger = getLogger("cartHandlers");

export function registerCartHandlers() {
  // ═══════════════════════════════════════════════════════════════════
  // CART SESSION HANDLERS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create new cart session
   * Handler: cart:createSession
   */
  ipcMain.handle("cart:createSession", async (event, sessionData) => {
    try {
      const db = await getDatabase();
      const session = await db.cart.createSession(sessionData);

      return {
        success: true,
        data: JSON.parse(JSON.stringify(session)),
      };
    } catch (error) {
      logger.error("Create cart session IPC error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to create cart session",
      };
    }
  });

  /**
   * Get active cart session for cashier
   * Handler: cart:getActiveSession
   */
  ipcMain.handle("cart:getActiveSession", async (event, cashierId) => {
    try {
      const db = await getDatabase();
      const session = await db.cart.getActiveSession(cashierId);

      return {
        success: true,
        data: session ? JSON.parse(JSON.stringify(session)) : null,
      };
    } catch (error) {
      logger.error("Get active cart session IPC error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to get active cart session",
      };
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // CART ITEM HANDLERS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Add item to cart
   * Handler: cart:addItem
   */
  ipcMain.handle("cart:addItem", async (event, itemData) => {
    try {
      const db = await getDatabase();
      const item = await db.cart.addItem(itemData);

      return {
        success: true,
        data: JSON.parse(JSON.stringify(item)),
      };
    } catch (error) {
      logger.error("Add cart item IPC error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to add cart item",
      };
    }
  });

  /**
   * Get all items for a cart session
   * Handler: cart:getItems
   */
  ipcMain.handle("cart:getItems", async (event, sessionId) => {
    try {
      const db = await getDatabase();
      const items = await db.cart.getItemsBySession(sessionId);

      return {
        success: true,
        data: JSON.parse(JSON.stringify(items)),
      };
    } catch (error) {
      logger.error("Get cart items IPC error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to get cart items",
      };
    }
  });

  /**
   * Update existing cart item
   * Handler: cart:updateItem
   */
  ipcMain.handle("cart:updateItem", async (event, itemId, updates) => {
    try {
      const db = await getDatabase();
      const item = await db.cart.updateItem(itemId, updates);

      return {
        success: true,
        data: JSON.parse(JSON.stringify(item)),
      };
    } catch (error) {
      logger.error("Update cart item IPC error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to update cart item",
      };
    }
  });

  /**
   * Remove item from cart
   * Handler: cart:removeItem
   */
  ipcMain.handle("cart:removeItem", async (event, itemId) => {
    try {
      const db = await getDatabase();
      await db.cart.removeItem(itemId);

      return {
        success: true,
      };
    } catch (error) {
      logger.error("Remove cart item IPC error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to remove cart item",
      };
    }
  });

  /**
   * Clear all items from cart session
   * Handler: cart:clearCart
   */
  ipcMain.handle("cart:clearCart", async (event, sessionId) => {
    try {
      const db = await getDatabase();
      await db.cart.clearCart(sessionId);

      return {
        success: true,
      };
    } catch (error) {
      logger.error("Clear cart IPC error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to clear cart",
      };
    }
  });
}
```

---

### Database Layer

#### Cart Manager

**File**: `packages/main/src/database/managers/cartManager.ts`

```typescript
import type { CartSession, CartItem } from "../schema.js";
import type { DrizzleDB } from "../drizzle.js";
import { eq, and, desc, asc } from "drizzle-orm";
import * as schema from "../schema.js";

export class CartManager {
  private db: DrizzleDB;
  private uuid: any;

  constructor(drizzle: DrizzleDB, uuid: any) {
    this.db = drizzle;
    this.uuid = uuid;
  }

  // ═══════════════════════════════════════════════════════════════════
  // SESSION OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create a new cart session
   */
  async createSession(sessionData: Omit<CartSession, "id" | "createdAt" | "updatedAt" | "status" | "totalAmount" | "taxAmount">): Promise<CartSession> {
    const sessionId = this.uuid.v4();
    const now = new Date();

    await this.db.insert(schema.cartSessions).values({
      id: sessionId,
      cashierId: sessionData.cashierId,
      shiftId: sessionData.shiftId || null,
      businessId: sessionData.businessId,
      terminal_id: sessionData.terminal_id || null,
      status: "ACTIVE",
      totalAmount: 0,
      taxAmount: 0,
      customerAgeVerified: false,
      verificationMethod: "NONE",
      verifiedBy: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    return this.getSessionById(sessionId);
  }

  /**
   * Get cart session by ID
   */
  async getSessionById(sessionId: string): Promise<CartSession> {
    const [session] = await this.db.select().from(schema.cartSessions).where(eq(schema.cartSessions.id, sessionId)).limit(1);

    if (!session) {
      throw new Error("Cart session not found");
    }

    return session as CartSession;
  }

  /**
   * Get active cart session for a cashier
   */
  async getActiveSession(cashierId: string): Promise<CartSession | null> {
    const [session] = await this.db
      .select()
      .from(schema.cartSessions)
      .where(and(eq(schema.cartSessions.cashierId, cashierId), eq(schema.cartSessions.status, "ACTIVE")))
      .orderBy(desc(schema.cartSessions.createdAt))
      .limit(1);

    return (session as CartSession) || null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // ITEM OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Add item to cart
   * Supports both product items (productId) and category items (categoryId)
   */
  async addItem(itemData: Omit<CartItem, "id" | "addedAt" | "updatedAt">): Promise<CartItem> {
    // Validate: at least one of productId or categoryId must be set
    if (!itemData.productId && !itemData.categoryId) {
      throw new Error("Either productId or categoryId must be provided for cart item");
    }

    // Validate: both cannot be set (mutually exclusive)
    if (itemData.productId && itemData.categoryId) {
      throw new Error("Cart item cannot have both productId and categoryId");
    }

    const itemId = this.uuid.v4();
    const now = new Date();

    await this.db.insert(schema.cartItems).values({
      id: itemId,
      cartSessionId: itemData.cartSessionId,
      productId: itemData.productId || null,
      categoryId: itemData.categoryId || null,
      itemName: itemData.itemName || null,
      itemType: itemData.itemType,
      quantity: itemData.quantity || null,
      weight: itemData.weight || null,
      unitOfMeasure: itemData.unitOfMeasure || null,
      unitPrice: itemData.unitPrice,
      totalPrice: itemData.totalPrice,
      taxAmount: itemData.taxAmount,
      batchId: itemData.batchId || null,
      batchNumber: itemData.batchNumber || null,
      expiryDate: itemData.expiryDate || null,
      ageRestrictionLevel: itemData.ageRestrictionLevel || "NONE",
      ageVerified: itemData.ageVerified || false,
      scaleReadingWeight: itemData.scaleReadingWeight || null,
      scaleReadingStable: itemData.scaleReadingStable ?? true,
      addedAt: now,
      updatedAt: now,
    });

    // Recalculate session totals after adding item
    await this.recalculateSessionTotals(itemData.cartSessionId);

    return this.getItemById(itemId);
  }

  /**
   * Get all items for a cart session with product details
   */
  async getItemsBySession(sessionId: string): Promise<CartItem[]> {
    const itemsWithProducts = await this.db
      .select({
        // Cart item fields
        id: schema.cartItems.id,
        cartSessionId: schema.cartItems.cartSessionId,
        productId: schema.cartItems.productId,
        categoryId: schema.cartItems.categoryId,
        itemName: schema.cartItems.itemName,
        itemType: schema.cartItems.itemType,
        quantity: schema.cartItems.quantity,
        weight: schema.cartItems.weight,
        unitOfMeasure: schema.cartItems.unitOfMeasure,
        unitPrice: schema.cartItems.unitPrice,
        totalPrice: schema.cartItems.totalPrice,
        taxAmount: schema.cartItems.taxAmount,
        batchId: schema.cartItems.batchId,
        batchNumber: schema.cartItems.batchNumber,
        expiryDate: schema.cartItems.expiryDate,
        ageRestrictionLevel: schema.cartItems.ageRestrictionLevel,
        ageVerified: schema.cartItems.ageVerified,
        scaleReadingWeight: schema.cartItems.scaleReadingWeight,
        scaleReadingStable: schema.cartItems.scaleReadingStable,
        addedAt: schema.cartItems.addedAt,
        updatedAt: schema.cartItems.updatedAt,
        // Product fields (LEFT JOIN - optional)
        product: schema.products,
      })
      .from(schema.cartItems)
      .leftJoin(schema.products, eq(schema.cartItems.productId, schema.products.id))
      .where(eq(schema.cartItems.cartSessionId, sessionId))
      .orderBy(asc(schema.cartItems.addedAt));

    // Transform to CartItem array with product populated
    return itemsWithProducts.map((item) => ({
      id: item.id,
      cartSessionId: item.cartSessionId,
      productId: item.productId || undefined,
      categoryId: item.categoryId || undefined,
      itemName: item.itemName || undefined,
      itemType: item.itemType as "UNIT" | "WEIGHT",
      quantity: item.quantity || undefined,
      weight: item.weight || undefined,
      unitOfMeasure: item.unitOfMeasure || undefined,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      taxAmount: item.taxAmount,
      batchId: item.batchId || undefined,
      batchNumber: item.batchNumber || undefined,
      expiryDate: item.expiryDate as Date | string | undefined,
      ageRestrictionLevel: (item.ageRestrictionLevel || "NONE") as "NONE" | "AGE_16" | "AGE_18" | "AGE_21",
      ageVerified: Boolean(item.ageVerified),
      scaleReadingWeight: item.scaleReadingWeight || undefined,
      scaleReadingStable: Boolean(item.scaleReadingStable),
      addedAt: item.addedAt as Date | string,
      updatedAt: item.updatedAt as Date | string,
      product: item.product ? (item.product as any) : undefined,
    })) as CartItem[];
  }

  /**
   * Update cart item
   */
  async updateItem(itemId: string, updates: Partial<Omit<CartItem, "id" | "addedAt" | "updatedAt">>): Promise<CartItem> {
    const now = new Date();

    await this.db
      .update(schema.cartItems)
      .set({
        ...updates,
        updatedAt: now,
      })
      .where(eq(schema.cartItems.id, itemId))
      .run();

    // Get the item to find its session
    const item = await this.getItemById(itemId);

    // Recalculate session totals after update
    await this.recalculateSessionTotals(item.cartSessionId);

    return this.getItemById(itemId);
  }

  /**
   * Recalculate session totals from all items
   */
  async recalculateSessionTotals(sessionId: string): Promise<void> {
    const items = await this.getItemsBySession(sessionId);

    const totalAmount = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    const taxAmount = items.reduce((sum, item) => sum + (item.taxAmount || 0), 0);

    await this.db
      .update(schema.cartSessions)
      .set({
        totalAmount,
        taxAmount,
        updatedAt: new Date(),
      })
      .where(eq(schema.cartSessions.id, sessionId))
      .run();
  }
}
```

---

## Database Schema

### Products Table - Product Identifier Fields

**File**: `packages/main/src/database/schema.ts` (lines ~470-490)

The products table includes multiple identifier fields for product lookup:

```typescript
export const products = sqliteTable("products", {
  id: text("id").primaryKey(), // UUID primary key
  name: text("name").notNull(),
  sku: text("sku"), // Stock Keeping Unit - for barcode scan lookup
  barcode: text("barcode"), // EAN/UPC barcode - PRIMARY for scanner lookup
  plu: text("plu"), // Price Look-Up code - for scanner lookup
  productType: text("product_type"), // "UNIT" | "WEIGHT"
  ageRestrictionLevel: text("age_restriction_level"), // "NONE" | "AGE_16" | "AGE_18" | "AGE_21"
  requiresBatchTracking: integer("requires_batch_tracking", { mode: "boolean" }),
  // ... other fields
});
```

#### Product Identifier Usage

| Field     | Purpose                                        | Scanner Priority  | Example                                |
| --------- | ---------------------------------------------- | ----------------- | -------------------------------------- |
| `barcode` | EAN/UPC barcode on physical product            | **1st** (Primary) | "5901234123457"                        |
| `sku`     | Internal stock keeping unit                    | **2nd**           | "SKU-MILK-001"                         |
| `plu`     | Price look-up code (common in weighing scales) | **3rd**           | "4011" (bananas)                       |
| `id`      | System UUID (fallback)                         | **4th**           | "550e8400-e29b-41d4-a716-446655440000" |

---

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
