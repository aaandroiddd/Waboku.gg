import { useEffect } from 'react';
import { comprehensiveErrorHandler, getErrorStats } from '@/lib/comprehensive-error-handler';

export function ComprehensiveErrorHandlerInitializer() {
  useEffect(() => {
    if (comprehensiveErrorHandler) {
      console.log('[Comprehensive Error Handler Initializer] Error handler initialized');
      
      // Log error statistics in development mode
      if (process.env.NODE_ENV === 'development') {
        const logErrorStats = () => {
          const stats = getErrorStats();
          if (stats && (Object.keys(stats.errorCounts).length > 0 || stats.isRecovering)) {
            console.log('[Comprehensive Error Handler] Current stats:', stats);
          }
        };
        
        // Log stats every 2 minutes in development
        const statsInterval = setInterval(logErrorStats, 120000);
        
        // Also log stats when the page is about to unload
        const handleBeforeUnload = () => {
          const stats = getErrorStats();
          if (stats && Object.keys(stats.errorCounts).length > 0) {
            console.log('[Comprehensive Error Handler] Final stats before unload:', stats);
          }
        };
        
        window.addEventListener('beforeunload', handleBeforeUnload);
        
        return () => {
          clearInterval(statsInterval);
          window.removeEventListener('beforeunload', handleBeforeUnload);
        };
      }
    } else {
      console.warn('[Comprehensive Error Handler Initializer] Error handler not available (likely server-side)');
    }
  }, []);

  // This component doesn't render anything
  return null;
}