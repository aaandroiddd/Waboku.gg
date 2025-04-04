import { useEffect, useState } from 'react';
import { getDatabase, ref, onValue, get } from 'firebase/database';
import { database as firebaseDatabase } from '@/lib/firebase';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';

interface DatabaseConnectionStatusProps {
  onConnectionChange?: (connected: boolean) => void;
}

export function DatabaseConnectionStatus({ onConnectionChange }: DatabaseConnectionStatusProps) {
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [isRetrying, setIsRetrying] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [checkCount, setCheckCount] = useState(0);

  // Function to clear Firebase cache and reload
  const clearCacheAndReload = () => {
    if (typeof window !== 'undefined') {
      console.log('[DatabaseConnectionStatus] Clearing Firebase cache and reloading');
      localStorage.removeItem('firebase:previous_websocket_failure');
      localStorage.removeItem('firebase:host:waboku-gg-default-rtdb.firebaseio.com');
      sessionStorage.clear();
      localStorage.setItem('messages_cache_cleared', Date.now().toString());
      window.location.reload();
    }
  };

  // Function to check database connection
  const checkConnection = async (retryCount = 0) => {
    console.log(`[DatabaseConnectionStatus] Checking database connection (attempt ${retryCount + 1})`);
    setConnectionStatus('checking');
    setIsRetrying(true);
    setCheckCount(prev => prev + 1);
    
    // Get database instance
    let db = firebaseDatabase;
    
    if (!db) {
      try {
        db = getDatabase();
      } catch (error) {
        console.error('[DatabaseConnectionStatus] Error getting database:', error);
        setConnectionStatus('disconnected');
        setIsRetrying(false);
        setShowAlert(true);
        if (onConnectionChange) onConnectionChange(false);
        return;
      }
    }
    
    if (!db) {
      console.error('[DatabaseConnectionStatus] Database not available');
      setConnectionStatus('disconnected');
      setIsRetrying(false);
      setShowAlert(true);
      if (onConnectionChange) onConnectionChange(false);
      return;
    }
    
    try {
      // Check connection status
      const connectedRef = ref(db, '.info/connected');
      
      // First try with get() for immediate status
      try {
        const snapshot = await get(connectedRef);
        const connected = snapshot.val();
        console.log(`[DatabaseConnectionStatus] Connection check: ${connected ? 'connected' : 'disconnected'}`);
        
        setConnectionStatus(connected ? 'connected' : 'disconnected');
        if (onConnectionChange) onConnectionChange(connected);
        
        if (!connected && retryCount < 2) {
          // If disconnected and we haven't tried too many times, retry
          setTimeout(() => checkConnection(retryCount + 1), 2000);
          return;
        }
        
        setIsRetrying(false);
        setShowAlert(!connected);
      } catch (error) {
        console.error('[DatabaseConnectionStatus] Error checking connection:', error);
        setConnectionStatus('disconnected');
        setIsRetrying(false);
        setShowAlert(true);
        if (onConnectionChange) onConnectionChange(false);
      }
    } catch (error) {
      console.error('[DatabaseConnectionStatus] Error setting up connection check:', error);
      setConnectionStatus('disconnected');
      setIsRetrying(false);
      setShowAlert(true);
      if (onConnectionChange) onConnectionChange(false);
    }
  };

  // Check connection on mount
  useEffect(() => {
    checkConnection();
    
    // Set up periodic connection check
    const interval = setInterval(() => {
      if (connectionStatus !== 'connected') {
        checkConnection();
      }
    }, 30000); // Check every 30 seconds if not connected
    
    return () => clearInterval(interval);
  }, []);

  // Don't show anything if connected
  if (connectionStatus === 'connected' && !showAlert) {
    return null;
  }

  return (
    <div className="mb-4">
      {connectionStatus === 'checking' ? (
        <Alert variant="default" className="bg-blue-500/10 border-blue-500">
          <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
          <AlertTitle className="text-blue-500">Checking Connection</AlertTitle>
          <AlertDescription className="text-sm">
            Verifying connection to the messaging service...
          </AlertDescription>
        </Alert>
      ) : connectionStatus === 'disconnected' ? (
        <Alert variant="destructive" className="border-amber-500 bg-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <div className="flex-1">
            <AlertTitle className="text-amber-500">Connection Issue</AlertTitle>
            <AlertDescription className="text-sm">
              Unable to connect to the messaging service. This may affect your ability to send and receive messages.
            </AlertDescription>
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => setShowAlert(false)}
            >
              Dismiss
            </Button>
            <Button
              variant="default"
              size="sm"
              className="text-xs h-8 bg-amber-500 hover:bg-amber-600"
              onClick={() => checkConnection()}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Checking...
                </>
              ) : (
                <>Retry</>  
              )}
            </Button>
            {checkCount >= 2 && (
              <Button
                variant="default"
                size="sm"
                className="text-xs h-8"
                onClick={clearCacheAndReload}
              >
                Clear Cache
              </Button>
            )}
          </div>
        </Alert>
      ) : (
        <Alert variant="default" className="bg-green-500/10 border-green-500">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertTitle className="text-green-500">Connected</AlertTitle>
          <AlertDescription className="text-sm">
            Successfully connected to the messaging service.
          </AlertDescription>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-8 ml-auto"
            onClick={() => setShowAlert(false)}
          >
            Dismiss
          </Button>
        </Alert>
      )}
    </div>
  );
}