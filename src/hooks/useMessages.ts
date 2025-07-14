import { useEffect, useState, useRef } from 'react';
import { getDatabase, ref, onValue, push, set, get, update, remove, query, limitToLast } from 'firebase/database';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebaseServices, database as firebaseDatabase } from '@/lib/firebase';
import { databaseOptimizer } from '@/lib/database-usage-optimizer';

// Helper function to check if a user is blocked
const isUserBlocked = async (database: any, currentUserId: string, otherUserId: string): Promise<boolean> => {
  try {
    const blockedUsersRef = ref(database, `users/${currentUserId}/blockedUsers/${otherUserId}`);
    const snapshot = await get(blockedUsersRef);
    return snapshot.exists();
  } catch (error) {
    console.error('Error checking blocked status:', error);
    return false;
  }
};

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
  const listenersRef = useRef<string[]>([]);
  
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
    // Create a query with limitToLast(50) to reduce data transfer
    const messagesRef = query(ref(database, `messages/${chatId}`), limitToLast(50));
    console.log('Fetching messages from:', ref(database, `messages/${chatId}`).toString(), 'with limitToLast(50)');
    
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
        setError(getUserFriendlyErrorMessage(error));
        setMessages([]);
        setLoading(false);
      });
    });

    // Then set up the real-time listener for both messages and chat deletion status
    // Use the messagesRef query that already has limitToLast(50) applied
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
      setError(getUserFriendlyErrorMessage(error));
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

  // Helper function to check if error is due to being blocked (only for chat creation/message sending)
  const isBlockedError = (error: any, context: 'chat_creation' | 'message_sending' | 'message_loading' = 'message_loading'): boolean => {
    if (!error) return false;
    
    const errorMessage = error.message || error.toString();
    const errorCode = error.code;
    
    // Only treat permission errors as blocking errors when creating chats or sending messages
    // NOT when loading existing messages
    if (context === 'message_loading') {
      return false; // Never treat message loading errors as blocking errors
    }
    
    // For chat creation and message sending, check for permission denied errors
    return (
      errorCode === 'PERMISSION_DENIED' ||
      errorMessage.includes('Permission denied') ||
      errorMessage.includes('permission-denied') ||
      errorMessage.includes('PERMISSION_DENIED')
    );
  };

  // Helper function to get user-friendly error message
  const getUserFriendlyErrorMessage = (error: any, context: 'chat_creation' | 'message_sending' | 'message_loading' = 'message_loading'): string => {
    if (isBlockedError(error, context)) {
      return 'This conversation is no longer available. The user may have blocked you or the conversation has been restricted.';
    }
    
    if (error.message?.includes('Database connection failed')) {
      return 'Unable to connect to the messaging service. Please check your internet connection and try again.';
    }
    
    if (error.message?.includes('network')) {
      return 'Network error. Please check your internet connection and try again.';
    }
    
    // For message loading errors, provide a generic message
    return 'Unable to load messages. Please try refreshing the page.';
  };

  const findExistingChat = async (userId: string, receiverId: string, listingId?: string) => {
    if (!database) {
      console.error('Database not initialized for findExistingChat');
      // throw new Error('Database connection failed'); // Avoid throwing here, let sendMessage handle it
      return null;
    }
    
    // TODO: Implement a more secure way to find existing chats,
    // e.g., by querying user-specific chat lists or using a backend endpoint.
    // For now, returning null to prevent reading all /chats.
    // This means the client will currently always try to create a new chat if chatId is not provided.
    // The backend (e.g., /api/messages/send) should handle de-duplication if necessary.
    console.warn('findExistingChat is currently disabled to prevent permission errors. It will always return null.');
    return null;
  };

  const markAsRead = async (messageIds: string[]) => {
    if (!chatId || !user || !database) return;

    const updates: Record<string, any> = {};
    messageIds.forEach(messageId => {
      updates[`messages/${chatId}/${messageId}/read`] = true;
    });

    // Reset unread count for this user in their message thread
    updates[`users/${user.uid}/messageThreads/${chatId}/unreadCount`] = 0;

    try {
      // Try to update using the root reference first (for batch efficiency)
      await update(ref(database), updates);
    } catch (error) {
      console.error('Error marking messages as read with root update:', error);
      
      // Fallback: update each message individually if batch update fails
      try {
        console.log('Falling back to individual message updates');
        for (const messageId of messageIds) {
          const messageRef = ref(database, `messages/${chatId}/${messageId}`);
          await update(messageRef, { read: true });
        }
        
        // Also update unread count separately
        const userThreadRef = ref(database, `users/${user.uid}/messageThreads/${chatId}/unreadCount`);
        await set(userThreadRef, 0);
        
        console.log('Individual updates completed successfully');
      } catch (fallbackError) {
        console.error('Error in fallback individual updates:', fallbackError);
      }
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

        try {
          await set(newChatRef, chatData);
        } catch (error) {
          if (isBlockedError(error, 'chat_creation')) {
            throw new Error('Unable to send message. The user may have blocked you or restricted messages.');
          }
          throw error;
        }
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
    try {
      await set(messageRef, newMessage);
    } catch (error) {
      if (isBlockedError(error, 'message_sending')) {
        throw new Error('Unable to send message. The user may have blocked you or restricted messages.');
      }
      throw error;
    }

    // Update last message and listing info in chat, plus user message threads
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

    // Update message threads for both participants
    const messageTime = newMessage.timestamp;
    
    // Update sender's message thread
    chatUpdates[`users/${user.uid}/messageThreads/${chatReference}`] = {
      recipientId: receiverId,
      chatId: chatReference,
      lastMessageTime: messageTime,
      unreadCount: 0, // Sender doesn't have unread messages
      ...(listingId ? { listingId } : {}),
      ...(listingTitle ? { listingTitle } : {})
    };

    // Update receiver's message thread (increment unread count)
    chatUpdates[`users/${receiverId}/messageThreads/${chatReference}`] = {
      recipientId: user.uid,
      chatId: chatReference,
      lastMessageTime: messageTime,
      unreadCount: 1, // Receiver has 1 new unread message
      ...(listingId ? { listingId } : {}),
      ...(listingTitle ? { listingTitle } : {})
    };

    try {
      // Try to update using the root reference first
      await update(ref(database), chatUpdates);
    } catch (error) {
      console.error('Error updating chat with root update:', error);
      
      // Fallback: update chat directly if root update fails
      try {
        console.log('Falling back to direct chat update');
        const chatRef = ref(database, `chats/${chatReference}`);
        
        // Extract just the chat updates (removing the path prefix)
        const directChatUpdates = {};
        Object.entries(chatUpdates).forEach(([path, value]) => {
          if (path.startsWith(`chats/${chatReference}/`)) {
            const relativePath = path.replace(`chats/${chatReference}/`, '');
            directChatUpdates[relativePath] = value;
          }
        });
        
        await update(chatRef, directChatUpdates);
        
        // Also update user message threads separately
        const userUpdates = {};
        Object.entries(chatUpdates).forEach(([path, value]) => {
          if (path.startsWith('users/')) {
            userUpdates[path] = value;
          }
        });
        
        if (Object.keys(userUpdates).length > 0) {
          await update(ref(database), userUpdates);
        }
        
        console.log('Direct chat and user thread updates completed successfully');
      } catch (fallbackError) {
        console.error('Error in fallback chat update:', fallbackError);
      }
    }

    return chatReference;
  };

  return {
    messages,
    loading,
    error,
    sendMessage,
    markAsRead,
    deleteChat,
  };
};