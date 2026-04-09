// ErrorBoundary.tsx — Production-grade React error boundary
//
// Root cause fixed: routing mismatch crash (react-router-dom in wouter app)
// had no boundary to catch it, unmounting the entire tree.
// Chrome DevTools explicitly recommended adding one.
//
// Usage:
//   <ErrorBoundary name="LoginPage"><LoginPage /></ErrorBoundary>

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  name?: string;
}

interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (process.env.NODE_ENV === "development") {
      console.error(`[ErrorBoundary:${this.props.name ?? "?"}]`, error, info.componentStack);
    }
    // Production: Sentry.captureException(error, { extra: { boundary: this.props.name, componentStack: info.componentStack } });
  }

  reset = () => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (!error) return children;
    if (fallback) return fallback(error, this.reset);

    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
        <div className="max-w-md w-full bg-zinc-900 border border-red-900/40 rounded-2xl p-8 flex flex-col gap-5">
          <div>
            <h2 className="text-white font-semibold text-lg">Something went wrong</h2>
            <p className="text-zinc-500 text-sm mt-1">An unexpected error occurred in this section.</p>
          </div>
          {process.env.NODE_ENV === "development" && (
            <pre className="bg-zinc-950 rounded-lg p-4 font-mono text-xs text-red-300 overflow-auto max-h-48 border border-red-900/30 whitespace-pre-wrap">
              {error.message}
            </pre>
          )}
          <div className="flex gap-3">
            <button onClick={this.reset} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors">
              Try again
            </button>
            <button onClick={() => window.location.reload()} className="flex-1 bg-red-700 hover:bg-red-600 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors">
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
