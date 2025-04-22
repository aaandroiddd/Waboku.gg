import { useEffect, useRef, useState } from 'react';
import { database, getFirebaseServices } from '@/lib/firebase';
import { ref, onValue, get, getDatabase, goOnline, set } from 'firebase/database';
import { toast } from '@/components/ui/use-toast';
import { setMessagesPageMode, prefetchUserData } from '@/hooks/useUserData';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * This component initializes the messages page by ensuring that:
 * 1. Realtime Database connection is verified and established
 * 2. Optimizes database connection for better performance
 * 3. Provides reliable connection recovery mechanisms
 * 4. Prefetches user data for active conversations
 */
export function MessagesPageInitializer() {
  const dbInstanceRef = useRef<any>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 8;
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  /**
   * Primary function to establish and verify database connection
   * with improved error handling and recovery
   */
  const connectToDatabase = async (): Promise<any> => {
    try {
      // First try to use existing database instance
      let db = dbInstanceRef.current || database;
      
      // If no database instance exists, get a fresh one
      if (!db) {
        const { database: freshDb } = getFirebaseServices();
        db = freshDb || getDatabase();
        
        if (!db) {
          throw new Error('Failed to initialize database');
        }
      }
      
      // Store the database instance for future use
      dbInstanceRef.current = db;
      
      // Explicitly go online to ensure connection
      goOnline(db);
      
      return db;
    } catch (error) {
      console.error('[MessagesPageInitializer] Database connection error:', error);
      throw error;
    }
  };

  /**
   * Function to verify database connection status
   * with improved error recovery and logging
   */
  const verifyDatabaseConnection = async () => {
    const retryCount = retryCountRef.current;
    
    // Clean up previous connection attempts
    cleanup();
    
    try {
      // Connect to the database
      const db = await connectToDatabase();
      
      // Check connection status via .info/connected reference
      const connectedRef = ref(db, '.info/connected');
      
      // First try with immediate get() for faster response
      try {
        const snapshot = await get(connectedRef);
        const connected = snapshot.val();
        
        if (connected) {
          console.log('[MessagesPageInitializer] Database connection verified');
          setIsConnected(true);
          retryCountRef.current = 0;
          
          // Test write operation
          testDatabaseWrite(db);

          // Once connected, prefetch user data
          prefetchVisibleUserData();
          return;
        }
      } catch (error) {
        console.warn('[MessagesPageInitializer] Initial connection check failed:', error);
      }
      
      // Set up listener for connection status changes
      const unsubscribe = onValue(connectedRef, (snapshot) => {
        const connected = snapshot.val();
        
        if (connected) {
          console.log('[MessagesPageInitializer] Connection established via listener');
          setIsConnected(true);
          retryCountRef.current = 0;
          
          // Test write operation once connected
          testDatabaseWrite(db);

          // Once connected, prefetch user data
          prefetchVisibleUserData();
        } else {
          console.log('[MessagesPageInitializer] Disconnected from database');
          setIsConnected(false);
          
          if (retryCount < MAX_RETRIES) {
            const delay = Math.min(1000 * Math.pow(1.5, retryCount), 10000);
            console.log(`[MessagesPageInitializer] Will retry in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
            timeoutRef.current = setTimeout(() => {
              retryCountRef.current++;
              verifyDatabaseConnection();
            }, delay);
          } else if (retryCount >= MAX_RETRIES) {
            console.error(`[MessagesPageInitializer] Max retry attempts (${MAX_RETRIES}) reached`);
            // Only show a toast on the final attempt to avoid spamming
            toast({
              title: "Connection issues detected",
              description: "Having trouble connecting to the message server. Try refreshing the page.",
              variant: "destructive",
              duration: 5000,
            });
          }
        }
      }, (error) => {
        console.error('[MessagesPageInitializer] Connection listener error:', error);
        setIsConnected(false);
        
        if (retryCount < MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(1.5, retryCount), 10000);
          timeoutRef.current = setTimeout(() => {
            retryCountRef.current++;
            verifyDatabaseConnection();
          }, delay);
        }
      });
      
      // Store the unsubscribe function
      unsubscribeRef.current = unsubscribe;
      
      // Set a timeout for initial connection check
      // If we don't get a connection after 5 seconds, retry
      timeoutRef.current = setTimeout(() => {
        if (isConnected !== true && retryCount < MAX_RETRIES) {
          console.log('[MessagesPageInitializer] Connection check timed out');
          retryCountRef.current++;
          verifyDatabaseConnection();
        }
      }, 5000);
      
    } catch (error) {
      console.error('[MessagesPageInitializer] Error during connection verification:', error);
      setIsConnected(false);
      
      // Retry with backoff if we haven't exceeded max retries
      if (retryCount < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(1.5, retryCount), 10000);
        timeoutRef.current = setTimeout(() => {
          retryCountRef.current++;
          verifyDatabaseConnection();
        }, delay);
      }
    }
  };

  /**
   * Test database connection by writing to a test node
   * This confirms write permissions are working correctly
   */
  const testDatabaseWrite = async (db: any) => {
    try {
      if (!db) return;
      
      const testRef = ref(db, 'connection_tests/last_test');
      await set(testRef, {
        timestamp: Date.now(),
        client: 'web',
        status: 'connected',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
      });
      
      console.log('[MessagesPageInitializer] Test write successful');
    } catch (error) {
      console.error('[MessagesPageInitializer] Test write failed:', error);
      
      // If write fails but read succeeded, we might have permission issues
      toast({
        title: "Permission Issue Detected",
        description: "Unable to send messages. Please refresh the page or contact support.",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  /**
   * Prefetch user data for all visible conversations
   * This improves the user experience by loading usernames in advance
   */
  const prefetchVisibleUserData = async () => {
    try {
      // Find all user IDs that are visible in the UI
      const userIdsToFetch = new Set<string>();
      
      // Try to get recent conversations from Realtime Database
      const { database } = getFirebaseServices();
      if (database) {
        try {
          // Try to get current user ID from session
          let currentUserId = null;
          try {
            const userData = sessionStorage.getItem('userData');
            if (userData) {
              const parsedUserData = JSON.parse(userData);
              currentUserId = parsedUserData.uid;
            }
          } catch (e) {
            console.warn('[MessagesPageInitializer] Error retrieving current user from session:', e);
          }

          if (currentUserId) {
            // Try to fetch conversations
            const conversationsRef = ref(database, `conversations/${currentUserId}`);
            const conversationsSnapshot = await get(conversationsRef);
            
            if (conversationsSnapshot.exists()) {
              const conversations = conversationsSnapshot.val();
              // Extract user IDs from conversations
              Object.keys(conversations).forEach(convoId => {
                const participants = conversations[convoId].participants;
                if (participants) {
                  Object.keys(participants).forEach(userId => {
                    if (userId !== currentUserId) {
                      userIdsToFetch.add(userId);
                    }
                  });
                }
              });
            }
            
            // Also try to fetch from the messages path which might have additional user IDs
            const messagesRef = ref(database, `messages/${currentUserId}`);
            try {
              const messagesSnapshot = await get(messagesRef);
              if (messagesSnapshot.exists()) {
                const messages = messagesSnapshot.val();
                Object.keys(messages).forEach(otherUserId => {
                  if (otherUserId !== currentUserId) {
                    userIdsToFetch.add(otherUserId);
                  }
                });
              }
            } catch (e) {
              console.warn('[MessagesPageInitializer] Error fetching messages:', e);
            }
          } else {
            console.warn('[MessagesPageInitializer] Current user ID not found');
          }
        } catch (error) {
          console.warn('[MessagesPageInitializer] Error fetching conversations from RTDB:', error);
        }
      }
      
      // Also try Firestore as a fallback for getting user IDs
      try {
        const firestoreConversations = query(
          collection(db, 'conversations'),
          limit(20)
        );
        
        const querySnapshot = await getDocs(firestoreConversations);
        querySnapshot.forEach(doc => {
          if (doc.exists()) {
            const data = doc.data();
            if (data.participants) {
              Object.keys(data.participants).forEach(userId => {
                userIdsToFetch.add(userId);
              });
            }
          }
        });
      } catch (error) {
        console.warn('[MessagesPageInitializer] Error fetching conversations from Firestore:', error);
      }

      // Also check if we have any user IDs visible in the DOM
      // This is a fallback to ensure we load data for any users currently displayed
      if (typeof document !== 'undefined') {
        const userElements = document.querySelectorAll('[data-user-id]');
        userElements.forEach(el => {
          const userId = el.getAttribute('data-user-id');
          if (userId) {
            userIdsToFetch.add(userId);
          }
        });
      }
      
      // Prefetch data for all the user IDs we found
      if (userIdsToFetch.size > 0) {
        console.log(`[MessagesPageInitializer] Prefetching data for ${userIdsToFetch.size} users visible in conversations`);
        prefetchUserData(Array.from(userIdsToFetch));
      }
    } catch (error) {
      console.error('[MessagesPageInitializer] Error prefetching user data:', error);
    }
  };

  /**
   * Cleanup function to remove listeners and timeouts
   */
  const cleanup = () => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Unsubscribe from any existing listener
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  };

  // Initialize connection when component mounts
  useEffect(() => {
    console.log('[MessagesPageInitializer] Initializing messages page');
    setMessagesPageMode(true);
    verifyDatabaseConnection();
    
    // Cleanup when component unmounts
    return () => {
      console.log('[MessagesPageInitializer] Cleaning up messages page');
      cleanup();
      setMessagesPageMode(false);
    };
  }, []);

  // The component doesn't render anything visible
  return null;
}