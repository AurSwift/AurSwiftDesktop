/**
 * Error boundary for lazy-loaded transition-based views.
 * Shows "Failed to load view" and a retry action that remounts the view.
 */

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ViewLoadErrorBoundaryProps {
  children: ReactNode;
  /** Optional view id for display */
  viewId?: string;
}

interface ViewLoadErrorBoundaryState {
  error: Error | null;
  retryKey: number;
}

export class ViewLoadErrorBoundary extends Component<
  ViewLoadErrorBoundaryProps,
  ViewLoadErrorBoundaryState
> {
  state: ViewLoadErrorBoundaryState = {
    error: null,
    retryKey: 0,
  };

  static getDerivedStateFromError(error: Error): Partial<ViewLoadErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(): void {
    // Error already stored in state via getDerivedStateFromError
  }

  handleRetry = (): void => {
    this.setState((prev) => ({ error: null, retryKey: prev.retryKey + 1 }));
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-sm">
            <h2 className="text-xl font-semibold">Failed to load view</h2>
            <p className="text-muted-foreground text-sm">
              {this.props.viewId
                ? `Could not load "${this.props.viewId}".`
                : "Something went wrong while loading this view."}
            </p>
            <Button onClick={this.handleRetry} variant="outline">
              Retry
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div key={this.state.retryKey} className="contents">
        {this.props.children}
      </div>
    );
  }
}
