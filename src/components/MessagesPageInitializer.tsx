import { useEffect } from 'react';
import { db, disableNetwork, database } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';

/**
 * This component initializes the messages page by ensuring that:
 * 1. Firestore is disabled for the messages page (we only use Realtime Database)
 * 2. Realtime Database connection is verified
 * 
 * This helps prevent the "400 Bad Request" errors with Firestore Listen channel
 */
export function MessagesPageInitializer() {
  useEffect(() => {
    // Disable Firestore for the messages page - we only use Realtime Database
    const disableFirestore = async () => {
      if (db) {
        try {
          console.log('[MessagesPageInitializer] Disabling Firestore for messages page');
          await disableNetwork(db);
          console.log('[MessagesPageInitializer] Firestore disabled successfully');
        } catch (error) {
          console.error('[MessagesPageInitializer] Error disabling Firestore:', error);
        }
      }
    };

    // Verify Realtime Database connection
    const verifyRealtimeDatabase = () => {
      if (database) {
        try {
          console.log('[MessagesPageInitializer] Verifying Realtime Database connection');
          const connectedRef = ref(database, '.info/connected');
          
          onValue(connectedRef, (snapshot) => {
            const connected = snapshot.val();
            console.log(`[MessagesPageInitializer] Realtime Database connection: ${connected ? 'connected' : 'disconnected'}`);
            
            if (!connected) {
              console.warn('[MessagesPageInitializer] Realtime Database not connected, messages may not load');
            }
          }, { onlyOnce: true });
        } catch (error) {
          console.error('[MessagesPageInitializer] Error verifying Realtime Database connection:', error);
        }
      } else {
        console.error('[MessagesPageInitializer] Realtime Database not initialized');
      }
    };

    // Run initialization
    disableFirestore();
    verifyRealtimeDatabase();

    // No cleanup needed for this effect
  }, []);

  // This component doesn't render anything
  return null;
}