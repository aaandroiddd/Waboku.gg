import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface ClearFirestoreCacheProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  buttonText?: string;
}

/**
 * Button component that clears Firestore-related cache and reloads the page
 * This helps resolve 400 Bad Request errors with Firestore
 */
export function ClearFirestoreCache({
  variant = 'default',
  size = 'default',
  className = '',
  buttonText = 'Clear Cache & Reload'
}: ClearFirestoreCacheProps) {
  const clearCacheAndReload = () => {
    if (typeof window === 'undefined') return;
    
    console.log('[ClearFirestoreCache] Clearing Firebase/Firestore cache and reloading');
    
    // Clear Firebase-specific localStorage items
    Object.keys(localStorage).forEach(key => {
      if (
        key.startsWith('firebase:') || 
        key.includes('firestore') || 
        key.includes('firebase')
      ) {
        console.log(`[ClearFirestoreCache] Removing localStorage item: ${key}`);
        localStorage.removeItem(key);
      }
    });
    
    // Clear Firebase-specific sessionStorage items
    Object.keys(sessionStorage).forEach(key => {
      if (
        key.startsWith('firebase:') || 
        key.includes('firestore') || 
        key.includes('firebase')
      ) {
        console.log(`[ClearFirestoreCache] Removing sessionStorage item: ${key}`);
        sessionStorage.removeItem(key);
      }
    });
    
    // Clear IndexedDB databases related to Firebase
    if (window.indexedDB) {
      // List of common Firebase IndexedDB database names
      const firebaseDbNames = [
        'firebaseLocalStorage',
        'firestore',
        'firebase-installations-database',
        'firebase-messaging-database',
        'firebase-auth-state'
      ];
      
      firebaseDbNames.forEach(dbName => {
        try {
          console.log(`[ClearFirestoreCache] Attempting to delete IndexedDB database: ${dbName}`);
          const request = window.indexedDB.deleteDatabase(dbName);
          
          request.onsuccess = () => {
            console.log(`[ClearFirestoreCache] Successfully deleted IndexedDB database: ${dbName}`);
          };
          
          request.onerror = () => {
            console.error(`[ClearFirestoreCache] Error deleting IndexedDB database: ${dbName}`);
          };
        } catch (error) {
          console.error(`[ClearFirestoreCache] Exception when trying to delete IndexedDB database ${dbName}:`, error);
        }
      });
    }
    
    // Add a flag to indicate we're coming back from a cache clear
    localStorage.setItem('firebase_cache_cleared', Date.now().toString());
    
    // Give a small delay to allow IndexedDB operations to complete
    setTimeout(() => {
      // Reload the page
      window.location.reload();
    }, 500);
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={clearCacheAndReload}
      className={className}
    >
      <RefreshCw className="mr-2 h-4 w-4" />
      {buttonText}
    </Button>
  );
}