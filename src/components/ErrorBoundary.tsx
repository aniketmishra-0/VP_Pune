// @ts-nocheck
import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

/**
 * Generic Error Boundary that catches React render errors and
 * displays a styled error card instead of a blank (blue) screen.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-rose-200/50 dark:border-rose-900/40 shadow-sm p-6 max-w-xl mx-auto mt-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-rose-600 dark:text-rose-400">
                {this.props.fallbackTitle || "Something went wrong"}
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">Component render error</p>
            </div>
          </div>

          <div className="bg-rose-50/50 dark:bg-rose-950/10 rounded-xl p-4 mb-4 border border-rose-100/50 dark:border-rose-900/20">
            <p className="text-xs text-rose-600 dark:text-rose-300 font-mono break-all">
              {this.state.error?.message || "Unknown error"}
            </p>
            {this.state.errorInfo?.componentStack && (
              <details className="mt-2">
                <summary className="text-[10px] text-slate-400 cursor-pointer hover:text-slate-600 font-mono">
                  Component Stack
                </summary>
                <pre className="text-[9px] text-slate-400 mt-1 overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>

          <button
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#5277f7] hover:bg-[#4062dd] text-white font-bold text-xs transition-all cursor-pointer shadow-lg shadow-[#5277f7]/20"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
