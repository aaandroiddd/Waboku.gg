import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class EnhancedErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is one of the errors we want to handle gracefully
    const message = error.message || '';
    
    if (
      message.includes('Cannot read properties of undefined (reading \'includes\')') ||
      message.includes('Cannot read properties of undefined') ||
      message.includes('Failed to fetch') ||
      message.includes('ResizeObserver loop limit exceeded')
    ) {
      console.warn('[Enhanced Error Boundary] Caught handled error:', message);
      return { hasError: true, error };
    }
    
    // For other errors, let them bubble up
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const message = error.message || '';
    
    // Only handle specific errors
    if (
      message.includes('Cannot read properties of undefined (reading \'includes\')') ||
      message.includes('Cannot read properties of undefined') ||
      message.includes('Failed to fetch') ||
      message.includes('ResizeObserver loop limit exceeded')
    ) {
      console.warn('[Enhanced Error Boundary] Component caught error:', error);
      console.warn('[Enhanced Error Boundary] Error info:', errorInfo);
      
      this.setState({
        hasError: true,
        error,
        errorInfo
      });
      
      // Try to recover after a short delay
      setTimeout(() => {
        this.setState({ hasError: false, error: undefined, errorInfo: undefined });
      }, 1000);
    } else {
      // Re-throw other errors
      throw error;
    }
  }

  render() {
    if (this.state.hasError) {
      // Return fallback UI or default fallback
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div style={{ 
          padding: '10px', 
          color: '#666', 
          fontSize: '14px',
          textAlign: 'center',
          minHeight: '20px'
        }}>
          Loading...
        </div>
      );
    }

    return this.props.children;
  }
}