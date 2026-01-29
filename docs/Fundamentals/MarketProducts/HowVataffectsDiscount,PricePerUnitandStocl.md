Here is a **clean, POS-friendly breakdown** of **how VAT affects stock, discounts, and price-per-unit** in a small grocery or corner-shop POS system like PayPoint or any retail till.

---

# 🏷️ 1. **How VAT affects STOCK**

**VAT has _no effect_ on stock levels.**

Stock changes are based ONLY on **quantity sold or received**, not VAT.

### Example:

- You sell **1 cauliflower**
- Whether VAT is **0% or 20%**, stock reduces by **1**

### Why?

VAT is a **tax on the sale**, not on the product quantity.

### So:

✔ Stock decreases only by quantity sold
✔ VAT doesn’t change how stock is recorded
✔ Same stock logic for zero-rated, reduced-rate, or standard-rate items

**Conclusion:** Stock = purely inventory logic, independent of VAT.

---

# 💸 2. **How VAT affects DISCOUNTS**

VAT **changes automatically** when a discount is applied because the taxable amount changes.

There are two common discount types:

---

## **A. Line-item discount** (discount on a specific product)

VAT is applied **after** discount.

### Example:

- Chocolate bar: **£1.20** (VAT included @ 20%)
- 10% discount → New price = **£1.08**

VAT calculation:

```
VAT = £1.08 × (20/120) ≈ £0.18
```

Before discount VAT = £0.20
After discount VAT = **£0.18**

So VAT automatically reduces when the taxable value reduces.

---

## **B. Receipt-level discount** (Apply £1 off total)

POS must **split** the discount across the items proportionally to recalc VAT correctly.

Example:

| Item  | Gross | VAT Rate |
| ----- | ----- | -------- |
| Milk  | £1.00 | 0%       |
| Drink | £2.40 | 20%      |

Total = £3.40
Discount = £1.00

The POS allocates:

- Portion of discount to milk (0% VAT)
- Portion to drink (20% VAT)

Then VAT reduces only on the **drink’s portion of discount**.

---

# 🧮 3. **How VAT affects Price Per Unit**

## Important:

**Price per unit DOES NOT include VAT internally in the database**
…unless your POS uses VAT-inclusive pricing (most grocery/till systems do).

But system behaviour depends on the pricing model:

---

# 🔄 **Pricing Models**

## **A. VAT-Inclusive Pricing** _(Most retail POS, including PayPoint)_

Your `pricePerUnit` already includes VAT.

Example:

- Chocolate pricePerUnit = £1.20
- VAT (20%) inside that is **£0.20**

The POS extracts VAT from the price using the inclusive formula.

**Price shown to customer never changes**, VAT is calculated internally.

---

## **B. VAT-Exclusive Pricing** _(Wholesale, B2B systems)_

Your `pricePerUnit` is BEFORE VAT.

Example:

- pricePerUnit = £1.00
- VAT = £0.20
- Gross = £1.20

### How system behaves:

- Stock uses net price for cost analysis
- Customer pays gross
- VAT summary uses VAT portion (20p)

---

# 🔎 VAT & Price Per Unit Summary Table

| Concept                | VAT Inclusive        | VAT Exclusive  |
| ---------------------- | -------------------- | -------------- |
| Price stored in DB     | Includes VAT         | Excludes VAT   |
| Customer sees          | Same as DB           | DB price + VAT |
| VAT calculation        | Extracted from price | Added to price |
| Discount affects VAT?  | YES                  | YES            |
| Stock affected by VAT? | NO                   | NO             |

---

# 🧰 Practical POS Examples

### Example 1: Weighted Items (fruits, veg)

- Customer buys 0.750 kg tomatoes
- price per kg = £2.00 (0% VAT)
- Gross = £1.50
- VAT = **£0**
- Stock reduces by weight (0.75 kg)
- Discount reduces price only, VAT unaffected

---

### Example 2: Regular Item (chocolate)

- pricePerUnit = £1.20
- VAT 20% = £0.20
- Stock reduces by 1
- Discount reduces gross, VAT recalculated
- pricePerUnit vanishes VAT at reporting stage only, not in DB

---

# 🧾 **Final Simplified Summary**

### **VAT does NOT affect stock.**

Stock changes only by quantity sold/received.

### **VAT does affect discounts.**

Any discount must reduce the VAT portion for taxable items.

### **VAT affects how you calculate price per unit.**

Only depending on whether your system stores prices as VAT-inclusive or VAT-exclusive.

---

If you want, I can also explain:

- How VAT influences profit/margin calculations
- How VAT categories should be stored in DB schema
- How VAT appears on receipt formatting (PayPoint style)
- VAT handling for weighed items vs generic items

Just tell me!
