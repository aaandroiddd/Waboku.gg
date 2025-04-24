import { useState, useEffect } from 'react';
import { getActiveListenersCount, getActiveListenersDetails } from '@/hooks/useFirestoreListener';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { disableNetwork, enableNetwork, db } from '@/lib/firebase';

/**
 * Component that displays the current number of active Firestore listeners
 * and provides controls to manage them
 */
export function FirestoreListenerDebugger() {
  const [listenerCount, setListenerCount] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [listenerDetails, setListenerDetails] = useState<{ path: string; count: number; lastAccessed: Date }[]>([]);
  const [isNetworkEnabled, setIsNetworkEnabled] = useState(true);

  // Update the listener count every second
  useEffect(() => {
    const interval = setInterval(() => {
      setListenerCount(getActiveListenersCount());
      if (showDetails) {
        setListenerDetails(getActiveListenersDetails());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [showDetails]);

  // Toggle network status
  const toggleNetwork = async () => {
    if (!db) return;
    
    try {
      if (isNetworkEnabled) {
        await disableNetwork(db);
        setIsNetworkEnabled(false);
      } else {
        await enableNetwork(db);
        setIsNetworkEnabled(true);
      }
    } catch (error) {
      console.error('Error toggling Firestore network:', error);
    }
  };

  // Toggle showing details
  const toggleDetails = () => {
    setShowDetails(!showDetails);
    if (!showDetails) {
      setListenerDetails(getActiveListenersDetails());
    }
  };

  // Only show in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <Card className="w-auto shadow-lg">
        <CardHeader className="py-2 px-4">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Firestore Listeners</span>
            <Badge variant={listenerCount > 10 ? "destructive" : listenerCount > 5 ? "warning" : "outline"}>
              {listenerCount}
            </Badge>
          </CardTitle>
        </CardHeader>
        
        {showDetails && (
          <CardContent className="py-2 px-4 max-h-60 overflow-auto">
            <div className="text-xs space-y-1">
              {listenerDetails.length === 0 ? (
                <p>No active listeners</p>
              ) : (
                listenerDetails.map((detail, index) => (
                  <div key={index} className="border-b pb-1 last:border-0">
                    <div className="flex justify-between">
                      <span className="font-mono truncate max-w-[200px]" title={detail.path}>
                        {detail.path}
                      </span>
                      <Badge variant="secondary" className="ml-2">
                        {detail.count}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground">
                      Last accessed: {detail.lastAccessed.toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        )}
        
        <div className="p-2 flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs"
            onClick={toggleDetails}
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </Button>
          
          <Button 
            variant={isNetworkEnabled ? "destructive" : "default"}
            size="sm" 
            className="text-xs"
            onClick={toggleNetwork}
          >
            {isNetworkEnabled ? 'Disable Network' : 'Enable Network'}
          </Button>
        </div>
      </Card>
    </div>
  );
}