import { useEffect, useState } from 'react';
import { getDatabase, ref, onValue, push, set } from 'firebase/database';
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
  participants: string[];
  lastMessage?: Message;
  listingId?: string;
}

export const useMessages = (chatId?: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const database = getDatabase();

  useEffect(() => {
    if (!chatId || !user) return;

    const messagesRef = ref(database, `messages/${chatId}`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const messageList = Object.entries(data).map(([id, message]: [string, any]) => ({
          id,
          ...message,
        }));
        setMessages(messageList.sort((a, b) => a.timestamp - b.timestamp));
      } else {
        setMessages([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [chatId, user]);

  const sendMessage = async (content: string, receiverId: string, listingId?: string) => {
    if (!user) return;

    const newMessage: Omit<Message, 'id'> = {
      senderId: user.uid,
      receiverId,
      content,
      timestamp: Date.now(),
      listingId,
    };

    let chatReference = chatId;
    
    if (!chatReference) {
      // Create new chat if it doesn't exist
      const chatsRef = ref(database, 'chats');
      const newChatRef = push(chatsRef);
      chatReference = newChatRef.key as string;
      
      await set(newChatRef, {
        participants: [user.uid, receiverId],
        listingId,
        createdAt: Date.now(),
      });
    }

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