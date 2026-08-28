// components/ui/ErrorBoundary.tsx
"use client";

import { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
            <h3 className="font-medium text-red-800">Something went wrong</h3>
            <p className="text-sm text-red-600 mt-1">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-2 text-sm text-red-700 underline hover:text-red-900"
            >
              Try again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// Simplified functional error boundary for specific components
export function PanelErrorBoundary({ 
  children, 
  panelName = "Panel" 
}: { 
  children: ReactNode; 
  panelName?: string;
}) {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-6 border border-yellow-200 bg-yellow-50 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-yellow-600">⚠️</span>
            <h3 className="font-medium text-yellow-800">{panelName} temporarily unavailable</h3>
          </div>
          <p className="text-sm text-yellow-700 mt-2">
            This section encountered an error. You can continue using other parts of the form.
          </p>
        </div>
      }
      onError={(error) => {
        console.error(`${panelName} error:`, error);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
