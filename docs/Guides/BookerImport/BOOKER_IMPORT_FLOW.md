# Import from Booker — Complete Flow Documentation

> **Scope:** This document describes the end-to-end flow when the **Import from Booker** button is clicked in **Product Management** (the product list view) in the AuraSwift desktop app, including every file and function involved.

---

## Table of Contents

1. [Overview](#1-overview)
2. [High-Level Flow](#2-high-level-flow)
3. [Entry Point & UI](#3-entry-point--ui)
4. [Step-by-Step Flow](#4-step-by-step-flow)
5. [Files & Functions Reference](#5-files--functions-reference)
6. [IPC Channels](#6-ipc-channels)
7. [Data Structures](#7-data-structures)
8. [Progress & Completion](#8-progress--completion)

---

## 1. Overview

When the user clicks **Import from Booker** on the **Product Management** page (“Manage all menu items and inventory”):

1. A modal opens (`ImportBookerModal` with `importType="product"`).
2. The user selects a Booker **Product** CSV (`Stock Holding (Product) Report`).
3. The file is parsed, previewed, and then imported.
4. Products, categories (from departments), suppliers, VAT categories, and batches are created/updated in the database.
5. Progress is streamed to the UI; on success, the product list and stats refresh.

The same **Import from Booker** button exists on **Category Management**; there the modal uses `importType="department"` and imports only department/category data. This doc focuses on the **Product Management** (product) flow.

---

## 2. High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ RENDERER (UI)                                                               │
│                                                                             │
│  ProductDetailsView (Product Management)                                    │
│  └─ Button "Import from Booker" onClick → setImportModalOpen(true)          │
│                                                                             │
│  ImportBookerModal (importType="product")                                   │
│  ├─ Step "select"  → Select CSV → window.importAPI.selectFile("product")   │
│  ├─ Step "preview" → Parse      → window.importAPI.parseFile(path)         │
│  └─ Step "import"  → Execute    → window.importAPI.importProducts(...)     │
│       └─ Subscribe: window.importAPI.onProgress(callback)                   │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │ IPC (preload → main)
┌───────────────────────────────────────▼─────────────────────────────────────┐
│ MAIN PROCESS                                                               │
│                                                                             │
│  bookerImportHandlers.ts                                                   │
│  ├─ import:booker:selectFile  → Electron dialog → return path              │
│  ├─ import:booker:parseFile   → BookerImportService.parseFile              │
│  └─ import:booker:product     → ImportManager.importBookerData             │
│       └─ Progress: event.sender.send("import:booker:progress", progress)   │
│                                                                             │
│  BookerImportService (parseFile)                                            │
│  └─ detectFileType → parseProductReport → BookerProduct[]                  │
│                                                                             │
│  ImportManager.importBookerData                                             │
│  ├─ importCategories (departmentData) → categoryMap                        │
│  ├─ importSuppliers (productData)     → supplierMap                        │
│  └─ importProducts (productData, categoryMap, supplierMap)                 │
│       ├─ VatCategoryManager.getOrCreateVatCategory                         │
│       ├─ ProductManager.getProductBySKU / updateProduct / insert            │
│       └─ BatchManager.createBatch (when updateStockLevels && stock > 0)    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Entry Point & UI

### 3.1 Where the button lives

- **Page:** Product Management (product list).
- **View:** `ProductDetailsView` (nested under `ProductManagementView` when `currentView === productList`).
- **File:** `packages/renderer/src/features/inventory/views/product-details-view.tsx`

### 3.2 Button and modal wiring

```tsx
// product-details-view.tsx
const [importModalOpen, setImportModalOpen] = useState(false);

<Button onClick={() => setImportModalOpen(true)}>
  <FileSpreadsheet /> Import from Booker
</Button>

<ImportBookerModal
  open={importModalOpen}
  onOpenChange={setImportModalOpen}
  importType="product"
  onSuccess={onProductsImported}
/>
```

- **Click:** `setImportModalOpen(true)` → modal opens.
- **`importType="product"`** → Product CSV flow (not department).
- **`onSuccess`** → `onProductsImported` from parent (`ProductManagementView`), which invalidates caches, then calls `loadProducts` and `loadProductStats`.

### 3.3 Navigation context

- **Product Management** is a nested view under the inventory feature.
- `ProductManagementView` renders `ProductDetailsView` when the nested route is `productList`.
- **Config:** `packages/renderer/src/features/inventory/config/navigation.ts` — `PRODUCT_LIST: "productList"`.
- **Registry:** `packages/renderer/src/navigation/registry/view-registry.ts` (inventory/product management views).

---

## 4. Step-by-Step Flow

### Phase 1: Modal opens (step `"select"`)

1. User clicks **Import from Booker** in Product Management.
2. `product-details-view` sets `importModalOpen` to `true`.
3. `ImportBookerModal` mounts with `importType="product"`, `open={true}`.
4. Modal shows step **select**: “Select a Booker CSV file to import products”.
5. User clicks **Select CSV File** → `handleSelectFile` runs.

### Phase 2: File selection (IPC)

6. **`handleSelectFile`** (`import-booker-modal.tsx`):
   - Calls `window.importAPI.selectFile(importType)` → `importType` is `"product"`.
7. **Preload** (`packages/preload/src/api/import.ts`):
   - `importAPI.selectFile` → `ipcRenderer.invoke('import:booker:selectFile', fileType)`.
8. **Main** (`bookerImportHandlers.ts`):
   - Handler `import:booker:selectFile` runs.
   - `dialog.showOpenDialog` (Electron) with filters `["csv"]`, `["*"]`.
   - Returns `{ success: true, filePath }` or `{ success: false, message }`.
9. Modal receives path → `setSelectedFile(response.filePath)` then calls **`handleParseFile(response.filePath)`**.

### Phase 3: Parse file (IPC)

10. **`handleParseFile`** (`import-booker-modal.tsx`):
    - `window.importAPI.parseFile(filePath)`.
11. **Preload:** `ipcRenderer.invoke('import:booker:parseFile', filePath)`.
12. **Main** (`bookerImportHandlers.ts`):
    - Handler `import:booker:parseFile` → `bookerImportService.parseFile(filePath)`.
13. **`BookerImportService`** (`packages/main/src/services/bookerImportService.ts`):
    - `fs.promises.readFile(filePath, 'utf-8')`.
    - **`detectFileType(content)`**: looks for `"Stock Holding (Product) Report"` → `"product"`; `"Stock Holding (Department) Report"` → `"department"`; else `"unknown"`.
    - **`parseProductReport(content)`**:
      - Split lines (`\r\n|\r|\n`), skip first 3 header lines.
      - Skip “totals” row.
      - For each data line: **`parseCSVLine`** (handles quotes), expect ≥16 columns.
      - Map to `BookerProduct`: department, category, productDescription, itemCode, eans, vatRate, vatPercentage, supplierName, costPrice, retailPrice, balanceOnHand, etc.
      - **`parseNumber`** / **`parseVatPercentage`** for numeric fields.
    - Returns `ParseResult<BookerProduct>`: `{ success, data, fileType, errors, warnings, rowCount, validRowCount }`.
14. Handler returns that result to renderer.
15. Modal:
    - If `fileType !== "product"` → error “This appears to be a Department report…” and stay on select.
    - If parsing errors → show errors, stay on select.
    - Otherwise → `setParsedData`, `setParseErrors`, `setParseWarnings`, `setStep("preview")`.

### Phase 4: Preview (step `"preview"`)

16. Modal renders **preview**: table of `parsedData` (product, SKU, price, stock), max 100 rows, plus “... and N more”.
17. User clicks **Import N Items** → **`handleImport`** runs.

### Phase 5: Import execution (IPC)

18. **`handleImport`** (`import-booker-modal.tsx`):
    - Ensures `user?.businessId` exists.
    - `setImporting(true)`, `setStep("import")`, `setError(null)`.
    - Builds **`ImportOptions`**:
      - `onDuplicateSku: "update"`, `onDuplicateBarcode: "skip"`, `createMissingCategories: true`, `updateStockLevels: true`, `mapVatFromPercentage: true`, `batchSize: 100`, `defaultExpiryDays: 365`.
    - Because `importType === "product"`:
      - `importResult = await window.importAPI.importProducts(parsedData, user.businessId, options)`.
19. **Preload:** `ipcRenderer.invoke('import:booker:product', productData, businessId, options)`.
20. **Progress subscription** (modal `useEffect` when `open`):
    - `window.importAPI.onProgress(callback)` → `ipcRenderer.on('import:booker:progress', ...)`.
    - Main sends progress via `event.sender.send('import:booker:progress', progress)`; modal updates `progress` state and UI.

### Phase 6: Main-side import (`import:booker:product`)

21. **Handler `import:booker:product`** (`bookerImportHandlers.ts`):
    - `getDatabase()`, `getDrizzle()`.
    - `new ImportManager(drizzle, { v4: uuidv4 })`.
    - Progress callback: `(p) => event.sender.send('import:booker:progress', p)`.
    - **Department data from products:**  
      Collect unique `product.department` from `productData` → build `departmentData`: `[{ department, balanceOnHand: 0, totalCostPrice: 0, ... }]`.
    - **`importManager.importBookerData(departmentData, productData, businessId, fullOptions)`** with product-specific options (e.g. `onDuplicateSku: "update"`, `updateStockLevels: true`, `mapVatFromPercentage: true`).
22. **`ImportManager.importBookerData`** (`packages/main/src/database/managers/importManager.ts`):
    - **Phase 1 — Categories:**  
      **`importCategories(departmentData, businessId, options, result)`**:
      - For each department: lookup category by `(businessId, name)`; if missing and `createMissingCategories`, **`categoryManager.createCategory`**.
      - Build **`categoryMap`**: department name → category id.
      - Emit progress `stage: "categories"`.
    - **Phase 2 — Suppliers:**  
      **`importSuppliers(productData, businessId, options, result)`**:
      - Unique `supplierName` from products.
      - For each: lookup supplier by `(businessId, name)`; if missing, insert into `suppliers`.
      - Build **`supplierMap`**: name → id.
      - Emit progress `stage: "suppliers"`.
    - **Phase 3 — Products (and batches):**  
      **`importProducts(productData, businessId, categoryMap, supplierMap, options, result)`**:
      - For each `BookerProduct`:
        - `categoryId = categoryMap.get(product.department)`; skip if missing.
        - `supplierId = supplierMap.get(product.supplierName)`.
        - **VAT:**  
          If `mapVatFromPercentage` and `product.vatRate`: **`vatCategoryManager.parseBookerVatRate`** → **`getOrCreateVatCategory(product.vatRate, businessId)`** → `vatCategoryId`.
        - **Product:**
          - **`productManager.getProductBySKU(product.itemCode)`**.
          - If exists and `onDuplicateSku === "update"`: **`productManager.updateProduct`** (name, basePrice, costPrice, barcode, categoryId, vatCategoryId, etc.); `productsUpdated++`.
          - If not exists: insert into `products` (via Drizzle); `productsCreated++`.
        - **Batch (if `updateStockLevels` and `balanceOnHand > 0`):**
          - Batch number `{itemCode}-{YYYYMMDD}`.
          - **`batchManager.createBatch`** (productId, batchNumber, expiry, quantities, supplierId, costPrice, businessId, etc.).
          - Update product `stockLevel` (replace or add per `stockUpdateMode`).
          - Increment `batchesCreated`.
        - Emit progress `stage: "products"` with `processed`, `succeeded`, `failed`, `currentItem`.
    - Set `result.success = (result.errors.length === 0)`, `result.duration`, return **`ImportResult`**.

### Phase 7: Result and UI update

23. Handler returns `ImportResult` to renderer.
24. Modal: `setResult(importResult)`, `setStep("complete")`, `setImporting(false)`.
25. **Complete** step shows counts (categories created/updated, VAT categories, suppliers, products created/updated, batches, skipped) and any errors/warnings.
26. **`onSuccess`** (`useEffect` when `result` and `onSuccess`):
    - If any of `productsCreated`, `productsUpdated`, `categoriesCreated`, `categoriesUpdated` is greater than 0 → call **`onProductsImported()`**.
27. **`onProductsImported`** (from `ProductManagementView`):
    - **`invalidateAllCaches(user.businessId)`** (`@/shared/utils/simple-cache`).
    - **`loadProducts()`** (paginated product list).
    - **`loadProductStats()`** (stats for dashboard).

User closes modal → `onOpenChange(false)` → modal resets state (step, file, parsed data, etc.) after 300ms.

---

## 5. Files & Functions Reference

### Renderer (UI)

| File | Function / export | Role |
|------|-------------------|------|
| `packages/renderer/src/features/inventory/views/product-details-view.tsx` | Component `ProductDetailsView` | Product Management UI; hosts Import button and modal. |
| | `useState(false)` → `importModalOpen` | Toggles modal visibility. |
| | `onClick` → `setImportModalOpen(true)` | Opens Import modal. |
| | `ImportBookerModal` with `importType="product"`, `onSuccess={onProductsImported}` | Modal instance for product import. |
| `packages/renderer/src/features/inventory/components/shared/import-booker-modal.tsx` | Component `ImportBookerModal` | Modal: select → parse → preview → import → complete. |
| | `handleSelectFile` | Calls `importAPI.selectFile(importType)`, then `handleParseFile`. |
| | `handleParseFile` | Calls `importAPI.parseFile`, validates `fileType`, sets `parsedData` / errors, moves to preview. |
| | `handleImport` | Builds `ImportOptions`, calls `importAPI.importProducts` or `importDepartments` by `importType`. |
| | `useEffect` (progress) | Subscribes to `importAPI.onProgress`, updates `progress` state. |
| | `useEffect` (result + onSuccess) | Calls `onSuccess` when result has imported items. |
| `packages/renderer/src/features/inventory/views/product-management-view.tsx` | `viewComponents.productList` | Renders `ProductDetailsView` for product list. |
| | `onProductsImported` | Invalidates caches, `loadProducts`, `loadProductStats`. |
| `packages/renderer/src/features/inventory/config/navigation.ts` | `PRODUCT_LIST`, etc. | Nested route ids for product management. |
| `packages/renderer/src/navigation/registry/view-registry.ts` | Inventory / product management views | View registry. |
| `packages/renderer/src/types/features/import/index.ts` | `ImportProgress`, `ImportResult`, `ImportOptions` | Types used by modal. |

### Preload & API

| File | Function / export | Role |
|------|-------------------|------|
| `packages/preload/src/api/import.ts` | `importAPI` | Exposes import methods to renderer via IPC. |
| | `selectFile(fileType)` | `ipcRenderer.invoke('import:booker:selectFile', fileType)`. |
| | `parseFile(filePath)` | `ipcRenderer.invoke('import:booker:parseFile', filePath)`. |
| | `importProducts(data, businessId, options)` | `ipcRenderer.invoke('import:booker:product', ...)`. |
| | `onProgress(callback)` | Subscribe to `import:booker:progress`. |
| `packages/preload/src/index.ts` | `contextBridge.exposeInMainWorld("importAPI", importAPI)` | Makes `window.importAPI` available in renderer. |

### Main process

| File | Function / export | Role |
|------|-------------------|------|
| `packages/main/src/index.ts` | `initApp` | Registers IPC handlers during app init. |
| | `registerBookerImportHandlers()` | Registers Booker import IPC handlers. |
| `packages/main/src/ipc/bookerImportHandlers.ts` | `registerBookerImportHandlers` | Registers all `import:booker:*` handlers. |
| | `import:booker:selectFile` | Uses `dialog.showOpenDialog`, returns `{ success, filePath }`. |
| | `import:booker:parseFile` | Delegates to `BookerImportService.parseFile`. |
| | `import:booker:product` | Builds `departmentData` from products, creates `ImportManager`, calls `importBookerData`, sends progress. |
| `packages/main/src/services/bookerImportService.ts` | `BookerImportService` | Parses Booker CSV. |
| | `parseFile(filePath)` | Reads file, `detectFileType`, then `parseDepartmentReport` or `parseProductReport`. |
| | `detectFileType(content)` | Detects "Stock Holding (Product/Department) Report". |
| | `parseProductReport(content)` | Parses product CSV into `BookerProduct[]`. |
| | `parseCSVLine(line)` | CSV parsing with quoted fields. |
| | `parseNumber`, `parseVatPercentage` | Numeric parsing. |
| | `validateData` | Validates products (used by validate handler; product import uses parse + options). |
| `packages/main/src/database/managers/importManager.ts` | `ImportManager` | Orchestrates categories, suppliers, products, batches. |
| | `importBookerData(departmentData, productData, businessId, options)` | Runs categories → suppliers → products; returns `ImportResult`. |
| | `importCategories(...)` | Creates/updates categories, returns `categoryMap`. |
| | `importSuppliers(...)` | Creates/updates suppliers, returns `supplierMap`. |
| | `importProducts(...)` | Creates/updates products, VAT categories, batches; updates stock. |
| `packages/main/src/database/managers/categoryManager.ts` | `CategoryManager.createCategory` | Used by `importCategories`. |
| `packages/main/src/database/managers/productManager.ts` | `getProductBySKU`, `getProductById`, `updateProduct` | Used by `importProducts`. |
| `packages/main/src/database/managers/batchManager.ts` | `BatchManager.createBatch` | Creates batches when `updateStockLevels` and stock &gt; 0. |
| `packages/main/src/database/managers/vatCategoryManager.ts` | `parseBookerVatRate`, `getVatCategoryByCode`, `getOrCreateVatCategory` | VAT handling during product import. |

### Shared / utils

| File | Function | Role |
|------|----------|------|
| `packages/renderer/src/shared/utils/simple-cache.ts` | `invalidateAllCaches(businessId)` | Called from `onProductsImported`. |
| `packages/renderer/src/shared/hooks/use-auth.ts` | `useAuth` → `user`, `user.businessId` | Used by modal and product view. |

---

## 6. IPC Channels

| Channel | Direction | Payload | Purpose |
|--------|-----------|---------|---------|
| `import:booker:selectFile` | Renderer → Main | `fileType: 'department' \| 'product'` | Open file dialog, return path. |
| `import:booker:parseFile` | Renderer → Main | `filePath: string` | Parse CSV, return `ParseResult`. |
| `import:booker:validate` | Renderer → Main | `(data, businessId)` | Validate parsed data (optional). |
| `import:booker:product` | Renderer → Main | `(productData, businessId, options)` | Run product import. |
| `import:booker:department` | Renderer → Main | `(departmentData, businessId, options)` | Run department-only import (Category Management). |
| `import:booker:execute` | Renderer → Main | `(departmentData, productData, businessId, options)` | Full import (both); not used by Product Management flow. |
| `import:booker:progress` | Main → Renderer | `ImportProgress` | Stream progress during import. |

---

## 7. Data Structures

### BookerProduct (main)

```ts
interface BookerProduct {
  department: string;
  category: string;
  productDescription: string;
  itemCode: string;           // SKU
  eans: string[];             // barcodes
  vatRate: string;
  vatPercentage: number;
  supplierName: string;
  costPrice: number;
  retailPrice: number;
  balanceOnHand: number;
  totalCostPrice: number;
  totalRetailPrice: number;
  totalVatAmount: number;
  totalNetPrice: number;
  totalPotentialProfit: number;
}
```

### ImportOptions (product flow)

- `onDuplicateSku: "update"`, `onDuplicateBarcode: "skip"`, `createMissingCategories: true`, `updateStockLevels: true`, `mapVatFromPercentage: true`, `batchSize: 100`, `defaultExpiryDays: 365`.

### ImportProgress

- `stage`: `"categories" | "suppliers" | "products" | "complete"`, `total`, `processed`, `succeeded`, `failed`, `currentItem?`.

### ImportResult

- `success`, `categoriesCreated`, `categoriesUpdated`, `vatCategoriesCreated`, `suppliersCreated`, `suppliersUpdated`, `productsCreated`, `productsUpdated`, `productsSkipped`, `batchesCreated`, `errors[]`, `warnings[]`, `duration`.

---

## 8. Progress & Completion

- **Progress:** Main calls `onProgress` (from options) inside `importCategories`, `importSuppliers`, and `importProducts`. The product handler wraps this and sends `import:booker:progress` to the renderer. The modal subscribes via `importAPI.onProgress` and shows a progress bar and “Processing data” / `currentItem`.
- **Completion:** When `importProducts` resolves, the modal shows the **complete** step with `ImportResult` and a **Close** button. If any items were imported, `onSuccess` runs → `onProductsImported` → cache invalidation, `loadProducts`, `loadProductStats`, so the Product Management list and stats reflect the new data.

---

## Summary

**Product Management → Import from Booker** flow:

1. **UI:** `ProductDetailsView` button → `ImportBookerModal` (`importType="product"`).
2. **Select:** `importAPI.selectFile("product")` → `import:booker:selectFile` → native dialog → path.
3. **Parse:** `importAPI.parseFile(path)` → `import:booker:parseFile` → `BookerImportService.parseFile` → `parseProductReport` → `BookerProduct[]`.
4. **Preview:** Modal shows parsed data; user confirms.
5. **Import:** `importAPI.importProducts(...)` → `import:booker:product` → `ImportManager.importBookerData` (departments from products → categories → suppliers → products + VAT + batches).
6. **Progress:** `import:booker:progress` events → modal progress UI.
7. **Done:** `ImportResult` → complete step → `onSuccess` → `onProductsImported` → invalidate caches, reload products and stats.

All relevant files and functions are listed in [§ 5](#5-files--functions-reference).
