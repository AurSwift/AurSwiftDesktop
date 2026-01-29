# Cart Total Calculation Analysis

## Overview

This document provides a comprehensive analysis of how totals are calculated in the cart table for the AuraSwift POS system.

---

## Calculation Flow Architecture

### 1. **Individual Item Price Calculation** (`calculateItemPrice`)

**Location:** `packages/renderer/src/views/dashboard/pages/cashier/views/new-transaction/utils/price-calculations.ts`

#### For Weighted Products (WEIGHT items):

```typescript
// Step 1: Determine unit price
unitPrice = pricePerKg ?? basePrice; // Uses pricePerKg if available, otherwise basePrice

// Step 2: Calculate subtotal
subtotal = unitPrice * weight; // Price per unit × weight in kg

// Step 3: Calculate tax
taxAmount = subtotal * taxRate; // Default tax rate: 8% (0.08)

// Step 4: Calculate total price
totalPrice = subtotal + taxAmount;
```

**Example:**

- Product: Apples
- `pricePerKg`: £2.50
- Weight: 1.5 kg
- Tax Rate: 8%
- Calculation:
  - `subtotal = £2.50 × 1.5 = £3.75`
  - `taxAmount = £3.75 × 0.08 = £0.30`
  - `totalPrice = £3.75 + £0.30 = £4.05`

#### For Unit Products (UNIT items):

```typescript
// Step 1: Determine unit price
unitPrice = customPrice ?? basePrice; // Uses customPrice if provided, otherwise basePrice

// Step 2: Calculate subtotal
subtotal = unitPrice * 1; // Always quantity 1 per addition

// Step 3: Calculate tax
taxAmount = subtotal * taxRate;

// Step 4: Calculate total price
totalPrice = subtotal + taxAmount;
```

**Example:**

- Product: Chocolate Bar
- `basePrice`: £1.50
- Quantity: 1
- Tax Rate: 8%
- Calculation:
  - `subtotal = £1.50 × 1 = £1.50`
  - `taxAmount = £1.50 × 0.08 = £0.12`
  - `totalPrice = £1.50 + £0.12 = £1.62`

---

### 2. **Adding Items to Cart** (`addToCart`)

**Location:** `packages/renderer/src/views/dashboard/pages/cashier/views/new-transaction/hooks/use-cart.ts`

#### New Item Addition:

```typescript
// Calculate item price using calculateItemPrice()
const { unitPrice, totalPrice, taxAmount } = calculateItemPrice(product, weight, customPrice);

// Store in cart item:
{
  unitPrice: unitPrice,        // Price per unit/kg
  totalPrice: totalPrice,       // Subtotal + Tax (for this item)
  taxAmount: taxAmount,         // Tax for this item
  weight: weight,               // For WEIGHT items
  quantity: 1,                  // For UNIT items (always 1 per addition)
  unitOfMeasure: salesUnit      // Effective sales unit (from settings)
}
```

#### Updating Existing Item:

When the same product is added again:

**For UNIT items:**

```typescript
newQuantity = existingQuantity + 1;
newSubtotal = unitPrice * newQuantity;
newTaxAmount = newSubtotal * taxRate;
finalTotalPrice = newSubtotal + newTaxAmount;
```

**For WEIGHT items:**

```typescript
newQuantity = existingQuantity + 1; // Item count increments
newWeight = existingWeight + newWeight; // Weight accumulates
newSubtotal = unitPrice * newWeight; // Price based on total weight
newTaxAmount = newSubtotal * taxRate;
finalTotalPrice = newSubtotal + newTaxAmount;
```

**Important Note:** For weighted items, `quantity` represents the number of items added (for batch tracking), while `weight` represents the total weight (for pricing).

---

### 3. **Cart Totals Calculation** (`calculateCartTotals`)

**Location:** `packages/renderer/src/views/dashboard/pages/cashier/views/new-transaction/utils/price-calculations.ts`

```typescript
export function calculateCartTotals(items: CartItemWithProduct[]): {
  subtotal: number;
  tax: number;
  total: number;
} {
  // Calculate true subtotal (before tax) by extracting tax from each item's totalPrice
  // Note: item.totalPrice already includes tax (itemSubtotal + itemTaxAmount),
  // so we need to extract the true subtotal by subtracting taxAmount
  const subtotal = items.reduce((sum, item) => {
    const itemSubtotal = item.totalPrice - (item.taxAmount || 0);
    return sum + itemSubtotal;
  }, 0);

  // Sum all item tax amounts
  const tax = items.reduce((sum, item) => sum + (item.taxAmount || 0), 0);

  // Total is subtotal + tax
  const total = subtotal + tax;

  return { subtotal, tax, total };
}
```

**Calculation Logic:**

- **Subtotal:** Sum of all item subtotals (before tax) = Σ(item.totalPrice - item.taxAmount)
- **Tax:** Sum of all item tax amounts = Σ(item.taxAmount)
- **Total:** Subtotal + Tax = (Sum of item subtotals) + (Sum of item taxes)

---

### 4. **Cart Display Components**

#### Cart Item Row (`cart-item-row.tsx`)

Displays individual item:

- **Unit/Weight Column:** Shows `weight` with `unitOfMeasure` for WEIGHT items, or `quantity` for UNIT items
- **Price Column:** Shows `unitPrice` with `unitOfMeasure` for WEIGHT items
- **Total Column:** Shows `totalPrice` (item subtotal + item tax)

#### Cart Summary (`cart-summary.tsx`)

Displays cart totals:

- **Subtotal:** Sum of all item subtotals (before tax) - correctly extracted
- **Tax:** Sum of all item taxes with weighted average tax rate display
- **Total:** Subtotal + Tax (correctly calculated)

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User Adds Product to Cart                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. calculateItemPrice(product, weight, customPrice)         │
│    ├─ For WEIGHT: unitPrice = pricePerKg × weight          │
│    ├─ For UNIT: unitPrice = basePrice × quantity            │
│    ├─ taxAmount = subtotal × taxRate                       │
│    └─ totalPrice = subtotal + taxAmount                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Store in Cart Item                                       │
│    ├─ unitPrice: Price per unit/kg                         │
│    ├─ totalPrice: Item subtotal + item tax                 │
│    ├─ taxAmount: Tax for this item                         │
│    ├─ weight: Weight in kg (for WEIGHT items)              │
│    └─ quantity: Item count (for UNIT items)                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. calculateCartTotals(cartItems)                          │
│    ├─ subtotal = Σ(item.totalPrice - item.taxAmount)       │
│    ├─ tax = Σ(item.taxAmount)                                │
│    └─ total = subtotal + tax                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Display in Cart Table                                    │
│    ├─ Individual items show item.totalPrice                 │
│    └─ Summary shows cart subtotal, tax, and total           │
└─────────────────────────────────────────────────────────────┘
```

---

## Sales Unit Settings Impact

The sales unit settings (Fixed vs Varying) **do NOT directly affect** the total calculation, but they affect:

1. **Display:** The `unitOfMeasure` shown in the cart (e.g., "KG", "GRAM", "LITRE")
2. **User Experience:** Which unit is displayed when entering weight
3. **Data Storage:** The `unitOfMeasure` field stored in cart items

**However:** The actual price calculation uses the weight value (in kg internally) regardless of the displayed unit. The unit is purely for display purposes.

---

## Total Amount Calculation

### How Total Amount is Calculated

The total amount displayed in the cart is calculated through a multi-step process:

#### Step 1: Individual Item Totals

Each cart item has its own `totalPrice` which is calculated as:

```
item.totalPrice = itemSubtotal + itemTaxAmount
```

Where:

- **For WEIGHT items:** `itemSubtotal = unitPrice × weight`
- **For UNIT items:** `itemSubtotal = unitPrice × quantity`
- **itemTaxAmount:** `itemSubtotal × taxRate`

#### Step 2: Cart Subtotal Calculation

The cart subtotal is the sum of all item subtotals (before tax):

```typescript
subtotal = Σ(item.totalPrice - item.taxAmount);
```

This extracts the true subtotal by removing tax from each item's total price.

#### Step 3: Cart Tax Calculation

The cart tax is the sum of all item tax amounts:

```typescript
tax = Σ(item.taxAmount);
```

#### Step 4: Cart Total Calculation

The final cart total is calculated as:

```typescript
total = subtotal + tax;
```

**Formula Breakdown:**

```
total = Σ(item.totalPrice - item.taxAmount) + Σ(item.taxAmount)
     = Σ(item.totalPrice - item.taxAmount + item.taxAmount)
     = Σ(item.totalPrice)
```

This ensures that:

- Subtotal represents the sum of all item prices before tax
- Tax represents the sum of all taxes
- Total represents the final amount the customer pays

### Tax Rate Display

The cart summary displays a weighted average tax rate calculated as:

```typescript
effectiveTaxRate = (totalTax / subtotal) × 100
```

This provides an accurate representation of the overall tax rate when items have different tax rates.

**Example:**

- If cart has items with 8% and 10% tax rates
- The displayed rate will be a weighted average (e.g., "Tax (8.5%)")
- This reflects the actual effective tax rate across all items

---

## Example Calculation Walkthrough

### Scenario: Cart with 3 items

**Item 1: Apples (WEIGHT)**

- `pricePerKg`: £2.50
- `weight`: 1.5 kg
- `taxRate`: 8%
- Calculation:
  - `subtotal = £2.50 × 1.5 = £3.75`
  - `taxAmount = £3.75 × 0.08 = £0.30`
  - `totalPrice = £3.75 + £0.30 = £4.05`

**Item 2: Chocolate Bar (UNIT)**

- `basePrice`: £1.50
- `quantity`: 2
- `taxRate`: 8%
- Calculation (per item):
  - `subtotal = £1.50 × 1 = £1.50`
  - `taxAmount = £1.50 × 0.08 = £0.12`
  - `totalPrice = £1.50 + £0.12 = £1.62`
- Total for 2 items:
  - `subtotal = £1.50 × 2 = £3.00`
  - `taxAmount = £0.12 × 2 = £0.24`
  - `totalPrice = £1.62 × 2 = £3.24`

**Item 3: Milk (WEIGHT)**

- `pricePerKg`: £1.20
- `weight`: 2.0 kg
- `taxRate`: 8%
- Calculation:
  - `subtotal = £1.20 × 2.0 = £2.40`
  - `taxAmount = £2.40 × 0.08 = £0.19`
  - `totalPrice = £2.40 + £0.19 = £2.59`

### ✅ Fixed Calculation (Current Implementation):

```
subtotal = (£3.75 + £3.00 + £2.40) = £9.15  (before tax - correctly extracted)
tax = £0.30 + £0.24 + £0.19 = £0.73
total = £9.15 + £0.73 = £9.88
```

### Calculation Verification:

The total can be verified by summing all item totalPrices directly:

```
total = £4.05 + £3.24 + £2.59 = £9.88
```

This matches the calculated total: `£9.15 (subtotal) + £0.73 (tax) = £9.88`

---

## Summary

### Calculation Accuracy

1. **Individual Item Calculation:** ✅ Correct

   - Properly calculates subtotal, tax, and total per item
   - Handles both WEIGHT and UNIT items correctly
   - Formula: `item.totalPrice = itemSubtotal + itemTaxAmount`

2. **Cart Totals Calculation:** ✅ Correct

   - Extracts true subtotal from `item.totalPrice - item.taxAmount`
   - Properly sums taxes without double counting
   - Formula: `total = subtotal + tax = Σ(item.totalPrice)`
   - Includes null safety checks for `taxAmount`

3. **Cart Summary Display:** ✅ Correct

   - Calculates and displays weighted average tax rate dynamically
   - Shows actual effective tax rate (e.g., "Tax (8.2%)")
   - Handles edge cases (empty cart, zero subtotal)
   - Uses `useMemo` for performance optimization

4. **Sales Unit Settings:** ✅ Correctly Implemented
   - Affects display only, not calculation
   - Properly uses effective sales unit from settings
   - Weight values are stored in kg internally regardless of display unit

### Implementation Quality

- ✅ Proper null safety with `|| 0` fallbacks
- ✅ Clear documentation explaining the calculation logic
- ✅ Performance optimization with `useMemo` for tax rate calculation
- ✅ Type safety maintained throughout
- ✅ Edge case handling (empty cart, zero values)
- ✅ Consistent calculation across all cart operations
