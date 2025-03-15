import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getDatabase, ref, onValue, get, update } from 'firebase/database';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface UnreadCounts {
  messages: number;
  offers: number;
  orders: number;
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
  });

  // Track if a section is currently being viewed to prevent counting while user is viewing
  const [activeSection, setActiveSection] = useState<keyof UnreadCounts | null>(null);

  useEffect(() => {
    if (!user) {
      setUnreadCounts({ messages: 0, offers: 0, orders: 0 });
      return;
    }

    // Listen for unread messages
    const database = getDatabase();
    const chatsRef = ref(database, 'chats');
    
    const unsubscribeMessages = onValue(chatsRef, async (snapshot) => {
      try {
        const chatsData = snapshot.val();
        if (!chatsData) {
          setUnreadCounts(prev => ({ ...prev, messages: 0 }));
          return;
        }

        let unreadMessageCount = 0;
        
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
            unreadMessageCount++;
          }
        }
        
        // Only update if the messages section is not currently active
        if (activeSection !== 'messages') {
          setUnreadCounts(prev => ({ ...prev, messages: unreadMessageCount }));
        }
      } catch (error) {
        console.error('Error counting unread messages:', error);
      }
    });

    // Listen for unread offers
    const fetchUnreadOffers = async () => {
      try {
        if (activeSection === 'offers') return;
        
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

    // Listen for unread orders - with debounce to prevent excessive queries
    let ordersDebounceTimer: NodeJS.Timeout | null = null;
    
    const fetchUnreadOrders = async () => {
      try {
        // Don't fetch if user is currently viewing orders section
        if (activeSection === 'orders') return;
        
        // Clear any existing timer
        if (ordersDebounceTimer) {
          clearTimeout(ordersDebounceTimer);
        }
        
        // Set a new timer to delay the actual fetch
        ordersDebounceTimer = setTimeout(async () => {
          console.log('[UnreadContext] Fetching unread orders count');
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
          
          const [newOrdersSnapshot, updatedOrdersSnapshot] = await Promise.all([
            getDocs(newOrdersQuery),
            getDocs(updatedOrdersQuery)
          ]);
          
          const unreadOrderCount = newOrdersSnapshot.size + updatedOrdersSnapshot.size;
          console.log(`[UnreadContext] Found ${unreadOrderCount} unread orders`);
          
          setUnreadCounts(prev => ({ ...prev, orders: unreadOrderCount }));
        }, 2000); // 2 second debounce
      } catch (error) {
        console.error('Error counting unread orders:', error);
      }
    };

    // Initial fetch
    fetchUnreadOffers();
    fetchUnreadOrders();

    // Set up interval to periodically check for unread offers and orders
    const intervalId = setInterval(() => {
      fetchUnreadOffers();
      fetchUnreadOrders();
    }, 60000); // Check every minute

    return () => {
      unsubscribeMessages();
      clearInterval(intervalId);
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