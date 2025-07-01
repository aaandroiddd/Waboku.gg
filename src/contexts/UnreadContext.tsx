import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { getDatabase, ref, onValue, get, update } from 'firebase/database';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { databaseOptimizer } from '@/lib/database-usage-optimizer';
import { notificationService } from '@/lib/notification-service';

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
}

const UnreadContext = createContext<UnreadContextType | undefined>(undefined);

export const UnreadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({
    messages: 0,
    offers: 0,
    orders: 0,
    notifications: 0,
  });

  // Track if a section is currently being viewed to prevent counting while user is viewing
  const [activeSection, setActiveSection] = useState<keyof UnreadCounts | null>(null);
  const listenersRef = useRef<string[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef<Record<string, number>>({});
  const notificationUnsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user) {
      setUnreadCounts({ messages: 0, offers: 0, orders: 0, notifications: 0 });
      // Clean up any existing listeners
      listenersRef.current.forEach(id => databaseOptimizer.removeListener(id));
      listenersRef.current = [];
      
      // Clean up notification listener
      if (notificationUnsubscribeRef.current) {
        notificationUnsubscribeRef.current();
        notificationUnsubscribeRef.current = null;
      }
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      console.log('[UnreadContext] User not authenticated, stopping all unread monitoring to reduce database usage');
      return;
    }

    console.log('[UnreadContext] User authenticated, starting optimized unread monitoring');

    // Clean up previous listeners
    listenersRef.current.forEach(id => databaseOptimizer.removeListener(id));
    listenersRef.current = [];
    
    // Clean up previous notification listener
    if (notificationUnsubscribeRef.current) {
      notificationUnsubscribeRef.current();
      notificationUnsubscribeRef.current = null;
    }

    // Set up real-time notification listener using the same service as NotificationBell
    console.log('[UnreadContext] Setting up real-time notification listener');
    try {
      notificationUnsubscribeRef.current = notificationService.subscribeToUnreadCount(
        user.uid,
        (count) => {
          console.log('[UnreadContext] Received notification count update:', count);
          if (activeSection !== 'notifications') {
            setUnreadCounts(prev => ({ ...prev, notifications: count }));
          }
        }
      );
    } catch (error) {
      console.error('[UnreadContext] Error setting up notification listener:', error);
    }

    // Use optimized listener for messages - check actual chat data for unread status
    // Only create this listener when user is authenticated
    const messagesListenerId = databaseOptimizer.createOptimizedListener({
      path: `users/${user.uid}/messageThreads`,
      callback: async (threadsData) => {
        try {
          if (!threadsData || activeSection === 'messages') {
            setUnreadCounts(prev => ({ ...prev, messages: 0 }));
            return;
          }

          let unreadMessageCount = 0;
          const { database } = getFirebaseServices();
          
          if (!database) {
            console.error('Database not available for unread count');
            return;
          }
          
          // Check each chat for actual unread status
          const chatIds = Object.keys(threadsData);
          
          // Limit the number of concurrent checks to reduce database load
          const maxConcurrentChecks = 5;
          const chunks = [];
          for (let i = 0; i < chatIds.length; i += maxConcurrentChecks) {
            chunks.push(chatIds.slice(i, i + maxConcurrentChecks));
          }
          
          for (const chunk of chunks) {
            const unreadPromises = chunk.map(async (chatId) => {
              try {
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
                console.error(`Error checking unread status for chat ${chatId}:`, error);
                return 0;
              }
            });
            
            const chunkResults = await Promise.all(unreadPromises);
            unreadMessageCount += chunkResults.reduce((sum, count) => sum + count, 0);
            
            // Small delay between chunks to be respectful to the database
            if (chunks.indexOf(chunk) < chunks.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
          
          setUnreadCounts(prev => ({ ...prev, messages: unreadMessageCount }));
        } catch (error) {
          console.error('Error counting unread messages:', error);
        }
      },
      options: { once: false }
    });

    if (messagesListenerId) {
      listenersRef.current.push(messagesListenerId);
    }

    // Optimized fetch functions with caching and rate limiting
    const fetchUnreadOffers = async () => {
      try {
        if (activeSection === 'offers') return;
        
        const now = Date.now();
        const lastFetch = lastFetchRef.current.offers || 0;
        
        // Increased rate limit: only fetch every 60 seconds (was 30)
        if (now - lastFetch < 60000) {
          return;
        }
        
        lastFetchRef.current.offers = now;
        
        const { db } = getFirebaseServices();
        
        // Query for received offers that are pending (unread)
        const receivedOffersQuery = query(
          collection(db, 'offers'),
          where('sellerId', '==', user.uid),
          where('status', '==', 'pending'),
          where('cleared', '==', false)
        );
        
        const offersSnapshot = await getDocs(receivedOffersQuery);
        const unreadOfferCount = offersSnapshot.size;
        
        setUnreadCounts(prev => ({ ...prev, offers: unreadOfferCount }));
      } catch (error) {
        console.error('Error counting unread offers:', error);
      }
    };

    const fetchUnreadOrders = async () => {
      try {
        if (activeSection === 'orders') return;
        
        const now = Date.now();
        const lastFetch = lastFetchRef.current.orders || 0;
        
        // Increased rate limit: only fetch every 60 seconds (was 30)
        if (now - lastFetch < 60000) {
          return;
        }
        
        lastFetchRef.current.orders = now;
        
        const { db } = getFirebaseServices();
        
        // Query for new orders (as seller)
        const newOrdersQuery = query(
          collection(db, 'orders'),
          where('sellerId', '==', user.uid),
          where('sellerRead', '==', false)
        );
        
        // Query for updated orders (as buyer)
        const updatedOrdersQuery = query(
          collection(db, 'orders'),
          where('buyerId', '==', user.uid),
          where('buyerRead', '==', false)
        );
        
        // Query for unshipped orders (as buyer) - orders that are paid or awaiting shipping
        const unshippedOrdersQuery = query(
          collection(db, 'orders'),
          where('buyerId', '==', user.uid),
          where('status', 'in', ['paid', 'awaiting_shipping'])
        );
        
        const [newOrdersSnapshot, updatedOrdersSnapshot, unshippedOrdersSnapshot] = await Promise.all([
          getDocs(newOrdersQuery),
          getDocs(updatedOrdersQuery),
          getDocs(unshippedOrdersQuery)
        ]);
        
        // Count unread orders (new/updated) plus unshipped orders
        const unreadOrderCount = newOrdersSnapshot.size + updatedOrdersSnapshot.size + unshippedOrdersSnapshot.size;
        
        setUnreadCounts(prev => ({ ...prev, orders: unreadOrderCount }));
      } catch (error) {
        console.error('Error counting unread orders:', error);
      }
    };



    // Initial fetch with longer delay to avoid overwhelming on mount
    setTimeout(() => {
      fetchUnreadOffers();
      fetchUnreadOrders();
      // Remove fetchUnreadNotifications since we now use real-time listener
    }, 2000); // Increased from 1 second to 2 seconds

    // Set up interval to periodically check for unread offers and orders only (notifications now use real-time)
    intervalRef.current = setInterval(() => {
      // Only fetch if user is still authenticated and page is visible
      if (user && document.visibilityState === 'visible') {
        fetchUnreadOffers();
        fetchUnreadOrders();
        // Remove fetchUnreadNotifications since we now use real-time listener
      }
    }, 300000); // Check every 5 minutes instead of 2 minutes

    return () => {
      // Clean up listeners
      listenersRef.current.forEach(id => databaseOptimizer.removeListener(id));
      listenersRef.current = [];
      
      // Clean up notification listener
      if (notificationUnsubscribeRef.current) {
        notificationUnsubscribeRef.current();
        notificationUnsubscribeRef.current = null;
      }
      
      // Clean up interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      console.log('[UnreadContext] Cleaned up all unread monitoring');
    };
  }, [user, activeSection]);

  // Clear unread count when user views a section
  const clearUnreadCount = (section: keyof UnreadCounts) => {
    setActiveSection(section);
    setUnreadCounts(prev => ({ ...prev, [section]: 0 }));
    
    // For messages, we need to update the database to mark messages as read
    if (section === 'messages' && user) {
      const database = getDatabase();
      const chatsRef = ref(database, 'chats');
      
      // Get all chats
      get(chatsRef).then((snapshot) => {
        const chatsData = snapshot.val();
        if (!chatsData) return;
        
        const updates: Record<string, any> = {};
        
        // Process each chat
        for (const [chatId, chat] of Object.entries<any>(chatsData)) {
          // Skip if user is not a participant or chat is deleted by user
          if (!chat.participants?.[user.uid] || chat.deletedBy?.[user.uid]) {
            continue;
          }
          
          // Check if there's a last message and it's unread
          if (chat.lastMessage && 
              chat.lastMessage.receiverId === user.uid && 
              chat.lastMessage.read === false) {
            // Mark the last message as read
            updates[`chats/${chatId}/lastMessage/read`] = true;
          }
        }
        
        // Apply all updates at once
        if (Object.keys(updates).length > 0) {
          update(ref(database), updates).catch(err => {
            console.error('Error updating message read status:', err);
          });
        }
      }).catch(err => {
        console.error('Error getting chats for read status update:', err);
      });
    }
  };

  // Reset tracking when user leaves a section
  const resetUnreadCount = (section: keyof UnreadCounts) => {
    if (activeSection === section) {
      setActiveSection(null);
    }
  };

  return (
    <UnreadContext.Provider value={{ unreadCounts, clearUnreadCount, resetUnreadCount }}>
      {children}
    </UnreadContext.Provider>
  );
};

export const useUnread = () => {
  const context = useContext(UnreadContext);
  if (context === undefined) {
    throw new Error('useUnread must be used within an UnreadProvider');
  }
  return context;
};