## 🔹 Refund Transaction Logic Flow

### 1. **Locate Original Transaction**

- Refunds should always be tied to an **existing transaction ID**.
- Cashier enters/scans transaction number (or selects from recent transactions list).
- System pulls transaction details (items, quantities, payment method, totals).

✅ Prevents fake refunds and ensures reporting accuracy.

---

### 2. **Select Items for Refund**

- Allow cashier to:

  - Refund the **entire transaction**, OR
  - Refund **specific items/quantities**.

- The system recalculates the refund total based on item price + tax.

✅ Flexibility for partial returns.

---

### 3. **Refund Method Validation**

- Refund should default to the **original payment method**:

  - **Cash purchase → Cash refund**.
  - **Card purchase → Card refund (reverse transaction)**.
  - **Mobile wallet → Refund to wallet**.

_(Some businesses allow store credit instead — add as configurable option)._

✅ Keeps accounting clean and avoids misuse.

---

### 4. **Record Refund Transaction**

- Save refund as a **negative transaction** linked to the original:

  - `refund_id` → points to `original_transaction_id`.
  - Store: refunded items, refund amount, cashier ID, timestamp.

- Adjust:

  - **Sales totals** (decrease).
  - **Cash drawer balance** (if cash refund).
  - **Shift performance stats**.
  - **Adjustments summary** (increase refund count/total).

✅ This ensures sales and drawer reports are accurate.

---

### 5. **Update Inventory**

- If items are physically returned:

  - **Increment stock** back into inventory.

- If not returnable (e.g., food, perishables):

  - Configure system to skip stock re-entry.

✅ Prevents stock mismatches.

---

### 6. **Print / Provide Refund Receipt**

- Print or email a **refund receipt**:

  - Shows refunded items, total refund amount, original transaction ID, and refund method.

- Helps customer trust and provides audit trail.

---

## 🔹 Edge Case Rules

- **Time limit**: Restrict refunds after X days (configurable, e.g., 30 days).
- **Manager approval**: Require supervisor PIN/role override for refunds over a certain amount.
- **Refund reason**: Always log a reason (damaged item, wrong size, customer dissatisfaction, etc.).

---

## ✅ Example Flow in Quick Actions

1. Click **Process Refund**.
2. Enter/select original transaction.
3. Choose full or partial refund.
4. System calculates refund total.
5. Confirm → refund recorded + stock adjusted.
6. Update reports (sales, cash drawer, adjustments).
7. Print refund receipt.

---

👉 This approach makes refunds:

- **Traceable** (linked to original sale).
- **Accurate** (adjusts sales, drawer, and stock).
- **Secure** (manager approvals & reasons logged).
- **Simple for cashier** (guided step-by-step).
