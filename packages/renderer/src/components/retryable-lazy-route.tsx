/**
 * Lazy-loaded route that recreates lazy(loader) when retryKey changes.
 * React.lazy caches the loader promise, so remounting alone doesn't re-run it.
 * Using retryKey in useMemo deps creates a new lazy each retry → loader runs again.
 */

import {
  lazy,
  Suspense,
  useMemo,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react";
import { useRetryContext } from "./retry-context";
import { lazyWithDebugDelay } from "@/shared/utils/lazy-with-debug-delay";
import { lazyWithDebugError } from "@/shared/utils/lazy-with-debug-error";

export type RetryableLazyDebug = "delay" | "error" | "none";

type Loader = () => Promise<{ default: ComponentType<unknown> }>;

export interface RetryableLazyRouteProps {
  loader: Loader;
  fallback: ReactNode;
  /** Apply debug delay ('delay') or simulated failure ('error') when env flags set. */
  debug?: RetryableLazyDebug;
}

export function RetryableLazyRoute({
  loader,
  fallback,
  debug = "none",
}: RetryableLazyRouteProps): ReactElement {
  const { retryKey } = useRetryContext();

  const Lazy = useMemo(() => {
    if (debug === "error") return lazyWithDebugError(loader);
    if (debug === "delay") return lazyWithDebugDelay(loader);
    return lazy(loader);
    // retryKey is the crucial dep: new lazy each retry → loader runs again (React.lazy caches otherwise).
    // loader/debug are effectively stable (module-level or route config).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  return (
    <Suspense fallback={fallback}>
      <Lazy />
    </Suspense>
  );
}
