import { useEffect, useState } from 'react';
import { getDatabase, ref, onValue, push, set, get } from 'firebase/database';
import { useAuth } from '@/contexts/AuthContext';

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: number;
  listingId?: string;
}

export interface Chat {
  id: string;
  participants: Record<string, boolean>;
  lastMessage?: Message;
  listingId?: string;
  listingTitle?: string;
}

export const useMessages = (chatId?: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const database = getDatabase();

  useEffect(() => {
    if (!chatId || !user) {
      console.log('No chat ID or user, skipping message subscription');
      return;
    }

    console.log('Setting up message subscription for chat:', chatId);
    const messagesRef = ref(database, `messages/${chatId}`);
    
    const unsubscribe = onValue(messagesRef, (snapshot) => {
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
      console.log('Cleaning up message subscription for chat:', chatId);
      unsubscribe();
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
      return participants[userId] && 
             participants[receiverId] && 
             chat.listingId === listingId; // Strict equality check for listingId
    })?.[0];

    return existingChatId;
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
      ...(listingId ? { listingId } : {})
    };

    const messageRef = push(ref(database, `messages/${chatReference}`));
    await set(messageRef, newMessage);

    // Update last message in chat
    await set(ref(database, `chats/${chatReference}/lastMessage`), {
      ...newMessage,
      id: messageRef.key,
    });

    return chatReference;
  };

  return {
    messages,
    loading,
    sendMessage,
  };
};