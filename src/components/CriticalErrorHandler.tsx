import React, { useEffect, useState } from 'react';
import { connectionManager } from '@/lib/firebase';

interface CriticalError {
  timestamp: number;
  type: 'unknown_sid' | 'next_module' | 'firestore_listen' | 'general';
  message: string;
  url?: string;
  recovered: boolean;
  recoveryMethod?: string;
}

export function CriticalErrorHandler() {
  const [errors, setErrors] = useState<CriticalError[]>([]);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);
  const [lastRecoveryTime, setLastRecoveryTime] = useState(0);

  useEffect(() => {
    // Handle critical unhandled rejections
    const handleCriticalError = async (event: any) => {
      const now = Date.now();
      
      // Prevent too frequent recovery attempts
      if (now - lastRecoveryTime < 5000) {
        console.log('[Critical Error Handler] Skipping recovery - too soon since last attempt');
        return;
      }

      let errorType: CriticalError['type'] = 'general';
      let shouldRecover = false;
      let recoveryMethod = 'standard';

      if (event.reason) {
        const message = event.reason.message || '';
        const stack = event.reason.stack || '';

        // Check for Unknown SID errors
        if (message.includes('Unknown SID') || 
            stack.includes('Unknown SID') ||
            (stack.includes('firestore.googleapis.com') && message.includes('Bad Request'))) {
          errorType = 'unknown_sid';
          shouldRecover = true;
          recoveryMethod = 'complete_session_reset';
          console.log('[Critical Error Handler] Detected Unknown SID error');
        }
        // Check for Listen channel errors
        else if (stack.includes('/Listen/channel') || 
                 stack.includes('Firestore/Listen')) {
          errorType = 'firestore_listen';
          shouldRecover = true;
          recoveryMethod = 'listen_channel_recovery';
          console.log('[Critical Error Handler] Detected Firestore Listen channel error');
        }
        // Check for Next.js module errors
        else if (message.includes('Cannot find module') && 
                 (message.includes('next/dist') || message.includes('amp-context'))) {
          errorType = 'next_module';
          shouldRecover = true;
          recoveryMethod = 'page_reload';
          console.log('[Critical Error Handler] Detected Next.js module error');
        }
      }

      if (shouldRecover) {
        // Prevent default error handling for critical errors
        event.preventDefault();

        const newError: CriticalError = {
          timestamp: now,
          type: errorType,
          message: event.reason?.message || 'Unknown critical error',
          url: event.reason?.stack?.match(/https?:\/\/[^\s)]+/)?.[0],
          recovered: false,
          recoveryMethod
        };

        setErrors(prev => [...prev.slice(-9), newError]); // Keep last 10 errors
        setIsRecovering(true);
        setRecoveryAttempts(prev => prev + 1);
        setLastRecoveryTime(now);

        console.log(`[Critical Error Handler] Implementing ${recoveryMethod} for ${errorType} error`);

        try {
          await implementRecovery(errorType, recoveryMethod, newError);
        } catch (recoveryError) {
          console.error('[Critical Error Handler] Recovery failed:', recoveryError);
          setIsRecovering(false);
          
          // Escalate recovery method if standard recovery fails
          if (recoveryAttempts >= 2) {
            console.log('[Critical Error Handler] Escalating to page reload due to multiple failures');
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          }
        }
      }
    };

    // Enhanced fetch interceptor for critical errors
    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
      try {
        const response = await originalFetch(input, init);
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';

        // Check for critical Firebase errors in responses
        if (url.includes('firestore.googleapis.com') && response.status === 400) {
          try {
            const responseText = await response.clone().text();
            
            if (responseText.includes('Unknown SID')) {
              console.log('[Critical Error Handler] Detected Unknown SID in fetch response');
              
              const newError: CriticalError = {
                timestamp: Date.now(),
                type: 'unknown_sid',
                message: `HTTP 400: Unknown SID from ${url}`,
                url,
                recovered: false,
                recoveryMethod: 'complete_session_reset'
              };

              setErrors(prev => [...prev.slice(-9), newError]);
              setIsRecovering(true);
              setRecoveryAttempts(prev => prev + 1);
              setLastRecoveryTime(Date.now());

              // Implement immediate recovery for Unknown SID
              implementRecovery('unknown_sid', 'complete_session_reset', newError);
            }
          } catch (readError) {
            console.warn('[Critical Error Handler] Could not read response body:', readError);
          }
        }

        return response;
      } catch (error) {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';
        
        // Check for critical fetch errors
        if (url.includes('firestore.googleapis.com') && 
            error instanceof Error && 
            error.message === 'Failed to fetch') {
          
          console.log('[Critical Error Handler] Critical fetch error for Firestore');
          
          const newError: CriticalError = {
            timestamp: Date.now(),
            type: 'firestore_listen',
            message: `Fetch failed for ${url}`,
            url,
            recovered: false,
            recoveryMethod: 'listen_channel_recovery'
          };

          setErrors(prev => [...prev.slice(-9), newError]);
          setIsRecovering(true);
          setRecoveryAttempts(prev => prev + 1);
          setLastRecoveryTime(Date.now());

          // Don't wait for the error to propagate, recover immediately
          implementRecovery('firestore_listen', 'listen_channel_recovery', newError);
        }

        throw error;
      }
    };

    // Add error event listeners
    window.addEventListener('unhandledrejection', handleCriticalError);
    window.addEventListener('error', (event) => {
      // Handle script loading errors that might indicate Next.js module issues
      if (event.error && event.error.message && 
          event.error.message.includes('Loading chunk')) {
        console.log('[Critical Error Handler] Detected chunk loading error, may indicate module issues');
        
        const newError: CriticalError = {
          timestamp: Date.now(),
          type: 'next_module',
          message: event.error.message,
          recovered: false,
          recoveryMethod: 'page_reload'
        };

        setErrors(prev => [...prev.slice(-9), newError]);
        
        // For chunk loading errors, reload after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    });

    // Cleanup function
    return () => {
      window.removeEventListener('unhandledrejection', handleCriticalError);
    };
  }, [recoveryAttempts, lastRecoveryTime]);

  const implementRecovery = async (
    errorType: CriticalError['type'], 
    method: string, 
    error: CriticalError
  ) => {
    try {
      switch (method) {
        case 'complete_session_reset':
          if (connectionManager) {
            await connectionManager.forceCompleteSessionReset();
            console.log('[Critical Error Handler] Complete session reset completed');
          } else {
            throw new Error('Connection manager not available');
          }
          break;

        case 'listen_channel_recovery':
          if (connectionManager) {
            await connectionManager.handleListenChannelError(error.url || 'unknown', 0);
            console.log('[Critical Error Handler] Listen channel recovery completed');
          } else {
            throw new Error('Connection manager not available');
          }
          break;

        case 'page_reload':
          console.log('[Critical Error Handler] Implementing page reload for critical error');
          setTimeout(() => {
            window.location.reload();
          }, 1000);
          return; // Don't mark as recovered since we're reloading

        default:
          if (connectionManager) {
            await connectionManager.reconnectFirebase();
            console.log('[Critical Error Handler] Standard reconnection completed');
          } else {
            throw new Error('Connection manager not available');
          }
      }

      // Mark error as recovered
      setErrors(prev => prev.map(err => 
        err.timestamp === error.timestamp 
          ? { ...err, recovered: true }
          : err
      ));
      setIsRecovering(false);

    } catch (recoveryError) {
      console.error(`[Critical Error Handler] ${method} failed:`, recoveryError);
      setIsRecovering(false);
      throw recoveryError;
    }
  };

  // Reset recovery attempts periodically
  useEffect(() => {
    const resetInterval = setInterval(() => {
      setRecoveryAttempts(0);
    }, 300000); // Reset every 5 minutes

    return () => clearInterval(resetInterval);
  }, []);

  // Only render in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-sm">
      {isRecovering && (
        <div className="bg-orange-100 dark:bg-orange-900 border border-orange-300 dark:border-orange-700 rounded-lg p-3 mb-2">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600 mr-2"></div>
            <span className="text-sm text-orange-800 dark:text-orange-200">
              Recovering from critical error...
            </span>
          </div>
        </div>
      )}
      
      {errors.length > 0 && (
        <div className="bg-purple-100 dark:bg-purple-900 border border-purple-300 dark:border-purple-700 rounded-lg p-3">
          <h4 className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">
            Critical Errors ({errors.length})
          </h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {errors.slice(-5).map((error) => (
              <div key={error.timestamp} className="text-xs text-purple-700 dark:text-purple-300">
                <div className={error.recovered ? 'text-green-600 dark:text-green-400' : ''}>
                  <span className="font-medium">{error.type}:</span> {error.message.substring(0, 50)}...
                  {error.recovered && ' ✓'}
                </div>
                <div className="text-xs opacity-75">
                  {new Date(error.timestamp).toLocaleTimeString()} - {error.recoveryMethod}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}