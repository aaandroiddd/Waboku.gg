import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { clearFirestoreCaches, fixFirestoreListenChannel } from '@/lib/firebase-connection-fix';

interface ClearBrowserCacheButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  onSuccess?: () => void;
}

export function ClearBrowserCacheButton({
  variant = 'default',
  size = 'default',
  className = '',
  onSuccess
}: ClearBrowserCacheButtonProps) {
  const [isClearing, setIsClearing] = useState(false);

  const handleClearCache = async () => {
    setIsClearing(true);
    try {
      console.log('Starting cache clearing process...');
      
      // Clear all Firestore-related caches
      await clearFirestoreCaches();
      console.log('Cleared Firestore caches');
      
      // Clear all listing-related localStorage items
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('listings_')) {
          localStorage.removeItem(key);
          console.log(`Cleared cache: ${key}`);
        }
      });
      
      // Fix Firestore connection issues
      await fixFirestoreListenChannel();
      console.log('Fixed Firestore Listen channel');
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
      alert('Cache cleared successfully. The page will now reload for changes to take effect.');
      window.location.reload();
    } catch (error) {
      console.error('Error clearing cache:', error);
      alert('There was an error clearing the cache. Please try refreshing the page manually.');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClearCache}
      disabled={isClearing}
    >
      {isClearing ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Clearing Cache...
        </>
      ) : (
        'Clear Browser Cache'
      )}
    </Button>
  );
}