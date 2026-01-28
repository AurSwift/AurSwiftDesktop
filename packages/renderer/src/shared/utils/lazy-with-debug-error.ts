/**
 * Lazy loader wrapper that optionally simulates chunk load failure in development.
 * Use when testing RouteErrorBoundary / ViewLoadErrorBoundary ("Failed to load" + Retry).
 *
 * When VITE_DEBUG_ERROR_BOUNDARY=true and DEV, the loader is replaced with a
 * rejecting promise so the error boundary is triggered without editing loaders each time.
 *
 * @example
 * // Route-level: use RetryableLazyRoute with debug="error" in App.tsx.
 * // View-level (feature config):
 * component: lazyWithDebugError(() => import("../views/user-management-view")),
 * // Run: VITE_DEBUG_ERROR_BOUNDARY=true npm run start, then navigate to that route/view.
 */

import {
  lazy as reactLazy,
  type ComponentType,
  type LazyExoticComponent,
} from "react";

const DEBUG_ERROR_BOUNDARY =
  import.meta.env.DEV &&
  import.meta.env.VITE_DEBUG_ERROR_BOUNDARY === "true";

if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.log(
    "[lazyWithDebugError] VITE_DEBUG_ERROR_BOUNDARY =",
    import.meta.env.VITE_DEBUG_ERROR_BOUNDARY,
    "→ simulate failure:",
    DEBUG_ERROR_BOUNDARY,
  );
}

const SIMULATED_ERROR_MESSAGE =
  "Debug: simulated chunk load failure (VITE_DEBUG_ERROR_BOUNDARY)";

/**
 * Same as React.lazy(loader), but in dev with VITE_DEBUG_ERROR_BOUNDARY=true
 * the loader is replaced with a rejecting promise so the error boundary shows.
 */
export function lazyWithDebugError<T extends ComponentType<unknown>>(
  loader: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  if (!DEBUG_ERROR_BOUNDARY) {
    return reactLazy(loader);
  }
  return reactLazy(
    () => Promise.reject(new Error(SIMULATED_ERROR_MESSAGE)) as Promise<{ default: T }>
  );
}
