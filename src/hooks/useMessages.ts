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
  
  // Initialize database safely
  useEffect(() => {
    // Try to use the imported database instance first
    if (firebaseDatabase) {
      setDatabase(firebaseDatabase);
      return;
    }
    
    // Fallback to getting it from services
    try {
      const { database: dbFromServices } = getFirebaseServices();
      if (dbFromServices) {
        setDatabase(dbFromServices);
        return;
      }
      
      // Last resort: try to initialize directly
      const directDb = getDatabase();
      if (directDb) {
        setDatabase(directDb);
        return;
      }
    } catch (err) {
      console.error('[useMessages] Error initializing database:', err);
      setError('Database connection failed. Please try refreshing the page.');
      setLoading(false);
    }
  }, []);
  
  // Set up a listener to restore deleted threads when new messages are received
  useEffect(() => {
    if (!user || !database) return;
    
    // Listen for changes to all chats
    const chatsRef = ref(database, 'chats');
    
    const unsubscribe = onValue(chatsRef, async (snapshot) => {
      try {
        const chatsData = snapshot.val();
        if (!chatsData) return;
        
        // Check each chat to see if it's deleted but has new messages
        Object.entries(chatsData).forEach(async ([chatId, chatData]: [string, any]) => {
          // Skip if not a participant or no lastMessage
          if (!chatData.participants?.[user.uid] || !chatData.lastMessage) return;
          
          // Check if chat is deleted by current user
          const deletedTimestamp = chatData.deletedBy?.[user.uid];
          const isDeletedByUser = !!deletedTimestamp;
          
          if (isDeletedByUser) {
            // Check if the last message is from another user
            const lastMessageIsFromOtherUser = chatData.lastMessage.senderId !== user.uid;
            
            // Check if the last message is newer than when the user deleted the thread
            // If deletedTimestamp is just a boolean (true) from older versions, assume any new message should restore
            const lastMessageTimestamp = chatData.lastMessage.timestamp;
            const isMessageNewerThanDeletion = typeof deletedTimestamp === 'number' 
              ? lastMessageTimestamp > deletedTimestamp 
              : true; // If we don't have a timestamp, assume any message should restore the thread
            
            if (lastMessageIsFromOtherUser && isMessageNewerThanDeletion) {
              console.log(`New message detected in deleted thread ${chatId}. Restoring thread.`);
              console.log(`Message timestamp: ${new Date(lastMessageTimestamp).toISOString()}, Deletion timestamp: ${typeof deletedTimestamp === 'number' ? new Date(deletedTimestamp).toISOString() : 'unknown'}`);
              
              // Remove the deletedBy flag for the current user to restore the thread
              const deletedByRef = ref(database, `chats/${chatId}/deletedBy/${user.uid}`);
              await set(deletedByRef, null);
              
              console.log(`Thread ${chatId} has been restored due to new message.`);
            }
          }
        });
      } catch (error) {
        console.error('Error in thread restoration listener:', error);
      }
    });
    
    return () => unsubscribe();
  }, [user, database]);

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
    
    // First, check if the chat is deleted for the current user
    const checkChatDeletion = async () => {
      try {
        const chatRef = ref(database, `chats/${chatId}`);
        const chatSnapshot = await get(chatRef);
        const chatData = chatSnapshot.val();
        
        // If chat is deleted for the current user, don't load messages
        if (chatData?.deletedBy?.[user.uid]) {
          console.log(`Chat ${chatId} is deleted for current user, not loading messages`);
          setMessages([]);
          setLoading(false);
          return true;
        }
        return false;
      } catch (error) {
        console.error('Error checking chat deletion status:', error);
        return false;
      }
    };
    
    checkChatDeletion().then(isDeleted => {
      if (isDeleted) return;
      
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
    });

    // Then set up the real-time listener for both messages and chat deletion status
    const messagesUnsubscribe = onValue(messagesRef, (snapshot) => {
      try {
        // First check if the chat is deleted
        const chatRef = ref(database, `chats/${chatId}`);
        get(chatRef).then(chatSnapshot => {
          const chatData = chatSnapshot.val();
          
          // If chat is deleted for the current user, don't show messages
          if (chatData?.deletedBy?.[user.uid]) {
            console.log(`Chat ${chatId} is deleted for current user, clearing messages`);
            setMessages([]);
            return;
          }
          
          // Otherwise, process messages normally
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
        }).catch(error => {
          console.error('Error checking chat deletion status in listener:', error);
        });
      } catch (error) {
        console.error('Error processing messages update:', error);
      }
    }, (error) => {
      console.error('Error in message subscription:', error);
    });
    
    // Also listen for changes to the chat's deletion status
    const chatRef = ref(database, `chats/${chatId}`);
    const chatUnsubscribe = onValue(chatRef, (snapshot) => {
      try {
        const chatData = snapshot.val();
        
        // If chat is deleted for the current user, clear messages
        if (chatData?.deletedBy?.[user.uid]) {
          console.log(`Chat ${chatId} deletion status changed, clearing messages`);
          setMessages([]);
        }
      } catch (error) {
        console.error('Error processing chat update:', error);
      }
    });

    return () => {
      messagesUnsubscribe();
      chatUnsubscribe();
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

    // Only find a chat with the exact same listing ID
    // This ensures each listing gets its own thread
    let existingChatId = Object.entries(chats).find(([_, chat]: [string, any]) => {
      const participants = chat.participants || {};
      const notDeleted = !chat.deletedBy?.[userId];
      
      // If listingId is provided, we must match it exactly
      if (listingId) {
        return participants[userId] && 
               participants[receiverId] && 
               chat.listingId === listingId && 
               notDeleted;
      }
      
      // If no listingId is provided (general message), find a thread without a listingId
      return participants[userId] && 
             participants[receiverId] && 
             !chat.listingId && 
             notDeleted;
    })?.[0];

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

    // Mark chat as deleted for the current user with a timestamp
    // This timestamp helps determine if new messages arrived after deletion
    const deletionTimestamp = Date.now();
    const updates: Record<string, any> = {
      [`chats/${chatId}/deletedBy/${user.uid}`]: deletionTimestamp
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