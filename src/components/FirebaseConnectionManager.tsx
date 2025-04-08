import { useEffect, useState } from 'react';
import { getFirebaseServices, connectionManager } from '@/lib/firebase';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw, WifiOff } from 'lucide-react';

export function FirebaseConnectionManager() {
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  useEffect(() => {
    // Check initial connection status
    const checkConnection = async () => {
      try {
        const services = getFirebaseServices();
        if (services.app && services.db) {
          setConnectionStatus('connected');
        } else {
          setConnectionStatus('disconnected');
          setShowAlert(true);
        }
      } catch (error) {
        console.error('[FirebaseConnectionManager] Error checking connection:', error);
        setConnectionStatus('disconnected');
        setShowAlert(true);
      }
    };

    checkConnection();

    // Add connection listener
    let removeListener: (() => void) | undefined;
    if (connectionManager) {
      removeListener = connectionManager.addConnectionListener(() => {
        checkConnection();
      });
    }

    // Listen for online/offline events
    const handleOnline = () => {
      console.log('[FirebaseConnectionManager] Browser went online');
      checkConnection();
    };

    const handleOffline = () => {
      console.log('[FirebaseConnectionManager] Browser went offline');
      setConnectionStatus('disconnected');
      setShowAlert(true);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      if (removeListener) {
        removeListener();
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    setReconnectAttempts(prev => prev + 1);
    
    try {
      // Get services and force a reconnection
      const services = getFirebaseServices();
      
      // Wait a moment to allow connection to establish
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (services.app && services.db) {
        setConnectionStatus('connected');
        setShowAlert(false);
      } else {
        setConnectionStatus('disconnected');
      }
    } catch (error) {
      console.error('[FirebaseConnectionManager] Error during reconnection:', error);
      setConnectionStatus('disconnected');
    } finally {
      setIsReconnecting(false);
    }
  };

  // Only show the alert when disconnected and showAlert is true
  if (connectionStatus === 'disconnected' && showAlert) {
    return (
      <Alert variant="destructive" className="fixed bottom-4 right-4 max-w-md z-50 shadow-lg">
        <WifiOff className="h-4 w-4" />
        <AlertTitle>Connection Issue</AlertTitle>
        <AlertDescription>
          <p>There was a problem connecting to our database services.</p>
          <div className="mt-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleReconnect}
              disabled={isReconnecting}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isReconnecting ? 'animate-spin' : ''}`} />
              {isReconnecting ? 'Reconnecting...' : 'Retry Connection'}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowAlert(false)}
              className="ml-2"
            >
              Dismiss
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Return null when connected or alert is dismissed
  return null;
}