# Thermal Receipt Printer Testing Guide - AuraSwift POS

This document provides comprehensive guidance for testing the thermal receipt printer integration in real-time with actual hardware devices.

## 📋 Table of Contents

- [Supported Printers](#supported-printers)
- [Code Architecture Analysis](#code-architecture-analysis)
- [Testing Setup](#testing-setup)
- [Real Hardware Testing Procedures](#real-hardware-testing-procedures)
- [Known Issues & Workarounds](#known-issues--workarounds)
- [Troubleshooting](#troubleshooting)
- [Test Scenarios](#test-scenarios)

---

## 🖨️ Supported Printers

### ✅ Wired (USB) Printers

The system uses **node-thermal-printer v4.5.0** library which supports ESC/POS compatible thermal printers via USB serial connection.

#### **Epson Models** (Primary Support)

- **TM-T20** - Entry-level 80mm thermal printer
- **TM-T82** - Standard 80mm thermal printer
- **TM-T88V** - Professional 80mm thermal printer (most common)
- **TM-T88VI** - Latest generation with USB, Ethernet
- **TM-m10** - Mobile receipt printer
- **TM-m30** - Compact receipt printer

#### **Star Micronics Models**

- **TSP100** - USB receipt printer series
- **TSP143** - High-speed USB printer
- **TSP654** - Multi-interface printer
- **TSP650** - Older generation printer
- **mPOP** - Combined printer and cash drawer

#### **Citizen Models**

- **CT-S310A** - Compact 80mm printer
- **CT-S4000** - High-performance printer
- **CT-E651** - Ethernet/USB printer

#### **Generic Models**

- Any ESC/POS compatible USB thermal printer
- Most receipt printers with USB interface

### ✅ Wireless (Bluetooth) Printers

#### **Mobile/Portable Printers**

- **DIERI BT Thermal Printer** (Explicitly referenced in code)
- **Epson TM-P20** - Bluetooth mobile printer
- **Epson TM-P80** - Advanced mobile printer
- **Star SM-L200** - Portable receipt printer
- **Star SM-L300** - Rugged mobile printer
- **Bixolon SPP-R200III** - Mobile thermal printer
- **Bixolon SPP-R400** - 4-inch mobile printer

#### **Bluetooth Requirements**

- Bluetooth 2.0 or higher
- Serial Port Profile (SPP) support
- Pairing with computer before use
- MAC address format: `BT:XX:XX:XX:XX:XX:XX`

---

## 🏗️ Code Architecture Analysis

### **Service Layer** (`packages/main/src/services/thermalPrinterService.ts`)

This is the **production-ready** implementation that uses `node-thermal-printer`:

```typescript
// Key Features:
- ✅ Real printer initialization with node-thermal-printer
- ✅ USB & Bluetooth interface support
- ✅ Print queue management
- ✅ Timeout handling (10 seconds default)
- ✅ Connection status monitoring
- ✅ Test print functionality
- ✅ Automatic device scanning
```

**IPC Handlers Available:**

- `printer:initialize` - Initialize printer connection
- `printer:print` - Queue and print receipt
- `printer:status` - Get current printer status
- `printer:test` - Print test receipt
- `printer:disconnect` - Disconnect from printer
- `printer:interfaces` - Scan for available printers

### **Legacy Implementation** (`packages/main/src/thermalPrinterService.ts`)

This is a **mock/fallback** implementation:

```typescript
// Current Status:
- ⚠️ Uses mock printer (not real hardware)
- ⚠️ Simulated connection delays
- ⚠️ No actual ESC/POS commands sent
- ✅ Same IPC interface for compatibility
```

**Note:** The code has TWO printer services. The one in `services/` folder is the real implementation.

### **React Hook** (`packages/renderer/src/hooks/useThermalPrinter.ts`)

```typescript
// Features:
- ✅ Connection management
- ✅ Print queue tracking
- ✅ Error handling & retry logic (max 3 attempts)
- ✅ Status monitoring
- ✅ Toast notifications
- ✅ Interface scanning
```

### **Receipt Generator** (`packages/renderer/src/utils/receiptGenerator.ts`)

```typescript
// Features:
- ✅ ESC/POS command generation
- ✅ 32-character line width (58mm printer optimized)
- ✅ Text alignment (left, center)
- ✅ Bold/emphasized text
- ✅ Line wrapping
- ✅ Formatted layout for receipts
```

### **UI Components** (`packages/renderer/src/components/printer/ReceiptPrinterComponents.tsx`)

```typescript
// Components:
- ✅ PrinterStatus display
- ✅ Progress indicators
- ✅ Error handling UI
- ✅ Retry/Skip/Email options
- ✅ Printer setup dialogs
```

---

## 🔧 Testing Setup

### **Prerequisites**

1. **Hardware Requirements:**

   - Thermal receipt printer (USB or Bluetooth)
   - USB cable (for USB printers)
   - Receipt paper roll (58mm or 80mm)
   - Power supply for printer

2. **Software Requirements:**
   - AuraSwift POS installed
   - Node.js 18+ installed
   - Native modules compiled (`npm run postinstall`)

### **Windows Setup (Primary Platform)**

#### **USB Printer:**

```powershell
# 1. Connect USB printer to computer
# 2. Windows will auto-detect and install drivers

# 3. Find the COM port assigned:
# Open Device Manager → Ports (COM & LPT)
# Note the COM port (e.g., COM3, COM4)

# 4. Verify port access:
mode COM3

# Expected output: Baud rate, parity, etc.
```

#### **Bluetooth Printer:**

```powershell
# 1. Enable Bluetooth on printer (refer to manual)
# 2. Open Windows Settings → Bluetooth & devices
# 3. Click "Add device" → Bluetooth
# 4. Select your printer from the list
# 5. Pair the device (may require PIN, usually 0000 or 1234)

# 6. After pairing, find the outgoing COM port:
# Settings → Bluetooth & devices → Devices
# Click on printer → More Bluetooth settings
# COM Ports tab → Note the "Outgoing" COM port

# 7. Test connection:
echo "Test" > COM5  # Replace COM5 with your port
```

### **macOS Setup**

#### **USB Printer:**

```bash
# 1. Connect USB printer
# 2. Find the device:
ls -la /dev/tty.*

# Look for something like:
# /dev/tty.usbserial-XXXXXXXX

# 3. Test connectivity:
echo "Test" > /dev/tty.usbserial-XXXXXXXX
```

#### **Bluetooth Printer:**

```bash
# 1. Enable Bluetooth on printer
# 2. Open System Preferences → Bluetooth
# 3. Pair with printer
# 4. After pairing, check serial port:
ls -la /dev/tty.*

# Look for something like:
# /dev/tty.printer-SerialPort
```

---

## 🧪 Real Hardware Testing Procedures

### **Step 1: Verify Service is Using Real Implementation**

Check which service is being imported in your main process:

```bash
# Search for imports in main index
grep -r "thermalPrinterService" packages/main/src/index.ts
```

**If you see:**

```typescript
import thermalPrinterService from "./thermalPrinterService"; // ❌ MOCK
```

**Change to:**

```typescript
import { thermalPrinterService } from "./services/thermalPrinterService"; // ✅ REAL
```

### **Step 2: Initialize the Application**

```bash
# Start the application in development mode
npm start

# Check console for initialization messages:
# "🖨️ Thermal printer service initialized"
```

### **Step 3: Configure Printer Connection**

**In the AuraSwift UI:**

1. Navigate to **Settings → Hardware → Printer**
2. Click **"Scan for Printers"** or **"Setup Printer"**
3. Select your printer from the list

**For USB:**

```typescript
// Configuration example
{
  type: "epson",  // or "star", "generic"
  interface: "COM3",  // Windows
  // OR
  interface: "/dev/tty.usbserial-XXXXXXXX",  // macOS
  options: {
    timeout: 5000,
    characterSet: "CP437"
  }
}
```

**For Bluetooth:**

```typescript
{
  type: "epson",
  interface: "COM5",  // Windows
  // OR
  interface: "/dev/tty.printer-SerialPort",  // macOS
  // OR
  interface: "BT:00:11:62:AA:BB:CC",  // Direct MAC address
  options: {
    timeout: 5000,
    characterSet: "CP437"
  }
}
```

### **Step 4: Test Printer Connection**

**Option A: UI Test Button**

1. Click **"Test Printer"** button in settings
2. Printer should print a test receipt:

   ```
   PRINTER TEST
   =============
   Date: [current date/time]
   Status: Connected

   Test Successful!
   ```

**Option B: Developer Console Test**

```javascript
// Open DevTools (Ctrl+Shift+I or Cmd+Option+I)
// Test printer initialization:
await window.printerAPI.connect({
  type: "epson",
  interface: "COM3",
});

// Check status:
const status = await window.printerAPI.getStatus();
console.log(status);
// Expected: { connected: true, interface: "COM3", type: "epson" }
```

### **Step 5: Test Receipt Printing**

**Create a Test Transaction:**

```javascript
// In DevTools Console:
const testTransaction = {
  id: "TEST001",
  timestamp: new Date(),
  cashierId: "CASHIER01",
  cashierName: "John Doe",
  businessId: "BUS001",
  businessName: "Test Supermarket",
  items: [
    {
      id: "ITEM001",
      name: "Coca Cola 2L",
      quantity: 2,
      price: 2.5,
      total: 5.0,
      category: "Beverages",
      barcode: "5449000000996",
    },
    {
      id: "ITEM002",
      name: "White Bread",
      quantity: 1,
      price: 1.5,
      total: 1.5,
      category: "Bakery",
    },
  ],
  subtotal: 6.5,
  tax: 0.52,
  discount: 0,
  total: 7.02,
  amountPaid: 10.0,
  change: 2.98,
  paymentMethods: [{ type: "cash", amount: 10.0 }],
  receiptNumber: "0001",
  notes: "Test transaction",
};

// Print test receipt:
const result = await window.printerAPI.printReceipt(testTransaction);
console.log(result);
// Expected: { success: true }
```

**Verify Receipt Output:**

The printer should print:

```
     TEST SUPERMARKET

================================
Receipt #: 0001
Date: [date]
Time: [time]
Cashier: John Doe
--------------------------------
ITEMS:
Coca Cola 2L
  2x @ £2.50              £5.00

White Bread
  1x @ £1.50              £1.50

--------------------------------
Subtotal:                 £6.50
Tax (8%):                 £0.52
TOTAL:                    £7.02
--------------------------------
PAYMENT:
Method: Cash
Cash:                    £10.00
Change:                   £2.98
--------------------------------
     Thank you!

[Paper cut]
```

---

## ⚠️ Known Issues & Workarounds

### **Issue 1: Duplicate Service Implementation**

**Problem:** Two thermal printer services exist in codebase:

- `/packages/main/src/thermalPrinterService.ts` (Mock)
- `/packages/main/src/services/thermalPrinterService.ts` (Real)

**Impact:** If wrong service is imported, printer won't work with real hardware.

**Solution:**

```typescript
// In packages/main/src/index.ts, ensure you import:
import { thermalPrinterService } from "./services/thermalPrinterService";

// NOT:
// import thermalPrinterService from './thermalPrinterService';
```

### **Issue 2: Mock Printer in Legacy Service**

**Problem:** The non-services implementation uses `this.printer = { mock: true }`.

**Impact:** Prints won't reach hardware.

**Solution:** Remove or update legacy service to extend from real service.

### **Issue 3: CharacterSet Compatibility**

**Problem:** Some printers don't support default CP437 character set.

**Symptoms:** Special characters appear garbled.

**Solution:**

```typescript
// Try different character sets in config:
options: {
  characterSet: "PC850"; // Western European
  // OR
  characterSet: "PC437"; // US
  // OR
  characterSet: "PC852"; // Latin 2
}
```

### **Issue 4: Connection Timeout on First Print**

**Problem:** First print may timeout due to printer initialization delay.

**Symptoms:** Error: "Print timeout"

**Solution:**

```typescript
// Increase timeout in config:
options: {
  timeout: 10000; // Increase to 10 seconds
}
```

### **Issue 5: Bluetooth Pairing Drops**

**Problem:** Bluetooth connection unstable, especially on Windows.

**Symptoms:** "Printer not connected" after successful initial connection.

**Solution:**

- Use USB connection for production environments
- Ensure printer is within 10m range
- Update Bluetooth drivers on Windows
- Disable power-saving for Bluetooth adapter

### **Issue 6: Paper Width Mismatch**

**Problem:** Receipt content cut off or poorly formatted.

**Symptoms:** Text wrapping incorrectly, lines too long.

**Solution:**

```typescript
// receiptGenerator.ts uses 32 characters (58mm printer)
// If using 80mm printer, adjust LINE_WIDTH:

private static readonly LINE_WIDTH = 48; // For 80mm
```

---

## 🔍 Troubleshooting

### **Printer Not Detected**

```bash
# Windows:
# 1. Check Device Manager for COM ports
# 2. Ensure printer drivers installed
# 3. Try different USB ports

# macOS:
ls -la /dev/tty.*  # Should show device
ls -la /dev/cu.*   # Check callout devices too

# Test serial port directly:
echo "test" > /dev/tty.usbserial-XXXXXXXX
```

### **Connection Fails**

**Check permissions:**

```bash
# Linux (may require):
sudo usermod -a -G dialout $USER
sudo chmod 666 /dev/ttyUSB0

# macOS (may require):
sudo chmod 666 /dev/tty.usbserial-*
```

**Check port is not in use:**

```bash
# Windows:
net use COM3  # Should show available

# Linux/macOS:
lsof /dev/ttyUSB0  # Should show empty
```

### **Prints Garbled Text**

**Fix character encoding:**

```typescript
options: {
  characterSet: "CP437",  // Try different sets
  removeSpecialCharacters: true  // Remove unsupported chars
}
```

### **Printer Prints Blank**

**Possible causes:**

1. Paper inserted backwards (thermal side faces print head)
2. Paper roll empty
3. Printer in test mode
4. ESC/POS commands not supported

**Solution:**

- Check paper orientation
- Replace paper roll
- Power cycle printer
- Try different printer type in config

### **Print Queue Stuck**

```javascript
// Clear queue via DevTools:
await window.printerAPI.cancelPrint();

// Or restart application
```

---

## ✅ Test Scenarios

### **Scenario 1: Normal Transaction**

- **Items:** 5 items, various quantities
- **Payment:** Cash with change
- **Expected:** Receipt prints with all items, correct totals

### **Scenario 2: Large Transaction**

- **Items:** 20+ items
- **Payment:** Mixed (cash + card)
- **Expected:** Receipt prints completely, no truncation

### **Scenario 3: Special Characters**

- **Items:** Products with special characters (é, ñ, £)
- **Expected:** Characters print correctly or are removed

### **Scenario 4: Connection Loss During Print**

- **Action:** Disconnect printer while printing
- **Expected:** Error shown, retry option available

### **Scenario 5: Queue Management**

- **Action:** Send 3 print jobs rapidly
- **Expected:** All print in order, no duplicates

### **Scenario 6: Bluetooth Range Test**

- **Action:** Move printer away during print
- **Expected:** Graceful error, reconnection prompt

### **Scenario 7: Paper Out**

- **Action:** Remove paper during print
- **Expected:** Error detected, print retries when paper added

### **Scenario 8: Multiple Printer Switch**

- **Action:** Connect to different printer mid-session
- **Expected:** Clean disconnect from first, connect to second

---

## 📊 Testing Checklist

Use this checklist for comprehensive testing:

- [ ] USB printer detected automatically
- [ ] Bluetooth printer pairs successfully
- [ ] Test print works correctly
- [ ] Single item receipt prints
- [ ] Multi-item receipt prints
- [ ] Receipt formatting correct (alignment, spacing)
- [ ] Totals calculate correctly
- [ ] Paper cut command works
- [ ] Print queue processes in order
- [ ] Error recovery works (retry logic)
- [ ] Timeout handling functional
- [ ] Connection status updates in real-time
- [ ] UI shows correct printer status
- [ ] Multiple print jobs handled
- [ ] Disconnect cleans up properly
- [ ] Printer survives app restart
- [ ] Special characters handled
- [ ] Long product names wrap correctly
- [ ] Receipt footer prints
- [ ] Date/time format correct

---

## 🎯 Recommended Testing Workflow

### **Phase 1: Hardware Verification** (15 mins)

1. Connect printer
2. Verify drivers/pairing
3. Test print from test application
4. Confirm receipt output

### **Phase 2: Integration Testing** (30 mins)

1. Start AuraSwift
2. Scan for printers
3. Connect to printer
4. Run test print
5. Verify test receipt

### **Phase 3: Transaction Testing** (1 hour)

1. Create test transaction
2. Print receipt
3. Verify formatting
4. Test error scenarios
5. Test queue management

### **Phase 4: Stress Testing** (30 mins)

1. Rapid print jobs
2. Connection interruptions
3. Long transactions
4. Special characters
5. Paper out scenarios

---

## 📝 Logging & Debugging

**Enable verbose logging:**

```bash
# Set environment variable before starting:
DEBUG=printer:* npm start
```

**Check console output:**

```
🖨️ Initializing thermal printer: {type: "epson", interface: "COM3"}
✅ Thermal printer initialized successfully
🖨️ Printing receipt job job_1234567890...
✅ Receipt job job_1234567890 queued successfully
🖨️ Executing print job job_1234567890...
✅ Print job job_1234567890 completed successfully
```

**Common error messages:**

```
❌ Failed to initialize thermal printer: [error]
❌ Printer not initialized. Please initialize printer first.
❌ Print timeout
❌ Failed to process print job: [error]
❌ Connection check failed: [error]
```

---

## 🚀 Production Deployment Notes

Before deploying to production:

1. **Ensure real service is active** (not mock)
2. **Test with actual hardware models** used in deployment
3. **Configure appropriate timeouts** for environment
4. **Set up error monitoring** for print failures
5. **Train staff on printer troubleshooting**
6. **Have spare receipt rolls available**
7. **Document printer connection details** for site

---

**Last Updated:** October 17, 2025  
**Author:** AuraSwift Development Team  
**Version:** 3.1.0
