/// <reference types="vite/client" />

/**
 * Describes all existing environment variables and their types.
 * Required for Code completion/intellisense and type checking.
 *
 * Note: To prevent accidentally leaking env variables to the client, only variables prefixed with `VITE_` are exposed to your Vite-processed code.
 *
 * @see https://github.com/vitejs/vite/blob/0a699856b248116632c1ac18515c0a5c7cf3d1db/packages/vite/types/importMeta.d.ts#L7-L14 Base Interface.
 * @see https://vitejs.dev/guide/env-and-mode.html#env-files Vite Env Variables Doc.
 */
interface ImportMetaEnv {
  /**
   * URL where `renderer` web page is running.
   * This variable is initialized in scripts/watch.ts
   */
  readonly VITE_DEV_SERVER_URL: undefined | string;

  /** Current app version */
  readonly VITE_APP_VERSION: string;

  /**
   * Web app URL for customer-facing pages (release notes, etc.)
   * Defaults to production URL if not set
   */
  readonly VITE_WEB_APP_URL?: string;

  /**
   * When "true" and in dev, lazy loaders wrapped with lazyWithDebugDelay
   * add an artificial delay so Suspense fallbacks stay visible for testing.
   * Usage: VITE_DEBUG_FALLBACKS=true npm run start
   */
  readonly VITE_DEBUG_FALLBACKS?: string;

  /**
   * When "true" and in dev, lazy loaders wrapped with lazyWithDebugError
   * reject instead of loading, so RouteErrorBoundary / ViewLoadErrorBoundary
   * ("Failed to load" + Retry) can be tested. Usage: VITE_DEBUG_ERROR_BOUNDARY=true npm run start
   */
  readonly VITE_DEBUG_ERROR_BOUNDARY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
