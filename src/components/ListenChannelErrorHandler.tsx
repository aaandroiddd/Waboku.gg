import React, { useEffect, useState } from 'react';
import { connectionManager } from '@/lib/firebase';

interface ListenChannelError {
  timestamp: number;
  url: string;
  error: string;
  recovered: boolean;
}

export function ListenChannelErrorHandler() {
  const [errors, setErrors] = useState<ListenChannelError[]>([]);
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    // Listen for Listen channel errors specifically
    const handleListenChannelError = (event: any) => {
      if (event.reason && 
          event.reason.name === 'TypeError' && 
          event.reason.message === 'Failed to fetch' && 
          event.reason.stack && 
          event.reason.stack.includes('/Listen/channel')) {
        
        console.log('[Listen Channel Handler] Detected Listen channel error, implementing recovery...');
        
        const newError: ListenChannelError = {
          timestamp: Date.now(),
          url: 'Listen/channel',
          error: event.reason.message,
          recovered: false
        };
        
        setErrors(prev => [...prev.slice(-4), newError]); // Keep last 5 errors
        setIsRecovering(true);
        
        // Implement immediate recovery
        if (connectionManager) {
          connectionManager.handleListenChannelError('listen-channel-handler', 0)
            .then(() => {
              console.log('[Listen Channel Handler] Recovery completed successfully');
              setIsRecovering(false);
              
              // Mark error as recovered
              setErrors(prev => prev.map(err => 
                err.timestamp === newError.timestamp 
                  ? { ...err, recovered: true }
                  : err
              ));
            })
            .catch((recoveryError) => {
              console.error('[Listen Channel Handler] Recovery failed:', recoveryError);
              setIsRecovering(false);
            });
        } else {
          console.error('[Listen Channel Handler] Connection manager not available');
          setIsRecovering(false);
        }
      }
    };

    // Add global error listener
    window.addEventListener('unhandledrejection', handleListenChannelError);
    
    // Also listen for fetch errors
    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
      try {
        const response = await originalFetch(input, init);
        return response;
      } catch (error) {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';
        
        if (url.includes('/Listen/channel')) {
          console.log('[Listen Channel Handler] Fetch error for Listen channel detected');
          
          const newError: ListenChannelError = {
            timestamp: Date.now(),
            url,
            error: error instanceof Error ? error.message : 'Unknown error',
            recovered: false
          };
          
          setErrors(prev => [...prev.slice(-4), newError]);
          setIsRecovering(true);
          
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
              });
          } else {
            setIsRecovering(false);
          }
        }
        
        throw error;
      }
    };

    return () => {
      window.removeEventListener('unhandledrejection', handleListenChannelError);
      // Note: We can't easily restore the original fetch without causing issues
    };
  }, []);

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