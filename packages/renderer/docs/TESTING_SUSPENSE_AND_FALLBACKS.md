# Testing Suspense and Fallbacks Locally (Electron)

How to verify that **Suspense** and **fallbacks** (LoadingScreen, ViewLoadingFallback, error boundaries) work correctly when running the Electron app locally.

---

## 1. What You’re Testing

| Fallback | Where | When it shows |
|----------|--------|----------------|
| **LoadingScreen** | Route-level (auth, dashboard, license) | While the lazy route chunk is loading |
| **ViewLoadingFallback** | Transition-based views (New Transaction, User Management, etc.) & dashboard role views | While the lazy view chunk is loading |
| **ViewLoadErrorBoundary** / **RouteErrorBoundary** | Views & routes | When a chunk fails to load; shows “Failed to load” + **Retry** |

Locally, chunks often load very fast (disk / localhost), so fallbacks can flash briefly or seem invisible. Use one of the methods below to make them visible.

---

## 2. Prerequisites

- **Run the app:** `npm run start` (from repo root). This starts the Vite dev server and Electron.
- **Open DevTools:** In the Electron window, `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS), or use **View → Toggle Developer Tools**.

---

## 3. Method 1: Network Throttling (no code changes)

Slowing down the network makes chunk requests take longer, so Suspense fallbacks stay visible.

### Steps

1. Run `npm run start` and log in until you reach the dashboard (or the route you want to test).
2. Open **DevTools** → **Network** tab.
3. Set throttling to **Slow 3G** (or **Fast 3G**) via the throttling dropdown (often “No throttling” by default).
4. **Hard refresh** the app (`Ctrl+Shift+R` / `Cmd+Shift+R`) or restart the app so initial chunks are re-fetched.
5. **Navigate** and watch for fallbacks:
   - **Route-level:** Go to `/auth`, then `/dashboard`, then `/license`. You should see **LoadingScreen** (full-screen “Loading…”) while each route chunk loads.
   - **View-level:** From the dashboard, open **New Sale**, **User Management**, **Product Management**, **Sales Reports**, etc. You should see **ViewLoadingFallback** (compact “Loading…” in the main area, header visible) while each view chunk loads.
6. **Dashboard role views:** If you’re admin/manager/cashier, the first time the dashboard picks a role view, that chunk loads too. ViewLoadingFallback is used there as well.

### Tips

- Keep throttling **on** while navigating. Disable it when done.
- If you never see a fallback, try **Slow 3G** or **Custom** (e.g. 500 ms delay).
- **Cache:** Enable "Disable cache" in DevTools to avoid cached chunks and simulate first-time loads; otherwise leave as you prefer.

---

## 4. Method 2: Debug delay (route-level fallbacks)

Route-level lazy loading uses **`RetryableLazyRoute`** with `debug="delay"` (Dashboard, License) or `debug="none"` (Auth by default). When `debug="delay"` and **`VITE_DEBUG_FALLBACKS=true`**, **`lazyWithDebugDelay`** adds an artificial delay so **LoadingScreen** stays visible for ~2.5 s.

### Enable the delay

**Put the flag in `packages/renderer/.env.local`** (not `desktop/.env.local`):  
`VITE_DEBUG_FALLBACKS=true`  
Restart the dev server after changing env.

Or run from `desktop/`:

```bash
VITE_DEBUG_FALLBACKS=true npm run start
```

**Important:** The renderer Vite dev server loads `.env` from **`packages/renderer/`** only. Putting `VITE_*` vars in `desktop/.env.local` has **no effect** on the renderer.


### What's delayed

- **Dashboard** and **License** use `debug="delay"`; their route chunks are delayed by **2.5 seconds** when the flag is set and `DEV`. **Auth** uses `debug="none"` by default — set `debug="delay"` for the auth `RetryableLazyRoute` in `App.tsx` to test `/auth` delay.
- **View-level** lazy loading (transition views, dashboard role views) still uses normal `lazy()`; they are **not** delayed by this util. Use **Method 1** (throttling) or **Method 3** for those.

### Steps

1. Set **`VITE_DEBUG_FALLBACKS=true`** in **`packages/renderer/.env.local`** (or use the CLI flag above), then **restart** the dev server.
2. Go to **`/dashboard`**. You should see **LoadingScreen** for ~2.5 s, then the dashboard.
3. Navigate to **`/license`**. Same: **LoadingScreen** ~2.5 s, then the license page.
4. For **`/auth`**: Auth uses `debug="none"` by default. To test delay there, set `debug="delay"` for the auth `RetryableLazyRoute` in `App.tsx`, then go to `/auth`.
5. In DevTools console you should see `[lazyWithDebugDelay] VITE_DEBUG_FALLBACKS = true → delay active: true`. If you see `undefined` or `false`, use **`packages/renderer/.env.local`** and restart.
6. Set **VITE_DEBUG_FALLBACKS=false** or omit it when you're done; revert any `debug="delay"` change for auth.

### Optional: custom delay

- **Route-level:** `RetryableLazyRoute` uses the default **2.5 s** when `debug="delay"`. Custom delay per route would require extending `RetryableLazyRoute` (e.g. a `delayMs` prop).
- **View-level:** Use **Method 3** with `lazyWithDebugDelay(() => import("..."), 4000)` for a **4 s** delay on a specific view. Only applies when `VITE_DEBUG_FALLBACKS=true` and dev.

---

## 5. Method 3: Temporarily delay a view (view-level fallbacks)

To verify **ViewLoadingFallback** for a **specific** transition-based view without throttling:

1. Open that view’s feature config (e.g. `features/sales/config/feature-config.ts`).
2. Temporarily wrap the view’s loader with a delay:

   ```ts
   import { lazyWithDebugDelay } from "@/shared/utils/lazy-with-debug-delay";

   // Example: delay New Transaction view
   component: lazyWithDebugDelay(() => import("../views/new-transaction-view")),
   ```

3. Run with `VITE_DEBUG_FALLBACKS=true`, go to the dashboard, then navigate to that view. You should see **ViewLoadingFallback** for the chosen delay.
4. Revert the change and remove the flag when done.

---

## 6. Testing Error Boundaries (Retry) — Programmatic

Use **`lazyWithDebugError`** to trigger **RouteErrorBoundary** / **ViewLoadErrorBoundary** without editing loader logic each time. When `VITE_DEBUG_ERROR_BOUNDARY=true`, the wrapped loader rejects so you get "Failed to load" + **Retry**.

### Route-level (RouteErrorBoundary)

Routes use **`RetryableLazyRoute`** with a `debug` prop. **Retry** re-runs the loader (React.lazy cache fix); turn off the flag and Retry to verify success.

1. **Put the flag in `packages/renderer/.env.local`** (not `desktop/.env.local`):  
   `VITE_DEBUG_ERROR_BOUNDARY=true`  
   Restart the dev server. Or run **`VITE_DEBUG_ERROR_BOUNDARY=true npm run start`** from `desktop/`.
2. In `App.tsx`, set **`debug="error"`** for the route you want to test (e.g. Auth):
   ```ts
   <RetryableLazyRoute
     loader={authLoader}
     fallback={<LoadingScreen />}
     debug="error"
   />
   ```
3. Open `/auth`. You should see **RouteErrorBoundary** ("Failed to load page" + **Retry**). **Retry** will fail again while the flag is set.
4. In DevTools console: `[lazyWithDebugError] VITE_DEBUG_ERROR_BOUNDARY = true → simulate failure: true`. If you see `undefined` or `false`, use **`packages/renderer/.env.local`** and restart.
5. **Verify Retry:** Restart without the flag, set `debug="none"` for that route, then trigger the error again (e.g. bad path). Click **Retry** — the loader runs again and the page should load.
6. Revert `debug="error"` to `debug="none"` when done.

### View-level (ViewLoadErrorBoundary)

1. Ensure **`VITE_DEBUG_ERROR_BOUNDARY=true`** is in **`packages/renderer/.env.local`** (or use the CLI flag) and restart.
2. In a feature config (e.g. `users/config/feature-config.ts`), use `lazyWithDebugError` for one view:
   ```ts
   import { lazyWithDebugError } from "@/shared/utils/lazy-with-debug-error";

   component: lazyWithDebugError(() => import("../views/user-management-view")),
   ```
3. Run with the flag, go to the dashboard, navigate to that view.
4. You should see **ViewLoadErrorBoundary** ("Failed to load view" + **Retry**). **Retry** will fail again while the flag is set. Use the `[lazyWithDebugError]` console log to confirm the flag is active.
5. Revert the change and remove the flag when finished.

### Manual fallback (no util)

You can still trigger it manually:

- **Route:** Prefer **`RetryableLazyRoute`** with `debug="error"` (see above). Otherwise, temporarily replace the route element with `Suspense` + `lazy(() => Promise.reject(new Error("Test")))` (no Retry re-run).
- **View:** `lazy(() => import("../views/nonexistent-view"))` (bad path) in a feature config.

Revert after testing.

---

## 7. Quick Checklist

| What to verify | How |
|----------------|-----|
| **LoadingScreen** on `/auth` | Throttling **or** `VITE_DEBUG_FALLBACKS=true` + go to /auth |
| **LoadingScreen** on `/dashboard` | Same; go to /dashboard |
| **LoadingScreen** on `/license` | Same; go to /license |
| **ViewLoadingFallback** on New Transaction, User Management, etc. | Throttling + navigate from dashboard **or** Method 3 for one view |
| **ViewLoadingFallback** on dashboard role view (admin/manager/cashier) | Throttling + first load of dashboard after login |
| **RouteErrorBoundary** (Failed to load page + Retry) | Use `RetryableLazyRoute` with `debug="error"`, `VITE_DEBUG_ERROR_BOUNDARY=true`, then open that route; **Retry** re-runs the loader |
| **ViewLoadErrorBoundary** (Failed to load view + Retry) | Use `lazyWithDebugError` for one view in feature config, `VITE_DEBUG_ERROR_BOUNDARY=true`, then navigate to that view |

---

## 8. See Also

- **LoadingScreen:** `components/loading-screen.tsx`
- **ViewLoadingFallback:** `components/view-loading-fallback.tsx`
- **RetryableLazyRoute:** `components/retryable-lazy-route.tsx` — lazy route that recreates `lazy(loader)` on retry so the loader runs again
- **RetryContext** / **useRetryContext:** `components/retry-context.tsx` — provided by `RouteErrorBoundary`; `RetryableLazyRoute` uses `retryKey` to re-run the loader on retry
- **RouteErrorBoundary:** `components/route-error-boundary.tsx` — error boundary for routes; provides `RetryContext`, shows "Failed to load page" + Retry
- **ViewLoadErrorBoundary:** `components/view-load-error-boundary.tsx` — error boundary for transition-based views
- **lazyWithDebugDelay:** `shared/utils/lazy-with-debug-delay.ts` — logs `[lazyWithDebugDelay]` in dev when flag is checked
- **lazyWithDebugError:** `shared/utils/lazy-with-debug-error.ts` — programmatic error-boundary trigger; logs `[lazyWithDebugError]` in dev
- **CODE_SPLITTING_README.md** – Overview of code splitting and performance.
