import { useEffect, useState, useCallback } from 'react';
import { db, disableNetwork, enableNetwork } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';

// Pages that need active Firestore connections
const PAGES_REQUIRING_FIRESTORE = [
  '/dashboard',
  '/listings/[id]',
  '/profile/[id]',
  '/messages',
  '/wanted/[id]'
];

// Pages that should never use Firestore
const PAGES_NEVER_NEEDING_FIRESTORE = [
  '/',
  '/auth/sign-in',
  '/auth/sign-up',
  '/about',
  '/faq',
  '/privacy-policy'
];

// Cache to track when we last enabled/disabled Firestore
interface FirestoreConnectionCache {
  lastAction: 'enable' | 'disable';
  timestamp: number;
  path: string;
}

/**
 * Component that intelligently manages Firestore connections
 * to reduce excessive Listen requests when not actively needed
 */
export function FirestoreConnectionManager() {
  const { user } = useAuth();
  const router = useRouter();
  const [isFirestoreEnabled, setIsFirestoreEnabled] = useState(false);
  
  // Function to check if current page needs Firestore
  const doesCurrentPageNeedFirestore = () => {
    const currentPath = router.pathname;
    
    // First check if this is a page that should never use Firestore
    const isNeverNeededPage = PAGES_NEVER_NEEDING_FIRESTORE.some(path => {
      return path === currentPath;
    });
    
    if (isNeverNeededPage) {
      return false;
    }
    
    // Then check if the current path matches any of the paths requiring Firestore
    return PAGES_REQUIRING_FIRESTORE.some(path => {
      // Handle exact matches
      if (path === currentPath) return true;
      
      // Handle dynamic routes (those with [param] pattern)
      if (path.includes('[') && path.includes(']')) {
        const pathPattern = path.replace(/\[.*?\]/g, '[^/]+');
        const regex = new RegExp(`^${pathPattern}$`);
        return regex.test(currentPath);
      }
      
      // Handle prefix matches (e.g., /dashboard/*)
      if (currentPath.startsWith(path.split('/')[1] + '/')) return true;
      
      return false;
    });
  };

  // Track if a network operation is in progress to prevent overlapping calls
  const [isNetworkOperationInProgress, setIsNetworkOperationInProgress] = useState(false);
  // Track the last operation time to prevent too frequent changes
  const [lastOperationTime, setLastOperationTime] = useState(0);
  
  // Clear any Firestore-related localStorage items that might be causing listeners
  const clearFirestoreCache = useCallback(() => {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('firestore') || 
            key.includes('firestore') || 
            key.includes('firebase') || 
            key.includes('fs_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Error clearing Firestore cache:', error);
    }
  }, []);
  
  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;
    
    // Skip if Firestore is not initialized
    if (!db) return;
    
    const manageFirestoreConnection = async () => {
      // Prevent rapid toggling of network state
      const now = Date.now();
      const timeSinceLastOperation = now - lastOperationTime;
      
      // Don't allow operations more frequently than every 5 seconds
      if (timeSinceLastOperation < 5000) {
        console.log('Skipping Firestore connection change - too soon since last operation');
        return;
      }
      
      // Don't allow overlapping operations
      if (isNetworkOperationInProgress) {
        console.log('Skipping Firestore connection change - operation already in progress');
        return;
      }
      
      try {
        setIsNetworkOperationInProgress(true);
        
        // Get cached connection state
        const cacheKey = 'firestore_connection_state';
        let connectionCache: FirestoreConnectionCache | null = null;
        
        try {
          const cachedData = sessionStorage.getItem(cacheKey);
          if (cachedData) {
            connectionCache = JSON.parse(cachedData);
          }
        } catch (error) {
          console.error('Error reading Firestore connection cache:', error);
        }
        
        // Determine if we need Firestore for the current page
        const needsFirestore = doesCurrentPageNeedFirestore();
        const currentPath = router.pathname;
        
        // If we don't need Firestore (either user not logged in or page doesn't need it)
        if ((!user && !needsFirestore) || (user && !needsFirestore)) {
          // Only disable if we haven't recently disabled for this path
          // and if the last action wasn't already 'disable'
          if (!connectionCache || 
              connectionCache.lastAction !== 'disable' || 
              connectionCache.path !== currentPath) {
            
            console.log(`Disabling Firestore - ${!user ? 'User not logged in' : 'Page does not need it'}`);
            
            // Add a small delay before disabling to allow any pending operations to complete
            await new Promise(resolve => setTimeout(resolve, 500));
            
            try {
              await disableNetwork(db);
              setIsFirestoreEnabled(false);
              setLastOperationTime(Date.now());
              
              // Clear Firestore cache to prevent lingering listeners
              // but only after a small delay to allow disableNetwork to complete
              setTimeout(() => {
                clearFirestoreCache();
              }, 1000);
              
              // Update cache
              const newCache: FirestoreConnectionCache = {
                lastAction: 'disable',
                timestamp: Date.now(),
                path: currentPath
              };
              
              try {
                sessionStorage.setItem(cacheKey, JSON.stringify(newCache));
              } catch (error) {
                console.error('Error saving Firestore connection cache:', error);
              }
            } catch (error) {
              console.error('Error disabling Firestore network:', error);
            }
          }
          return;
        }
        
        // If we need Firestore, enable it
        if ((user || needsFirestore) && 
            (!connectionCache || 
             connectionCache.lastAction !== 'enable' || 
             connectionCache.path !== currentPath)) {
          
          console.log('Enabling Firestore - User logged in and/or page needs it');
          
          try {
            await enableNetwork(db);
            setIsFirestoreEnabled(true);
            setLastOperationTime(Date.now());
            
            // Update cache
            const newCache: FirestoreConnectionCache = {
              lastAction: 'enable',
              timestamp: Date.now(),
              path: currentPath
            };
            
            try {
              sessionStorage.setItem(cacheKey, JSON.stringify(newCache));
            } catch (error) {
              console.error('Error saving Firestore connection cache:', error);
            }
          } catch (error) {
            console.error('Error enabling Firestore network:', error);
          }
        }
      } catch (error) {
        console.error('Error managing Firestore connection:', error);
      } finally {
        // Ensure we always reset the in-progress flag
        setIsNetworkOperationInProgress(false);
      }
    };

    // Run with a small delay to prevent race conditions on initial load
    const timeoutId = setTimeout(() => {
      manageFirestoreConnection();
    }, 1000);
    
    // Clean up timeout on unmount
    return () => {
      clearTimeout(timeoutId);
    };
  }, [user, router.pathname, isNetworkOperationInProgress, lastOperationTime, clearFirestoreCache]);

  // This component doesn't render anything
  return null;
}