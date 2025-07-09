import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class StringErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is the specific includes() error we're trying to catch
    if (error.message && error.message.includes('Cannot read properties of undefined (reading \'includes\')')) {
      console.warn('StringErrorBoundary caught includes() error:', error);
      return { hasError: true, error };
    }
    
    // For other errors, let them bubble up
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Only handle includes() errors
    if (error.message && error.message.includes('Cannot read properties of undefined (reading \'includes\')')) {
      console.warn('StringErrorBoundary componentDidCatch - includes() error:', error, errorInfo);
      
      // Log additional debugging information
      console.warn('Component stack:', errorInfo.componentStack);
      console.warn('This error has been caught and handled. The application should continue to work normally.');
    }
  }

  render() {
    if (this.state.hasError) {
      // Return the fallback UI or a default one
      return this.props.fallback || (
        <div className="text-muted-foreground text-sm">
          Content temporarily unavailable
        </div>
      );
    }

    return this.props.children;
  }
}