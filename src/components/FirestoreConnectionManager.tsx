import { useEffect, useState } from 'react';
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

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;
    
    // Skip if Firestore is not initialized
    if (!db) return;
    
    // Clear any Firestore-related localStorage items that might be causing listeners
    const clearFirestoreCache = () => {
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
    };
    
    const manageFirestoreConnection = async () => {
      try {
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
        
        // If user is not logged in, disable Firestore except for specific pages
        if (!user && !needsFirestore) {
          // Only disable if we haven't recently disabled
          if (!connectionCache || 
              connectionCache.lastAction !== 'disable' || 
              connectionCache.path !== currentPath) {
            
            console.log('Disabling Firestore - User not logged in and page does not need it');
            await disableNetwork(db);
            setIsFirestoreEnabled(false);
            
            // Clear Firestore cache to prevent lingering listeners
            clearFirestoreCache();
            
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
          }
          return;
        }
        
        // If user is logged in but current page doesn't need Firestore
        if (user && !needsFirestore) {
          // Only disable if we haven't recently disabled for this path
          if (!connectionCache || 
              connectionCache.lastAction !== 'disable' || 
              connectionCache.path !== currentPath) {
            
            console.log('Disabling Firestore - User logged in but page does not need it');
            await disableNetwork(db);
            setIsFirestoreEnabled(false);
            
            // Clear Firestore cache to prevent lingering listeners
            clearFirestoreCache();
            
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
          }
          return;
        }
        
        // If we need Firestore, enable it
        if ((user || needsFirestore) && 
            (!connectionCache || 
             connectionCache.lastAction !== 'enable' || 
             connectionCache.path !== currentPath)) {
          
          console.log('Enabling Firestore - User logged in and/or page needs it');
          await enableNetwork(db);
          setIsFirestoreEnabled(true);
          
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
        }
      } catch (error) {
        console.error('Error managing Firestore connection:', error);
      }
    };

    // Run immediately on mount and when route changes
    manageFirestoreConnection();
    
    // Also run when user auth state changes
    return () => {
      // Clean up if needed
    };
  }, [user, router.pathname]);

  // This component doesn't render anything
  return null;
}