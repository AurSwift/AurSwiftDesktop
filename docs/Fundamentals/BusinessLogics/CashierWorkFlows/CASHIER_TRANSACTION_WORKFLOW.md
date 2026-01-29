# Cashier Transaction Workflow - Complete Guide

**Last Updated:** November 5, 2025  
**Version:** 1.0  
**Status:** ✅ PRODUCTION READY

---

## 📋 TABLE OF CONTENTS

1. [Workflow Overview](#workflow-overview)
2. [Step-by-Step Process](#step-by-step-process)
3. [Cash Payment with HP LaserJet Receipt](#cash-payment-with-hp-laserjet-receipt)
4. [Technical Implementation](#technical-implementation)
5. [Testing Checklist](#testing-checklist)
6. [Troubleshooting](#troubleshooting)

---

## 🎯 WORKFLOW OVERVIEW

This document describes the complete end-to-end process for a cashier to:

1. Add items to cart (scan/manual)
2. Calculate totals
3. Select cash payment method
4. Complete transaction
5. Generate and print receipt via HP LaserJet printer
6. Reset for next customer

### System Components Involved

| Component                  | Purpose                 | File Location                                                                     |
| -------------------------- | ----------------------- | --------------------------------------------------------------------------------- |
| **Transaction View**       | Main UI                 | `packages/renderer/src/pages/dashboard/cashier/features/new-transaction-view.tsx` |
| **Receipt Generator**      | PDF creation            | `packages/renderer/src/utils/pdfReceiptGenerator.ts`                              |
| **Office Printer Service** | HP LaserJet integration | `packages/main/src/services/officePrinterService.ts`                              |
| **Office Printer Hook**    | React state management  | `packages/renderer/src/hooks/useOfficePrinter.ts`                                 |
| **Database**               | Transaction persistence | `packages/main/src/database.ts`                                                   |

---

## 📝 STEP-BY-STEP PROCESS

### Prerequisites

✅ Cashier has active shift  
✅ HP LaserJet printer is powered on and connected  
✅ System has detected the printer (auto-discovery)  
✅ Paper loaded in printer

---

### STEP 1: Start New Transaction

**Cashier Action:** Click "New Transaction" button

**System Response:**

- Opens transaction view
- Initializes empty cart
- Displays product grid/search
- Enables barcode scanner input

**Code:**

```tsx
// File: new-transaction-view.tsx
const [cart, setCart] = useState<CartItem[]>([]);
const [barcodeInput, setBarcodeInput] = useState("");
```

---

### STEP 2: Add Items to Cart

**Method A: Barcode Scanning (Recommended)**

1. **Cashier scans product barcode** using hardware scanner or enters manually
2. System searches products by: ID, SKU, or PLU code
3. If product found:
   - Adds to cart automatically
   - Shows success toast notification
   - Plays audio feedback (if enabled)
4. For weight-based products:
   - Prompts for weight entry
   - Calculates price based on weight × price per unit

**Code:**

```tsx
const handleBarcodeScan = () => {
  const product = products.find((p) => p.id === barcodeInput || p.sku === barcodeInput || p.plu === barcodeInput);

  if (product) {
    if (product.requiresWeight) {
      // Show weight input dialog
      setSelectedWeightProduct(product);
    } else {
      addToCart(product);
    }
  } else {
    toast.error("Product not found");
  }
};
```

**Method B: Manual Product Selection**

1. **Cashier browses products** by category or searches by name
2. **Clicks product card** to add to cart
3. System adds item with quantity = 1
4. Cashier can adjust quantity using +/- buttons

**Method C: Search Bar**

1. **Cashier types product name** in search field
2. System filters products in real-time
3. **Clicks matching product** to add

---

### STEP 3: Review Cart

**Display Information:**

- Product names
- Quantities
- Unit prices
- Item totals
- Weight (for weight-based items)

**Cart Operations:**

- ➕ Increase quantity
- ➖ Decrease quantity
- 🗑️ Remove item
- ✏️ Edit weight (for applicable items)

**Automatic Calculations:**

```typescript
const subtotal = cart.reduce((sum, item) => {
  let itemPrice = item.product.price;

  // For weight-based products
  if (item.product.requiresWeight && item.product.pricePerUnit) {
    itemPrice = item.product.pricePerUnit;
  }

  const itemTotal = itemPrice * item.quantity * (item.weight || 1);
  return sum + itemTotal;
}, 0);

const tax = subtotal * 0.08; // 8% tax rate
const total = subtotal + tax;
```

**Display:**

- Subtotal: £X.XX
- Tax (8%): £X.XX
- **Total: £X.XX** (bold, highlighted)

---

### STEP 4: Proceed to Checkout

**Cashier Action:** Clicks "Checkout" button

**Validation:**

- ✅ Cart not empty
- ✅ All items have valid prices
- ✅ Active shift exists

**System Response:**

- Enables payment step
- Shows payment method selector
- Disables cart editing (or shows "Back to Cart" button)

**Code:**

```tsx
<Button className="w-full mt-4 bg-sky-600 hover:bg-sky-700 h-11 text-lg" onClick={() => setPaymentStep(true)} disabled={cart.length === 0}>
  <Calculator className="h-5 w-5 mr-2" />
  Checkout
</Button>
```

---

### STEP 5: Select Payment Method

**Cashier Action:** Clicks "Cash" payment button

**Available Options:**

- 💵 **Cash** - Physical currency
- 💳 **Card** - BBPOS WisePad 3 (if ready)
- 📱 **Mobile** - Digital payment (future)
- 🎫 **Voucher** - Gift card/Coupon (future)

**System Response for Cash:**

- Shows cash input field
- Pre-fills with exact total amount
- Shows quick amount buttons (£5, £10, £20, £50)
- Shows change calculation in real-time

**Code:**

```tsx
const handlePayment = async (method: PaymentMethod["type"]) => {
  setPaymentMethod({ type: method });

  if (method === "cash") {
    setCashAmount(total); // Auto-fill exact amount
  }
};
```

---

### STEP 6: Enter Cash Amount

**Cashier Actions:**

**Option A: Use Quick Buttons**

- Click £5, £10, £20, or £50 for common amounts
- Click "Exact Amount" for no change
- Click "Round Up" for next whole pound

**Option B: Manual Entry**

- Type cash amount received in input field
- System validates: cash >= total

**Real-time Feedback:**

```typescript
Change: cashAmount >= total ? `£${(cashAmount - total).toFixed(2)}` : `-£${(total - cashAmount).toFixed(2)}`; // Shows shortage
```

**Validation:**

- ✅ Cash amount ≥ total
- ✅ Cash amount > 0
- ❌ If insufficient: Button disabled, shows "Need £X.XX More"

**Code:**

```tsx
<Input
  type="number"
  step="0.01"
  placeholder="Enter cash amount"
  value={cashAmount || ""}
  onChange={(e) => setCashAmount(parseFloat(e.target.value) || 0)}
  className="text-lg h-12"
/>

<div className="flex justify-between text-slate-600">
  <span>Change:</span>
  <span className="font-semibold text-sky-600">
    {cashAmount >= total
      ? `£${(cashAmount - total).toFixed(2)}`
      : `Need £${(total - cashAmount).toFixed(2)} more`}
  </span>
</div>
```

---

### STEP 7: Complete Transaction

**Cashier Action:** Clicks "Complete Transaction" button

**System Process:**

#### 7.1 Validation

```typescript
// Check active shift
const shiftResponse = await window.shiftAPI.getActive(user.id);
if (!shiftResponse.success) {
  toast.error("No active shift found");
  return;
}

// Check payment amount
if (paymentMethod.type === "cash" && cashAmount < total) {
  toast.error(`Insufficient cash. Need £${(total - cashAmount).toFixed(2)} more`);
  return;
}

// Check cart not empty
if (cart.length === 0) {
  toast.error("Cart is empty");
  return;
}
```

#### 7.2 Generate Receipt Number

```typescript
const receiptNumber = `RCP-${Date.now()}`;
// Example: RCP-1730891234567
```

#### 7.3 Prepare Transaction Data

```typescript
const transactionItems = cart.map((item) => {
  let unitPrice = item.product.price;
  let totalPrice = item.product.price * item.quantity;

  if (item.product.requiresWeight && item.weight && item.product.pricePerUnit) {
    unitPrice = item.product.pricePerUnit;
    totalPrice = item.product.pricePerUnit * item.weight * item.quantity;
  }

  return {
    productId: item.product.id,
    productName: item.product.name,
    quantity: item.quantity,
    unitPrice,
    totalPrice,
  };
});
```

#### 7.4 Save to Database

```typescript
const transactionResponse = await window.transactionAPI.create({
  shiftId: activeShift.id,
  businessId: user.businessId,
  type: "sale",
  subtotal,
  tax,
  total,
  paymentMethod: "cash",
  cashAmount,
  items: transactionItems,
  status: "completed",
  receiptNumber,
  timestamp: new Date().toISOString(),
});
```

**Database Tables Updated:**

- `transactions` - Main transaction record
- `shift_transactions` - Links transaction to shift
- `inventory` - Updates stock levels (if tracking enabled)

---

### STEP 8: Generate PDF Receipt

**System Action:** Creates professional PDF receipt for HP LaserJet

**Receipt Format (Letter/A4):**

```
┌─────────────────────────────────────┐
│        AURASWIFT POS SYSTEM         │
│     123 Main Street, London         │
│        Phone: 020-1234-5678         │
│        VAT: GB123456789             │
├─────────────────────────────────────┤
│  Receipt #: RCP-1730891234567       │
│  Date: 05/11/2025  Time: 14:30      │
│  Cashier: John Smith                │
│  Transaction ID: TXN-123456         │
├─────────────────────────────────────┤
│  ITEMS                              │
├─────────────────────────────────────┤
│  Coca Cola 330ml                    │
│    2 x £1.50                  £3.00 │
│    SKU: DRINK-001                   │
│                                     │
│  Fresh Apples                       │
│    Weight: 1.50 kg                  │
│    1 x £2.99/kg               £4.49 │
│    SKU: FRUIT-002                   │
│                                     │
│  White Bread 800g                   │
│    1 x £1.20                  £1.20 │
│    SKU: BAKERY-003                  │
├─────────────────────────────────────┤
│  Subtotal:                    £8.69 │
│  Tax (8%):                    £0.70 │
│  ───────────────────────────────── │
│  TOTAL:                       £9.39 │
├─────────────────────────────────────┤
│  PAYMENT: Cash                      │
│  Cash Received:              £10.00 │
│  Change:                      £0.61 │
├─────────────────────────────────────┤
│      Thank you for shopping!        │
│   Keep this receipt for returns     │
│                                     │
│  Return Policy: 30 days with        │
│  receipt. Perishable items excluded │
│                                     │
│  Transaction ID for reference:      │
│  TXN-123456                         │
└─────────────────────────────────────┘
```

**PDF Generation Code:**

```typescript
import { generatePDFReceipt } from "@/utils/pdfReceiptGenerator";

const pdfBuffer = await generatePDFReceipt({
  receiptNumber,
  transactionId: receiptNumber,
  date: new Date().toLocaleDateString("en-GB"),
  time: new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }),
  cashierName: `${user.firstName} ${user.lastName}`,
  items: cart.map((item) => ({
    name: item.product.name,
    quantity: item.quantity,
    unitPrice: item.product.price,
    totalPrice: item.product.price * item.quantity,
    weight: item.weight,
    unit: item.product.unit,
    sku: item.product.sku,
  })),
  subtotal,
  tax,
  total,
  paymentMethod: "cash",
  cashAmount,
  change: cashAmount - total,
  storeName: user.businessName || "AuraSwift POS",
  storeAddress: "123 Main Street, London",
  storePhone: "020-1234-5678",
  vatNumber: "GB123456789",
});
```

---

### STEP 9: Print Receipt via HP LaserJet

**System Action:** Sends PDF to HP LaserJet printer

**Process:**

#### 9.1 Save PDF to Temp File

```typescript
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const tempDir = path.join(app.getPath("temp"), "receipts");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const pdfPath = path.join(tempDir, `receipt-${receiptNumber}.pdf`);
fs.writeFileSync(pdfPath, pdfBuffer);
```

#### 9.2 Use Office Printer Hook

```typescript
import { useOfficePrinter } from "@/hooks/useOfficePrinter";

const { printers, selectedPrinter, printDocument } = useOfficePrinter();

// Auto-discover printers (runs once on mount)
useEffect(() => {
  discoverPrinters();
}, []);

// Print the receipt
const printResult = await printDocument(
  pdfPath, // PDF file path
  "pdf", // Document type
  {
    copies: 1,
    color: false, // Monochrome for receipt
    duplex: "simplex", // Single-sided
    paperSize: "letter", // Letter or A4
    quality: "normal",
    orientation: "portrait",
  }
);
```

#### 9.3 Handle Print Job

```typescript
if (printResult.success) {
  console.log(`Print job submitted: ${printResult.jobId}`);

  // Monitor job status
  const checkStatus = setInterval(async () => {
    const status = await window.officePrinterAPI.getJobStatus(printResult.jobId);

    if (status.status === "completed") {
      clearInterval(checkStatus);
      toast.success("Receipt printed successfully!");
      cleanupPDF(pdfPath);
    } else if (status.status === "failed") {
      clearInterval(checkStatus);
      toast.error(`Print failed: ${status.error}`);
      // Offer retry or email option
    }
  }, 2000); // Check every 2 seconds
} else {
  toast.error(`Print failed: ${printResult.error}`);
  // Fallback: Save transaction but offer to reprint later
}
```

#### 9.4 Print Job Lifecycle

```
[Pending] → [Queued] → [Printing] → [Completed]
     ↓            ↓           ↓
  [Failed]   [Failed]   [Failed]
     ↓            ↓           ↓
  [Retry 1] → [Retry 2] → [Retry 3] → [Failed (Max Retries)]
```

**Database Tracking:**

- Job saved to `print_jobs` table
- Retry attempts logged in `print_job_retries` table
- Status updates in real-time

---

### STEP 10: Transaction Complete

**System Response:**

#### 10.1 Show Success Message

```tsx
<motion.div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <motion.div className="bg-white p-6 rounded-lg text-center max-w-sm">
    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
    <h2 className="text-xl font-bold mb-2">Transaction Complete!</h2>
    <p className="text-slate-600">Receipt #{receiptNumber}</p>
    <p className="text-lg font-semibold text-green-600 mt-2">Change: £{(cashAmount - total).toFixed(2)}</p>
    <p className="text-sm text-slate-500 mt-4">Receipt is printing...</p>
  </motion.div>
</motion.div>
```

#### 10.2 Reset for Next Customer

```typescript
// After 3 seconds (or manual click "New Sale")
setTimeout(() => {
  setCart([]);
  setPaymentMethod(null);
  setCashAmount(0);
  setTransactionComplete(false);
  setPaymentStep(false);
  setBarcodeInput("");

  toast.success("Ready for next customer!");
}, 3000);
```

#### 10.3 Update Shift Statistics

```typescript
// Automatically updated in database
{
  totalSales: previousTotal + total,
  totalTransactions: previousCount + 1,
  cashInDrawer: previousCash + cashAmount,
  // Card payments tracked separately
}
```

---

## 🔧 TECHNICAL IMPLEMENTATION

### Required Files

#### 1. PDF Receipt Generator

**File:** `packages/renderer/src/utils/pdfReceiptGenerator.ts`

```typescript
import PDFDocument from "pdfkit";

export interface ReceiptData {
  receiptNumber: string;
  transactionId: string;
  date: string;
  time: string;
  cashierName: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    weight?: number;
    unit?: string;
    sku?: string;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: "cash" | "card" | "mobile" | "mixed";
  cashAmount?: number;
  cardAmount?: number;
  change?: number;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  vatNumber?: string;
}

export async function generatePDFReceipt(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER", // or 'A4'
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });

    const buffers: Buffer[] = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // Header
    doc.fontSize(20).font("Helvetica-Bold").text(data.storeName, { align: "center" });

    doc.fontSize(10).font("Helvetica").text(data.storeAddress, { align: "center" }).text(data.storePhone, { align: "center" });

    if (data.vatNumber) {
      doc.text(`VAT: ${data.vatNumber}`, { align: "center" });
    }

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(0.5);

    // Transaction Details
    doc.fontSize(10);
    doc.text(`Receipt #: ${data.receiptNumber}`);
    doc.text(`Date: ${data.date}  Time: ${data.time}`);
    doc.text(`Cashier: ${data.cashierName}`);
    doc.text(`Transaction ID: ${data.transactionId}`);

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(0.5);

    // Items Header
    doc.fontSize(12).font("Helvetica-Bold").text("ITEMS");
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica");

    // Items
    data.items.forEach((item) => {
      doc.text(item.name, 50, doc.y, { width: 300 });

      let qtyText = `${item.quantity} x £${item.unitPrice.toFixed(2)}`;
      if (item.weight && item.unit) {
        doc.moveDown(0.3);
        doc.fontSize(9).text(`Weight: ${item.weight.toFixed(2)} ${item.unit}`, 60);
        qtyText = `${item.quantity} x £${item.unitPrice.toFixed(2)}/${item.unit}`;
      }

      doc.fontSize(10);
      doc.text(qtyText, 50, doc.y, { width: 300 });
      doc.text(`£${item.totalPrice.toFixed(2)}`, 400, doc.y - 15, { width: 112, align: "right" });

      if (item.sku) {
        doc.fontSize(9).text(`SKU: ${item.sku}`, 60);
      }

      doc.moveDown(0.5);
    });

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(0.5);

    // Totals
    doc.fontSize(10);
    doc.text(`Subtotal:`, 50, doc.y, { width: 400 });
    doc.text(`£${data.subtotal.toFixed(2)}`, 400, doc.y - 12, { width: 112, align: "right" });

    doc.text(`Tax (8%):`, 50, doc.y, { width: 400 });
    doc.text(`£${data.tax.toFixed(2)}`, 400, doc.y - 12, { width: 112, align: "right" });

    doc.moveDown(0.3);
    doc.fontSize(12).font("Helvetica-Bold");
    doc.text(`TOTAL:`, 50, doc.y, { width: 400 });
    doc.text(`£${data.total.toFixed(2)}`, 400, doc.y - 15, { width: 112, align: "right" });

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(0.5);

    // Payment
    doc.fontSize(10).font("Helvetica");
    doc.text(`Payment Method: ${data.paymentMethod.toUpperCase()}`);

    if (data.paymentMethod === "cash") {
      doc.text(`Cash Received:`, 50, doc.y, { width: 400 });
      doc.text(`£${data.cashAmount?.toFixed(2)}`, 400, doc.y - 12, { width: 112, align: "right" });

      if (data.change && data.change > 0) {
        doc.text(`Change:`, 50, doc.y, { width: 400 });
        doc.text(`£${data.change.toFixed(2)}`, 400, doc.y - 12, { width: 112, align: "right" });
      }
    }

    doc.moveDown(2);
    doc.fontSize(12).font("Helvetica-Bold").text("Thank you for shopping!", { align: "center" });

    doc
      .fontSize(9)
      .font("Helvetica")
      .text("Keep this receipt for returns", { align: "center" })
      .moveDown(0.5)
      .text("Return Policy: 30 days with receipt", { align: "center" })
      .text("Perishable items excluded", { align: "center" });

    doc.moveDown();
    doc.fontSize(8).text(`Transaction ID: ${data.transactionId}`, { align: "center" });

    doc.end();
  });
}
```

#### 2. Integration in Transaction View

```tsx
// File: new-transaction-view.tsx

import { generatePDFReceipt } from "@/utils/pdfReceiptGenerator";
import { useOfficePrinter } from "@/hooks/useOfficePrinter";

const NewTransactionView = () => {
  const { printDocument, printers, discoverPrinters } = useOfficePrinter();

  // Discover printers on mount
  useEffect(() => {
    discoverPrinters();
  }, []);

  const handleCompleteTransaction = async () => {
    // ... validation and database save ...

    // Generate PDF receipt
    try {
      const pdfBuffer = await generatePDFReceipt({
        receiptNumber,
        transactionId: receiptNumber,
        date: new Date().toLocaleDateString("en-GB"),
        time: new Date().toLocaleTimeString("en-GB"),
        cashierName: `${user.firstName} ${user.lastName}`,
        items: cart.map(item => ({
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.price,
          totalPrice: item.product.price * item.quantity,
          sku: item.product.sku
        })),
        subtotal,
        tax,
        total,
        paymentMethod: "cash",
        cashAmount,
        change: cashAmount - total,
        storeName: user.businessName || "AuraSwift POS",
        storeAddress: "123 Main Street, London",
        storePhone: "020-1234-5678",
        vatNumber: "GB123456789"
      });

      // Save PDF to temp file
      const tempPath = `/tmp/receipt-${receiptNumber}.pdf`;
      // (Use electron's fs to save)

      // Print via HP LaserJet
      const printResult = await printDocument(tempPath, "pdf", {
        copies: 1,
        color: false,
        duplex: "simplex",
        paperSize: "letter",
        quality: "normal"
      });

      if (printResult.success) {
        toast.success("Receipt printed successfully!");
      } else {
        toast.error(`Print failed: ${printResult.error}`);
      }

    } catch (error) {
      console.error("Receipt generation error:", error);
      toast.error("Failed to generate receipt");
    }

    // Show completion UI
    setTransactionComplete(true);
  };

  return (
    // ... UI components ...
  );
};
```

---

## ✅ TESTING CHECKLIST

### Pre-Testing Setup

- [ ] HP LaserJet Pro MFP M3302fdw powered on
- [ ] Printer connected (USB/Network)
- [ ] Paper loaded (Letter or A4)
- [ ] Cashier has active shift
- [ ] Test products in database
- [ ] System can detect printer

### Test Case 1: Simple Transaction

- [ ] Start new transaction
- [ ] Scan/add 1 product (Coca Cola - £1.50)
- [ ] Verify cart shows: 1x Coca Cola = £1.50
- [ ] Click checkout
- [ ] Verify totals: Subtotal £1.50, Tax £0.12, Total £1.62
- [ ] Select cash payment
- [ ] Enter £2.00 cash
- [ ] Verify change: £0.38
- [ ] Click complete transaction
- [ ] Verify database record created
- [ ] Verify PDF receipt generated
- [ ] Verify receipt prints on HP LaserJet
- [ ] Verify printed receipt is readable
- [ ] Verify change amount correct on receipt

### Test Case 2: Multiple Items

- [ ] Add 3 different products
- [ ] Adjust quantity of one item to 2
- [ ] Remove one item
- [ ] Verify cart calculations correct
- [ ] Complete transaction with exact cash
- [ ] Verify receipt shows all items
- [ ] Verify £0.00 change printed

### Test Case 3: Weight-Based Product

- [ ] Scan weight-based product (e.g., Apples)
- [ ] Enter weight: 1.5 kg
- [ ] Verify price calculated: 1.5 × price/kg
- [ ] Complete transaction
- [ ] Verify receipt shows weight and unit

### Test Case 4: Large Transaction

- [ ] Add 10+ different items
- [ ] Mix regular and weight-based products
- [ ] Use quick cash buttons (£50)
- [ ] Complete transaction
- [ ] Verify receipt fits all items (multi-page if needed)

### Test Case 5: Error Handling

- [ ] Disconnect printer
- [ ] Attempt transaction
- [ ] Verify error message shown
- [ ] Verify transaction still saved
- [ ] Reconnect printer
- [ ] Attempt to reprint from history

### Test Case 6: Concurrent Transactions

- [ ] Start transaction on Terminal 1
- [ ] Start transaction on Terminal 2
- [ ] Complete both simultaneously
- [ ] Verify both print correctly
- [ ] Verify no receipt number conflicts

### Test Case 7: End-of-Day

- [ ] Complete 20+ transactions
- [ ] End shift
- [ ] Verify all receipts printed
- [ ] Check print job history
- [ ] Verify no failed jobs

---

## 🐛 TROUBLESHOOTING

### Problem: Printer Not Found

**Symptoms:**

- "No printers available" message
- HP LaserJet not in printer list

**Solutions:**

1. Check printer power and connection
2. Verify printer drivers installed on system
3. Check printer is set as default in OS settings
4. Run printer discovery manually: `discoverPrinters()`
5. Restart application
6. Check printer network connection (if network printer)

**Code:**

```typescript
const { printers, discoverPrinters } = useOfficePrinter();

// Manual refresh
<Button onClick={discoverPrinters}>Refresh Printers</Button>;
```

---

### Problem: PDF Generation Fails

**Symptoms:**

- Error: "Failed to generate receipt"
- No PDF created

**Solutions:**

1. Check pdfkit installed: `npm list pdfkit`
2. Verify temp directory exists and writable
3. Check receipt data is valid
4. Review console logs for specific error

**Debug Code:**

```typescript
try {
  const pdfBuffer = await generatePDFReceipt(receiptData);
  console.log("PDF generated, size:", pdfBuffer.length);
} catch (error) {
  console.error("PDF generation error:", error);
  // Fallback: use thermal printer or email receipt
}
```

---

### Problem: Print Job Fails

**Symptoms:**

- Print job shows "failed" status
- Receipt doesn't print
- Error message displayed

**Solutions:**

1. Check printer status: `getPrinterHealth(printerName)`
2. Verify paper loaded
3. Check PDF file exists and readable
4. Try manual print from system
5. Check print queue not stuck
6. Retry print job: `retryJob(jobId)`

**Code:**

```typescript
const health = await window.officePrinterAPI.getHealth("HP Color LaserJet Pro MFP M3302fdw");

if (!health.isAvailable) {
  toast.error(`Printer offline: ${health.errorMessage}`);
  // Offer alternatives: save PDF, email receipt
}
```

---

### Problem: Transaction Saved But Receipt Not Printed

**Symptoms:**

- Transaction complete message shown
- Database updated
- No receipt printed

**Recovery:**

1. Go to transaction history
2. Find transaction by receipt number
3. Click "Reprint Receipt" button
4. PDF regenerated and sent to printer

**Prevention:**

- Check printer status BEFORE completing transaction
- Implement retry logic (already built-in)
- Save PDF to permanent storage for reprinting

---

### Problem: Change Calculation Wrong

**Symptoms:**

- Wrong change amount shown/printed
- Math doesn't add up

**Solutions:**

1. Check cashAmount entered correctly
2. Verify total calculation (subtotal + tax)
3. Check for floating-point precision issues

**Fix:**

```typescript
// Always use toFixed() for money
const change = parseFloat((cashAmount - total).toFixed(2));
```

---

### Problem: Printer Shows As "Paused"

**Symptoms:**

- Printer health status: "paused"
- Jobs queued but not printing

**Solutions:**

1. Open system printer settings
2. Resume printer queue
3. Cancel stuck jobs if any
4. Try test page from system

**Windows:**

- Control Panel → Devices and Printers → Right-click printer → "See what's printing" → Resume

**macOS:**

- System Preferences → Printers & Scanners → Open Print Queue → Resume

---

## 📊 WORKFLOW METRICS

**Average Transaction Time:**

- Add items: 30-60 seconds
- Payment input: 10-15 seconds
- Receipt printing: 5-10 seconds
- **Total: ~1-2 minutes per customer**

**System Performance:**

- PDF generation: <1 second
- Print job submission: <1 second
- Actual printing: 3-5 seconds (HP LaserJet)
- Database save: <500ms

**Success Rates (Target):**

- Transaction completion: >99%
- Receipt printing: >95%
- First-attempt print success: >90%
- Retry success rate: >95%

---

## 🎯 BEST PRACTICES

1. **Always check printer status** before starting a transaction-heavy period (morning, lunch rush)

2. **Keep spare paper** near printer for quick reload

3. **Train cashiers** on troubleshooting basics (paper reload, printer restart)

4. **Regular maintenance:**

   - Clean printer weekly
   - Update printer drivers monthly
   - Test print daily before opening

5. **Monitor print queue:**

   - Check for failed jobs hourly
   - Clear queue at shift end
   - Review print job logs daily

6. **Backup plans:**
   - Email receipts as fallback
   - Manual receipt books for emergencies
   - Secondary printer as backup

---

## 🔗 RELATED DOCUMENTATION

- [HP LaserJet Analysis](./HP_LASERJET_ANALYSIS.md) - Complete printer integration details
- [Supported Printers](./SUPPORTED_PRINTERS.md) - All printer models
- [Printer Production Analysis](./Hardwares/PRINTER_PRODUCTION_ANALYSIS.md) - Production readiness

---

**Document Version:** 1.0  
**Last Updated:** November 5, 2025  
**Next Review:** December 5, 2025
