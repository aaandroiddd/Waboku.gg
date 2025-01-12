import { useEffect, useState } from 'react';
import { getDatabase, ref, onValue, push, set, get, update, remove } from 'firebase/database';
import { useAuth } from '@/contexts/AuthContext';

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: number;
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
  const { user } = useAuth();
  const database = getDatabase();

  useEffect(() => {
    if (!chatId || !user) {
      console.log('No chat ID or user, skipping message subscription');
      setMessages([]);
      setLoading(false);
      return;
    }

    console.log('Setting up message subscription for chat:', chatId);
    const messagesRef = ref(database, `messages/${chatId}`);
    const chatRef = ref(database, `chats/${chatId}`);
    
    // Subscribe to both chat and messages
    const unsubscribeChat = onValue(chatRef, (chatSnapshot) => {
      const chatData = chatSnapshot.val();
      
      // If chat is deleted for current user, clear messages and stop
      if (chatData?.deletedBy?.[user.uid]) {
        setMessages([]);
        setLoading(false);
        return;
      }

      // If chat exists and is not deleted, subscribe to messages
      const unsubscribeMessages = onValue(messagesRef, (snapshot) => {
        const data = snapshot.val();
        console.log('Received messages data:', data);
        
        if (data) {
          const messageList = Object.entries(data).map(([id, message]: [string, any]) => ({
            id,
            ...message,
          }));
          const sortedMessages = messageList.sort((a, b) => a.timestamp - b.timestamp);
          console.log('Processed messages:', sortedMessages);
          setMessages(sortedMessages);
        } else {
          console.log('No messages found for chat:', chatId);
          setMessages([]);
        }
        setLoading(false);
      }, (error) => {
        console.error('Error in message subscription:', error);
        setLoading(false);
      });

      return () => {
        unsubscribeMessages();
      };
    });

    return () => {
      console.log('Cleaning up message subscription for chat:', chatId);
      unsubscribeChat();
    };
  }, [chatId, user]);

  const findExistingChat = async (userId: string, receiverId: string, listingId?: string) => {
    const chatsRef = ref(database, 'chats');
    const snapshot = await get(chatsRef);
    const chats = snapshot.val();
    
    if (!chats) return null;

    // Find chat with exact listing match only
    const existingChatId = Object.entries(chats).find(([_, chat]: [string, any]) => {
      const participants = chat.participants || {};
      const notDeleted = !chat.deletedBy?.[userId];
      return participants[userId] && 
             participants[receiverId] && 
             chat.listingId === listingId && // Strict equality check for listingId
             notDeleted;
    })?.[0];

    return existingChatId;
  };

  const markAsRead = async (messageIds: string[]) => {
    if (!chatId || !user) return;

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
      ...(listingId ? { listingId } : {})
    };

    const messageRef = push(ref(database, `messages/${chatReference}`));
    await set(messageRef, newMessage);

    // Update last message and listing info in chat
    const chatUpdates: any = {
      [`chats/${chatReference}/lastMessage`]: {
        ...newMessage,
        id: messageRef.key,
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