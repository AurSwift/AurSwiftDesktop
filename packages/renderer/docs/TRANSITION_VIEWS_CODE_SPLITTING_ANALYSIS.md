# Transition-Based Views: Code-Splitting Analysis

**Scope:** `desktop/packages/renderer`  
**Purpose:** Detail which transition-based views are code-split (own chunk, lazy-loaded) vs. bundled with the dashboard/route chunk.

---

## 1. What Counts as a “Transition-Based” View?

Transition-based views are **all views in `VIEW_REGISTRY`** that are shown via the navigation system (`navigateTo(viewId)`) while the user stays on the **`/dashboard`** URL. They are **not** URL routes.

- **Routes (URL-based):** `/`, `/auth`, `/dashboard`, `/license` → use **`RetryableLazyRoute`** + **`RouteErrorBoundary`** / **`RetryContext`** (separate chunks; **Retry** re-runs the loader).
- **Transition-based:** Everything else in the registry → shown by swapping the main content when navigating within the app shell.

---

## 2. Registry Overview

The central registry is [`view-registry.ts`](../src/navigation/registry/view-registry.ts). It builds `VIEW_REGISTRY` from:

| Source | Contents |
|--------|----------|
| **Registry itself** | `dashboard` (root) |
| **salesViews** | Sales feature config |
| **usersViews** | Users feature config |
| **inventoryViews** | Inventory feature config |
| **settingsViews** | Settings feature config |
| **staffViews** | Staff feature config |
| **rbacViews** | RBAC feature config |

---

## 3. Per-View Code-Split Status

### 3.1 Root view: `dashboard`

| Field | Value |
|-------|--------|
| **View ID** | `dashboard` |
| **Component** | `DashboardPageWrapper` |
| **Import** | **Static** in `view-registry.ts`: `import { DashboardPageWrapper } from "../components/dashboard-page-wrapper"` |
| **Code-split?** | **No** |
| **Chunk** | Dashboard route chunk (`dashboard-view-*.js`), loaded when user visits `/dashboard` |

**Rationale:** The dashboard root view is the default landing content on `/dashboard`. It’s kept in the dashboard chunk by design so it’s available immediately.

---

### 3.2 Sales views

| View ID | Component | Config | Code-split? | Chunk |
|---------|-----------|--------|-------------|-------|
| `sales:new-transaction` | `NewTransactionView` | `lazy(() => import("../views/new-transaction-view"))` | **Yes** | `new-transaction-view-*.js` |
| `sales:cashier-dashboard` | `CashierDashboardView` | `lazy(() => import("@/features/dashboard/views/cashier-dashboard-view"))` | **Yes** | `cashier-dashboard-view-*.js` |
| `sales:sales-reports` | `SalesReportsView` | `lazy(() => import("../views/sales-reports-view"))` | **Yes** | `sales-reports-view-*.js` |

**`sales:cashier-dashboard`** is code-split. `DashboardPageWrapper` lazy-loads role-specific dashboards (Admin, Manager, Cashier) and no longer statically imports them, so `cashier-dashboard-view` has its own chunk.

---

### 3.3 Users views

| View ID | Component | Config | Code-split? | Chunk |
|---------|-----------|--------|-------------|-------|
| `users:management` (or `USERS_ROUTES.MANAGEMENT`) | `UserManagementView` | `lazy(() => import("../views/user-management-view"))` | **Yes** | `user-management-view-*.js` |

---

### 3.4 Inventory views

All use `lazy()` and **are** code-split. Some reuse the same lazy component for multiple view IDs.

| View ID | Component | Config | Code-split? | Chunk |
|---------|-----------|--------|-------------|-------|
| `inventory:dashboard` | `ProductManagementView` | `LazyProductManagementView` | **Yes** | `product-management-view-*.js` |
| `productManagement` | `ProductManagementWrapper` | `lazy(() => import("../wrappers/...").then(m => ({ default: m.ProductManagementWrapper })))` | **Yes** | `product-management-wrapper-*.js` |
| `productDashboard` | `ProductDashboardView` | `lazy(() => import("../views/inventory-dashboard-view"))` | **Yes** | `inventory-dashboard-view-*.js` |
| `productList` | `ProductManagementView` | `LazyProductManagementView` | **Yes** | `product-management-view-*.js` (shared) |
| `productDetails` | `ProductDetailsView` | `lazy(() => import("../views/product-details-view"))` | **Yes** | `product-details-view-*.js` |
| `categoryManagement` | `ManageCategoriesView` | `lazy(() => import("../views/category-management-view"))` | **Yes** | `category-management-view-*.js` |
| `batchManagement` | `BatchManagementWrapper` | `lazy(() => import("../wrappers/...").then(m => ({ default: m.BatchManagementWrapper })))` | **Yes** | `batch-management-wrapper-*.js` |
| `batchDashboard` | `BatchManagementView` | `LazyBatchManagementView` | **Yes** | `batch-management-view-*.js` (shared) |
| `batchList` | `BatchManagementView` | `LazyBatchManagementView` | **Yes** | `batch-management-view-*.js` (shared) |
| `expiryAlerts` | `ExpiryDashboardView` | `lazy(() => import("../views/expiry-dashboard-view").then(...))` | **Yes** | `expiry-dashboard-view-*.js` |
| `stockMovementHistory` | `StockMovementHistoryView` | `lazy(() => import("../views/stock-movement-history-view"))` | **Yes** | `stock-movement-history-view-*.js` |

---

### 3.5 Settings views

| View ID | Component | Config | Code-split? | Chunk |
|---------|-----------|--------|-------------|-------|
| `SETTINGS_ROUTES.GENERAL` | `GeneralSettingsView` | `lazy(() => import("../views/general-settings-view"))` | **Yes** | `general-settings-view-*.js` |
| `SETTINGS_ROUTES.STORE_CONFIGURATION` | `StoreConfigurationView` | `lazy(() => import("../views/store-configuration-view"))` | **Yes** | `store-configuration-view-*.js` |
| `SETTINGS_ROUTES.VIVA_WALLET` | `VivaWalletSettingsView` | `lazy(() => import("../views/viva-wallet-settings-view"))` | **Yes** | `viva-wallet-settings-view-*.js` |

---

### 3.6 Staff views

| View ID | Component | Config | Code-split? | Chunk |
|---------|-----------|--------|-------------|-------|
| `STAFF_ROUTES.MANAGE_CASHIERS` | `ManageCashierView` | `lazy(() => import("../views/manage-cashier-view"))` | **Yes** | `manage-cashier-view-*.js` |
| `STAFF_ROUTES.SCHEDULES` | `StaffSchedulesView` | `lazy(() => import("../views/staff-schedules-view"))` | **Yes** | `staff-schedules-view-*.js` |
| `STAFF_ROUTES.BREAK_POLICIES` | `BreakPolicySettingsView` | `lazy(() => import("../views/break-policy-settings-view"))` | **Yes** | `break-policy-settings-view-*.js` |
| `STAFF_ROUTES.TIME_REPORTS` | `StaffTimeReportsView` | `lazy(() => import("../views/staff-time-reports-view"))` | **Yes** | `staff-time-reports-view-*.js` |
| `STAFF_ROUTES.TIME_CORRECTIONS` | `StaffTimeCorrectionsView` | `lazy(() => import("../views/staff-time-corrections-view"))` | **Yes** | `staff-time-corrections-view-*.js` |

---

### 3.7 RBAC views

| View ID | Component | Config | Code-split? | Chunk |
|---------|-----------|--------|-------------|-------|
| `RBAC_ROUTES.ROLE_MANAGEMENT` | `RoleManagementView` | `lazy(() => import("../views/role-management-view"))` | **Yes** | `role-management-view-*.js` |
| `RBAC_ROUTES.USER_ROLE_ASSIGNMENT` | `UserRoleAssignmentView` | `lazy(() => import("../views/user-role-assignment-view"))` | **Yes** | `user-role-assignment-view-*.js` |

---

## 4. Summary

### 4.1 Totals

| Category | Count |
|----------|-------|
| **Transition-based views in registry** | **26** (1 dashboard + 3 sales + 1 users + 11 inventory + 3 settings + 5 staff + 2 RBAC) |
| **Code-split (own chunk, lazy-loaded)** | **25** |
| **Not code-split** | **1** |

### 4.2 Not code-split (1)

1. **`dashboard`**  
   - Component: `DashboardPageWrapper`  
   - Static import in `view-registry.ts`.  
   - Intentionally kept in the dashboard chunk as the default landing view.  
   - Role-specific views (Admin, Manager, Cashier) are lazy-loaded inside the wrapper and are code-split.

### 4.3 Code-split (25)

All other transition-based views use `React.lazy` + dynamic `import()`, have their own chunks (or share a chunk when the same component backs multiple view IDs), and are loaded on first navigation to that view. This includes `sales:cashier-dashboard`.

---

## 5. Build Verification

From `dist/assets` after a production build:

- **View-specific chunks** (examples):  
  `new-transaction-view-*.js`, `cashier-dashboard-view-*.js`, `admin-dashboard-view-*.js`, `manager-dashboard-view-*.js`, `user-management-view-*.js`, `product-management-view-*.js`, `sales-reports-view-*.js`, `batch-management-view-*.js`, `general-settings-view-*.js`, `staff-schedules-view-*.js`, `role-management-view-*.js`, etc.
- **Dashboard** route chunk (`dashboard-view-*.js`) contains `DashboardPageWrapper` and navigation shell only; role-specific dashboards are in separate chunks.

---

## 6. Conclusion

- **25 of 26** transition-based views are **code-split** (own chunk, lazy-loaded).
- **1** is **not** code-split: **`dashboard`** (root), by design, as the default landing view. Role-specific dashboards (Admin, Manager, Cashier) used inside it are lazy-loaded and code-split.

**Route-level:** Auth, Dashboard, and License use **`RetryableLazyRoute`**; **Retry** in **`RouteErrorBoundary`** re-runs the loader. See **TESTING_SUSPENSE_AND_FALLBACKS.md** and **CODE_SPLITTING_README.md**.
