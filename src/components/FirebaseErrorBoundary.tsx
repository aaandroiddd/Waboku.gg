import React, { Component, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { connectionManager } from '@/lib/firebase';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
  isRecovering: boolean;
  recoveryAttempts: number;
}

export class FirebaseErrorBoundary extends Component<Props, State> {
  private maxRecoveryAttempts = 3;
  private recoveryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isRecovering: false,
      recoveryAttempts: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[Firebase Error Boundary] Caught error:', error);
    console.error('[Firebase Error Boundary] Error info:', errorInfo);
    
    this.setState({
      error,
      errorInfo,
      hasError: true
    });

    // Check if this is a Firebase-related error
    const isFirebaseError = this.isFirebaseRelatedError(error);
    
    if (isFirebaseError) {
      console.log('[Firebase Error Boundary] Firebase-related error detected, attempting automatic recovery...');
      this.attemptAutomaticRecovery(error);
    }
  }

  private isFirebaseRelatedError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    const errorStack = error.stack?.toLowerCase() || '';
    
    return (
      errorMessage.includes('firebase') ||
      errorMessage.includes('firestore') ||
      errorMessage.includes('failed to fetch') ||
      errorStack.includes('firebase') ||
      errorStack.includes('firestore') ||
      errorStack.includes('listen/channel') ||
      errorStack.includes('write/channel') ||
      error.name === 'FirebaseError'
    );
  }

  private attemptAutomaticRecovery = async (error: Error) => {
    if (this.state.recoveryAttempts >= this.maxRecoveryAttempts) {
      console.log('[Firebase Error Boundary] Maximum recovery attempts reached');
      return;
    }

    this.setState({ 
      isRecovering: true,
      recoveryAttempts: this.state.recoveryAttempts + 1
    });

    try {
      // Check if this is a Listen channel error
      const isListenChannelError = error.stack?.includes('/Listen/channel') || 
                                   error.message.includes('Listen/channel');
      
      if (isListenChannelError && connectionManager) {
        console.log('[Firebase Error Boundary] Attempting Listen channel recovery...');
        await connectionManager.handleListenChannelError('error-boundary', 0);
      } else if (connectionManager) {
        console.log('[Firebase Error Boundary] Attempting general Firebase reconnection...');
        await connectionManager.reconnectFirebase();
      }

      // Wait a bit before attempting to recover
      this.recoveryTimeoutId = setTimeout(() => {
        console.log('[Firebase Error Boundary] Attempting to recover from error...');
        this.setState({
          hasError: false,
          error: null,
          errorInfo: null,
          isRecovering: false
        });
      }, 3000);

    } catch (recoveryError) {
      console.error('[Firebase Error Boundary] Recovery attempt failed:', recoveryError);
      this.setState({ isRecovering: false });
    }
  };

  private handleManualRecovery = () => {
    console.log('[Firebase Error Boundary] Manual recovery initiated...');
    
    this.setState({ isRecovering: true });

    // Clear any existing timeout
    if (this.recoveryTimeoutId) {
      clearTimeout(this.recoveryTimeoutId);
    }

    // Attempt recovery
    if (connectionManager) {
      // Force a complete session reset for manual recovery
      connectionManager.forceCompleteSessionReset().then(() => {
        console.log('[Firebase Error Boundary] Manual recovery completed');
        
        // Reset the error boundary state
        setTimeout(() => {
          this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            isRecovering: false,
            recoveryAttempts: 0
          });
        }, 2000);
      }).catch((recoveryError) => {
        console.error('[Firebase Error Boundary] Manual recovery failed:', recoveryError);
        this.setState({ isRecovering: false });
      });
    } else {
      // Fallback: just reset the state
      setTimeout(() => {
        this.setState({
          hasError: false,
          error: null,
          errorInfo: null,
          isRecovering: false,
          recoveryAttempts: 0
        });
      }, 1000);
    }
  };

  private handlePageReload = () => {
    console.log('[Firebase Error Boundary] Reloading page...');
    window.location.reload();
  };

  componentWillUnmount() {
    if (this.recoveryTimeoutId) {
      clearTimeout(this.recoveryTimeoutId);
    }
  }

  render() {
    if (this.state.hasError) {
      const isFirebaseError = this.isFirebaseRelatedError(this.state.error!);
      
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <div className="max-w-md w-full space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                {isFirebaseError ? 'Connection Error' : 'Application Error'}
              </AlertTitle>
              <AlertDescription>
                {isFirebaseError ? (
                  <>
                    We're experiencing connection issues with our servers. 
                    {this.state.recoveryAttempts > 0 && (
                      <span className="block mt-2 text-sm">
                        Recovery attempt {this.state.recoveryAttempts} of {this.maxRecoveryAttempts}
                      </span>
                    )}
                  </>
                ) : (
                  'Something went wrong. Please try refreshing the page.'
                )}
              </AlertDescription>
            </Alert>

            {process.env.NODE_ENV === 'development' && (
              <Alert>
                <AlertTitle>Error Details (Development)</AlertTitle>
                <AlertDescription>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium">
                      Click to view error details
                    </summary>
                    <pre className="mt-2 text-xs overflow-auto max-h-32 bg-muted p-2 rounded">
                      {this.state.error?.message}
                      {'\n\n'}
                      {this.state.error?.stack}
                    </pre>
                  </details>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-2">
              {isFirebaseError && (
                <Button 
                  onClick={this.handleManualRecovery}
                  disabled={this.state.isRecovering}
                  className="w-full"
                >
                  {this.state.isRecovering ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Reconnecting...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Try Again
                    </>
                  )}
                </Button>
              )}
              
              <Button 
                onClick={this.handlePageReload}
                variant="outline"
                className="w-full"
              >
                Reload Page
              </Button>
            </div>

            {isFirebaseError && (
              <div className="text-center text-sm text-muted-foreground">
                If the problem persists, please check your internet connection
                or try again in a few minutes.
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}