# Deprecated/Legacy/Unused Code Report
**Generated:** 2026-01-28  
**Scope:** `desktop/packages/renderer/src/features`

## Summary

This report identifies deprecated, legacy, and unused code patterns found in the features directory. Items are categorized by severity and type.

---

## 🔴 Critical: Deprecated Type Files (Not Imported)

These type files are marked as deprecated but appear to be **unused** (no imports found). They can likely be **safely removed** after verification.

### Inventory Feature

1. **`inventory/types/import.types.ts`**
   - **Status:** Deprecated, marked for migration to `@/types/features/import`
   - **Usage:** No imports found
   - **Action:** Verify no runtime usage, then delete

2. **`inventory/types/age-restriction.types.ts`**
   - **Status:** Deprecated, marked for migration to `@/types/enums`
   - **Usage:** No imports found (re-exported via `inventory/index.ts` from new location)
   - **Action:** Verify no direct imports, then delete

3. **`inventory/types/batch.types.ts`**
   - **Status:** Deprecated, marked for migration to `@/types/features/batches`
   - **Usage:** ⚠️ **STILL IMPORTED** in:
     - `inventory/views/expiry-dashboard-view.tsx:13`
     - `inventory/hooks/use-batch-form.tsx:17`
   - **Action:** Migrate imports to `@/types/features/batches`, then delete

### Sales Feature

4. **`sales/types/index.ts`**
   - **Status:** Deprecated, all types moved to `@/types`
   - **Usage:** No imports found
   - **Action:** Verify no imports, then delete

5. **`sales/types/shift.types.ts`**
   - **Status:** Deprecated, marked for migration to `@/types/domain`
   - **Usage:** No imports found
   - **Action:** Verify no imports, then delete

6. **`sales/types/transaction.types.ts`**
   - **Status:** Deprecated, marked for migration to `@/types/domain`
   - **Usage:** No imports found
   - **Action:** Verify no imports, then delete

7. **`sales/types/payment.types.ts`**
   - **Status:** Deprecated, marked for migration to `@/types/domain/payment`
   - **Usage:** No imports found (file is empty except for deprecation comment)
   - **Action:** Safe to delete

---

## 🟡 Medium: Legacy Code Patterns (Still in Use)

These are legacy implementations that are still actively used but should be migrated.

### Sales Feature - Legacy Product/Category Hooks

**Location:** `sales/views/new-transaction-view.tsx`

- **Lines 215-231:** `legacyProducts` hook usage
  - Conditionally used when `USE_VIRTUALIZED_PRODUCTS` is false
  - Should be migrated to virtualized version
  - **Status:** Active fallback for non-virtualized mode

- **Lines 263-324:** `legacyCategories` hook usage
  - Conditionally used when `USE_VIRTUAL_CATEGORIES` is false
  - Should be migrated to virtualized version
  - **Status:** Active fallback for non-virtualized mode

**Recommendation:** Monitor feature flags and plan migration timeline.

### Inventory Feature - Legacy Routes

**Location:** `inventory/config/navigation.ts` & `inventory/config/feature-config.ts`

- **Lines 30-60 (navigation.ts):** Legacy nested route constants
  - `PRODUCT_MANAGEMENT`, `BATCH_MANAGEMENT`, and nested variants
  - Marked as "will be migrated to new structure"
  - **Status:** Still referenced in feature-config.ts

- **Lines 91-106 (feature-config.ts):** Legacy route configuration
  - `PRODUCT_MANAGEMENT` route still configured
  - TODO comment: "Replace with InventoryDashboardView after migration"
  - **Status:** Active route, migration pending

**Recommendation:** Complete route migration before removing legacy routes.

### Payment Feature - Legacy Payment Methods

**Location:** `sales/hooks/use-payment.ts:733`

- **Lines 733-739:** Legacy card/mobile payment handling
  - Deprecated in favor of Viva Wallet
  - Shows error toast directing users to Viva Wallet
  - **Status:** Error handler for deprecated payment methods

**Recommendation:** Consider removing after ensuring all payment flows use Viva Wallet.

---

## 🟢 Low: Intentionally Unused Parameters

These are parameters kept for interface compatibility or future use. They're intentionally prefixed with `_` or have eslint-disable comments.

### Sales Feature

1. **`sales/hooks/use-shift.ts:25,37`**
   - `userRole` parameter unused
   - Prefixed with `_` to indicate intentional
   - **Status:** Kept for interface compatibility

2. **`sales/hooks/use-payment.ts:186`**
   - `isShowingStatus` parameter unused
   - Comment: "kept for interface compatibility, will be used in future"
   - **Status:** Future use planned

3. **`sales/components/payment/payment-method-selector.tsx:21`**
   - `cardReaderReady` parameter unused
   - Comment: "Kept for backward compatibility, but Viva Wallet replaces it"
   - **Status:** Backward compatibility

4. **`sales/hooks/use-barcode-scanner.ts:244-246`**
   - `scanLog` and `clearScanLog` from `useProductionScanner` unused
   - **Status:** May be used for debugging in future

5. **`sales/hooks/use-viva-wallet-transaction.ts:67,80`**
   - `handleTransactionEvent` function unused
   - TODO comment: "Implement event listener when IPC events are set up"
   - **Status:** Reserved for future event-based updates

---

## 📝 TODO Comments (Future Work)

### High Priority

1. **`inventory/config/feature-config.ts:81`**
   - TODO: Replace `LazyProductManagementView` with `InventoryDashboardView` after migration
   - Tracking: `docs/TODO_TRACKING.md#3`

2. **`inventory/views/product-management-view.tsx:318`**
   - TODO: Check if product requires batch tracking once field is added to schema
   - Tracking: `docs/TODO_TRACKING.md#2`

3. **`sales/components/modals/age-verification-modal.tsx:114,200`**
   - TODO: Implement ID scanner integration
   - Tracking: `docs/TODO_TRACKING.md#4`
   - Button disabled until implemented

4. **`sales/hooks/use-viva-wallet-transaction.ts:68`**
   - TODO: Implement event listener when IPC events are set up
   - Tracking: `docs/TODO_TRACKING.md#1`

### Low Priority

5. **`dashboard/components/dashboard-header.tsx:42`**
   - TODO: Implement check for meal breaks in shift history
   - `hasMealBreakToday` hardcoded to `false`

---

## 🧹 Cleanup Opportunities

### Removed/Commented Code

1. **`users/views/user-management-view.tsx:5,61`** ✅ **Done**
   - Commented out unused import: `getUserRoleName`
   - Commented out unused variable: `userRole`
   - **Action:** Remove commented code — **completed**

### Schema Legacy Support

2. **`inventory/schemas/product-schema.ts`**
   - Lines 130, 142, 156, 205: Comments about accepting non-UUID strings for legacy IDs
   - **Status:** Intentional backward compatibility
   - **Action:** Document migration plan for legacy ID format

3. **`inventory/schemas/category-schema.ts`**
   - Lines 57, 73: Comments about accepting non-UUID strings for legacy IDs
   - **Status:** Intentional backward compatibility
   - **Action:** Document migration plan for legacy ID format

---

## 🔍 Deprecated Functions

### Dashboard Feature

**`dashboard/hooks/use-feature-visibility.ts`** ✅ **Done**
- Function: `useIsFeatureVisible()` (removed)
- **Status:** Was deprecated, use `useFeatureVisibility()` instead
- **Action:** **Removed** — was not imported elsewhere

---

## 🔷 Other Unused / Legacy (Post Code-Splitting Refactor)

These were identified after the `RetryableLazyRoute` / route-level code-splitting refactor. The `/auth` route uses `RetryableLazyRoute` + `authLoader`; the view registry does **not** use auth views.

### Auth Feature – Unused Exports

1. **`authViews`** and **`authFeature`**  
   - **Location:** `auth/config/feature-config.ts`, exported via `auth/index.ts`  
   - **Usage:** No imports found. View registry uses `salesViews`, `usersViews`, `inventoryViews`, etc. only. The `/auth` route uses `RetryableLazyRoute` with `authLoader` → `import("@/features/auth/views/auth-page")`.  
   - **Action:** Consider removing `authViews` / `authFeature` from the auth config and auth index exports if no other code (e.g. main process, tests) relies on them. Verify with repo-wide search first.

2. **`AuthPage`** barrel export  
   - **Location:** `auth/index.ts` exports `AuthPage` from `./views/auth-page`  
   - **Usage:** Auth config imports `AuthPage` directly from `@/features/auth/views/auth-page`. App uses `authLoader` → same path. No imports of `AuthPage` from `@/features/auth`.  
   - **Action:** Potentially unused. Safe to remove from barrel only if no external consumers; verify before deleting.

### Navigation – Unused Export

3. **`isLegacyRoute()`**  
   - **Location:** `navigation/registry/route-mapper.ts`  
   - **Usage:** Exported but never imported. `mapLegacyRoute` is used by view-registry.  
   - **Action:** Remove `isLegacyRoute` (and its export) if not part of a public API. `LEGACY_ROUTE_MAP` is used by `mapLegacyRoute`; keep it.

---

## 📊 Statistics

- **Deprecated Type Files:** 7 (likely safe to remove)
- **Legacy Code Patterns:** 3 active areas
- **Intentionally Unused:** 5 parameters
- **TODO Items:** 5 tracked items
- **Cleanup Opportunities:** 3 areas
- **Other Unused (post code-split):** 3 items (auth exports, `isLegacyRoute`)

---

## 🎯 Recommended Actions

### Immediate (Safe to Remove)
1. Delete deprecated type files after verifying no imports:
   - `inventory/types/import.types.ts` ✅ (no imports found)
   - `inventory/types/age-restriction.types.ts` ✅ (no imports found)
   - `sales/types/index.ts` ✅ (no imports found)
   - `sales/types/shift.types.ts` ✅ (no imports found)
   - `sales/types/transaction.types.ts` ✅ (no imports found)
   - `sales/types/payment.types.ts` ✅ (empty file, safe to delete)

2. **Migrate then delete:**
   - `inventory/types/batch.types.ts` ⚠️ (still imported in 2 files - migrate first)

3. ~~Remove commented code:~~ ✅ **Done**
   - `users/views/user-management-view.tsx` (lines 5, 61)

4. ~~Remove deprecated function if unused:~~ ✅ **Done**
   - `dashboard/hooks/use-feature-visibility.ts` (`useIsFeatureVisible`)

5. ~~Remove `isLegacyRoute`~~ ✅ **Done** from `navigation/registry/route-mapper.ts` (unused export).

6. **Other unused (verify first):**
   - Consider removing `authViews` / `authFeature` from auth config + auth index, and `AuthPage` barrel export, after confirming no external usage.

### Short-term (Plan Migration)
1. Complete inventory route migration
2. Migrate legacy product/category hooks to virtualized versions
3. Remove legacy payment method handlers after Viva Wallet migration

### Long-term (Track TODOs)
1. Implement ID scanner integration
2. Complete IPC event listener setup
3. Implement meal break checking

---

## 🔗 Related Documentation

- TODO Tracking: `docs/TODO_TRACKING.md`
- Migration guides referenced in deprecated type files
- Feature flags: `USE_VIRTUALIZED_PRODUCTS`, `USE_VIRTUAL_CATEGORIES`
