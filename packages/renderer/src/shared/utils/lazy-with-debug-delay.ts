/**
 * Lazy loader wrapper that optionally adds an artificial delay in development.
 * Use when testing Suspense fallbacks locally – chunks often load too fast to see them.
 *
 * When VITE_DEBUG_FALLBACKS=true and DEV, the loader's promise is delayed by `delayMs`
 * so LoadingScreen / ViewLoadingFallback stay visible.
 *
 * @example
 * // Route-level: use RetryableLazyRoute with debug="delay" in App.tsx.
 * // View-level (feature config):
 * component: lazyWithDebugDelay(() => import("../views/some-view")),
 * // Run: VITE_DEBUG_FALLBACKS=true npm run start
 */

import {
  lazy as reactLazy,
  type ComponentType,
  type LazyExoticComponent,
} from "react";

const DEBUG_FALLBACKS =
  import.meta.env.DEV && import.meta.env.VITE_DEBUG_FALLBACKS === "true";

if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.log(
    "[lazyWithDebugDelay] VITE_DEBUG_FALLBACKS =",
    import.meta.env.VITE_DEBUG_FALLBACKS,
    "→ delay active:",
    DEBUG_FALLBACKS,
  );
}

function delay<T>(ms: number): (value: T) => Promise<T> {
  return (value) =>
    new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
}

/**
 * Same as React.lazy(loader), but in dev with VITE_DEBUG_FALLBACKS=true
 * adds delayMs (default 2500) before resolving so fallbacks are visible.
 */
export function lazyWithDebugDelay<T extends ComponentType<unknown>>(
  loader: () => Promise<{ default: T }>,
  delayMs = 2500
): LazyExoticComponent<T> {
  if (!DEBUG_FALLBACKS) {
    return reactLazy(loader);
  }
  return reactLazy(() =>
    loader().then((mod) => (delayMs > 0 ? delay<typeof mod>(delayMs)(mod) : mod))
  );
}
