import { useEffect } from 'react';
import { db, disableNetwork } from '@/lib/firebase';
import { useToast } from '@/components/ui/use-toast';

/**
 * Component that properly disables Firestore connections
 * This helps prevent 400 Bad Request errors when Firestore is not needed
 */
export function FirestoreDisabler() {
  const { toast } = useToast();

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    const disableFirestore = async () => {
      if (db) {
        try {
          console.log('[FirestoreDisabler] Disabling Firestore connections');
          await disableNetwork(db);
          console.log('[FirestoreDisabler] Firestore disabled successfully');
          
          // Clear any Firestore-related localStorage items
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('firestore') || key.includes('firestore')) {
              localStorage.removeItem(key);
            }
          });
        } catch (error) {
          console.error('[FirestoreDisabler] Error disabling Firestore:', error);
          
          // Only show toast for non-development environments
          if (process.env.NODE_ENV !== 'development') {
            toast({
              title: "Firestore Warning",
              description: "There was an issue disabling Firestore. Some features may not work correctly.",
              variant: "destructive",
              duration: 5000,
            });
          }
        }
      }
    };

    // Run immediately
    disableFirestore();

    // Also run when the component is unmounted and remounted
    return () => {
      console.log('[FirestoreDisabler] Component unmounted');
    };
  }, [toast]);

  // This component doesn't render anything
  return null;
}