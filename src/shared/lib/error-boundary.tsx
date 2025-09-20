// Error Boundary Component
import React from 'react';
import { AppError, ErrorHandler } from './error-handling';
import { logger } from './logger';

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: AppError;
}

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: AppError }>;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const appError = ErrorHandler.handle(error);
    return {
      hasError: true,
      error: appError
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const appError = ErrorHandler.handle(error);
    logger.error('Error boundary caught error:', { error: appError, errorInfo });
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error} />;
    }

    return this.props.children;
  }
}

// Default error fallback component
const DefaultErrorFallback: React.FC<{ error: AppError }> = ({ error }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-900">
    <div className="max-w-md w-full bg-gray-800 rounded-lg p-6 text-center">
      <div className="text-red-400 text-6xl mb-4">⚠️</div>
      <h1 className="text-white text-xl font-bold mb-2">Something went wrong</h1>
      <p className="text-gray-400 mb-4">{error.message}</p>
      <button
        onClick={() => window.location.reload()}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
      >
        Reload Page
      </button>
    </div>
  </div>
);
