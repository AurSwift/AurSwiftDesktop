## Receipt Printing (Thermal) — Architecture & Flow

This document explains how the **Print Receipt** functionality is wired in the Electron app, the participating files/modules, and the end-to-end flow across **Renderer → Preload → Main**.

It also includes a short **setup + verification checklist** for Windows COM-port thermal printers (e.g., Metapace T-3).

---

## High-level architecture

- **Renderer (React/Vite)**: UI + hooks that initiate printing and show status/errors.
- **Preload (Electron contextBridge)**: exposes `window.printerAPI` (and `window.officePrinterAPI`) and forwards calls via `ipcRenderer.invoke(...)`.
- **Main process (Electron)**: registers `ipcMain.handle(...)` handlers and talks to OS/hardware using Node libraries.

There are **two printer stacks**:

- **Thermal receipt printer (ESC/POS)**: `node-thermal-printer` (80mm default; supports 58/80 via characters-per-line).
- **Office printer (PDF printing)**: `pdf-to-printer` (general printers; unrelated to the “thermal receipt” flow).

---

## Participating files

### Renderer (UI + hooks)

- `packages/renderer/src/features/sales/views/new-transaction-view.tsx`
  - Bootstraps printer auto-connect from `localStorage` on mount.
  - Wires the receipt modal and passes print/download handlers.
- `packages/renderer/src/features/sales/components/payment/receipt-options-modal.tsx`
  - The “Payment Successful” modal with the **Print Receipt** button.
  - Disables print if the printer is disconnected and provides a **Connect Printer** dialog.
- `packages/renderer/src/features/sales/hooks/use-payment.ts`
  - After a transaction completes, checks printer status and shows the receipt modal.
  - `handlePrintReceipt()` calls `startPrintingFlow(transactionData)`.
- `packages/renderer/src/services/hardware/printer/hooks/use-thermal-printer.ts`
  - Core printer hook:
    - `checkPrinterStatus()` → `window.printerAPI.getStatus()`
    - `connectPrinter(config)` → `window.printerAPI.connect(config)`
    - `printReceipt(transactionData)` → `window.printerAPI.printReceipt(transactionData)`
    - `ensureConnected()` → refreshes status and attempts auto-connect from saved config
  - `useReceiptPrintingFlow()` orchestrates “start printing / retry / skip”.
- `packages/renderer/src/features/sales/services/receipt-generator.ts`
  - ESC/POS receipt generation utility (`ReceiptGenerator`) that can output a string or `Buffer`.
  - Can be used with custom widths via `charactersPerLine` options.
- `packages/renderer/src/services/hardware/printer/components/printer-setup-dialog.tsx`
  - UI for selecting a COM port and saving it for auto-connect.

### Preload (Renderer ↔ Main bridge)

- `packages/preload/src/api/system.ts`
  - Defines `printerAPI` (thermal) and `officePrinterAPI` (office printers).
- `packages/preload/src/index.ts`
  - `contextBridge.exposeInMainWorld("printerAPI", printerAPI);`
- `packages/preload/src/types/api/system.ts`
  - Type definitions for `window.printerAPI` (contract surface).

### Main process (IPC handlers + hardware)

- `packages/main/src/index.ts`
  - Imports services to register IPC handlers:
    - `./services/thermalPrinterService.js`
    - `./services/officePrinterService.js`
    - `./services/pdfReceiptService.js` (used for “Download Receipt”, not thermal printing)
- `packages/main/src/services/thermalPrinterService.ts`
  - Thermal printer implementation using `node-thermal-printer`.
  - Registers IPC handlers (on import) via `ipcMain.handle(...)`.
  - Converts `TransactionData` into ESC/POS bytes using shared formatter.
- `packages/shared/src/receipts/escpos.ts`
  - Shared ESC/POS receipt formatter (dynamic characters-per-line).
- `packages/main/src/services/officePrinterService.ts`
  - Office printer implementation using `pdf-to-printer` (not used for thermal receipt printing).

---

## Runtime flow (what happens when you click “Print Receipt”)

### 1) Payment completes → show receipt options modal

1. A transaction is completed in `usePayment.completeTransaction(...)` (`packages/renderer/src/features/sales/hooks/use-payment.ts`).
2. `checkPrinterStatus()` runs:
   - Calls `window.printerAPI.getStatus()`.
   - Stores `{ connected, error }` in `printerStatus` state.
3. `handleReceiptAfterTransaction(...)` builds a `TransactionData` object (receipt model) and sets:
   - `completedTransactionData`
   - `showReceiptOptions = true`
4. `NewTransactionView` renders:
   - `<ReceiptOptionsModal ... printerStatus={payment.printerStatus} />`

### 2) User clicks “Print Receipt”

1. Click in `ReceiptOptionsModal` triggers `onPrint`.
2. `onPrint` is wired to `payment.handlePrintReceipt` (`use-payment.ts`).
3. `handlePrintReceipt()` calls:
   - `startPrintingFlow(completedTransactionData)`
4. `startPrintingFlow()` comes from `useReceiptPrintingFlow()` (`use-thermal-printer.ts`):
   - Calls `ensureConnected()` to refresh status (and auto-connect if possible).
   - Calls `printReceipt(transactionData)` (from `useThermalPrinter()`).
5. `useThermalPrinter.printReceipt()` calls:
   - `window.printerAPI.printReceipt(transactionData)`

### 3) Preload forwards request to the main process

In `packages/preload/src/api/system.ts`:

- `window.printerAPI.printReceipt(transactionData)`
  - calls `ipcRenderer.invoke("printer:printReceipt", transactionData)`

### 4) Main process should print via the thermal printer service

Intended responsibilities (main process):

1. Receive IPC request (`ipcMain.handle(...)`)
2. Ensure printer is initialized/connected
3. Convert transaction data to ESC/POS bytes (Buffer)
4. Send bytes to `node-thermal-printer` using `raw(Buffer)` (preferred) and execute print
5. Return success/failure to renderer

---

## Note: previous IPC mismatch

Older builds had an IPC channel mismatch (e.g. preload calling `printer:getStatus` while main only registered `printer:status`), which caused `No handler registered for 'printer:getStatus'`.

The current implementation registers the **canonical channels** used by preload (`printer:getStatus`, `printer:connect`, `printer:printReceipt`, `printer:cancelPrint`, `printer:getAvailableInterfaces`) and keeps the older ones as aliases.

---

## Notes on receipt formatting (ESC/POS)

- `packages/shared/src/receipts/escpos.ts` generates ESC/POS commands (latin1) for **58mm or 80mm** layouts.
- `packages/main/src/services/thermalPrinterService.ts` converts `TransactionData` to ESC/POS bytes and prints using `raw(Buffer)` (preferred).

---

## Receipt layout (Lidl-style, Metapace T-3 80mm / 48cpl)

The shared formatter (`packages/shared/src/receipts/escpos.ts`) now prints a compact “Lidl-style” layout at **80mm (48 chars/line)**:

- **Header**
  - Store name (double-width + double-height, centered)
  - Address / phone / VAT number (centered)
  - Optional extra header lines via `headerLines[]`
- **Transaction block**
  - Receipt number, date/time, cashier
- **Items block**
  - Each item prints as `NAME (left)` + `£AMOUNT (right)` on the same line when possible
  - Quantity/unit price is printed on the next line (compact)
  - Long names wrap cleanly without breaking alignment
- **Totals + payment**
  - `TOTAL` is bold/emphasized
  - Payment line prints `CASH` (+ change) or `CARD` (+ amount)
- **Customer copy + card slip (only when card slip data exists)**
  - Prints `*CUSTOMER COPY* - PLEASE RETAIN RECEIPT`
  - Prints Viva Wallet card slip fields when available (brand, last4 masked, auth code, TID, TRN)
  - These fields are **persisted on the transaction** at sale time so reprints show the same slip
- **VAT summary**
  - Prints a small VAT table (grouped by effective VAT rate when item VAT is available)
  - Falls back to a simplified single-rate summary derived from `subtotal`/`tax`
- **Barcode**
  - Prints a Code128 barcode (defaults to receipt number) + the human readable value beneath

### Where card slip fields come from

For Viva Wallet sales, the app fetches the terminal `/status` payload at completion and stores:

- `transactions.viva_wallet_auth_code`
- `transactions.viva_wallet_card_brand`
- `transactions.viva_wallet_card_last4`
- `transactions.viva_wallet_card_type`

The thermal print path (`ThermalPrinterService.buildReceiptBuffer`) loads the saved transaction by ID and injects these fields into the ESC/POS builder so **reprints remain consistent**.

---

## Windows setup + verification checklist (Metapace T-3, COM port, 80mm)

1. **Connect the printer** via USB and confirm Windows assigns a COM port:
   - Device Manager → Ports (COM & LPT) → note the COM number (e.g. COM3).
2. In the app, complete a transaction to reach the receipt modal.
3. If the printer is disconnected, click **Connect Printer** and select the COM port.
   - This saves `printer_config` in `localStorage` for auto-connect.
4. Click **Print Receipt**.
5. Verify:
   - Text is not clipped (80mm layout).
   - Long product names wrap cleanly.
   - Paper cut triggers at the end (if supported by the printer firmware/settings).
6. If printing fails:
   - Re-open **Connect Printer** and reselect the COM port.
   - Check that no other process is holding the port.
   - Confirm the printer is in ESC/POS mode / correct driver settings for raw printing.

---

## Quick file map (copy/paste)

- **Receipt modal UI**: `packages/renderer/src/features/sales/components/payment/receipt-options-modal.tsx`
- **Payment completion + receipt option handlers**: `packages/renderer/src/features/sales/hooks/use-payment.ts`
- **Thermal printer hooks (renderer)**: `packages/renderer/src/services/hardware/printer/hooks/use-thermal-printer.ts`
- **Preload printer bridge**: `packages/preload/src/api/system.ts` + `packages/preload/src/index.ts`
- **Main thermal printer service**: `packages/main/src/services/thermalPrinterService.ts`
- **Main bootstrap (imports services)**: `packages/main/src/index.ts`

