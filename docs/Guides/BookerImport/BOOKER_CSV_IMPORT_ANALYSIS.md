# Booker CSV Import - Detailed Field Mapping Analysis

> **Analysis Date:** December 2025  
> **Files Analyzed:**
>
> - `StockHolding_Department_Report_31141213_2025-11-18.csv`
> - `StockHolding_Product_Report_31141213_2025-11-18-888.csv`

---

## 📋 Table of Contents

1. [Import Entry Points](#import-entry-points)
2. [Import Flow Architecture](#import-flow-architecture)
3. [Department Report Analysis](#department-report-analysis)
4. [Product Report Analysis](#product-report-analysis)
5. [Field Mapping Details](#field-mapping-details)
6. [Data Transformations](#data-transformations)

---

## 🚪 Import Entry Points

### 1. Department Report Import

**UI Location:** Category Management Page  
**Component:** `packages/renderer/src/views/dashboard/pages/manager/views/stock/manage-categories-view.tsx`  
**Modal Component:** `ImportBookerModal` with `importType="department"`

**Trigger Flow:**

```
User clicks "Import Booker CSV" button
  ↓
ImportBookerModal opens (importType="department")
  ↓
User selects: StockHolding_Department_Report_*.csv
  ↓
File is parsed → Preview shown → Import executed
```

**IPC Handler:** `import:booker:department`  
**Handler Location:** `packages/main/src/ipc/bookerImportHandlers.ts` (lines 161-226)

### 2. Product Report Import

**UI Location:** Product Management Page  
**Component:** `packages/renderer/src/views/dashboard/pages/manager/views/stock/manage-product-view.tsx`  
**Modal Component:** `ImportBookerModal` with `importType="product"`

**Trigger Flow:**

```
User clicks "Import Booker CSV" button
  ↓
ImportBookerModal opens (importType="product")
  ↓
User selects: StockHolding_Product_Report_*.csv
  ↓
File is parsed → Preview shown → Import executed
```

**IPC Handler:** `import:booker:product`  
**Handler Location:** `packages/main/src/ipc/bookerImportHandlers.ts` (lines 231-320)

---

## 🔄 Import Flow Architecture

### Complete Import Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│ RENDERER PROCESS (UI)                                       │
│                                                             │
│  ImportBookerModal Component                                │
│  ├─ Step 1: Select File                                     │
│  │   └─ window.importAPI.selectFile(importType)            │
│  ├─ Step 2: Parse File                                      │
│  │   └─ window.importAPI.parseFile(filePath)               │
│  ├─ Step 3: Preview Data                                    │
│  └─ Step 4: Execute Import                                  │
│      ├─ window.importAPI.importDepartments() [Department]   │
│      └─ window.importAPI.importProducts() [Product]        │
└───────────────────────┬─────────────────────────────────────┘
                        │ IPC
┌───────────────────────▼─────────────────────────────────────┐
│ MAIN PROCESS                                              │
│                                                           │
│  IPC Handlers (bookerImportHandlers.ts)                   │
│  ├─ import:booker:selectFile                              │
│  ├─ import:booker:parseFile                                │
│  ├─ import:booker:department                               │
│  └─ import:booker:product                                 │
│                                                           │
│  BookerImportService (bookerImportService.ts)             │
│  ├─ detectFileType()                                      │
│  ├─ parseDepartmentReport()                               │
│  └─ parseProductReport()                                  │
│                                                           │
│  ImportManager (importManager.ts)                         │
│  ├─ importCategories()                                    │
│  ├─ importSuppliers()                                     │
│  └─ importProducts()                                      │
│                                                           │
│  Database Managers                                        │
│  ├─ CategoryManager                                       │
│  ├─ VatCategoryManager                                    │
│  ├─ SupplierManager                                       │
│  ├─ ProductManager                                        │
│  └─ BatchManager                                          │
└───────────────────────────────────────────────────────────┘
```

---

## 📊 Department Report Analysis

### File Structure

**File:** `StockHolding_Department_Report_31141213_2025-11-18.csv`

**Format:**

```
Line 1: Header with timestamp
Line 2: Blank line
Line 3: Column headers
Line 4+: Data rows
Last line: Totals row (skipped)
```

**CSV Columns (7 total):**

1. `Department`
2. `Balance On Hand`
3. `Total Cost Price`
4. `Total Retail Price`
5. `Total VAT Amount`
6. `Total Net Price`
7. `Total Potential Profit`

### Parsing Logic

**Location:** `packages/main/src/services/bookerImportService.ts`  
**Method:** `parseDepartmentReport()` (lines 98-160)

**Process:**

1. **Skip Header Lines:** First 3 lines are skipped (header + blank + column names)
2. **Skip Totals Row:** Any line starting with "Totals" (case-insensitive) is skipped
3. **Parse CSV Line:** Custom parser handles quoted fields
4. **Validate:** Expects exactly 7 columns
5. **Transform:** Maps to `BookerDepartment` interface

### Field Mapping: Department Report → Database

| CSV Column Index | CSV Field Name           | Parsed Field           | Database Table | Database Field | Transformation                             |
| ---------------- | ------------------------ | ---------------------- | -------------- | -------------- | ------------------------------------------ |
| 0                | `Department`             | `department`           | `categories`   | `name`         | `.trim()`                                  |
| 1                | `Balance On Hand`        | `balanceOnHand`        | ❌ Not stored  | -              | `parseNumber()` - Used for validation only |
| 2                | `Total Cost Price`       | `totalCostPrice`       | ❌ Not stored  | -              | `parseNumber()` - Used for validation only |
| 3                | `Total Retail Price`     | `totalRetailPrice`     | ❌ Not stored  | -              | `parseNumber()` - Used for validation only |
| 4                | `Total VAT Amount`       | `totalVatAmount`       | ❌ Not stored  | -              | `parseNumber()` - Used for validation only |
| 5                | `Total Net Price`        | `totalNetPrice`        | ❌ Not stored  | -              | `parseNumber()` - Used for validation only |
| 6                | `Total Potential Profit` | `totalPotentialProfit` | ❌ Not stored  | -              | `parseNumber()` - Used for validation only |

**Note:** Only the `Department` field is actually stored in the database. The other fields are parsed but not persisted - they're aggregate totals that don't need to be stored at the category level.

### Import Process: Department Report

**Location:** `packages/main/src/database/managers/importManager.ts`  
**Method:** `importCategories()` (lines 189-260)

**Steps:**

1. For each department in the parsed data:
   - Check if category exists (by `name` and `businessId`)
   - If exists: Update counter, add to category map
   - If not exists and `createMissingCategories=true`: Create new category
2. Return category map (`department name → category ID`)

**Database Operations:**

- **Table:** `categories`
- **Fields Set:**
  - `id`: Generated UUID
  - `name`: From `department` field (trimmed)
  - `businessId`: From user session
  - `description`: Auto-generated: `"Imported from Booker on [date]"`
  - `vatCategoryId`: `null` (not set from department report)
  - `isActive`: `true` (default)
  - `createdAt`: Current timestamp
  - `updatedAt`: Current timestamp

---

## 📦 Product Report Analysis

### File Structure

**File:** `StockHolding_Product_Report_31141213_2025-11-18-888.csv`

**Format:**

```
Line 1: Header with timestamp
Line 2: Blank line
Line 3: Column headers
Line 4+: Data rows
Last line: Totals row (skipped)
```

**CSV Columns (16 total):**

1. `Department`
2. `Category`
3. `Product Description`
4. `Item Code`
5. `Eans` (can contain multiple barcodes separated by `|`)
6. `Vat Rate` (e.g., "standard rate 20%")
7. `Vat Percentage` (e.g., 20.00)
8. `Supplier Name`
9. `Cost Price`
10. `Retail Price`
11. `Balance On Hand`
12. `Total Cost Price`
13. `Total Retail Price`
14. `Total VAT Amount`
15. `Total Net Price`
16. `Total Potential Profit`

### Parsing Logic

**Location:** `packages/main/src/services/bookerImportService.ts`  
**Method:** `parseProductReport()` (lines 165-243)

**Process:**

1. **Skip Header Lines:** First 3 lines are skipped
2. **Skip Totals Row:** Any line starting with "Totals" (case-insensitive) is skipped
3. **Parse CSV Line:** Custom parser handles quoted fields
4. **Validate:** Expects exactly 16 columns
5. **Special Handling:**
   - **EANs:** Split by `|` character, trim each, filter empty strings → Array
   - **VAT Percentage:** Extracted from `Vat Rate` string using regex `/(\d+(\.\d+)?)/`
6. **Transform:** Maps to `BookerProduct` interface

### Field Mapping: Product Report → Database

#### 1. Products Table

| CSV Column | CSV Field Name                | Parsed Field                | Database Table | Database Field          | Transformation                                |
| ---------- | ----------------------------- | --------------------------- | -------------- | ----------------------- | --------------------------------------------- |
| 2          | `Product Description`         | `productDescription`        | `products`     | `name`                  | `.trim()`                                     |
| 3          | `Item Code`                   | `itemCode`                  | `products`     | `sku`                   | `.trim()`                                     |
| 4          | `Eans`                        | `eans[0]`                   | `products`     | `barcode`               | First EAN from pipe-separated list, `.trim()` |
| 8          | `Cost Price`                  | `costPrice`                 | `products`     | `costPrice`             | `parseNumber()`                               |
| 9          | `Retail Price`                | `retailPrice`               | `products`     | `basePrice`             | `parseNumber()`                               |
| 10         | `Balance On Hand`             | `balanceOnHand`             | `products`     | `stockLevel`            | `parseNumber()` → Updated via batches         |
| 5+6        | `Vat Rate` + `Vat Percentage` | `vatRate` + `vatPercentage` | `products`     | `vatCategoryId`         | Lookup/create VAT category                    |
| 5+6        | `Vat Rate` + `Vat Percentage` | `vatRate` + `vatPercentage` | `products`     | `vatOverridePercent`    | `vatPercentage` value                         |
| 0          | `Department`                  | `department`                | `products`     | `categoryId`            | Lookup category by name                       |
| 10         | `Balance On Hand`             | `balanceOnHand > 0`         | `products`     | `requiresBatchTracking` | Set to `true` if stock > 0                    |

**Additional Fields Set (Defaults):**

- `id`: Generated UUID
- `businessId`: From user session
- `productType`: `"STANDARD"`
- `salesUnit`: `"PIECE"`
- `trackInventory`: `true`
- `isActive`: `true`
- `allowDiscount`: `true`
- `stockRotationMethod`: `"FIFO"`
- `description`: `null`
- `image`: `null`
- `plu`: `null`
- `usesScale`: `false`
- `pricePerKg`: `null`
- `isGenericButton`: `false`
- `genericDefaultPrice`: `null`
- `minStockLevel`: `0`
- `reorderPoint`: `0`
- `allowPriceOverride`: `false`
- `hasExpiry`: `false`
- `shelfLifeDays`: `null`
- `requireIdScan`: `false`
- `restrictionReason`: `null`
- `createdAt`: Current timestamp
- `updatedAt`: Current timestamp

#### 2. Suppliers Table

| CSV Column | CSV Field Name  | Parsed Field   | Database Table | Database Field | Transformation               |
| ---------- | --------------- | -------------- | -------------- | -------------- | ---------------------------- |
| 7          | `Supplier Name` | `supplierName` | `suppliers`    | `name`         | `.trim()`, only if not empty |

**Additional Fields Set (Defaults):**

- `id`: Generated UUID
- `businessId`: From user session
- `email`: `null`
- `phone`: `null`
- `address`: `null`
- `contactPerson`: `null`
- `isActive`: `true`
- `createdAt`: Current timestamp
- `updatedAt`: Current timestamp

**Note:** Supplier is only created if `supplierName` is not empty. Products can have `null` supplier.

#### 3. VAT Categories Table

| CSV Column | CSV Field Name   | Parsed Field    | Database Table  | Database Field | Transformation                                       |
| ---------- | ---------------- | --------------- | --------------- | -------------- | ---------------------------------------------------- |
| 5          | `Vat Rate`       | `vatRate`       | `vatCategories` | `code`         | Parsed from rate string (e.g., "STD", "RED", "ZERO") |
| 6          | `Vat Percentage` | `vatPercentage` | `vatCategories` | `rate`         | Extracted number from rate string or column 6        |

**VAT Rate Parsing Logic:**

- **Location:** `packages/main/src/database/managers/vatCategoryManager.ts`
- **Method:** `parseBookerVatRate()`
- **Mappings:**
  - `"standard rate 20%"` → Code: `"STD"`, Rate: `20.0`
  - `"reduced rate 5%"` → Code: `"RED"`, Rate: `5.0`
  - `"zero rate"` → Code: `"ZERO"`, Rate: `0.0`
  - Other formats: Attempts to extract percentage from string

**Additional Fields Set:**

- `id`: Generated UUID
- `businessId`: From user session
- `name`: Derived from code (e.g., "Standard Rate", "Reduced Rate", "Zero Rate")
- `description`: `null`
- `isActive`: `true`
- `createdAt`: Current timestamp
- `updatedAt`: Current timestamp

#### 4. Product Batches Table

**Created only if:** `balanceOnHand > 0` AND `updateStockLevels = true`

| Source                   | Parsed Field        | Database Table   | Database Field      | Transformation                                              |
| ------------------------ | ------------------- | ---------------- | ------------------- | ----------------------------------------------------------- |
| `itemCode` + Import Date | -                   | `productBatches` | `batchNumber`       | `"[itemCode]-[YYYYMMDD]"` (e.g., "05013668436239-20251118") |
| `Balance On Hand`        | `balanceOnHand`     | `productBatches` | `initialQuantity`   | `parseNumber()`                                             |
| `Balance On Hand`        | `balanceOnHand`     | `productBatches` | `currentQuantity`   | `parseNumber()` (same as initial)                           |
| Import Options           | `defaultExpiryDays` | `productBatches` | `expiryDate`        | `importDate + defaultExpiryDays` (default: 365 days)        |
| Created Product          | `productId`         | `productBatches` | `productId`         | Product ID from previous step                               |
| Import Date              | `importDate`        | `productBatches` | `manufacturingDate` | Import date (assumed received date)                         |
| `Cost Price`             | `costPrice`         | `productBatches` | `costPrice`         | `parseNumber()`                                             |
| Created Supplier         | `supplierId`        | `productBatches` | `supplierId`        | Supplier ID (can be `null`)                                 |

**Additional Fields Set:**

- `id`: Generated UUID
- `businessId`: From user session
- `status`: `"ACTIVE"`
- `createdAt`: Current timestamp
- `updatedAt`: Current timestamp

**Note:** After batch creation, `products.stockLevel` is automatically updated via `BatchManager.updateProductStockFromBatches()` to reflect the sum of all active batches.

#### 5. Stock Movements Table

**Note:** Stock movements are NOT directly created during import. The batch creation process handles stock tracking. Stock movements would be created when:

- Batches are manually adjusted
- Products are sold (reducing batch quantities)
- Stock is manually adjusted

---

## 🔧 Data Transformations

### Number Parsing

**Method:** `parseNumber(value: string): number`  
**Location:** `bookerImportService.ts` (lines 273-277)

**Process:**

1. Trim whitespace
2. Remove all non-numeric characters except `.` and `-`
3. Parse as float
4. Return `0` if `NaN`

**Examples:**

- `"0.00"` → `0`
- `"31.34"` → `31.34`
- `"1,804.47"` → `1804.47` (comma removed)
- `""` → `0`
- `"N/A"` → `0`

### VAT Percentage Extraction

**Method:** `parseVatPercentage(vatRate: string): number`  
**Location:** `bookerImportService.ts` (lines 282-285)

**Process:**

1. Use regex `/(\d+(\.\d+)?)/` to find first number
2. Parse as float
3. Return `0` if no match

**Examples:**

- `"standard rate 20%"` → `20`
- `"reduced rate 5%"` → `5`
- `"zero rate"` → `0`
- `"20.00"` → `20`

### EAN/Barcode Parsing

**Location:** `bookerImportService.ts` (lines 197-201)

**Process:**

1. Split by `|` character
2. Trim each barcode
3. Filter out empty strings
4. Store as array
5. Use first barcode for `products.barcode` field

**Examples:**

- `"05013668436239"` → `["05013668436239"]`
- `"8801048178018|8801048179145"` → `["8801048178018", "8801048179145"]` (first used)
- `""` → `[]` (empty array, barcode set to `null`)

### CSV Line Parsing

**Method:** `parseCSVLine(line: string): string[]`  
**Location:** `bookerImportService.ts` (lines 248-268)

**Process:**

- Custom parser handles quoted fields
- Respects quotes to handle commas within fields
- Splits on commas only when not inside quotes

**Example:**

- `"Blackstrom ",05013668436239` → `["Blackstrom ", "05013668436239"]`
- `"Product, Name",123` → `["Product, Name", "123"]`

---

## 📝 Import Options

### Department Import Options

**Default Settings:**

```typescript
{
  onDuplicateSku: "skip",
  onDuplicateBarcode: "skip",
  createMissingCategories: true,
  categoryNameTransform: "none",
  updateStockLevels: false,  // Departments don't update stock
  stockUpdateMode: "replace",
  mapVatFromPercentage: false,  // Departments don't have VAT
  batchSize: 100,
}
```

### Product Import Options

**Default Settings:**

```typescript
{
  onDuplicateSku: "update",  // Update existing products
  onDuplicateBarcode: "skip",  // Skip if barcode exists
  createMissingCategories: true,  // Auto-create categories from departments
  categoryNameTransform: "none",
  updateStockLevels: true,  // Create batches and update stock
  stockUpdateMode: "replace",
  mapVatFromPercentage: true,  // Create VAT categories from rates
  batchSize: 100,
  defaultExpiryDays: 365,  // Default expiry for batches
  importDate: new Date(),  // Used for batch naming
}
```

---

## 🔍 Key Implementation Details

### 1. File Type Detection

**Location:** `bookerImportService.ts` (lines 85-93)

**Logic:**

- Checks if content includes `"Stock Holding (Department) Report"` → `"department"`
- Checks if content includes `"Stock Holding (Product) Report"` → `"product"`
- Otherwise → `"unknown"`

### 2. Duplicate Handling

**SKU Duplicates:**

- `"skip"`: Skip product, add to `productsSkipped`
- `"update"`: Update existing product with new data
- `"error"`: Add error to result, skip product

**Barcode Duplicates:**

- `"skip"`: Skip product if barcode already exists
- `"update"`: Update existing product
- `"error"`: Add error to result

### 3. Category Auto-Creation

When importing products:

- If product has a `department` that doesn't exist as a category:
  - If `createMissingCategories=true`: Create category automatically
  - Otherwise: Skip product with warning

### 4. Batch Creation Logic

**Conditions for Batch Creation:**

1. `productId` exists (product was created/updated)
2. `updateStockLevels = true`
3. `balanceOnHand > 0`

**Batch Number Format:**

- `"[itemCode]-[YYYYMMDD]"`
- Example: `"05013668436239-20251118"`

**Duplicate Batch Prevention:**

- Checks if batch with same `batchNumber` and `productId` exists
- If exists: Skip creation (to avoid double-counting on re-import)

### 5. Stock Level Synchronization

After batch creation:

- `BatchManager.updateProductStockFromBatches()` is called
- Updates `products.stockLevel` = SUM of all `ACTIVE` batches' `currentQuantity`
- Ensures consistency between product stock and batch quantities

---

## 📊 Summary

### Department Report Import

- **Purpose:** Create/update categories (departments)
- **Database Impact:** `categories` table only
- **Fields Used:** `Department` (mapped to `categories.name`)
- **Other Fields:** Parsed but not stored (aggregate totals)

### Product Report Import

- **Purpose:** Create/update products, suppliers, VAT categories, and batches
- **Database Impact:**
  - `categories` (auto-created if missing)
  - `vatCategories` (created from VAT rates)
  - `suppliers` (created from supplier names)
  - `products` (main product data)
  - `productBatches` (created for products with stock)
  - `products.stockLevel` (updated from batches)
- **Fields Used:** All 16 columns, with various transformations

---

## 🔗 Related Files

### Core Import Logic

- `packages/main/src/services/bookerImportService.ts` - CSV parsing
- `packages/main/src/database/managers/importManager.ts` - Import orchestration
- `packages/main/src/ipc/bookerImportHandlers.ts` - IPC handlers

### UI Components

- `packages/renderer/src/views/dashboard/pages/manager/views/stock/components/import-booker-modal.tsx` - Import modal
- `packages/renderer/src/views/dashboard/pages/manager/views/stock/manage-categories-view.tsx` - Category management page
- `packages/renderer/src/views/dashboard/pages/manager/views/stock/manage-product-view.tsx` - Product management page

### Preload API

- `packages/preload/src/api/import.ts` - Renderer API interface

### Documentation

- `docs/BookerImport/BOOKER_DATA_IMPORT_PLAN.md` - Implementation plan
