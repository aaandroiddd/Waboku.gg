import { useEffect } from 'react';
import { db, disableNetwork } from '@/lib/firebase';

/**
 * Component that properly disables Firestore connections
 * This helps prevent 400 Bad Request errors when Firestore is not needed
 */
export function FirestoreDisabler() {
  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    const disableFirestore = async () => {
      if (db) {
        try {
          await disableNetwork(db);
          
          // Set a flag to indicate Firestore is disabled
          localStorage.setItem('firestore_disabled', 'true');
          
          // Clear any Firestore-related localStorage items
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('firestore') || key.includes('firestore')) {
              // Don't remove our own flag
              if (key !== 'firestore_disabled') {
                localStorage.removeItem(key);
              }
            }
          });
        } catch (error) {
          console.error('[FirestoreDisabler] Error disabling Firestore:', error);
        }
      }
    };

    // Run immediately
    disableFirestore();

    // Cleanup function to remove the flag when component unmounts
    return () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('firestore_disabled');
      }
    };
  }, []);

  // This component doesn't render anything
  return null;
}