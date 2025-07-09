import { useEffect, useRef } from 'react';
import { getFirebaseServices, connectionManager } from '@/lib/firebase';
import { disableNetwork, enableNetwork } from 'firebase/firestore';

export function FirestoreListenChannelHandler() {
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;
  const isHandling = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Listen for custom Firestore reconnect events
    const handleFirestoreReconnect = async () => {
      if (isHandling.current) return;
      isHandling.current = true;

      try {
        const { db } = getFirebaseServices();
        if (!db) return;

        console.log('[Firestore Listen Handler] Attempting reconnection...');
        
        // Disable network first
        await disableNetwork(db);
        console.log('[Firestore Listen Handler] Network disabled');
        
        // Wait before re-enabling
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Re-enable network
        await enableNetwork(db);
        console.log('[Firestore Listen Handler] Network re-enabled');
        
        reconnectAttempts.current = 0;
      } catch (error) {
        console.error('[Firestore Listen Handler] Reconnection failed:', error);
        reconnectAttempts.current++;
        
        if (reconnectAttempts.current < maxReconnectAttempts) {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('firestore-reconnect'));
          }, 5000 * reconnectAttempts.current);
        }
      } finally {
        setTimeout(() => {
          isHandling.current = false;
        }, 1000);
      }
    };

    // Enhanced fetch error monitoring specifically for Listen channel
    const originalFetch = window.fetch;
    window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
      try {
        const response = await originalFetch(input, init);
        
        // Check for Firestore Listen channel errors
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('firestore.googleapis.com') && url.includes('/Listen/channel')) {
          if (!response.ok) {
            console.warn('[Firestore Listen Handler] Listen channel HTTP error:', response.status);
            
            if (response.status === 400) {
              // Trigger immediate reconnection for 400 errors
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('firestore-reconnect'));
              }, 100);
            }
          }
        }
        
        return response;
      } catch (error: any) {
        const url = typeof input === 'string' ? input : input.toString();
        
        // Handle Listen channel fetch failures
        if (url.includes('firestore.googleapis.com') && url.includes('/Listen/channel')) {
          console.error('[Firestore Listen Handler] Listen channel fetch failed:', error.message);
          
          // Trigger reconnection for fetch failures
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('firestore-reconnect'));
          }, 500);
          
          // Return a mock response to prevent cascading errors
          return new Response(JSON.stringify({ error: 'Listen channel temporarily unavailable' }), {
            status: 503,
            statusText: 'Service Temporarily Unavailable',
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        throw error;
      }
    };

    window.addEventListener('firestore-reconnect', handleFirestoreReconnect);

    return () => {
      window.removeEventListener('firestore-reconnect', handleFirestoreReconnect);
      // Restore original fetch
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}