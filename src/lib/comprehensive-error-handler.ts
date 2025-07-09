import { connectionManager } from './firebase';
import { sessionManager } from './session-manager';

interface ErrorPattern {
  pattern: RegExp | string;
  type: 'firebase' | 'nextjs' | 'network' | 'critical';
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoveryAction: 'ignore' | 'retry' | 'session_reset' | 'page_reload' | 'complete_reset';
  description: string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // String/JavaScript errors - Enhanced patterns
  {
    pattern: /Cannot read properties of undefined \(reading 'includes'\)/i,
    type: 'critical',
    severity: 'high',
    recoveryAction: 'ignore',
    description: 'Undefined includes() method call (should be handled by prototype patches)'
  },
  {
    pattern: /Cannot read properties of undefined/i,
    type: 'critical',
    severity: 'medium',
    recoveryAction: 'ignore',
    description: 'Undefined property access (handled gracefully)'
  },
  {
    pattern: /Cannot read property.*of undefined/i,
    type: 'critical',
    severity: 'medium',
    recoveryAction: 'ignore',
    description: 'Legacy undefined property access (handled gracefully)'
  },
  {
    pattern: /TypeError: Failed to fetch/i,
    type: 'network',
    severity: 'high',
    recoveryAction: 'ignore',
    description: 'Network fetch error (handled by enhanced error handler)'
  },
  
  // Firebase/Firestore errors
  {
    pattern: /Unknown SID/i,
    type: 'firebase',
    severity: 'critical',
    recoveryAction: 'complete_reset',
    description: 'Firestore session ID is invalid'
  },
  {
    pattern: /firestore\.googleapis\.com.*400/i,
    type: 'firebase',
    severity: 'high',
    recoveryAction: 'session_reset',
    description: 'Firestore API bad request'
  },
  {
    pattern: /Listen\/channel.*Failed to fetch/i,
    type: 'firebase',
    severity: 'high',
    recoveryAction: 'session_reset',
    description: 'Firestore Listen channel connection failed'
  },
  {
    pattern: /Write\/channel.*Failed to fetch/i,
    type: 'firebase',
    severity: 'high',
    recoveryAction: 'session_reset',
    description: 'Firestore Write channel connection failed'
  },
  {
    pattern: /securetoken\.googleapis\.com.*Failed to fetch/i,
    type: 'firebase',
    severity: 'medium',
    recoveryAction: 'retry',
    description: 'Firebase Auth token service error'
  },
  
  // Next.js module errors
  {
    pattern: /Cannot find module.*next\/dist/i,
    type: 'nextjs',
    severity: 'critical',
    recoveryAction: 'page_reload',
    description: 'Next.js module loading failure'
  },
  {
    pattern: /amp-context/i,
    type: 'nextjs',
    severity: 'critical',
    recoveryAction: 'page_reload',
    description: 'Next.js AMP context module missing'
  },
  {
    pattern: /Loading chunk \d+ failed/i,
    type: 'nextjs',
    severity: 'high',
    recoveryAction: 'page_reload',
    description: 'Next.js chunk loading failure'
  },
  {
    pattern: /ChunkLoadError/i,
    type: 'nextjs',
    severity: 'high',
    recoveryAction: 'page_reload',
    description: 'Webpack chunk loading error'
  },
  
  // Network errors
  {
    pattern: /NetworkError/i,
    type: 'network',
    severity: 'medium',
    recoveryAction: 'retry',
    description: 'Network connectivity issue'
  },
  {
    pattern: /Failed to fetch/i,
    type: 'network',
    severity: 'medium',
    recoveryAction: 'retry',
    description: 'Generic fetch failure'
  },
  
  // ResizeObserver errors (benign)
  {
    pattern: /ResizeObserver loop completed with undelivered notifications/i,
    type: 'critical',
    severity: 'low',
    recoveryAction: 'ignore',
    description: 'Benign ResizeObserver loop (suppressed)'
  }
];

class ComprehensiveErrorHandler {
  private errorCounts = new Map<string, number>();
  private lastErrorTimes = new Map<string, number>();
  private isRecovering = false;
  private recoveryQueue: Array<() => Promise<void>> = [];
  
  private readonly MAX_ERRORS_PER_TYPE = 3;
  private readonly ERROR_RESET_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly RECOVERY_COOLDOWN = 10 * 1000; // 10 seconds

  constructor() {
    if (typeof window !== 'undefined') {
      this.installGlobalHandlers();
    }
  }

  private installGlobalHandlers() {
    // Enhanced unhandled rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, 'unhandled_rejection');
    });

    // Enhanced error handler
    window.addEventListener('error', (event) => {
      this.handleError(event.error, 'window_error');
    });

    // Console error interceptor for better error tracking
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const message = args.join(' ');
      this.handleError(new Error(message), 'console_error');
      originalConsoleError.apply(console, args);
    };

    // Fetch interceptor for network errors
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      try {
        const response = await originalFetch(input, init);
        
        // Check for HTTP errors that might need special handling
        if (!response.ok) {
          const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';
          const error = new Error(`HTTP ${response.status}: ${response.statusText} for ${url}`);
          this.handleError(error, 'fetch_response_error');
        }
        
        return response;
      } catch (error) {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';
        const enhancedError = new Error(`Fetch failed for ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        this.handleError(enhancedError, 'fetch_network_error');
        throw error;
      }
    };

    console.log('[Comprehensive Error Handler] Global error handlers installed');
  }

  private handleError(error: any, source: string) {
    if (!error) return;

    const errorMessage = error.message || error.toString() || '';
    const errorStack = error.stack || '';
    const fullErrorText = `${errorMessage} ${errorStack}`;

    // Find matching error pattern
    const matchedPattern = ERROR_PATTERNS.find(pattern => {
      if (typeof pattern.pattern === 'string') {
        return fullErrorText.includes(pattern.pattern);
      } else {
        return pattern.pattern.test(fullErrorText);
      }
    });

    if (!matchedPattern) {
      // Log unmatched errors for potential pattern addition
      if (process.env.NODE_ENV === 'development') {
        console.log('[Comprehensive Error Handler] Unmatched error:', {
          source,
          message: errorMessage,
          stack: errorStack
        });
      }
      return;
    }

    console.log(`[Comprehensive Error Handler] Matched error pattern: ${matchedPattern.description}`, {
      type: matchedPattern.type,
      severity: matchedPattern.severity,
      action: matchedPattern.recoveryAction,
      source
    });

    // Handle based on severity and recovery action
    this.executeRecoveryAction(matchedPattern, error, source);
  }

  private executeRecoveryAction(pattern: ErrorPattern, error: any, source: string) {
    const errorKey = `${pattern.type}_${pattern.description}`;
    const now = Date.now();

    // Update error tracking
    const currentCount = this.errorCounts.get(errorKey) || 0;
    const lastErrorTime = this.lastErrorTimes.get(errorKey) || 0;

    // Reset count if enough time has passed
    if (now - lastErrorTime > this.ERROR_RESET_INTERVAL) {
      this.errorCounts.set(errorKey, 1);
    } else {
      this.errorCounts.set(errorKey, currentCount + 1);
    }
    
    this.lastErrorTimes.set(errorKey, now);

    const errorCount = this.errorCounts.get(errorKey) || 1;

    // Check if we should escalate recovery action
    let recoveryAction = pattern.recoveryAction;
    if (errorCount >= this.MAX_ERRORS_PER_TYPE) {
      console.warn(`[Comprehensive Error Handler] Error threshold reached for ${errorKey}, escalating recovery`);
      
      // Escalate recovery action
      switch (pattern.recoveryAction) {
        case 'ignore':
        case 'retry':
          recoveryAction = 'session_reset';
          break;
        case 'session_reset':
          recoveryAction = 'complete_reset';
          break;
        case 'complete_reset':
          recoveryAction = 'page_reload';
          break;
        default:
          recoveryAction = 'page_reload';
      }
    }

    // Execute recovery action
    switch (recoveryAction) {
      case 'ignore':
        console.debug(`[Comprehensive Error Handler] Ignoring error: ${pattern.description}`);
        break;

      case 'retry':
        console.log(`[Comprehensive Error Handler] Scheduling retry for: ${pattern.description}`);
        this.scheduleRetry(pattern, error);
        break;

      case 'session_reset':
        console.log(`[Comprehensive Error Handler] Scheduling session reset for: ${pattern.description}`);
        this.scheduleSessionReset(pattern, error);
        break;

      case 'complete_reset':
        console.log(`[Comprehensive Error Handler] Scheduling complete reset for: ${pattern.description}`);
        this.scheduleCompleteReset(pattern, error);
        break;

      case 'page_reload':
        console.log(`[Comprehensive Error Handler] Scheduling page reload for: ${pattern.description}`);
        this.schedulePageReload(pattern, error);
        break;
    }
  }

  private scheduleRetry(pattern: ErrorPattern, error: any) {
    if (this.isRecovering) return;

    const retryAction = async () => {
      console.log(`[Comprehensive Error Handler] Executing retry for: ${pattern.description}`);
      
      if (pattern.type === 'firebase' && connectionManager) {
        await connectionManager.reconnectFirebase();
      } else if (pattern.type === 'network') {
        // For network errors, just wait and hope connectivity improves
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    };

    this.addToRecoveryQueue(retryAction);
  }

  private scheduleSessionReset(pattern: ErrorPattern, error: any) {
    if (this.isRecovering) return;

    const sessionResetAction = async () => {
      console.log(`[Comprehensive Error Handler] Executing session reset for: ${pattern.description}`);
      
      if (sessionManager) {
        await sessionManager.forceReset(`error_handler_${pattern.type}`);
      } else if (connectionManager) {
        await connectionManager.forceSessionReset();
      }
    };

    this.addToRecoveryQueue(sessionResetAction);
  }

  private scheduleCompleteReset(pattern: ErrorPattern, error: any) {
    if (this.isRecovering) return;

    const completeResetAction = async () => {
      console.log(`[Comprehensive Error Handler] Executing complete reset for: ${pattern.description}`);
      
      if (sessionManager) {
        await sessionManager.forceReset(`complete_reset_${pattern.type}`);
      } else if (connectionManager) {
        await connectionManager.forceCompleteSessionReset();
      }
    };

    this.addToRecoveryQueue(completeResetAction);
  }

  private schedulePageReload(pattern: ErrorPattern, error: any) {
    console.log(`[Comprehensive Error Handler] Executing immediate page reload for: ${pattern.description}`);
    
    // For critical errors like Next.js module failures, reload immediately
    setTimeout(() => {
      console.log('[Comprehensive Error Handler] Reloading page due to critical error');
      window.location.reload();
    }, 1000);
  }

  private addToRecoveryQueue(action: () => Promise<void>) {
    this.recoveryQueue.push(action);
    this.processRecoveryQueue();
  }

  private async processRecoveryQueue() {
    if (this.isRecovering || this.recoveryQueue.length === 0) {
      return;
    }

    this.isRecovering = true;

    try {
      while (this.recoveryQueue.length > 0) {
        const action = this.recoveryQueue.shift();
        if (action) {
          await action();
          
          // Wait between recovery actions
          await new Promise(resolve => setTimeout(resolve, this.RECOVERY_COOLDOWN));
        }
      }
    } catch (error) {
      console.error('[Comprehensive Error Handler] Recovery action failed:', error);
    } finally {
      this.isRecovering = false;
    }
  }

  // Public methods for manual error reporting
  public reportError(error: Error, context: string) {
    this.handleError(error, `manual_${context}`);
  }

  public getErrorStats() {
    return {
      errorCounts: Object.fromEntries(this.errorCounts),
      lastErrorTimes: Object.fromEntries(this.lastErrorTimes),
      isRecovering: this.isRecovering,
      queueLength: this.recoveryQueue.length
    };
  }

  public resetErrorCounts() {
    this.errorCounts.clear();
    this.lastErrorTimes.clear();
    console.log('[Comprehensive Error Handler] Error counts reset');
  }
}

// Create and export singleton instance
export const comprehensiveErrorHandler = typeof window !== 'undefined' ? new ComprehensiveErrorHandler() : null;

// Export for manual error reporting
export const reportError = (error: Error, context: string) => {
  if (comprehensiveErrorHandler) {
    comprehensiveErrorHandler.reportError(error, context);
  }
};

// Export for getting error statistics
export const getErrorStats = () => {
  return comprehensiveErrorHandler?.getErrorStats() || null;
};

// Export for resetting error counts
export const resetErrorCounts = () => {
  if (comprehensiveErrorHandler) {
    comprehensiveErrorHandler.resetErrorCounts();
  }
};