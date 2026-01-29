/**
 * Compact fallback shown when a transition-based view is loading.
 * Used inside the app shell (header visible) during lazy view load.
 */

export function ViewLoadingFallback() {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    </div>
  );
}
