**Need of Cart Items table!** This is crucial for a proper POS system. Let me explain why and show you the complete database structure.

## Why You Need Separate Cart & Cart Items Tables

### The Problem Without Cart Items Table:

```typescript
// What happens if you only have a Sales table:
const problematicSale = {
  saleId: "SALE-001",
  customerId: null,
  total: 48.92,
  items: [
    // ❌ This becomes unstructured data nightmare
    "2x Milk @ 2.99, 1x Apples @ 3.99/kg (0.5kg), 1x Coke @ 1.50...",
  ],
  // ❌ Can't track individual item details
  // ❌ Can't handle returns properly
  // ❌ No batch tracking per item
  // ❌ No audit trail
};
```

## Complete POS Database Structure

### 1. Core Tables Structure

```sql
-- Session management (active carts)
CREATE TABLE cart_sessions (
    id VARCHAR(50) PRIMARY KEY,
    cashier_id VARCHAR(50) NOT NULL,
    station_id VARCHAR(50) NOT NULL,
    status ENUM('ACTIVE', 'COMPLETED', 'CANCELLED') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    total_amount DECIMAL(10, 2) DEFAULT 0,
    tax_amount DECIMAL(10, 2) DEFAULT 0,

    -- For age verification tracking
    customer_age_verified BOOLEAN DEFAULT FALSE,
    verification_method ENUM('NONE', 'MANUAL', 'SCAN', 'OVERRIDE') DEFAULT 'NONE',
    verified_by VARCHAR(50) NULL,

    INDEX idx_active_sessions (status, cashier_id),
    INDEX idx_created (created_at)
);

-- Cart items table (THE CRITICAL TABLE)
CREATE TABLE cart_items (
    id VARCHAR(50) PRIMARY KEY,
    cart_session_id VARCHAR(50) NOT NULL,
    product_id VARCHAR(50) NOT NULL,

    -- Item type and quantity
    item_type ENUM('UNIT', 'WEIGHT') NOT NULL,
    quantity INT NULL,                    -- For UNIT items
    weight DECIMAL(8, 3) NULL,           -- For WEIGHT items (kg)
    unit_of_measure VARCHAR(10) NULL,    -- 'kg', 'g', 'lb'

    -- Pricing
    unit_price DECIMAL(10, 2) NOT NULL,  -- Price per unit/kg
    total_price DECIMAL(10, 2) NOT NULL, -- Calculated total
    tax_amount DECIMAL(10, 2) NOT NULL,

    -- Batch tracking (for expiry)
    batch_id VARCHAR(50) NULL,
    batch_number VARCHAR(100) NULL,
    expiry_date DATE NULL,

    -- Age restriction tracking
    age_restriction_level ENUM('NONE', 'AGE_16', 'AGE_18', 'AGE_21') DEFAULT 'NONE',
    age_verified BOOLEAN DEFAULT FALSE,

    -- Scale data (for weighted items audit)
    scale_reading_weight DECIMAL(8, 3) NULL,
    scale_reading_stable BOOLEAN DEFAULT TRUE,

    -- Timestamps
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (cart_session_id) REFERENCES cart_sessions(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (batch_id) REFERENCES batches(id),

    INDEX idx_cart_session (cart_session_id),
    INDEX idx_product (product_id),
    INDEX idx_batch (batch_id)
);

-- Final sales table (after payment)
CREATE TABLE sales (
    id VARCHAR(50) PRIMARY KEY,
    cart_session_id VARCHAR(50) NOT NULL,
    cashier_id VARCHAR(50) NOT NULL,
    station_id VARCHAR(50) NOT NULL,

    -- Payment info
    total_amount DECIMAL(10, 2) NOT NULL,
    tax_amount DECIMAL(10, 2) NOT NULL,
    payment_method ENUM('CASH', 'CARD', 'MOBILE', 'MIXED') NOT NULL,
    payment_reference VARCHAR(100) NULL,
    tendered_amount DECIMAL(10, 2) NOT NULL,
    change_amount DECIMAL(10, 2) NOT NULL,

    -- Customer info
    customer_age_verified BOOLEAN DEFAULT FALSE,
    verification_method ENUM('NONE', 'MANUAL', 'SCAN', 'OVERRIDE') DEFAULT 'NONE',
    verified_by VARCHAR(50) NULL,

    sale_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (cart_session_id) REFERENCES cart_sessions(id)
);

-- Sale items table (copy from cart_items for permanent record)
CREATE TABLE sale_items (
    id VARCHAR(50) PRIMARY KEY,
    sale_id VARCHAR(50) NOT NULL,
    product_id VARCHAR(50) NOT NULL,

    -- Copy of cart item data
    item_type ENUM('UNIT', 'WEIGHT') NOT NULL,
    quantity INT NULL,
    weight DECIMAL(8, 3) NULL,
    unit_of_measure VARCHAR(10) NULL,

    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    tax_amount DECIMAL(10, 2) NOT NULL,

    -- Batch info (for recalls/audits)
    batch_id VARCHAR(50) NULL,
    batch_number VARCHAR(100) NULL,
    expiry_date DATE NULL,

    -- Age restriction info
    age_restriction_level ENUM('NONE', 'AGE_16', 'AGE_18', 'AGE_21') DEFAULT 'NONE',
    age_verified BOOLEAN DEFAULT FALSE,

    FOREIGN KEY (sale_id) REFERENCES sales(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (batch_id) REFERENCES batches(id)
);
```

## Real-World Data Examples

### Scenario: Customer Buys Mixed Items

```sql
-- 1. Create cart session
INSERT INTO cart_sessions (id, cashier_id, station_id)
VALUES ('CART-2024-001', 'cashier-123', 'POS-01');

-- 2. Add generic item (Milk) - UNIT type
INSERT INTO cart_items (
    id, cart_session_id, product_id, item_type, quantity,
    unit_price, total_price, tax_amount, batch_id, expiry_date
) VALUES (
    'ITEM-001', 'CART-2024-001', 'PROD-MILK-1L', 'UNIT', 2,
    2.99, 5.98, 0.60, 'BATCH-MILK-001', '2024-10-25'
);

-- 3. Add weighted item (Apples) - WEIGHT type
INSERT INTO cart_items (
    id, cart_session_id, product_id, item_type, weight, unit_of_measure,
    unit_price, total_price, tax_amount, scale_reading_weight
) VALUES (
    'ITEM-002', 'CART-2024-001', 'PROD-APPLES', 'WEIGHT', 1.5, 'kg',
    3.99, 5.99, 0.60, 1.5
);

-- 4. Add age-restricted item (Beer)
INSERT INTO cart_items (
    id, cart_session_id, product_id, item_type, quantity,
    unit_price, total_price, tax_amount, age_restriction_level, age_verified
) VALUES (
    'ITEM-003', 'CART-2024-001', 'PROD-BEER-500ML', 'UNIT', 1,
    4.99, 4.99, 1.00, 'AGE_18', TRUE
);
```

## Frontend State Management with Cart Items

### React State Structure

```tsx
// POS Till State Management
const [posState, setPosState] = useState({
  // Active session
  currentSession: {
    id: 'CART-2024-001',
    cashierId: 'cashier-123',
    status: 'ACTIVE',
    createdAt: '2024-01-15T10:00:00Z'
  },

  // Cart items array
  cartItems: [
    {
      id: 'ITEM-001',
      product: { id: 'PROD-MILK-1L', name: 'Fresh Milk 1L', ... },
      itemType: 'UNIT',
      quantity: 2,
      unitPrice: 2.99,
      totalPrice: 5.98,
      batchId: 'BATCH-MILK-001',
      expiryDate: '2024-10-25'
    },
    {
      id: 'ITEM-002',
      product: { id: 'PROD-APPLES', name: 'Fresh Apples', ... },
      itemType: 'WEIGHT',
      weight: 1.5,
      unitOfMeasure: 'kg',
      unitPrice: 3.99,
      totalPrice: 5.99,
      scaleReading: { weight: 1.5, stable: true }
    }
  ],

  // UI state
  uiState: 'PRODUCT_SELECTION'
});
```

### Cart Management Functions

```tsx
// Add item to cart function
const addItemToCart = async (product, itemData) => {
  const cartItem = {
    id: generateId(),
    cart_session_id: currentSession.id,
    product_id: product.id,
    ...itemData,
    added_at: new Date(),
  };

  // 1. Save to database
  const savedItem = await api.cartItems.create(cartItem);

  // 2. Update local state
  setPosState((prev) => ({
    ...prev,
    cartItems: [...prev.cartItems, savedItem],
  }));

  // 3. Update cart totals
  updateCartTotals();
};

// Update quantity function
const updateCartItemQuantity = async (itemId, newQuantity) => {
  // 1. Update database
  await api.cartItems.update(itemId, { quantity: newQuantity });

  // 2. Update local state
  setPosState((prev) => ({
    ...prev,
    cartItems: prev.cartItems.map((item) => (item.id === itemId ? { ...item, quantity: newQuantity, totalPrice: newQuantity * item.unitPrice } : item)),
  }));
};

// Remove item function
const removeCartItem = async (itemId) => {
  // 1. Remove from database
  await api.cartItems.delete(itemId);

  // 2. Update local state
  setPosState((prev) => ({
    ...prev,
    cartItems: prev.cartItems.filter((item) => item.id !== itemId),
  }));
};
```

## Why This Structure is Essential

### 1. **Handle Complex Scenarios**

```tsx
// Partial returns
const handleReturn = (saleId, itemsToReturn) => {
  // Can identify exactly which items to return
  itemsToReturn.forEach((item) => {
    const saleItem = getSaleItem(saleId, item.cartItemId);
    processRefund(saleItem);
  });
};

// Batch recalls
const handleBatchRecall = (batchId) => {
  // Find all sales containing recalled batch
  const affectedSales = getSalesByBatch(batchId);
  notifyCustomers(affectedSales);
};
```

### 2. **Advanced Reporting**

```sql
-- Sales by product type
SELECT
    item_type,
    COUNT(*) as transaction_count,
    SUM(total_price) as total_revenue
FROM sale_items
GROUP BY item_type;

-- Expiry performance
SELECT
    p.name,
    COUNT(*) as items_sold,
    AVG(DATEDIFF(si.sale_timestamp, si.expiry_date)) as days_before_expiry
FROM sale_items si
JOIN products p ON si.product_id = p.id
WHERE si.expiry_date IS NOT NULL
GROUP BY p.id;

-- Age verification compliance
SELECT
    age_restriction_level,
    COUNT(*) as total_sales,
    SUM(age_verified = TRUE) as verified_sales,
    (SUM(age_verified = TRUE) / COUNT(*)) * 100 as compliance_rate
FROM sale_items
WHERE age_restriction_level != 'NONE'
GROUP BY age_restriction_level;
```

### 3. **Cart Persistence & Recovery**

```tsx
// If POS crashes, recover cart
const recoverCartSession = async (sessionId) => {
  const session = await api.cartSessions.get(sessionId);
  const items = await api.cartItems.getBySession(sessionId);

  setPosState({
    currentSession: session,
    cartItems: items,
    uiState: "CART_REVIEW",
  });
};

// Continue where left off
<Button onClick={() => recoverCartSession("CART-2024-001")}>Continue Previous Sale</Button>;
```

## Key Benefits of Cart Items Table

1. **✅ Complete Audit Trail** - Every item change is tracked
2. **✅ Accurate Inventory Updates** - Batch stock decremented correctly
3. **✅ Flexible Cart Operations** - Edit quantities, remove items, hold carts
4. **✅ Returns & Refunds** - Process partial returns accurately
5. **✅ Advanced Analytics** - Detailed sales reporting
6. **✅ Crash Recovery** - Don't lose sales if system crashes
7. **✅ Multi-station Support** - Multiple cashiers can work simultaneously

**Bottom Line:** Yes, you absolutely need a `cart_items` table. It's the heart of your POS system that enables all the advanced features like expiry tracking, batch management, age verification, and proper inventory control.
