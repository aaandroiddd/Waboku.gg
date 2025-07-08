import { useEffect } from 'react';
import { sessionManager } from '@/lib/session-manager';

export function SessionManagerInitializer() {
  useEffect(() => {
    if (sessionManager) {
      console.log('[Session Manager Initializer] Session manager initialized');
      
      // Mark initial activity
      sessionManager.markActivity();
      
      // Log session state in development
      if (process.env.NODE_ENV === 'development') {
        const logSessionState = () => {
          const state = sessionManager.getSessionState();
          console.log('[Session Manager] Current state:', {
            isValid: state.isValid,
            errorCount: state.errorCount,
            timeSinceActivity: Date.now() - state.lastActivity,
            sessionId: state.sessionId ? `${state.sessionId.substring(0, 8)}...` : null
          });
        };
        
        // Log state every 5 minutes in development
        const logInterval = setInterval(logSessionState, 300000);
        
        return () => {
          clearInterval(logInterval);
        };
      }
    }
  }, []);

  // This component doesn't render anything
  return null;
}