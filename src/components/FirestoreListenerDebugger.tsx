import React, { useState, useEffect } from 'react';
import { getActiveListenersCount } from '@/lib/firebase-service';
import { Badge } from '@/components/ui/badge';

export function FirestoreListenerDebugger() {
  const [listenerCount, setListenerCount] = useState(0);
  
  useEffect(() => {
    // Update the count initially
    setListenerCount(getActiveListenersCount());
    
    // Set up an interval to update the count
    const interval = setInterval(() => {
      setListenerCount(getActiveListenersCount());
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Badge variant={listenerCount > 0 ? "destructive" : "outline"} className="px-3 py-1.5">
        {listenerCount} Active Firestore {listenerCount === 1 ? 'Listener' : 'Listeners'}
      </Badge>
    </div>
  );
}