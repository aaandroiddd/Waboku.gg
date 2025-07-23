import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getDatabase, ref, onValue, get, update } from 'firebase/database';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { databaseOptimizer } from '@/lib/database-usage-optimizer';
import { notificationService } from '@/lib/notification-service';
import { getOrderAttentionInfo } from '@/lib/order-utils';
import { Order } from '@/types/order';

interface UnreadCounts {
  messages: number;
  offers: number;
  orders: number;
  notifications: number;
}

interface UnreadContextType {
  unreadCounts: UnreadCounts;
  clearUnreadCount: (section: keyof UnreadCounts) => void;
  resetUnreadCount: (section: keyof UnreadCounts) => void;
  isLoading: boolean;
}

const UnreadContext = createContext<UnreadContextType | undefined>(undefined);

export const OptimizedUnreadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({
    messages: 0,
    offers: 0,
    orders: 0,
    notifications: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Track if a section is currently being viewed to prevent counting while user is viewing
  const [activeSection, setActiveSection] = useState<keyof UnreadCounts | null>(null);
  const listenersRef = useRef<string[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef<Record<string, number>>({});
  const notificationUnsubscribeRef = useRef<(() => void) | null>(null);
  const isPageVisibleRef = useRef(true);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Page Visibility API integration
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      isPageVisibleRef.current = isVisible;
      
      console.log(`[OptimizedUnreadContext] Page visibility changed: ${isVisible ? 'visible' : 'hidden'}`);
      
      if (!isVisible) {
        // Page is hidden, pause all listeners to reduce database usage
        pauseListeners();
      } else if (user) {
        // Page is visible and user is authenticated, resume listeners
        resumeListeners();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [user]);

  const pauseListeners = useCallback(() => {
    console.log('[OptimizedUnreadContext] Pausing listeners due to page visibility');
    
    // Clean up existing listeners
    listenersRef.current.forEach(id => databaseOptimizer.removeListener(id));
    listenersRef.current = [];
    
    // Clean up notification listener
    if (notificationUnsubscribeRef.current) {
      notificationUnsubscribeRef.current();
      notificationUnsubscribeRef.current = null;
    }
    
    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resumeListeners = useCallback(() => {
    if (!user || !isPageVisibleRef.current) {
      console.log('[OptimizedUnreadContext] Not resuming listeners - user not authenticated or page not visible');
      return;
    }
    
    console.log('[OptimizedUnreadContext] Resuming listeners due to page visibility');
    setupListeners();
  }, [user]);

  // Exponential backoff for reconnection attempts
  const getReconnectDelay = useCallback(() => {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, reconnectAttemptsRef.current), maxDelay);
    return delay;
  }, []);

  const setupListeners = useCallback(() => {
    if (!user || !isPageVisibleRef.current) {
      console.log('[OptimizedUnreadContext] Skipping listener setup - user not authenticated or page not visible');
      return;
    }

    console.log('[OptimizedUnreadContext] Setting up optimized listeners');
    setIsLoading(true);

    // Clean up previous listeners
    listenersRef.current.forEach(id => databaseOptimizer.removeListener(id));
    listenersRef.current = [];
    
    // Clean up previous notification listener
    if (notificationUnsubscribeRef.current) {
      notificationUnsubscribeRef.current();
      notificationUnsubscribeRef.current = null;
    }

    try {
      // Set up real-time notification listener
      notificationUnsubscribeRef.current = notificationService.subscribeToUnreadCount(
        user.uid,
        (count) => {
          console.log('[OptimizedUnreadContext] Received notification count update:', count);
          if (activeSection !== 'notifications') {
            setUnreadCounts(prev => ({ ...prev, notifications: count }));
          }
          // Reset reconnect attempts on successful data
          reconnectAttemptsRef.current = 0;
        }
      );

      // Use optimized listener for messages with exponential backoff
      const messagesListenerId = databaseOptimizer.createOptimizedListener({
        path: `users/${user.uid}/messageThreads`,
        callback: async (threadsData) => {
          try {
            if (!threadsData || activeSection === 'messages') {
              setUnreadCounts(prev => ({ ...prev, messages: 0 }));
              return;
            }

            // Reset reconnect attempts on successful data
            reconnectAttemptsRef.current = 0;

            let unreadMessageCount = 0;
            const { database } = getFirebaseServices();
            
            if (!database) {
              console.error('[OptimizedUnreadContext] Database not available for unread count');
              return;
            }
            
            const chatIds = Object.keys(threadsData);
            
            // Use batch processing with smaller chunks to reduce load
            const maxConcurrentChecks = 3; // Reduced from 5
            const chunks = [];
            for (let i = 0; i < chatIds.length; i += maxConcurrentChecks) {
              chunks.push(chatIds.slice(i, i + maxConcurrentChecks));
            }
            
            for (const chunk of chunks) {
              // Only process if page is still visible and user is still authenticated
              if (!isPageVisibleRef.current || !user) {
                console.log('[OptimizedUnreadContext] Stopping message processing - page hidden or user logged out');
                break;
              }

              const unreadPromises = chunk.map(async (chatId) => {
                try {
                  // Use one-time read instead of persistent listener for individual chats
                  const chatRef = ref(database, `chats/${chatId}`);
                  const chatSnapshot = await get(chatRef);
                  const chatData = chatSnapshot.val();
                  
                  if (chatData && 
                      chatData.participants?.[user.uid] && 
                      !chatData.deletedBy?.[user.uid] &&
                      chatData.lastMessage &&
                      chatData.lastMessage.receiverId === user.uid &&
                      chatData.lastMessage.read === false) {
                    return 1;
                  }
                  return 0;
                } catch (error) {
                  console.error(`[OptimizedUnreadContext] Error checking unread status for chat ${chatId}:`, error);
                  return 0;
                }
              });
              
              const chunkResults = await Promise.all(unreadPromises);
              unreadMessageCount += chunkResults.reduce((sum, count) => sum + count, 0);
              
              // Increased delay between chunks to be more respectful to the database
              if (chunks.indexOf(chunk) < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 200)); // Increased from 100ms
              }
            }
            
            setUnreadCounts(prev => ({ ...prev, messages: unreadMessageCount }));
          } catch (error) {
            console.error('[OptimizedUnreadContext] Error counting unread messages:', error);
            
            // Implement exponential backoff for reconnection
            reconnectAttemptsRef.current++;
            if (reconnectAttemptsRef.current <= maxReconnectAttempts) {
              const delay = getReconnectDelay();
              console.log(`[OptimizedUnreadContext] Retrying in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
              
              setTimeout(() => {
                if (user && isPageVisibleRef.current) {
                  setupListeners();
                }
              }, delay);
            }
          }
        },
        options: { once: false }
      });

      if (messagesListenerId) {
        listenersRef.current.push(messagesListenerId);
      }

      // Use one-time reads for offers and orders with increased intervals
      const fetchUnreadData = async () => {
        if (!user || !isPageVisibleRef.current || activeSection === 'offers' || activeSection === 'orders') {
          return;
        }
        
        try {
          const now = Date.now();
          
          // Fetch offers (increased rate limit to 2 minutes)
          const lastOffersFetch = lastFetchRef.current.offers || 0;
          if (now - lastOffersFetch >= 120000) { // 2 minutes
            lastFetchRef.current.offers = now;
            await fetchUnreadOffers();
          }
          
          // Fetch orders (increased rate limit to 2 minutes)
          const lastOrdersFetch = lastFetchRef.current.orders || 0;
          if (now - lastOrdersFetch >= 120000) { // 2 minutes
            lastFetchRef.current.orders = now;
            await fetchUnreadOrders();
          }
        } catch (error) {
          console.error('[OptimizedUnreadContext] Error in fetchUnreadData:', error);
        }
      };

      // Initial fetch with longer delay
      setTimeout(() => {
        if (user && isPageVisibleRef.current) {
          fetchUnreadData();
        }
      }, 3000); // Increased from 2 seconds

      // Set up interval with longer period and visibility check
      intervalRef.current = setInterval(() => {
        if (user && isPageVisibleRef.current) {
          fetchUnreadData();
        }
      }, 600000); // Check every 10 minutes instead of 5 minutes

      setIsLoading(false);
    } catch (error) {
      console.error('[OptimizedUnreadContext] Error setting up listeners:', error);
      setIsLoading(false);
      
      // Implement exponential backoff for setup errors
      reconnectAttemptsRef.current++;
      if (reconnectAttemptsRef.current <= maxReconnectAttempts) {
        const delay = getReconnectDelay();
        setTimeout(() => {
          if (user && isPageVisibleRef.current) {
            setupListeners();
          }
        }, delay);
      }
    }
  }, [user, activeSection, getReconnectDelay]);

  // Main effect that manages listeners based on authentication
  useEffect(() => {
    if (!user) {
      console.log('[OptimizedUnreadContext] User not authenticated, cleaning up all listeners');
      setUnreadCounts({ messages: 0, offers: 0, orders: 0, notifications: 0 });
      setIsLoading(false);
      
      // Clean up all listeners
      pauseListeners();
      
      // Reset reconnect attempts
      reconnectAttemptsRef.current = 0;
      
      return;
    }

    // Only setup listeners if page is visible
    if (isPageVisibleRef.current) {
      setupListeners();
    }

    return () => {
      console.log('[OptimizedUnreadContext] Cleaning up listeners on unmount');
      pauseListeners();
    };
  }, [user, setupListeners, pauseListeners]);

  // Optimized fetch functions with better error handling
  const fetchUnreadOffers = async () => {
    try {
      const { db } = getFirebaseServices();
      
      const receivedOffersQuery = query(
        collection(db, 'offers'),
        where('sellerId', '==', user!.uid),
        where('status', '==', 'pending'),
        where('cleared', '==', false)
      );
      
      const offersSnapshot = await getDocs(receivedOffersQuery);
      const unreadOfferCount = offersSnapshot.size;
      
      setUnreadCounts(prev => ({ ...prev, offers: unreadOfferCount }));
    } catch (error) {
      console.error('[OptimizedUnreadContext] Error counting unread offers:', error);
    }
  };

  const fetchUnreadOrders = async () => {
    try {
      const { db } = getFirebaseServices();
      
      const [sellerOrdersSnapshot, buyerOrdersSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'orders'), where('sellerId', '==', user!.uid))),
        getDocs(query(collection(db, 'orders'), where('buyerId', '==', user!.uid)))
      ]);
      
      const sellerOrders = sellerOrdersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Order[];
      
      const buyerOrders = buyerOrdersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Order[];
      
      let attentionCount = 0;
      
      [...sellerOrders, ...buyerOrders].forEach(order => {
        const isSale = order.sellerId === user!.uid;
        const attentionInfo = getOrderAttentionInfo(order, isSale);
        if (attentionInfo.needsAttention) {
          attentionCount++;
        }
      });
      
      setUnreadCounts(prev => ({ ...prev, orders: attentionCount }));
    } catch (error) {
      console.error('[OptimizedUnreadContext] Error counting orders needing attention:', error);
    }
  };

  // Clear unread count when user views a section
  const clearUnreadCount = useCallback((section: keyof UnreadCounts) => {
    setActiveSection(section);
    setUnreadCounts(prev => ({ ...prev, [section]: 0 }));
    
    // For messages, update the database to mark messages as read
    if (section === 'messages' && user) {
      const database = getDatabase();
      const chatsRef = ref(database, 'chats');
      
      get(chatsRef).then((snapshot) => {
        const chatsData = snapshot.val();
        if (!chatsData) return;
        
        const updates: Record<string, any> = {};
        
        for (const [chatId, chat] of Object.entries<any>(chatsData)) {
          if (!chat.participants?.[user.uid] || chat.deletedBy?.[user.uid]) {
            continue;
          }
          
          if (chat.lastMessage && 
              chat.lastMessage.receiverId === user.uid && 
              chat.lastMessage.read === false) {
            updates[`chats/${chatId}/lastMessage/read`] = true;
          }
        }
        
        if (Object.keys(updates).length > 0) {
          update(ref(database), updates).catch(err => {
            console.error('[OptimizedUnreadContext] Error updating message read status:', err);
          });
        }
      }).catch(err => {
        console.error('[OptimizedUnreadContext] Error getting chats for read status update:', err);
      });
    }
  }, [user]);

  // Reset tracking when user leaves a section
  const resetUnreadCount = useCallback((section: keyof UnreadCounts) => {
    if (activeSection === section) {
      setActiveSection(null);
    }
  }, [activeSection]);

  return (
    <UnreadContext.Provider value={{ 
      unreadCounts, 
      clearUnreadCount, 
      resetUnreadCount, 
      isLoading 
    }}>
      {children}
    </UnreadContext.Provider>
  );
};

export const useOptimizedUnread = () => {
  const context = useContext(UnreadContext);
  if (context === undefined) {
    throw new Error('useOptimizedUnread must be used within an OptimizedUnreadProvider');
  }
  return context;
};