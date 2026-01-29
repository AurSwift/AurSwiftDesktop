/**
 * Error boundary for lazy-loaded route-level pages.
 * Shows "Failed to load page" and a retry action. Provides RetryContext so
 * RetryableLazyRoute can create a new lazy(loader) on retry (React.lazy caches otherwise).
 */

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RetryContext } from "./retry-context";

interface RouteErrorBoundaryProps {
  children: ReactNode;
}

interface RouteErrorBoundaryState {
  error: Error | null;
  retryKey: number;
}

export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = {
    error: null,
    retryKey: 0,
  };

  static getDerivedStateFromError(error: Error): Partial<RouteErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(): void {
    // Error already stored in state via getDerivedStateFromError
  }

  handleRetry = (): void => {
    this.setState((prev) => ({ error: null, retryKey: prev.retryKey + 1 }));
  };

  render(): ReactNode {
    const value = {
      retryKey: this.state.retryKey,
      retry: this.handleRetry,
    };

    return (
      <RetryContext.Provider value={value}>
        {this.state.error ? (
          <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="text-center space-y-4 max-w-sm">
              <h2 className="text-xl font-semibold">Failed to load page</h2>
              <p className="text-muted-foreground text-sm">
                Something went wrong while loading this page.
              </p>
              <Button onClick={this.handleRetry} variant="outline">
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <div key={this.state.retryKey} className="contents">
            {this.props.children}
          </div>
        )}
      </RetryContext.Provider>
    );
  }
}
