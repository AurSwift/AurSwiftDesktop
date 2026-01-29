Age restriction is a critical feature for POS systems (alcohol, tobacco, knives, etc.). Let me break down the business logic, workflow, and UI/UX for you.

## Business Logic & Rules

### 1. Age Restriction Configuration

```javascript
// Age restriction levels
const AGE_RESTRICTIONS = {
  NONE: { id: "NONE", minAge: 0, label: "No Restriction", color: "gray" },
  AGE_16: { id: "AGE_16", minAge: 16, label: "16+", color: "blue" },
  AGE_18: { id: "AGE_18", minAge: 18, label: "18+", color: "orange" },
  AGE_21: { id: "AGE_21", minAge: 21, label: "21+", color: "red" },
};

// Product types that typically need restrictions
const RESTRICTED_CATEGORIES = {
  ALCOHOL: "AGE_18",
  TOBACCO: "AGE_18",
  KNIVES: "AGE_18",
  SOLVENTS: "AGE_18",
  FIREWORKS: "AGE_16",
  ENERGY_DRINKS: "AGE_16",
  LOTTERY: "AGE_18",
};
```

### 2. Product Configuration

**For both generic AND weighted items:**

- Age restriction is set at the **product definition level**
- Applies regardless of how the item is sold (by unit or by weight)

```jsx
// Components/Products/AgeRestrictionConfig.jsx
const AgeRestrictionConfig = ({ product, onUpdate }) => {
  return (
    <div className="age-restriction-config">
      <FormSection title="Age Verification">
        <FormSelect
          label="Minimum Age Requirement"
          name="ageRestriction"
          value={product.ageRestriction}
          options={Object.values(AGE_RESTRICTIONS).map((restriction) => ({
            value: restriction.id,
            label: `${restriction.label} ${restriction.minAge > 0 ? `(${restriction.minAge}+)` : ""}`,
            color: restriction.color,
          }))}
          onChange={(value) => onUpdate({ ageRestriction: value })}
        />

        {product.ageRestriction !== "NONE" && (
          <div className="restriction-notes">
            <FormInput
              label="Restriction Reason"
              name="restrictionReason"
              placeholder="e.g., Alcoholic beverage, Tobacco product..."
              value={product.restrictionReason}
              onChange={(value) => onUpdate({ restrictionReason: value })}
            />

            <FormCheckbox label="Require ID scan for verification" name="requireIdScan" checked={product.requireIdScan} onChange={(checked) => onUpdate({ requireIdScan: checked })} />
          </div>
        )}
      </FormSection>
    </div>
  );
};
```

## POS Till Workflow

### 1. Adding Restricted Items to Cart

```jsx
// Components/POS/RestrictedItemHandler.jsx
const RestrictedItemHandler = ({ cartItems, onAgeVerify }) => {
  const restrictedItems = cartItems.filter((item) => item.product.ageRestriction !== "NONE" && !item.ageVerified);

  if (restrictedItems.length === 0) return null;

  return (
    <div className="restricted-items-alert">
      <Alert variant="warning">
        <AlertTitle>Age Verification Required</AlertTitle>
        <AlertDescription>{restrictedItems.length} item(s) require age verification</AlertDescription>
      </Alert>

      <Button onClick={() => onAgeVerify(restrictedItems)} variant="warning" icon="🆔">
        Verify Customer Age
      </Button>
    </div>
  );
};
```

### 2. Age Verification Modal

```jsx
// Components/POS/AgeVerificationModal.jsx
const AgeVerificationModal = ({ items, onVerify, onCancel }) => {
  const [verificationMethod, setVerificationMethod] = useState(null);
  const [customerAge, setCustomerAge] = useState("");
  const [idScanData, setIdScanData] = useState(null);

  const requiredAge = Math.max(...items.map((item) => AGE_RESTRICTIONS[item.product.ageRestriction].minAge));

  const handleVerification = (method, data) => {
    const verificationRecord = {
      method,
      timestamp: new Date(),
      staffId: currentUser.id,
      customerData: data,
      verifiedAge: calculatedAge,
      itemsVerified: items.map((item) => item.id),
    };

    onVerify(verificationRecord);
  };

  return (
    <Modal open={true} onClose={onCancel}>
      <ModalHeader>
        <div className="age-verification-header">
          <div className="warning-icon">🆔</div>
          <h2>Age Verification Required</h2>
        </div>
      </ModalHeader>

      <ModalBody>
        {/* Restricted Items List */}
        <div className="restricted-items-list">
          <h4>Items requiring {requiredAge}+ verification:</h4>
          {items.map((item) => (
            <RestrictedProductCard key={item.id} product={item.product} quantity={item.quantity} />
          ))}
        </div>

        {/* Verification Methods */}
        <div className="verification-methods">
          <Tabs defaultValue="manual">
            <TabList>
              <Tab value="manual">Manual Entry</Tab>
              <Tab value="scan">ID Scan</Tab>
              <Tab value="override">Manager Override</Tab>
            </TabList>

            <TabPanel value="manual">
              <ManualAgeEntry requiredAge={requiredAge} onVerify={(data) => handleVerification("manual", data)} />
            </TabPanel>

            <TabPanel value="scan">
              <IDScanner onScan={(idData) => handleVerification("scan", idData)} requiredAge={requiredAge} />
            </TabPanel>

            <TabPanel value="override">
              <ManagerOverride onOverride={(reason) => handleVerification("override", { reason })} requiredAge={requiredAge} />
            </TabPanel>
          </Tabs>
        </div>
      </ModalBody>
    </Modal>
  );
};
```

### 3. Manual Age Entry Component

```jsx
// Components/POS/ManualAgeEntry.jsx
const ManualAgeEntry = ({ requiredAge, onVerify }) => {
  const [birthDate, setBirthDate] = useState("");
  const [calculatedAge, setCalculatedAge] = useState(null);

  const calculateAge = (dateString) => {
    const birthDate = new Date(dateString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  };

  const handleDateChange = (date) => {
    setBirthDate(date);
    const age = calculateAge(date);
    setCalculatedAge(age);
  };

  const isEligible = calculatedAge >= requiredAge;

  return (
    <div className="manual-age-entry">
      <FormInput label="Customer Date of Birth" type="date" value={birthDate} onChange={handleDateChange} max={new Date().toISOString().split("T")[0]} />

      {calculatedAge !== null && (
        <div className={`age-result ${isEligible ? "eligible" : "ineligible"}`}>
          <div className="age-display">
            <span className="age-number">{calculatedAge}</span>
            <span className="age-label">years old</span>
          </div>
          <div className="verification-status">{isEligible ? <Badge variant="success">Eligible to purchase</Badge> : <Badge variant="error">Below required age</Badge>}</div>
        </div>
      )}

      <Button onClick={() => onVerify({ birthDate, calculatedAge })} disabled={!isEligible} variant={isEligible ? "primary" : "disabled"}>
        Confirm Verification
      </Button>
    </div>
  );
};
```

### 4. Checkout Process Integration

```jsx
// Components/POS/CheckoutWithAgeVerification.jsx
const CheckoutWithAgeVerification = () => {
  const [cart, setCart] = useState([]);
  const [verificationRecords, setVerificationRecords] = useState({});
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [pendingVerificationItems, setPendingVerificationItems] = useState([]);

  const needsVerification = cart.some((item) => item.product.ageRestriction !== "NONE" && !verificationRecords[item.id]);

  const handleCheckout = () => {
    const unverifiedItems = cart.filter((item) => item.product.ageRestriction !== "NONE" && !verificationRecords[item.id]);

    if (unverifiedItems.length > 0) {
      setPendingVerificationItems(unverifiedItems);
      setShowVerificationModal(true);
      return;
    }

    // Proceed with checkout
    processCheckout();
  };

  const handleAgeVerify = (verificationRecord) => {
    const newRecords = { ...verificationRecords };
    pendingVerificationItems.forEach((item) => {
      newRecords[item.id] = verificationRecord;
    });

    setVerificationRecords(newRecords);
    setShowVerificationModal(false);
    setPendingVerificationItems([]);
  };

  return (
    <div className="checkout-container">
      {/* Cart Display */}
      <CartItems items={cart} verificationRecords={verificationRecords} />

      {/* Age Restriction Warning */}
      <RestrictedItemHandler cartItems={cart} onAgeVerify={setPendingVerificationItems} />

      {/* Checkout Button */}
      <CheckoutButton onClick={handleCheckout} disabled={needsVerification} warning={needsVerification ? "Age verification required" : null} />

      {/* Verification Modal */}
      {showVerificationModal && <AgeVerificationModal items={pendingVerificationItems} onVerify={handleAgeVerify} onCancel={() => setShowVerificationModal(false)} />}
    </div>
  );
};
```

## Database Schema Considerations

```sql
-- Products table
ALTER TABLE products ADD COLUMN (
  age_restriction_level ENUM('NONE', 'AGE_16', 'AGE_18', 'AGE_21'),
  require_id_scan BOOLEAN DEFAULT FALSE,
  restriction_reason VARCHAR(255)
);

-- Sales table for audit trail
CREATE TABLE age_verification_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  sale_id BIGINT,
  product_id BIGINT,
  verification_method ENUM('manual', 'scan', 'override'),
  customer_birthdate DATE NULL,
  calculated_age INT,
  staff_id BIGINT,
  manager_id BIGINT NULL,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Compliance & Reporting

```jsx
// Components/Reports/AgeVerificationAudit.jsx
const AgeVerificationAudit = () => {
  return (
    <div className="compliance-reports">
      <ReportSection title="Age Verification Compliance">
        <ComplianceStats totalVerified={1245} passedVerification={1198} failedVerification={47} overrideUsed={23} />

        <VerificationTimeline data={verificationTimelineData} title="Daily Verification Activity" />

        <StaffComplianceReport data={staffComplianceData} title="Staff Verification Performance" />
      </ReportSection>
    </div>
  );
};
```

## Key Business Rules Summary

1. **Same restriction applies** to both generic and weighted items
2. **Restriction checked at checkout** - blocks sale until verified
3. **Multiple verification methods** (manual, ID scan, manager override)
4. **Audit trail** for compliance and reporting
5. **Staff permissions** for overrides
6. **Real-time validation** during POS operations

This system ensures legal compliance while maintaining smooth POS operations for both restricted and non-restricted products.

My database modeling approach is **good but needs some refinements** for clarity and to handle the POS requirements properly. Let me analyze your current structure and suggest improvements:

## Analysis of Current Model

```sql
-- current structure (as I understand it)
categories
├── id
├── name
├── parent_id (for nesting)
└── ...

products
├── id
├── name
├── category_id
├── type (STANDARD, GENERIC, WEIGHTED) -- This is the confusion point
├── price
└── ...
```

## The Problem: **Type Confusion**

`STANDARD, GENERIC, WEIGHTED` types are mixing **two different concepts**:

1. **Product Nature** (how it's sold) → Weighted vs Unit-based
2. **Inventory Method** (how it's tracked) → Batch-tracked vs Simple stock

## Recommended Improved Database Model

```sql
-- Categories for nested navigation (your approach is good)
CREATE TABLE categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_id VARCHAR(50) NULL,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (parent_id) REFERENCES categories(id)
);

-- Products table with clear type separation
CREATE TABLE products (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category_id VARCHAR(50) NOT NULL,

    -- PRODUCT NATURE: How it's sold
    sale_type ENUM('UNIT', 'WEIGHT') NOT NULL DEFAULT 'UNIT',

    -- INVENTORY METHOD: How it's tracked
    inventory_type ENUM('SIMPLE', 'BATCH_TRACKED') NOT NULL DEFAULT 'SIMPLE',

    -- Pricing
    unit_price DECIMAL(10, 2) NULL,        -- For UNIT sale_type
    price_per_unit DECIMAL(10, 2) NULL,    -- For WEIGHT sale_type (per kg/lb)
    unit_of_measure VARCHAR(10) NULL,      -- 'kg', 'g', 'lb', 'oz' for weighted

    -- Age restriction
    age_restriction_level ENUM('NONE', 'AGE_16', 'AGE_18', 'AGE_21') DEFAULT 'NONE',
    require_id_scan BOOLEAN DEFAULT FALSE,

    -- Scale settings (for weighted items)
    tare_weight DECIMAL(8, 3) DEFAULT 0,   -- Container weight
    min_weight DECIMAL(8, 3) DEFAULT 0.001,-- Minimum saleable weight
    max_weight DECIMAL(8, 3) DEFAULT 10,   -- Maximum scale capacity

    -- Common fields
    barcode VARCHAR(100) NULL,
    sku VARCHAR(100) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Batches table (for batch-tracked products only)
CREATE TABLE batches (
    id VARCHAR(50) PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL,
    batch_number VARCHAR(100) NOT NULL,
    expiry_date DATE NULL,
    manufactured_date DATE NULL,
    quantity_received INT NOT NULL,
    current_stock INT NOT NULL,
    cost_price DECIMAL(10, 2) NULL,
    supplier VARCHAR(100) NULL,
    received_date DATE NOT NULL,
    location VARCHAR(100) NULL,
    is_active BOOLEAN DEFAULT TRUE,

    FOREIGN KEY (product_id) REFERENCES products(id),
    INDEX idx_product_expiry (product_id, expiry_date),
    INDEX idx_expiry (expiry_date)
);
```

## Clear Product Type Combinations

With this model, you get **clear combinations**:

| Product Example   | sale_type | inventory_type  | Description                         |
| ----------------- | --------- | --------------- | ----------------------------------- |
| **Coca-Cola Can** | `UNIT`    | `SIMPLE`        | Sold by unit, simple stock count    |
| **Heinz Ketchup** | `UNIT`    | `BATCH_TRACKED` | Sold by unit, expiry batch tracking |
| **Apples**        | `WEIGHT`  | `SIMPLE`        | Sold by weight, no expiry tracking  |
| **Fresh Chicken** | `WEIGHT`  | `BATCH_TRACKED` | Sold by weight, with expiry batches |

## POS Workflow Based on This Model

```typescript
// When product is selected in POS
const handleProductSelection = (product: Product) => {
  // 1. Check if weighted item
  if (product.sale_type === "WEIGHT") {
    return startWeighingProcess(product);
  }

  // 2. For unit items, check expiry if batch-tracked
  if (product.inventory_type === "BATCH_TRACKED") {
    const expiryCheck = checkProductExpiry(product.id);

    if (!expiryCheck.canSell) {
      showExpiryError(expiryCheck);
      return;
    }

    if (expiryCheck.warning) {
      showExpiryWarning(expiryCheck, () => {
        addUnitProductToCart(product, expiryCheck.batch);
      });
      return;
    }

    addUnitProductToCart(product, expiryCheck.batch);
  } else {
    // Simple unit product (no expiry tracking)
    addUnitProductToCart(product, null);
  }
};

// Add to cart functions
const addUnitProductToCart = (product: Product, batch: Batch | null) => {
  const cartItem = {
    id: generateId(),
    product: product,
    quantity: 1,
    unitPrice: product.unit_price,
    totalPrice: product.unit_price,
    saleType: "UNIT",
    batchId: batch?.id || null,
    expiryDate: batch?.expiry_date || null,
  };

  addToCart(cartItem);

  // Update inventory
  if (batch) {
    updateBatchStock(batch.id, -1);
  }
};

const addWeightedProductToCart = (product: Product, weight: number, batch: Batch | null) => {
  const totalPrice = weight * product.price_per_unit;

  const cartItem = {
    id: generateId(),
    product: product,
    weight: weight,
    unit: product.unit_of_measure,
    unitPrice: product.price_per_unit,
    totalPrice: totalPrice,
    saleType: "WEIGHT",
    batchId: batch?.id || null,
    expiryDate: batch?.expiry_date || null,
  };

  addToCart(cartItem);
};
```

## Sample Data for Clarity

```sql
-- Insert categories (nested structure)
INSERT INTO categories (id, name, parent_id, display_order) VALUES
('CAT-GROCERY', 'Grocery', NULL, 1),
('CAT-FRESH', 'Fresh Produce', 'CAT-GROCERY', 1),
('CAT-BEVERAGES', 'Beverages', 'CAT-GROCERY', 2),
('CAT-DAIRY', 'Dairy', 'CAT-GROCERY', 3);

-- Insert products with clear types
INSERT INTO products (id, name, category_id, sale_type, inventory_type, unit_price, price_per_unit, unit_of_measure) VALUES
-- UNIT + SIMPLE: No expiry tracking
('PROD-COKE', 'Coca-Cola 330ml', 'CAT-BEVERAGES', 'UNIT', 'SIMPLE', 1.50, NULL, NULL),

-- UNIT + BATCH_TRACKED: Expiry tracking
('PROD-MILK', 'Fresh Milk 1L', 'CAT-DAIRY', 'UNIT', 'BATCH_TRACKED', 2.99, NULL, NULL),

-- WEIGHT + SIMPLE: No expiry tracking
('PROD-APPLES', 'Fresh Apples', 'CAT-FRESH', 'WEIGHT', 'SIMPLE', NULL, 3.99, 'kg'),

-- WEIGHT + BATCH_TRACKED: Expiry tracking
('PROD-CHICKEN', 'Fresh Chicken Breast', 'CAT-FRESH', 'WEIGHT', 'BATCH_TRACKED', NULL, 12.99, 'kg');

-- Insert batches for batch-tracked products
INSERT INTO batches (id, product_id, batch_number, expiry_date, quantity_received, current_stock, received_date) VALUES
('BATCH-MILK-1', 'PROD-MILK', 'MILK-2024-10A', '2024-10-25', 100, 45, '2024-10-20'),
('BATCH-CHICKEN-1', 'PROD-CHICKEN', 'CHICK-2024-10B', '2024-10-23', 50, 20, '2024-10-21');
```

## Benefits of This Approach

1. **Clear Separation of Concerns**:

   - `sale_type` = How customer buys it
   - `inventory_type` = How you track it

2. **Flexible Combinations**:

   - Weighted items can have expiry tracking (fresh meat) or not (fruits)
   - Unit items can have expiry tracking (dairy) or not (canned goods)

3. **Better POS Logic**:

   - Clear workflow based on product nature
   - Appropriate validations for each type

4. **Scalable**:
   - Easy to add new product types
   - Clear database constraints

## Recommended Changes to Your Current Model

If you want to keep your existing `type` column, you could map it like this:

```sql
-- Migration from your current types to new system
UPDATE products
SET
  sale_type = CASE
    WHEN type IN ('STANDARD', 'GENERIC') THEN 'UNIT'
    WHEN type = 'WEIGHTED' THEN 'WEIGHT'
  END,
  inventory_type = CASE
    WHEN type = 'GENERIC' THEN 'BATCH_TRACKED'
    ELSE 'SIMPLE'
  END;
```

This approach gives you the clarity and flexibility needed for a robust POS system while maintaining your nested category structure for intuitive product browsing.
