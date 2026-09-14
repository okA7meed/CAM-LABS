import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
  onError?: (error: Error, info: React.ErrorInfo) => void;
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
  resetKey: number;
}

/**
 * Reusable crash containment for CAM LABS.
 *
 * A single uncaught render/effect error in React 18 otherwise unmounts the
 * ENTIRE application. Boundaries are placed around meaningful failure domains
 * (application, Manufacturing Workspace, CAD viewer, quote/pricing UI) so a
 * WebGL/driver/parse failure can never blank the whole platform.
 *
 * - `fallback` renders the recovery UI (a clear real-failure state + Retry).
 * - `retry()` remounts the subtree (new React key) — the failed component
 *   restarts from scratch instead of the app dying.
 * - `onError` receives the error for scoped diagnostics (dev logging handled
 *   by the caller so production logs are not flooded).
 * - A `label` names the failing domain for console diagnostics.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.props.onError?.(error, info);
    if (import.meta.env.DEV) {
      console.error(`[ErrorBoundary:${this.props.label || 'unknown'}]`, error, info.componentStack || info);
    }
  }

  private retry = () => {
    this.setState((s) => ({ error: null, resetKey: s.resetKey + 1 }));
  };

  override render(): ReactNode {
    if (this.state.error) {
      const fallback = this.props.fallback;
      if (fallback) return fallback(this.state.error, this.retry);
      return (
        <div className="mw-error-boundary" role="alert">
          <div className="mw-error-boundary-inner">
            <strong>Something went wrong in this section.</strong>
            <p>The rest of the application is still available.</p>
            <button type="button" className="mw-btn mw-btn-secondary" onClick={this.retry}>
              Retry
            </button>
          </div>
        </div>
      );
    }
    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}