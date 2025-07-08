import React, { useEffect, useState } from 'react';
import { connectionManager } from '@/lib/firebase';

interface ListenChannelError {
  timestamp: number;
  url: string;
  error: string;
  recovered: boolean;
  errorType: 'fetch' | 'rejection' | 'response';
  statusCode?: number;
}

export function ListenChannelErrorHandler() {
  const [errors, setErrors] = useState<ListenChannelError[]>([]);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);

  useEffect(() => {
    // Enhanced Listen channel error handler for unhandled rejections
    const handleListenChannelError = (event: any) => {
      const isListenChannelError = event.reason && (
        (event.reason.name === 'TypeError' && 
         event.reason.message === 'Failed to fetch' && 
         event.reason.stack && 
         event.reason.stack.includes('/Listen/channel')) ||
        (event.reason.message && 
         event.reason.message.includes('Unknown SID')) ||
        (event.reason.stack && 
         event.reason.stack.includes('firestore.googleapis.com/google.firestore.v1.Firestore/Listen'))
      );

      if (isListenChannelError) {
        console.log('[Listen Channel Handler] Detected Listen channel error in unhandled rejection:', event.reason);
        
        const newError: ListenChannelError = {
          timestamp: Date.now(),
          url: 'Listen/channel',
          error: event.reason.message || 'Unknown Listen channel error',
          recovered: false,
          errorType: 'rejection'
        };
        
        setErrors(prev => [...prev.slice(-4), newError]); // Keep last 5 errors
        setIsRecovering(true);
        setRecoveryAttempts(prev => prev + 1);
        
        // Prevent default unhandled rejection behavior for Listen channel errors
        event.preventDefault();
        
        // Implement immediate and aggressive recovery
        if (connectionManager) {
          connectionManager.handleListenChannelError('listen-channel-handler-rejection', 0)
            .then(() => {
              console.log('[Listen Channel Handler] Unhandled rejection recovery completed successfully');
              setIsRecovering(false);
              
              // Mark error as recovered
              setErrors(prev => prev.map(err => 
                err.timestamp === newError.timestamp 
                  ? { ...err, recovered: true }
                  : err
              ));
            })
            .catch((recoveryError) => {
              console.error('[Listen Channel Handler] Unhandled rejection recovery failed:', recoveryError);
              setIsRecovering(false);
              
              // If recovery fails multiple times, force complete session reset
              if (recoveryAttempts >= 2) {
                console.log('[Listen Channel Handler] Multiple recovery failures, forcing complete session reset');
                connectionManager.forceCompleteSessionReset();
              }
            });
        } else {
          console.error('[Listen Channel Handler] Connection manager not available for unhandled rejection');
          setIsRecovering(false);
        }
      }
    };

    // Add global error listener
    window.addEventListener('unhandledrejection', handleListenChannelError);
    
    // Enhanced fetch interceptor with better error detection
    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
      try {
        const response = await originalFetch(input, init);
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';
        
        // Check for Listen channel responses with errors
        if (url.includes('/Listen/channel') && !response.ok) {
          console.log(`[Listen Channel Handler] Listen channel response error: ${response.status}`);
          
          // Check for specific "Unknown SID" errors
          if (response.status === 400) {
            try {
              const responseText = await response.clone().text();
              if (responseText.includes('Unknown SID') || responseText.includes('Bad Request')) {
                console.log('[Listen Channel Handler] Detected Unknown SID error in response');
                
                const newError: ListenChannelError = {
                  timestamp: Date.now(),
                  url,
                  error: `HTTP ${response.status}: Unknown SID`,
                  recovered: false,
                  errorType: 'response',
                  statusCode: response.status
                };
                
                setErrors(prev => [...prev.slice(-4), newError]);
                setIsRecovering(true);
                setRecoveryAttempts(prev => prev + 1);
                
                if (connectionManager) {
                  // Use more aggressive recovery for Unknown SID errors
                  connectionManager.forceCompleteSessionReset()
                    .then(() => {
                      console.log('[Listen Channel Handler] Unknown SID recovery completed');
                      setIsRecovering(false);
                      setErrors(prev => prev.map(err => 
                        err.timestamp === newError.timestamp 
                          ? { ...err, recovered: true }
                          : err
                      ));
                    })
                    .catch((recoveryError) => {
                      console.error('[Listen Channel Handler] Unknown SID recovery failed:', recoveryError);
                      setIsRecovering(false);
                    });
                }
              }
            } catch (readError) {
              console.warn('[Listen Channel Handler] Could not read response body:', readError);
            }
          }
        }
        
        return response;
      } catch (error) {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';
        
        if (url.includes('/Listen/channel')) {
          console.log('[Listen Channel Handler] Fetch error for Listen channel detected:', error);
          
          const newError: ListenChannelError = {
            timestamp: Date.now(),
            url,
            error: error instanceof Error ? error.message : 'Unknown fetch error',
            recovered: false,
            errorType: 'fetch'
          };
          
          setErrors(prev => [...prev.slice(-4), newError]);
          setIsRecovering(true);
          setRecoveryAttempts(prev => prev + 1);
          
          if (connectionManager) {
            connectionManager.handleListenChannelError(url, 0)
              .then(() => {
                console.log('[Listen Channel Handler] Fetch error recovery completed');
                setIsRecovering(false);
                setErrors(prev => prev.map(err => 
                  err.timestamp === newError.timestamp 
                    ? { ...err, recovered: true }
                    : err
                ));
              })
              .catch((recoveryError) => {
                console.error('[Listen Channel Handler] Fetch error recovery failed:', recoveryError);
                setIsRecovering(false);
                
                // Escalate to complete session reset for persistent fetch errors
                if (recoveryAttempts >= 2) {
                  console.log('[Listen Channel Handler] Multiple fetch error recovery failures, forcing complete session reset');
                  connectionManager.forceCompleteSessionReset();
                }
              });
          } else {
            setIsRecovering(false);
          }
        }
        
        throw error;
      }
    };

    // Reset recovery attempts counter periodically
    const resetAttemptsInterval = setInterval(() => {
      setRecoveryAttempts(0);
    }, 300000); // Reset every 5 minutes

    return () => {
      window.removeEventListener('unhandledrejection', handleListenChannelError);
      clearInterval(resetAttemptsInterval);
      // Note: We can't easily restore the original fetch without causing issues
    };
  }, [recoveryAttempts]);

  // Only render in development mode for debugging
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      {isRecovering && (
        <div className="bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3 mb-2">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-2"></div>
            <span className="text-sm text-yellow-800 dark:text-yellow-200">
              Recovering from Listen channel error...
            </span>
          </div>
        </div>
      )}
      
      {errors.length > 0 && (
        <div className="bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg p-3">
          <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
            Listen Channel Errors ({errors.length})
          </h4>
          <div className="space-y-1">
            {errors.slice(-3).map((error, index) => (
              <div key={error.timestamp} className="text-xs text-red-700 dark:text-red-300">
                <span className={error.recovered ? 'text-green-600 dark:text-green-400' : ''}>
                  {new Date(error.timestamp).toLocaleTimeString()}: {error.error}
                  {error.recovered && ' ✓'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}