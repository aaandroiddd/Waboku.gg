import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { clearFirestoreCache } from '@/hooks/useFirestoreOptimizer';
import { Badge } from '@/components/ui/badge';
import { Database, RefreshCw } from 'lucide-react';

export function FirestoreRequestCounter() {
  const [requestCount, setRequestCount] = useState(0);
  
  useEffect(() => {
    // Function to count Firestore requests
    const countRequests = () => {
      // Look for network requests to Firestore
      const firestoreRequests = performance.getEntriesByType('resource')
        .filter(entry => 
          entry.name.includes('firestore.googleapis.com') || 
          entry.name.includes('firebase')
        );
      
      setRequestCount(firestoreRequests.length);
    };
    
    // Set up an interval to count requests
    const interval = setInterval(countRequests, 1000);
    
    // Initial count
    countRequests();
    
    return () => {
      clearInterval(interval);
    };
  }, []);
  
  const handleClearCache = () => {
    clearFirestoreCache();
    // Reload the page to see the effect
    window.location.reload();
  };
  
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
      <Badge variant="outline" className="bg-background/80 backdrop-blur-sm px-3 py-2 flex items-center gap-2">
        <Database className="h-4 w-4" />
        <span>{requestCount} Firestore Requests</span>
      </Badge>
      
      <Button 
        variant="outline" 
        size="sm" 
        className="bg-background/80 backdrop-blur-sm"
        onClick={handleClearCache}
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        Clear Cache
      </Button>
    </div>
  );
}