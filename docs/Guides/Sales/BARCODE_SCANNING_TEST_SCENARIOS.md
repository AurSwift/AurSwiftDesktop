# Barcode Scanning Test Scenarios for New Transaction View

## Overview

This document describes the test scenarios for barcode scanning functionality in the `new-transaction-view`. When a cashier scans an item with a barcode scanner, the product should go through the same validation and processing flow as manually selecting an item from the product panel.

## Integration Architecture

### How It Works

1. **Barcode Scanner Input**: Hardware barcode scanner sends keyboard events (via USB HID keyboard emulation)
2. **Event Capture**: `useProductionScanner` hook captures keyboard events and accumulates barcode string
3. **Product Lookup**: When barcode is complete, `useBarcodeScanner` hook looks up product by:
   - Product ID
   - SKU code
   - PLU code
   - Barcode field
4. **Product Processing**: Found product is passed to `handleProductClick`, which handles:
   - Age verification (if required)
   - Weight input (for weighted products)
   - Scale integration (for weighted products with scale)
   - Batch selection (if batch tracking required)
   - Generic price input (for generic items)
5. **Cart Addition**: Product is added to cart only after all required steps are completed

### Key Integration Points

- **`useBarcodeScanner` hook**: Located in `packages/renderer/src/features/sales/hooks/use-barcode-scanner.ts`
- **`handleProductClick` function**: Located in `packages/renderer/src/features/sales/views/new-transaction-view.tsx`
- **Backend lookup**: Product lookup by SKU/barcode is done client-side from loaded products list

---

## Test Scenarios

### Scenario 1: Standard Product (No Restrictions)

**Product Type**: STANDARD product
**Requirements**: None (no age verification, no batch tracking, not weighted)

**Test Steps**:

1. Cashier scans barcode for a standard product (e.g., "CANDY001")
2. System looks up product by barcode/SKU
3. Product is found and `handleProductClick` is called
4. Product is directly added to cart (no modals shown)
5. Product appears in cart session table
6. Success toast notification is shown
7. Scanner audio feedback plays (success sound)

**Expected Result**:

- Product immediately added to cart
- No modals or interruptions
- Cart total updates correctly
- Product visible in cart items list

**Validation Points**:

- [ ] Product lookup works correctly (SKU, barcode, PLU)
- [ ] No age verification modal appears
- [ ] No batch selection modal appears
- [ ] No scale display appears
- [ ] Product added to cart successfully
- [ ] Cart total updates correctly
- [ ] Success audio feedback plays

---

### Scenario 2: Weighted Product (Requires Weight Input)

**Product Type**: WEIGHTED product
**Requirements**: Weight must be entered before adding to cart

**Test Steps**:

1. Cashier scans barcode for a weighted product (e.g., "FRUIT001")
2. System looks up product by barcode/SKU
3. Product is found and `handleProductClick` is called
4. **Scale Display appears** (if scale connected) OR **Weight Input Display appears** (manual entry)
5. Cashier enters weight (via scale or manual keypad entry)
6. After weight confirmation, product is added to cart
7. Product appears in cart with weight value

**Expected Result**:

- Scale display or weight input appears after scan
- Weight must be entered before cart addition
- Product added with correct weight value
- Cart item shows weight and calculated price

**Validation Points**:

- [ ] Scale display appears for weighted products
- [ ] Manual weight input works as fallback
- [ ] Weight cannot be 0 or negative
- [ ] Product added with correct weight
- [ ] Price calculated correctly (weight × pricePerKg)
- [ ] Cart item displays weight correctly

---

### Scenario 3: Age-Restricted Product (No Batch Tracking)

**Product Type**: STANDARD or WEIGHTED product
**Requirements**: Age verification required (AGE_16, AGE_18, or AGE_21)

**Test Steps**:

1. Cashier scans barcode for age-restricted product (e.g., "BEER001")
2. System looks up product by barcode/SKU
3. Product is found and `handleProductClick` is called
4. **Age Verification Modal appears**
5. Cashier verifies customer age (manual entry or ID scan)
6. After successful verification, product processing continues:
   - If weighted: Scale display appears
   - If not weighted: Product added directly to cart
7. Product appears in cart with age verification flag

**Expected Result**:

- Age verification modal appears immediately after scan
- Product cannot be added without age verification
- Age verification audit record is created
- Product added after verification completes

**Validation Points**:

- [ ] Age verification modal appears
- [ ] Cannot bypass age verification
- [ ] Age verification audit record created in backend
- [ ] If verification fails/cancelled, product not added
- [ ] After verification, flow continues correctly (weight input or direct add)

---

### Scenario 4: Weighted + Age-Restricted Product

**Product Type**: WEIGHTED product with age restriction
**Requirements**: Both age verification AND weight input required

**Test Steps**:

1. Cashier scans barcode for weighted age-restricted product (e.g., "ALCOHOL001")
2. System looks up product by barcode/SKU
3. Product is found and `handleProductClick` is called
4. **Age Verification Modal appears FIRST** (before scale)
5. Cashier completes age verification
6. After age verification, **Scale Display appears**
7. Cashier enters weight (via scale or manual)
8. After weight confirmation, product is added to cart
9. Product appears in cart with both age verification and weight

**Expected Result**:

- Age verification shown first (before scale)
- After age verification, scale display appears
- Both steps must complete before cart addition
- Product added with age verification flag and weight

**Validation Points**:

- [ ] Age verification appears BEFORE scale display
- [ ] Scale display only appears after age verification completes
- [ ] If age verification cancelled, scale display does not appear
- [ ] Product added with both age verification and weight
- [ ] Age verification audit record created

---

### Scenario 5: Product with Batch Tracking (No Age Restriction)

**Product Type**: STANDARD or WEIGHTED product
**Requirements**: Batch tracking (expiry date management)

**Test Steps**:

1. Cashier scans barcode for product with batch tracking (e.g., "DAIRY001")
2. System looks up product by barcode/SKU
3. Product is found and `handleProductClick` is called
4. System attempts **auto-batch selection** (FEFO - First Expired First Out)
5. If batch available:
   - Product added directly with selected batch
   - No modal shown (seamless)
6. If multiple batches available or auto-selection fails:
   - **Batch Selection Modal appears**
   - Cashier selects batch manually
7. Product added to cart with batch information (batch ID, batch number, expiry date)

**Expected Result**:

- Batch automatically selected if possible (FEFO)
- Batch selection modal appears only if needed
- Product added with batch information
- Batch quantity deducted when transaction completes

**Validation Points**:

- [ ] Auto-batch selection attempts FEFO logic
- [ ] Batch selection modal appears when needed
- [ ] Product added with correct batch information
- [ ] Batch quantity check prevents overselling

---

### Scenario 6: Product with Batch Tracking + Age Restriction

**Product Type**: STANDARD or WEIGHTED product
**Requirements**: Both batch tracking AND age verification

**Test Steps**:

1. Cashier scans barcode for product (e.g., "TOBACCO001")
2. System looks up product by barcode/SKU
3. Product is found and `handleProductClick` is called
4. System attempts **auto-batch selection** first
5. **Age Verification Modal appears** (after batch selection or during modal if batch selection needed)
6. Cashier completes age verification
7. If batch selection modal was needed, it appears after age verification
8. Product added to cart with both batch and age verification

**Expected Result**:

- Batch selection happens first (auto or manual)
- Age verification appears at appropriate point
- Both requirements satisfied before cart addition
- Product added with batch and age verification flags

**Validation Points**:

- [ ] Batch selection happens (auto or manual)
- [ ] Age verification appears appropriately
- [ ] Product added with both batch and age verification
- [ ] Correct order of modals (batch → age verification)

---

### Scenario 7: Generic Item (Price Required)

**Product Type**: GENERIC product (isGenericButton = true)
**Requirements**: Cashier must enter price manually

**Test Steps**:

1. Cashier scans barcode for generic item (if barcode exists) OR selects generic item manually
2. System looks up product OR generic item is selected
3. **Generic Item Price Modal appears**
4. Cashier enters price for the generic item
5. After price confirmation, product is added to cart with custom price
6. Product appears in cart with entered price

**Expected Result**:

- Generic price modal appears
- Price must be entered manually
- Product added with custom price
- Price is validated (not 0 or negative)

**Validation Points**:

- [ ] Generic price modal appears
- [ ] Price input validated (positive number)
- [ ] Product added with custom price
- [ ] Cart total updates correctly

**Note**: Generic items typically don't have barcodes, but this scenario tests the flow if they do.

---

### Scenario 8: Product Not Found

**Test Steps**:

1. Cashier scans invalid/unknown barcode (e.g., "INVALID123")
2. System attempts product lookup by barcode/SKU
3. No product found
4. Error toast notification: "Product not found: INVALID123"
5. Scanner error audio feedback plays
6. No product added to cart
7. Scanner status shows error

**Expected Result**:

- Error message displayed
- Error audio feedback
- No product added to cart
- Scanner ready for next scan

**Validation Points**:

- [ ] Error message shows scanned barcode
- [ ] Error audio feedback plays
- [ ] Cart remains unchanged
- [ ] Scanner recovers and ready for next scan

---

### Scenario 9: Weighted Product - Two-Step Scan (Weight Entry)

**Product Type**: WEIGHTED product
**Requirements**: Weight must be entered

**Test Steps**:

1. Cashier scans barcode for weighted product (e.g., "PRODUCE001")
2. System looks up product
3. Product found, but weight not provided yet
4. **Weight Input Display appears** with warning: "⚖️ Weight required for [Product Name]. Enter weight in [UNIT] and scan again."
5. Cashier enters weight on keypad (e.g., "1.25" kg)
6. Cashier scans the SAME barcode again OR presses Enter
7. System recognizes this is the same product with weight now provided
8. Product is added to cart with entered weight

**Expected Result**:

- First scan: Weight input prompt appears
- Weight can be entered via keypad
- Second scan or Enter: Product added with weight
- Two-step process works smoothly

**Validation Points**:

- [ ] First scan shows weight input prompt
- [ ] Weight can be entered via numeric keypad
- [ ] Second scan of same product adds to cart with weight
- [ ] Weight input is cleared after cart addition

---

### Scenario 10: Batch Selection Required (Multiple Batches Available)

**Product Type**: Product with batch tracking
**Requirements**: Multiple batches available, manual selection needed

**Test Steps**:

1. Cashier scans barcode for product with batch tracking
2. System looks up product
3. Auto-batch selection fails (multiple batches or no clear FEFO winner)
4. **Batch Selection Modal appears**
5. Cashier views available batches with:
   - Batch numbers
   - Expiry dates
   - Available quantities
6. Cashier selects batch manually
7. If age verification required, it appears after batch selection
8. Product added to cart with selected batch

**Expected Result**:

- Batch selection modal appears when needed
- Cashier can view and select from available batches
- Selected batch information stored correctly
- Product added with selected batch

**Validation Points**:

- [ ] Batch selection modal shows all available batches
- [ ] Batch information displayed correctly (number, expiry, quantity)
- [ ] Manual selection works
- [ ] Selected batch stored in cart item

---

## Backend Product Lookup

### Lookup Fields

The product lookup in `useBarcodeScanner` searches by:

1. **Product ID** (`product.id === barcode`)
2. **SKU** (`product.sku === barcode`)
3. **PLU** (`product.plu === barcode`)
4. **Barcode** (case-insensitive match)

### Lookup Logic

```typescript
const product = products.find((p) => p.id === barcode || p.sku === barcode || p.plu === barcode || p.sku.toLowerCase() === barcode.toLowerCase());
```

**Note**: The lookup is done client-side from the loaded products list. Products are loaded via `useProducts` hook which calls `window.productAPI.getByBusiness(businessId)`.

---

## Flow Comparison: Manual vs Barcode Scan

### Manual Selection Flow

1. Cashier clicks product from left panel
2. `handleProductClick(product)` called
3. Validation checks:
   - Age verification?
   - Weight required?
   - Batch tracking?
   - Generic price?
4. Modals/inputs shown as needed
5. Product added to cart

### Barcode Scan Flow

1. Cashier scans barcode
2. `useBarcodeScanner` looks up product
3. `handleProductClick(product)` called (SAME FUNCTION)
4. Validation checks (SAME LOGIC):
   - Age verification?
   - Weight required?
   - Batch tracking?
   - Generic price?
5. Modals/inputs shown as needed (SAME MODALS)
6. Product added to cart (SAME LOGIC)

**Key Point**: Both flows use the **exact same** `handleProductClick` function, ensuring identical behavior and validation.

---

## Edge Cases to Test

1. **Rapid Scans**: Multiple barcodes scanned quickly in succession
2. **Invalid Barcode Format**: Barcodes that don't match expected format
3. **Product Deactivated**: Scanning product that exists but is inactive
4. **No Active Shift**: Scanning when shift not started (cashier mode)
5. **Cart Session Expired**: Scanning when cart session is invalid
6. **Weighted Product with Scale Disconnected**: Fallback to manual entry
7. **Age Verification Cancelled**: User cancels age verification modal
8. **Batch Selection Cancelled**: User cancels batch selection modal
9. **Concurrent Scans**: Multiple products scanned while modal is open
10. **Keyboard Input During Scan**: Typing in input fields during barcode scan

---

## Test Data Setup

### Test Products Needed

1. **Standard Product**: No restrictions (e.g., "TEST_STD_001")
2. **Weighted Product**: Requires weight (e.g., "TEST_WGT_001")
3. **Age-Restricted Product**: AGE_18 (e.g., "TEST_AGE_001")
4. **Weighted + Age-Restricted**: Both requirements (e.g., "TEST_WGT_AGE_001")
5. **Batch Tracked Product**: Requires batch selection (e.g., "TEST_BATCH_001")
6. **Batch + Age-Restricted**: Both (e.g., "TEST_BATCH_AGE_001")
7. **Generic Item**: Requires price input (e.g., "TEST_GENERIC_001")

### Test Barcodes

Assign barcodes/SKUs to test products:

- `TEST_STD_001` → Standard product
- `TEST_WGT_001` → Weighted product
- `TEST_AGE_001` → Age-restricted product
- `TEST_WGT_AGE_001` → Weighted + age-restricted
- `TEST_BATCH_001` → Batch tracked product
- `TEST_BATCH_AGE_001` → Batch + age-restricted
- `TEST_GENERIC_001` → Generic item

---

## Integration Verification Checklist

### Code Integration

- [x] `useBarcodeScanner` hook imported in `new-transaction-view.tsx`
- [x] `useBarcodeScanner` hook initialized with correct props
- [x] `onProductFound` callback connected to `handleProductClick`
- [x] Weight input handlers connected
- [x] Category price input handlers connected

### Flow Verification

- [ ] Standard products add directly to cart
- [ ] Weighted products show scale/weight input
- [ ] Age-restricted products show age verification modal
- [ ] Batch-tracked products handle batch selection
- [ ] Generic items show price input modal
- [ ] All validation flows work identically to manual selection

### Error Handling

- [ ] Invalid barcodes show error message
- [ ] Product not found shows error
- [ ] Scanner recovers after errors
- [ ] Audio feedback works (success/error)

---

## Implementation Notes

### Integration Completed

The barcode scanner has been integrated into `new-transaction-view.tsx`:

```typescript
// Barcode scanner hook - handles keyboard events from barcode scanner
// This integrates with handleProductClick to ensure scanned products go through
// the same validation flow (age verification, scale, batch selection) as manual selection
useBarcodeScanner({
  products: products.products,
  businessId: user?.businessId,
  onProductFound: handleProductClick, // <-- Key integration point
  selectedWeightProduct: weightInput.selectedWeightProduct,
  weightInput: weightInput.weightInput,
  weightDisplayPrice: weightInput.weightDisplayPrice,
  onSetSelectedWeightProduct: weightInput.setSelectedWeightProduct,
  onSetWeightInput: weightInput.setWeightInput,
  onSetWeightDisplayPrice: weightInput.setWeightDisplayPrice,
  onClearCategorySelection: categoryPriceInput.resetPriceInput,
  audioEnabled: true,
});
```

### Key Benefits

1. **Single Source of Truth**: Both manual and barcode selection use `handleProductClick`
2. **Consistent Validation**: All products go through same validation regardless of input method
3. **No Code Duplication**: Validation logic exists in one place
4. **Easy to Maintain**: Changes to validation flow automatically apply to both methods

---

## Testing Instructions

1. **Setup Test Products**: Create test products with various requirements (age, batch, weight, etc.)
2. **Configure Barcodes**: Assign SKU/barcode values to test products
3. **Test Each Scenario**: Go through each test scenario above
4. **Verify Behavior**: Confirm behavior matches manual selection
5. **Check Edge Cases**: Test edge cases listed above
6. **Validate Integration**: Use integration checklist to verify all components work

---

## Troubleshooting

### Issue: Barcode scan doesn't trigger product lookup

- **Check**: Is `useBarcodeScanner` hook initialized?
- **Check**: Are keyboard events being captured? (Check browser console)
- **Check**: Is barcode scanner in USB HID keyboard mode?

### Issue: Product found but validation flow doesn't work

- **Check**: Is `onProductFound` connected to `handleProductClick`?
- **Check**: Are all required props passed to `useBarcodeScanner`?
- **Check**: Does manual selection work for same product?

### Issue: Age verification doesn't appear for age-restricted products

- **Check**: Product has `ageRestrictionLevel` set correctly
- **Check**: `handleProductClick` receives correct product data
- **Check**: Age verification modal state management

### Issue: Weight input doesn't appear for weighted products

- **Check**: Product has `productType === "WEIGHTED"`
- **Check**: `isWeightedProduct()` utility function working
- **Check**: Weight input hook state management

---

## Related Files

- `packages/renderer/src/features/sales/views/new-transaction-view.tsx` - Main view component
- `packages/renderer/src/features/sales/hooks/use-barcode-scanner.ts` - Barcode scanner hook
- `packages/renderer/src/services/hardware/scanner/hooks/use-production-scanner.ts` - Low-level scanner hook
- `packages/renderer/src/features/sales/utils/product-helpers.ts` - Product utility functions

---

**Document Version**: 1.0  
**Last Updated**: [Current Date]  
**Author**: AI Assistant  
**Status**: Ready for Testing
