# Discount System Documentation

## Overview

The discount system provides comprehensive promotional and discount capabilities for the AuraSwift POS system. It supports multiple discount types, flexible applicability rules, time-based restrictions, and usage tracking.

## Features

### Discount Types

1. **Percentage Discount**

   - Reduces item/transaction price by a percentage (0-100%)
   - Example: 20% off

2. **Fixed Amount Discount**

   - Reduces price by a fixed dollar amount
   - Example: $5 off

3. **Buy X Get Y Discount**
   - Buy a certain quantity, get additional items with discount
   - Example: Buy 2, Get 1 Free
   - Supports: Free, Percentage off, or Fixed amount off on the Y items

### Applicability

Discounts can be applied to:

- **All Products** - Store-wide discount
- **Specific Categories** - Discount on all products in selected categories
- **Specific Products** - Discount on individual products
- **Entire Transaction** - Applied to the transaction total

### Conditions and Restrictions

1. **Minimum Requirements**

   - Minimum purchase amount
   - Minimum quantity required

2. **Maximum Limits**

   - Maximum discount amount (cap)
   - Total usage limit
   - Per-customer usage limit

3. **Time-Based Restrictions**

   - Start and end dates
   - Specific days of week (e.g., weekend only)
   - Time ranges (e.g., 9 AM - 5 PM)

4. **Coupon Codes**

   - Require coupon code for activation
   - Unique codes per discount

5. **Priority System**
   - Higher priority discounts applied first
   - Configurable combination rules

## Database Schema

### Discounts Table

```sql
CREATE TABLE discounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed_amount', 'buy_x_get_y')),
  value REAL NOT NULL,
  businessId TEXT NOT NULL,

  -- Applicability
  applicableTo TEXT NOT NULL CHECK (applicableTo IN ('all', 'category', 'product', 'transaction')),
  categoryIds TEXT,  -- JSON array
  productIds TEXT,   -- JSON array

  -- Buy X Get Y specifics
  buyQuantity INTEGER,
  getQuantity INTEGER,
  getDiscountType TEXT CHECK (getDiscountType IN ('free', 'percentage', 'fixed')),
  getDiscountValue REAL,

  -- Conditions
  minPurchaseAmount REAL,
  minQuantity INTEGER,
  maxDiscountAmount REAL,

  -- Validity
  startDate TEXT,
  endDate TEXT,
  isActive BOOLEAN DEFAULT 1,

  -- Usage tracking
  usageLimit INTEGER,
  usageCount INTEGER DEFAULT 0,
  perCustomerLimit INTEGER,

  -- Priority
  priority INTEGER DEFAULT 0,

  -- Time restrictions
  daysOfWeek TEXT,  -- JSON array [0-6]
  timeStart TEXT,   -- HH:MM format
  timeEnd TEXT,     -- HH:MM format

  -- Coupon
  requiresCouponCode BOOLEAN DEFAULT 0,
  couponCode TEXT,

  -- Combination
  combinableWithOthers BOOLEAN DEFAULT 1,

  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  createdBy TEXT NOT NULL,

  FOREIGN KEY (businessId) REFERENCES businesses (id),
  FOREIGN KEY (createdBy) REFERENCES users (id)
)
```

### Updated Transaction Schema

```typescript
interface Transaction {
  // ... existing fields
  discountAmount?: number;
  appliedDiscounts?: AppliedDiscount[];
}

interface TransactionItem {
  // ... existing fields
  discountAmount?: number;
  appliedDiscounts?: AppliedDiscount[];
}

interface AppliedDiscount {
  discountId: string;
  discountName: string;
  discountType: "percentage" | "fixed_amount" | "buy_x_get_y";
  discountValue: number;
  discountAmount: number;
  appliedTo: "transaction" | "item";
  itemId?: string;
}
```

## API Usage

### Creating a Discount

```typescript
import { DiscountManager } from "./database/managers/discountManager";

const discountManager = new DiscountManager(db);

// Create a percentage discount
const discount = discountManager.createDiscount({
  name: "Summer Sale",
  description: "20% off all products",
  type: "percentage",
  value: 20,
  businessId: "business-123",
  applicableTo: "all",
  isActive: true,
  priority: 10,
  startDate: "2024-06-01T00:00:00Z",
  endDate: "2024-08-31T23:59:59Z",
  combinableWithOthers: false,
  createdBy: "user-123",
});
```

### Creating a Buy X Get Y Discount

```typescript
// Buy 2, Get 1 Free
const bxgyDiscount = discountManager.createDiscount({
  name: "Buy 2 Get 1 Free",
  type: "buy_x_get_y",
  value: 0, // Not used for BXGY
  businessId: "business-123",
  applicableTo: "product",
  productIds: ["product-123"],
  buyQuantity: 2,
  getQuantity: 1,
  getDiscountType: "free",
  getDiscountValue: 100, // 100% off
  isActive: true,
  priority: 5,
  combinableWithOthers: true,
  createdBy: "user-123",
});
```

### Category-Specific Discount

```typescript
// 15% off specific categories
const categoryDiscount = discountManager.createDiscount({
  name: "Electronics Sale",
  type: "percentage",
  value: 15,
  businessId: "business-123",
  applicableTo: "category",
  categoryIds: ["electronics", "computers"],
  minPurchaseAmount: 50, // Minimum $50 purchase
  maxDiscountAmount: 100, // Max $100 off
  isActive: true,
  priority: 8,
  combinableWithOthers: true,
  createdBy: "user-123",
});
```

### Time-Based Discount

```typescript
// Happy hour discount - weekdays 3-6 PM
const happyHour = discountManager.createDiscount({
  name: "Happy Hour",
  type: "fixed_amount",
  value: 10,
  businessId: "business-123",
  applicableTo: "all",
  daysOfWeek: [1, 2, 3, 4, 5], // Monday-Friday
  timeStart: "15:00",
  timeEnd: "18:00",
  isActive: true,
  priority: 7,
  combinableWithOthers: true,
  createdBy: "user-123",
});
```

### Coupon Code Discount

```typescript
// Coupon code discount
const couponDiscount = discountManager.createDiscount({
  name: "New Customer Discount",
  type: "percentage",
  value: 25,
  businessId: "business-123",
  applicableTo: "all",
  requiresCouponCode: true,
  couponCode: "WELCOME25",
  perCustomerLimit: 1, // One use per customer
  usageLimit: 100, // Total 100 uses
  isActive: true,
  priority: 15,
  combinableWithOthers: false,
  createdBy: "user-123",
});
```

### Retrieving Discounts

```typescript
// Get all discounts for a business
const allDiscounts = discountManager.getDiscountsByBusiness("business-123");

// Get only active discounts
const activeDiscounts = discountManager.getActiveDiscounts("business-123");

// Get applicable discounts for a product
const productDiscounts = discountManager.getApplicableDiscountsForProduct("business-123", "product-123", "category-123");

// Validate coupon code
const coupon = discountManager.validateCouponCode("business-123", "WELCOME25");
if (coupon) {
  console.log("Valid coupon:", coupon.name);
}
```

### Calculating Discounts

```typescript
// Calculate discount for an item
const itemDiscount = discountManager.calculateItemDiscount({ unitPrice: 100, quantity: 2 }, discount);
console.log("Item discount:", itemDiscount); // e.g., 40 for 20% off $200

// Calculate discount for entire transaction
const transactionDiscount = discountManager.calculateTransactionDiscount(
  500, // subtotal
  discount
);
console.log("Transaction discount:", transactionDiscount);
```

### Updating Discounts

```typescript
// Update discount
discountManager.updateDiscount("discount-123", {
  isActive: false,
  endDate: "2024-12-31T23:59:59Z",
});

// Increment usage count (call when discount is applied)
discountManager.incrementUsageCount("discount-123");
```

### Deleting Discounts

```typescript
discountManager.deleteDiscount("discount-123");
```

## Discount Application Flow

### 1. During Checkout

When items are added to the transaction:

```typescript
// Get applicable discounts for each item
const applicableDiscounts = discountManager.getApplicableDiscountsForProduct(businessId, product.id, product.category);

// Sort by priority and apply highest priority discount(s)
const sortedDiscounts = applicableDiscounts.sort((a, b) => b.priority - a.priority);

// Calculate and apply discounts
for (const discount of sortedDiscounts) {
  if (!discount.combinableWithOthers && appliedDiscounts.length > 0) {
    break; // Only one non-combinable discount
  }

  const discountAmount = discountManager.calculateItemDiscount(item, discount);

  // Add to applied discounts
  appliedDiscounts.push({
    discountId: discount.id,
    discountName: discount.name,
    discountType: discount.type,
    discountValue: discount.value,
    discountAmount: discountAmount,
    appliedTo: "item",
    itemId: item.id,
  });

  // Increment usage count
  discountManager.incrementUsageCount(discount.id);
}
```

### 2. Transaction-Level Discounts

Apply after all items are added:

```typescript
// Get transaction-level discounts
const transactionDiscounts = activeDiscounts.filter((d) => d.applicableTo === "transaction");

for (const discount of transactionDiscounts) {
  // Check minimum purchase requirement
  if (discount.minPurchaseAmount && subtotal < discount.minPurchaseAmount) {
    continue;
  }

  const discountAmount = discountManager.calculateTransactionDiscount(subtotal, discount);

  appliedDiscounts.push({
    discountId: discount.id,
    discountName: discount.name,
    discountType: discount.type,
    discountValue: discount.value,
    discountAmount: discountAmount,
    appliedTo: "transaction",
  });

  discountManager.incrementUsageCount(discount.id);
}
```

### 3. Storing Applied Discounts

```typescript
// When creating transaction
const transaction = {
  // ... other fields
  discountAmount: totalDiscountAmount,
  appliedDiscounts: JSON.stringify(appliedDiscounts),
};

// When creating transaction items
const transactionItem = {
  // ... other fields
  discountAmount: itemDiscountAmount,
  appliedDiscounts: JSON.stringify(itemAppliedDiscounts),
};
```

## Best Practices

1. **Priority System**

   - Assign higher priorities to more important discounts
   - Non-combinable discounts should have high priority

2. **Usage Limits**

   - Set appropriate usage limits to control costs
   - Track per-customer usage for loyalty programs

3. **Time Restrictions**

   - Use time restrictions for peak/off-peak pricing
   - Implement happy hour or lunch specials

4. **Testing**

   - Test discount combinations thoroughly
   - Verify max discount caps work correctly
   - Test edge cases (expired, usage limit reached, etc.)

5. **Performance**

   - Use indexes on frequently queried fields
   - Cache active discounts in memory if needed
   - Limit number of simultaneously active discounts

6. **Auditing**
   - Log all discount applications
   - Track discount effectiveness (ROI)
   - Monitor for discount abuse

## Integration Points

### Frontend Integration

Create UI components for:

- Discount management (create, edit, delete)
- Discount list view with filters
- Coupon code input during checkout
- Applied discounts display on receipt

### Receipt Printing

Display discounts on receipts:

```
Item: Widget                   $100.00
  - Summer Sale (20% off)      -$20.00
                               -------
Subtotal                       $80.00
Tax                            $8.00
                               -------
Total                          $88.00
```

### Reporting

Track:

- Discount usage statistics
- Revenue impact
- Most popular discounts
- Discount abuse patterns

## Future Enhancements

1. **Customer-Specific Discounts**

   - Loyalty program tiers
   - Birthday discounts
   - Customer segments

2. **Advanced Rules Engine**

   - Complex conditions (AND/OR logic)
   - Exclude specific products/categories
   - Quantity tiers (10% off 5+, 20% off 10+)

3. **Automatic Discounts**

   - Cart total thresholds
   - Bundle deals
   - Cross-sell discounts

4. **Discount Analytics**

   - A/B testing
   - Conversion rate tracking
   - Revenue attribution

5. **Integration**
   - Import discounts from e-commerce platforms
   - Sync with loyalty systems
   - API for third-party discount providers

## Troubleshooting

### Discount Not Applying

1. Check if discount is active
2. Verify date/time restrictions
3. Check usage limits
4. Verify product/category applicability
5. Check minimum purchase requirements

### Multiple Discounts Conflict

1. Review priority settings
2. Check `combinableWithOthers` flag
3. Verify discount logic in application code

### Performance Issues

1. Add indexes if missing
2. Limit number of active discounts
3. Cache frequently accessed discounts
4. Optimize discount query logic

## Support

For questions or issues with the discount system, please:

1. Check this documentation
2. Review code examples
3. Contact the development team
