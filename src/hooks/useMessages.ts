import { useEffect, useState } from 'react';
import { getDatabase, ref, onValue, push, set, get, update, remove } from 'firebase/database';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebaseServices, database as firebaseDatabase } from '@/lib/firebase';

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: number;
  type: 'text' | 'image' | 'system';
  listingId?: string;
  read?: boolean;
}

export interface Chat {
  id: string;
  participants: Record<string, boolean>;
  lastMessage?: Message;
  listingId?: string;
  listingTitle?: string;
  deletedBy?: Record<string, boolean>;
}

export const useMessages = (chatId?: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [database, setDatabase] = useState<ReturnType<typeof getDatabase> | null>(null);
  
  // Initialize database safely with retry mechanism
  useEffect(() => {
    const initializeDatabase = async (retryCount = 0) => {
      try {
        // First try to use the imported database instance
        if (firebaseDatabase) {
          console.log('[useMessages] Using pre-initialized Firebase Realtime Database');
          setDatabase(firebaseDatabase);
          return;
        }
        
        // Fallback to getting it from services
        const { database: dbFromServices } = getFirebaseServices();
        if (dbFromServices) {
          console.log('[useMessages] Using Firebase Realtime Database from services');
          setDatabase(dbFromServices);
          return;
        }
        
        // Last resort: try to initialize directly
        try {
          console.log('[useMessages] Attempting direct database initialization');
          const directDb = getDatabase();
          if (directDb) {
            console.log('[useMessages] Direct database initialization successful');
            setDatabase(directDb);
            return;
          }
        } catch (directError) {
          console.error('[useMessages] Direct database initialization failed:', directError);
        }
        
        // If we get here, all initialization attempts failed
        console.error('[useMessages] Firebase Realtime Database not initialized properly');
        
        // Retry with exponential backoff if we haven't tried too many times
        if (retryCount < 3) {
          const delay = Math.min(1000 * Math.pow(1.5, retryCount), 5000);
          console.log(`[useMessages] Retrying database initialization in ${delay}ms (attempt ${retryCount + 1})`);
          
          setTimeout(() => {
            initializeDatabase(retryCount + 1);
          }, delay);
          return;
        }
        
        // If we've tried too many times, set error state
        setError('Database connection failed. Please try refreshing the page.');
        setLoading(false);
      } catch (err) {
        console.error('[useMessages] Error initializing database:', err);
        
        // Retry with exponential backoff if we haven't tried too many times
        if (retryCount < 3) {
          const delay = Math.min(1000 * Math.pow(1.5, retryCount), 5000);
          console.log(`[useMessages] Retrying database initialization in ${delay}ms (attempt ${retryCount + 1})`);
          
          setTimeout(() => {
            initializeDatabase(retryCount + 1);
          }, delay);
          return;
        }
        
        setError('Database connection failed. Please try refreshing the page.');
        setLoading(false);
      }
    };
    
    // Start initialization process
    initializeDatabase();
    
    // Check if we're coming back from a cache clear
    if (typeof window !== 'undefined') {
      const cacheCleared = localStorage.getItem('messages_cache_cleared');
      if (cacheCleared) {
        // Remove the flag
        localStorage.removeItem('messages_cache_cleared');
        
        // Log that we're coming back from a cache clear
        console.log('[useMessages] Detected return from cache clear, reinitializing database');
        
        // Force a fresh initialization after a short delay
        setTimeout(() => {
          initializeDatabase(0);
        }, 1000);
      }
    }
  }, []);

  const resetState = () => {
    setMessages([]);
    setLoading(false);
    setError(null);
  };

  useEffect(() => {
    if (!chatId || !user || !database) {
      console.log('No chat ID, user, or database connection, skipping messages load');
      setMessages([]);
      setLoading(false);
      if (!database) {
        setError('Database connection failed');
      }
      return;
    }

    console.log(`Loading messages for chat: ${chatId}`);
    setLoading(true);
    const messagesRef = ref(database, `messages/${chatId}`);
    console.log('Fetching messages from:', messagesRef.toString());
    
    // First, get the initial data
    get(messagesRef).then((snapshot) => {
      try {
        const data = snapshot.val();
        console.log('Raw messages data:', data ? 'Data present' : 'No data');
        
        if (data) {
          const messageList = Object.entries(data).map(([id, message]: [string, any]) => {
            console.log(`Processing message ${id}:`, {
              senderId: message.senderId,
              timestamp: new Date(message.timestamp).toISOString(),
              type: message.type
            });
            return {
              id,
              ...message,
            };
          });
          const sortedMessages = messageList.sort((a, b) => a.timestamp - b.timestamp);
          setMessages(sortedMessages);
          
          // Mark unread messages as read
          const unreadMessages = sortedMessages.filter(
            msg => msg.senderId !== user?.uid && !msg.read
          );
          
          if (unreadMessages.length > 0) {
            markAsRead(unreadMessages.map(msg => msg.id));
          }
          
          console.log(`Loaded ${sortedMessages.length} messages`);
        } else {
          console.log('No messages found for this chat');
          setMessages([]);
        }
      } catch (error) {
        console.error('Error processing initial messages:', error);
        setMessages([]);
      } finally {
        setLoading(false);
      }
    }).catch((error) => {
      console.error('Error getting initial messages:', error);
      setMessages([]);
      setLoading(false);
    });

    // Then set up the real-time listener
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data) {
          const messageList = Object.entries(data).map(([id, message]: [string, any]) => ({
            id,
            ...message,
          }));
          const sortedMessages = messageList.sort((a, b) => a.timestamp - b.timestamp);
          setMessages(sortedMessages);
        } else {
          setMessages([]);
        }
      } catch (error) {
        console.error('Error processing messages update:', error);
      }
    }, (error) => {
      console.error('Error in message subscription:', error);
    });

    return () => {
      unsubscribe();
    };
  }, [chatId, user, database]);

  const findExistingChat = async (userId: string, receiverId: string, listingId?: string) => {
    if (!database) {
      console.error('Database not initialized');
      throw new Error('Database connection failed');
    }
    
    const chatsRef = ref(database, 'chats');
    const snapshot = await get(chatsRef);
    const chats = snapshot.val();
    
    if (!chats) return null;

    // First try to find a chat with the same listing
    let existingChatId = Object.entries(chats).find(([_, chat]: [string, any]) => {
      const participants = chat.participants || {};
      const notDeleted = !chat.deletedBy?.[userId];
      return participants[userId] && 
             participants[receiverId] && 
             chat.listingId === listingId && 
             notDeleted;
    })?.[0];

    // If no chat found with the same listing, find any existing chat between these users
    if (!existingChatId) {
      existingChatId = Object.entries(chats).find(([_, chat]: [string, any]) => {
        const participants = chat.participants || {};
        const notDeleted = !chat.deletedBy?.[userId];
        return participants[userId] && 
               participants[receiverId] && 
               notDeleted;
      })?.[0];
    }

    return existingChatId;
  };

  const markAsRead = async (messageIds: string[]) => {
    if (!chatId || !user || !database) return;

    const updates: Record<string, boolean> = {};
    messageIds.forEach(messageId => {
      updates[`messages/${chatId}/${messageId}/read`] = true;
    });

    try {
      await update(ref(database), updates);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const deleteChat = async (chatId: string) => {
    if (!user) throw new Error('User not authenticated');
    if (!database) throw new Error('Database connection failed');

    const chatRef = ref(database, `chats/${chatId}`);
    const chatSnapshot = await get(chatRef);
    const chatData = chatSnapshot.val();

    if (!chatData) throw new Error('Chat not found');

    // Mark chat as deleted for the current user
    const updates: Record<string, any> = {
      [`chats/${chatId}/deletedBy/${user.uid}`]: true
    };

    // If all participants have deleted the chat, remove it completely
    const allParticipantsDeleted = Object.keys(chatData.participants).every(
      participantId => 
        (chatData.deletedBy?.[participantId] && participantId !== user.uid) || 
        participantId === user.uid
    );

    if (allParticipantsDeleted) {
      // Remove the entire chat and its messages
      await remove(ref(database, `chats/${chatId}`));
      await remove(ref(database, `messages/${chatId}`));
    } else {
      // Just mark as deleted for current user
      await update(ref(database), updates);
    }
  };

  const sendMessage = async (content: string, receiverId: string, listingId?: string, listingTitle?: string) => {
    if (!user) throw new Error('User not authenticated');
    if (!database) throw new Error('Database connection failed');

    let chatReference = chatId;
    
    if (!chatReference) {
      // Try to find existing chat first for this specific listing
      chatReference = await findExistingChat(user.uid, receiverId, listingId);

      if (!chatReference) {
        // Create new chat if it doesn't exist
        const chatsRef = ref(database, 'chats');
        const newChatRef = push(chatsRef);
        chatReference = newChatRef.key as string;
        
        // Create participants object with both users
        const participants: Record<string, boolean> = {
          [user.uid]: true,
          [receiverId]: true
        };

        const chatData: any = {
          participants,
          createdAt: Date.now(),
        };

        if (listingId) {
          chatData.listingId = listingId;
        }
        
        if (listingTitle) {
          chatData.listingTitle = listingTitle;
        }

        await set(newChatRef, chatData);
      }
    }

    const newMessage: Omit<Message, 'id'> = {
      senderId: user.uid,
      receiverId,
      content,
      timestamp: Date.now(),
      read: false,
      type: content.startsWith('![Image]') ? 'image' : 'text',
      ...(listingId ? { listingId } : {})
    };

    const messageRef = push(ref(database, `messages/${chatReference}`));
    await set(messageRef, newMessage);

    // Update last message and listing info in chat
    const chatUpdates: any = {
      [`chats/${chatReference}/lastMessage`]: {
        ...newMessage,
        id: messageRef.key,
        type: content.startsWith('![Image]') ? 'image' : 'text'
      }
    };

    // Update listing info if provided
    if (listingId && listingTitle) {
      chatUpdates[`chats/${chatReference}/listingId`] = listingId;
      chatUpdates[`chats/${chatReference}/listingTitle`] = listingTitle;
    }

    await update(ref(database), chatUpdates);

    return chatReference;
  };

  return {
    messages,
    loading,
    sendMessage,
    markAsRead,
    deleteChat,
  };
};