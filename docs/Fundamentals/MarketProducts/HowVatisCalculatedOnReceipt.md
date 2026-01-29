Here’s a **clear, POS-friendly explanation** of how VAT is calculated on receipts (like in PayPoint, Clover, Square, EPOS, etc.).

---

# 🧾 **How VAT is Calculated on Receipts (Step-by-Step)**

A receipt generally shows:

- Item price **inclusive** of VAT (for customer display)
- VAT breakdown per VAT category (for accounting)

VAT is calculated at either **inclusive** or **exclusive** price.

---

# ✅ **1. VAT Inclusive Pricing (Most UK POS)**

Retail product prices already include VAT.

### Formula:

If price **includes** VAT:

```
VAT Amount = Price × (VAT Rate / (1 + VAT Rate))
Net Price = Price - VAT Amount
```

### Example (Standard VAT 20%):

A chocolate bar priced at **£1.20** (customer sees this price)

```
VAT Amount = 1.20 × (0.20 / 1.20)
           = 1.20 × 0.166666...
           ≈ £0.20
Net Price = 1.20 - 0.20
          = £1.00
```

So on the receipt, the VAT summary would show:

| VAT Rate | Net  | VAT  | Gross |
| -------- | ---- | ---- | ----- |
| 20%      | 1.00 | 0.20 | 1.20  |

---

# ✅ **2. VAT Exclusive Pricing (Some wholesale / trade POS)**

If the price **does not** include VAT:

```
VAT Amount = Price × VAT Rate
Gross Price = Price + VAT Amount
```

Example:

- Net price = £1.00
- VAT @ 20% = £0.20
- Gross = £1.20

---

# 🧮 **3. Mixed VAT Receipt Example (Common in grocery stores)**

Customer buys:

| Product    | Price | VAT Rate |
| ---------- | ----- | -------- |
| Milk       | £1.00 | 0%       |
| Bread      | £1.50 | 0%       |
| Chocolate  | £1.20 | 20%      |
| Soft Drink | £2.40 | 20%      |

### VAT Breakdown:

**Zero-rated items (0%)**
No VAT added.

**Standard (20%)**
Calculate VAT from price:

- Chocolate VAT:
  `1.20 × 0.1666 = 0.20`
- Soft drink VAT:
  `2.40 × 0.1666 = 0.40`

### Receipt summary:

| VAT Category | Net  | VAT  | Gross |
| ------------ | ---- | ---- | ----- |
| 0%           | 2.50 | 0.00 | 2.50  |
| 20%          | 3.00 | 0.60 | 3.60  |
| **Total**    | 5.50 | 0.60 | 6.10  |

---

# 🏷️ **4. Why receipts show VAT summary separately**

- Retail law requires VAT transparency
- Accounting systems need to report VAT per category
- Cashiers shouldn’t manually calculate VAT

---

# 🖥️ **5. How your POS (backend DB) stores VAT data**

Typically you have:

### VAT Category Table:

```ts
vatCategory: {
  id: 1,
  name: "Standard 20%",
  rate: 0.20
}
```

### Product Table:

Each product references a VAT category:

```ts
product.vatCategoryId = 1;
```

The POS uses this to calculate:

- Net
- VAT
- Gross
- VAT summary totals

---

# 🔍 **6. Important: VAT is NOT stored in the barcode**

Barcodes only identify the product.
VAT % comes from your product database.

---

If you want, I can also explain:

- How VAT calculation interacts with discounts
- How VAT is grouped in DB modelling
- How PayPoint or EPOS systems format VAT on receipts
