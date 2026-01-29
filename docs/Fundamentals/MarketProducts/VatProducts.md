**VAT products** are simply **products that are subject to Value Added Tax** in a country’s taxation system.
Different countries have different VAT rules, but the core idea is the same:

### ✅ **What are VAT products?**

These are items on which the government charges VAT at **a specific rate**.
Examples (typical UK-style categories, also similar globally):

| VAT Category                  | Example Products                                                           | Description                                   |
| ----------------------------- | -------------------------------------------------------------------------- | --------------------------------------------- |
| **Standard rate (e.g., 20%)** | Alcohol, soft drinks, confectionery, snacks, electronics, toiletries       | Most goods fall here.                         |
| **Reduced rate (e.g., 5%)**   | Baby car seats, sanitary products                                          | Lower government tax to make them accessible. |
| **Zero-rated (0%)**           | Most groceries (bread, milk, vegetables, meat), children's clothing, books | You charge VAT at 0% but still record it.     |
| **VAT-exempt**                | Stamps, gambling, some financial services                                  | Completely outside VAT; no VAT recorded.      |

---

## ❓ **How do we differentiate VAT products?**

You separate them by **VAT category**, not by product type alone.

### POS System View

In a POS like PayPoint, **every product must have a VAT category assigned**:

- Standard (20%)
- Reduced (5%)
- Zero rated (0%)
- Exempt (no VAT)

Your product database often has:

```ts
vatCategoryId: number;
```

This links to a VAT category table.

---

## 🔍 **How VAT affects pricing**

Example:

- Chocolate bar → Standard VAT (20%)
- Apple → Zero VAT (0%)
- Tampon → Reduced VAT (5%)

The POS calculates how much VAT goes into each item on a receipt.

---

## ❗ Important: VAT is NOT stored in the barcode

Barcodes (EAN/UPC) **do not** contain VAT info.
They only identify the product (like an ID).

The VAT category comes from your **internal product database**, not the barcode.

---

## 🛒 In small corner shops (one-stop grocery stores)

They still must assign VAT correctly:

- Most groceries → 0%
- Snacks/drinks → 20%
- Baby items or sanitary items → 5%
- Stamps, lottery → Exempt

The POS usually comes with **preloaded VAT categories**, and the shop owner assigns items to categories during setup.

---

## If you want, I can also explain:

- How VAT is calculated on receipts
- How POS systems store VAT categories
- How VAT affects stock and price per unit

Just tell me!
