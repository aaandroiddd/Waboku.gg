import { useEffect, useState, useCallback, useRef } from 'react';
import { 
  getFirebaseServices, 
  enableNetwork, 
  disableNetwork,
  removeAllListeners
} from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw, WifiOff } from 'lucide-react';

// Pages that require active Firebase connections
const CRITICAL_PAGES = [
  '/dashboard',
  '/dashboard/messages',
  '/dashboard/orders',
  '/dashboard/offers',
  '/listings/',
  '/messages/'
];

// Pages that should never maintain persistent connections
const STATIC_PAGES = [
  '/',
  '/auth/sign-in',
  '/auth/sign-up',
  '/about',
  '/faq',
  '/privacy-policy',
  '/support'
];

interface ConnectionState {
  status: 'connected' | 'disconnected' | 'connecting' | 'idle';
  lastCheck: number;
  reconnectAttempts: number;
  isMonitoring: boolean;
}

export function OptimizedFirebaseConnectionManager() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'idle',
    lastCheck: 0,
    reconnectAttempts: 0,
    isMonitoring: false
  });
  
  const [showAlert, setShowAlert] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPageVisibleRef = useRef(true);
  const maxReconnectAttempts = 3; // Reduced from 5
  const monitoringInterval = 30000; // Check every 30 seconds instead of continuously

  // Page visibility tracking
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      isPageVisibleRef.current = isVisible;
      
      console.log(`[OptimizedFirebaseConnectionManager] Page visibility: ${isVisible ? 'visible' : 'hidden'}`);
      
      if (!isVisible) {
        // Page hidden - stop monitoring to reduce database usage
        stopConnectionMonitoring();
      } else if (shouldMonitorConnection()) {
        // Page visible and we need monitoring - resume
        startConnectionMonitoring();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, []);

  // Determine if current page needs connection monitoring
  const shouldMonitorConnection = useCallback(() => {
    const currentPath = router.pathname;
    
    // Don't monitor on static pages
    if (STATIC_PAGES.some(page => currentPath === page || currentPath.startsWith(page))) {
      return false;
    }
    
    // Only monitor on critical pages when user is authenticated
    if (!user) {
      return false;
    }
    
    // Check if current page is critical
    return CRITICAL_PAGES.some(page => 
      currentPath === page || 
      currentPath.startsWith(page) ||
      (page.includes('[') && new RegExp(page.replace(/\[.*?\]/g, '[^/]+')).test(currentPath))
    );
  }, [router.pathname, user]);

  // Start connection monitoring with reduced frequency
  const startConnectionMonitoring = useCallback(() => {
    if (connectionState.isMonitoring || !isPageVisibleRef.current) {
      return;
    }

    console.log('[OptimizedFirebaseConnectionManager] Starting optimized connection monitoring');
    
    setConnectionState(prev => ({ ...prev, isMonitoring: true }));
    
    // Initial connection check
    checkConnectionStatus();
    
    // Set up periodic monitoring with longer intervals
    monitoringIntervalRef.current = setInterval(() => {
      if (isPageVisibleRef.current && shouldMonitorConnection()) {
        checkConnectionStatus();
      }
    }, monitoringInterval);
  }, [connectionState.isMonitoring, shouldMonitorConnection]);

  // Stop connection monitoring
  const stopConnectionMonitoring = useCallback(() => {
    if (!connectionState.isMonitoring) {
      return;
    }

    console.log('[OptimizedFirebaseConnectionManager] Stopping connection monitoring to reduce database usage');
    
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
    }
    
    setConnectionState(prev => ({ 
      ...prev, 
      isMonitoring: false,
      status: 'idle'
    }));
    
    setShowAlert(false);
  }, [connectionState.isMonitoring]);

  // Check connection status with caching
  const checkConnectionStatus = useCallback(async () => {
    const now = Date.now();
    
    // Rate limit connection checks
    if (now - connectionState.lastCheck < 10000) { // Minimum 10 seconds between checks
      return;
    }

    try {
      setConnectionState(prev => ({ ...prev, status: 'connecting', lastCheck: now }));
      
      const services = getFirebaseServices();
      
      if (services.app && services.db) {
        setConnectionState(prev => ({ 
          ...prev, 
          status: 'connected',
          reconnectAttempts: 0
        }));
        setShowAlert(false);
      } else {
        throw new Error('Firebase services not available');
      }
    } catch (error) {
      console.error('[OptimizedFirebaseConnectionManager] Connection check failed:', error);
      
      setConnectionState(prev => ({ 
        ...prev, 
        status: 'disconnected',
        reconnectAttempts: prev.reconnectAttempts + 1
      }));
      
      // Only show alert if we're on a critical page and have tried multiple times
      if (shouldMonitorConnection() && connectionState.reconnectAttempts >= 2) {
        setShowAlert(true);
      }
    }
  }, [connectionState.lastCheck, connectionState.reconnectAttempts, shouldMonitorConnection]);

  // Handle reconnection with exponential backoff
  const handleReconnect = useCallback(async () => {
    if (connectionState.reconnectAttempts >= maxReconnectAttempts) {
      console.log('[OptimizedFirebaseConnectionManager] Max reconnection attempts reached');
      return;
    }

    setIsReconnecting(true);
    
    try {
      // Clean up all listeners first
      removeAllListeners();
      
      // Disable and re-enable network with delay
      await disableNetwork();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await enableNetwork();
      
      // Check connection after a delay
      setTimeout(() => {
        checkConnectionStatus();
      }, 2000);
      
    } catch (error) {
      console.error('[OptimizedFirebaseConnectionManager] Reconnection failed:', error);
    } finally {
      setIsReconnecting(false);
    }
  }, [connectionState.reconnectAttempts, checkConnectionStatus]);

  // Main effect to manage monitoring based on page and authentication
  useEffect(() => {
    if (shouldMonitorConnection() && isPageVisibleRef.current) {
      startConnectionMonitoring();
    } else {
      stopConnectionMonitoring();
    }

    return () => {
      stopConnectionMonitoring();
    };
  }, [shouldMonitorConnection, startConnectionMonitoring, stopConnectionMonitoring]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
      }
    };
  }, []);

  // Only show alert when there's a real connection issue on critical pages
  if (connectionState.status === 'disconnected' && showAlert && shouldMonitorConnection()) {
    return (
      <Alert variant="destructive" className="fixed bottom-4 right-4 max-w-md z-50 shadow-lg">
        <WifiOff className="h-4 w-4" />
        <AlertTitle>Connection Issue</AlertTitle>
        <AlertDescription>
          <p>Unable to connect to our services. Some features may not work properly.</p>
          <div className="mt-2 flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleReconnect}
              disabled={isReconnecting || connectionState.reconnectAttempts >= maxReconnectAttempts}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isReconnecting ? 'animate-spin' : ''}`} />
              {isReconnecting ? 'Reconnecting...' : 'Retry'}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowAlert(false)}
            >
              Dismiss
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Return null when not showing alert (component is invisible but still managing connections)
  return null;
}