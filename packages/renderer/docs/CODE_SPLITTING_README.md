# Code Splitting: Before, Performance & Other Benefits

**Scope:** `desktop/packages/renderer` (React app)  
**Topics:** Condition before route-level and view-level code splitting, how it improves performance, and what else it improves.

---

## 1. Condition Before Code Splitting

### 1.1 What We Had

Before introducing route-level and view-level code splitting:

- **Single large main chunk**  
  Almost the entire app lived in one `index-*.js` bundle (~**1.36 MB**). Vendor chunks (React, Radix UI, etc.) were split, but all app code was bundled together.

- **All routes statically imported**  
  `App` imported `AuthPage`, `DashboardView`, and `LicenseInfoPage` directly. The router chose which component to *render*, but **all three were already loaded** with the main chunk.

- **All transition-based views statically imported**  
  The central `VIEW_REGISTRY` pulled in every feature config (sales, users, inventory, settings, staff, RBAC). Each config statically imported **all** its view components (New Transaction, User Management, Product Management, Sales Reports, Settings, Staff, RBAC, etc.). So every view was in the main bundle, even if the user never opened it.

- **No `React.lazy` or dynamic `import()`**  
  There was no lazy loading for routes or views. Everything was eager-loaded at startup.

### 1.2 Import Chain (Before)

```text
main.tsx → App → Router
  → App imports: AuthPage, DashboardView, LicenseInfoPage, guards, ...
  → User visits /dashboard
    → DashboardView → NavigationProvider, AuthenticatedAppShell
      → navigation → view-registry
        → view-registry imports ALL feature configs
          → each config imports ALL view components
```

So:

- Visiting **any** route meant the main chunk already contained **all** route components.
- Visiting **/dashboard** meant we also pulled in **all** transition-based views (New Transaction, User Management, Inventory, Settings, Staff, RBAC, etc.), because they were imported through the registry and feature configs.

The router only controlled **what was rendered**, not **what was loaded**. The full dependency graph was loaded up front.

### 1.3 Summary Table (Before)

| Aspect | Before |
|--------|--------|
| Main app chunk | ~1.36 MB (all routes + all views) |
| Route-level splitting | None |
| View-level splitting | None |
| When views load | All at initial load |
| `React.lazy` / dynamic `import()` | Not used for routes or views |

---

## 2. How Code Splitting Improves Performance

### 2.1 Smaller Initial Bundle

- **Before:** ~1.36 MB of app code (plus vendor chunks) had to be downloaded, parsed, and executed before the app became interactive.
- **After:** The main chunk is much smaller (~436 KB). Route and view code live in **separate chunks** and load only when needed.

**Effect:** Faster **first load**, lower **Time to Interactive (TTI)**, and less work on the main thread at startup.

### 2.2 Route-Level Splitting

- **Auth, Dashboard, License** are lazy-loaded via **`RetryableLazyRoute`** (loaders + `React.lazy`). Each route has its own chunk.
- Routes are wrapped in **`RouteErrorBoundary`** and **`RetryContext`**. **Retry** re-runs the loader (avoids React.lazy cache), so chunk-load failures can be retried.
- When the user visits `/auth`, we fetch and run only the **auth** chunk. Same for `/dashboard` and `/license**.

**Effect:** Users who go straight to **login** don't pay the cost of dashboard, license, or any transition-based views. Less JS to load and parse for that flow. Failed chunk loads show "Failed to load page" + **Retry**, which actually re-fetches.

### 2.3 View-Level (Transition) Splitting

- Transition-based views (New Transaction, User Management, Product Management, Sales Reports, Settings, Staff, RBAC, etc.) are also lazy-loaded via `React.lazy` + dynamic `import()` in feature configs.
- A view’s chunk loads **only when the user navigates to that view** for the first time (e.g. “New Sale” or “User Management”).

**Effect:**  

- Users who only use **Sales** don’t load **Settings**, **Staff**, **RBAC**, or heavy **Inventory** views up front.  
- Heavy screens (e.g. New Transaction, Reports) are deferred until needed.  
- **Faster dashboard boot**: the dashboard shell and registry load first; big views load on demand.

### 2.4 Better Caching

- **Vendor** (React, React DOM, router) and **UI vendor** (Radix) stay in dedicated chunks. They change rarely.
- **Route** and **view** chunks change when you edit those features.  
- Splitting means **smaller, more targeted chunks**. When you ship an update, only changed chunks are re-downloaded; unchanged ones can be served from cache.

**Effect:** Better **cache reuse** across releases and **smaller incremental updates** for users.

### 2.5 Less Upfront Parse & Compile

- **Before:** The engine had to parse and compile ~1.36 MB of app JS before the UI could really run.
- **After:** We parse and run a smaller main bundle first. Additional chunks are parsed when they’re loaded.

**Effect:** **Lower main-thread cost at startup**, which helps on slower devices and low-end machines.

---

## 3. What Else It Improves (Beyond Raw Performance)

### 3.1 Scalability

- **Before:** Adding a new feature or view meant more code in the **same** main chunk. The initial bundle kept growing.
- **After:** New features can live in **new chunks**. They’re loaded on demand, so the **initial bundle size** doesn’t automatically grow with every new screen.

**Effect:** The app scales better as you add routes and views, without always increasing startup cost.

### 3.2 Clearer Boundaries & Debugging

- Routes and views map to **specific chunks** (e.g. `auth-page-*.js`, `new-transaction-view-*.js`).  
- Build tooling (e.g. Vite’s visualizer) can show **which modules** live in which chunks.

**Effect:** Easier to see what contributes to initial load vs. what loads later, and to **track down** bloat or unexpected dependencies.

### 3.3 Smoother Per-Screen UX

- **Before:** One big load, then the app appeared. No fine-grained loading states for individual screens.
- **After:** We use **Suspense** and fallbacks (e.g. `LoadingScreen` for routes, `ViewLoadingFallback` for views). Users see a **brief loading state** when opening a new route or view, instead of a single long wait at the start.

**Effect:** **More predictable, responsive** UX when navigating, especially for heavy screens.


### 3.4 Graceful Handling of Load Failures

- **Error boundaries** (`ViewLoadErrorBoundary`, `RouteErrorBoundary`) wrap lazy-loaded views and routes.
- If a chunk fails to load (e.g. network), we show **"Failed to load"** and a **Retry** action instead of breaking the whole app.
- **Route-level:** `RetryableLazyRoute` recreates `lazy(loader)` when **Retry** is used, so the loader runs again (React.lazy otherwise caches the failed promise).

**Effect:** **More resilient** behavior when chunks fail to load; **Retry** actually re-fetches for routes.

### 3.5 Alignment With Best Practices

- **React:** Use of `React.lazy` and `Suspense` for code splitting.  
- **Vite/Rollup:** Use of dynamic `import()` for chunk splitting.  
- **Common practice:** Split by **route** and by **heavy screens** (here, transition-based views).

**Effect:** The setup matches **common patterns**, and is easier for others to understand and maintain.

### 3.6 Optional Preloading

- With lazy-loaded views, we *could* add **preloading** (e.g. when the user hovers over “New Sale” or a sidebar link) by triggering the chunk load ahead of navigation.

**Effect:** **Faster perceived** navigation when we later add preloading, without changing the core splitting model.

---

## 4. Quick Reference

| Topic | Before | After (with code splitting) |
|-------|--------|-----------------------------|
| **Initial bundle** | ~1.36 MB app code | ~436 KB main + vendors; routes/views in separate chunks |
| **When routes load** | All at startup | When user visits that route |
| **When views load** | All at startup | When user first navigates to that view |
| **Performance** | Heavier first load, slower TTI | Lighter first load, faster TTI, deferred work |
| **Caching** | One big app chunk | Smaller, feature-specific chunks; better cache reuse |
| **Scalability** | New features enlarge initial bundle | New features → new chunks; initial bundle stable |
| **UX** | Single upfront wait | Per-route/view loading states |
| **Resilience** | Chunk failures less isolated | Error boundaries + Retry for failed chunks; **Retry** re-runs loader (RetryableLazyRoute) |

---

## 5. Related Docs

- **[ROUTING_AND_CODE_SPLITTING_REPORT.md](./ROUTING_AND_CODE_SPLITTING_REPORT.md)** – Routing patterns, transition-based views, and original analysis; includes implementation status.
- **[TRANSITION_VIEWS_CODE_SPLITTING_ANALYSIS.md](./TRANSITION_VIEWS_CODE_SPLITTING_ANALYSIS.md)** – Per-view code-split status and registry overview.
- **[TESTING_SUSPENSE_AND_FALLBACKS.md](./TESTING_SUSPENSE_AND_FALLBACKS.md)** – How to test Suspense, LoadingScreen, ViewLoadingFallback, error boundaries, and **Retry** locally (RetryableLazyRoute, `debug` prop, env flags).
