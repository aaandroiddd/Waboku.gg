import { useEffect, useState } from 'react';
import { getDatabase, ref, onValue, get } from 'firebase/database';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebaseServices } from '@/lib/firebase';

export interface MessageThread {
  chatId: string;
  recipientId: string;
  lastMessageTime: number;
  unreadCount: number;
  subject?: string;
  listingId?: string;
  listingTitle?: string;
  lastMessage?: {
    content: string;
    senderId: string;
    timestamp: number;
    type: 'text' | 'image' | 'system';
  };
  recipientName?: string;
  recipientAvatar?: string;
}

export const useMessageThreads = () => {
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Helper function to check if a user is blocked
  const isUserBlocked = async (otherUserId: string, database: any): Promise<boolean> => {
    if (!database || !user) return false;
    
    try {
      const blockedUsersRef = ref(database, `users/${user.uid}/blockedUsers/${otherUserId}`);
      const snapshot = await get(blockedUsersRef);
      return snapshot.exists();
    } catch (error) {
      console.error('Error checking blocked status:', error);
      return false;
    }
  };

  // Filter out blocked users from threads
  const filterBlockedUsers = async (threads: MessageThread[], database: any): Promise<MessageThread[]> => {
    if (!user || threads.length === 0) return threads;

    const filteredThreads: MessageThread[] = [];
    
    for (const thread of threads) {
      const isBlocked = await isUserBlocked(thread.recipientId, database);
      if (!isBlocked) {
        filteredThreads.push(thread);
      }
    }

    return filteredThreads;
  };

  useEffect(() => {
    if (!user) {
      setThreads([]);
      setLoading(false);
      return;
    }

    // Get database instance
    let database: any = null;
    try {
      const services = getFirebaseServices();
      database = services.database;
      
      if (!database) {
        console.error('[useMessageThreads] No database instance available');
        setError('Database connection failed');
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error('[useMessageThreads] Error getting database services:', err);
      setError('Database connection failed');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null); // Clear any previous errors
    
    const threadsRef = ref(database, `users/${user.uid}/messageThreads`);

    const unsubscribe = onValue(threadsRef, async (snapshot) => {
      try {
        const data = snapshot.val();
        
        if (data) {
          const threadList: MessageThread[] = Object.entries(data).map(([chatId, threadData]: [string, any]) => ({
            chatId,
            recipientId: threadData.recipientId,
            lastMessageTime: threadData.lastMessageTime,
            unreadCount: threadData.unreadCount || 0,
            subject: threadData.subject,
            listingId: threadData.listingId,
            listingTitle: threadData.listingTitle,
          }));

          // Sort by last message time (most recent first)
          const sortedThreads = threadList.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
          
          // Filter out blocked users
          const filteredThreads = await filterBlockedUsers(sortedThreads, database);
          
          // Fetch additional data for each thread (last message, recipient info)
          const enrichedThreads = await Promise.all(
            filteredThreads.map(async (thread) => {
              try {
                // Get last message from chat
                const chatRef = ref(database, `chats/${thread.chatId}`);
                const chatSnapshot = await get(chatRef);
                const chatData = chatSnapshot.val();

                if (chatData?.lastMessage) {
                  thread.lastMessage = {
                    content: chatData.lastMessage.content,
                    senderId: chatData.lastMessage.senderId,
                    timestamp: chatData.lastMessage.timestamp,
                    type: chatData.lastMessage.type || 'text'
                  };
                }

                // Get recipient info from participant names in chat
                if (chatData?.participantNames?.[thread.recipientId]) {
                  thread.recipientName = chatData.participantNames[thread.recipientId];
                }

                return thread;
              } catch (error) {
                console.error(`Error enriching thread ${thread.chatId}:`, error);
                return thread;
              }
            })
          );

          setThreads(enrichedThreads);
        } else {
          setThreads([]);
        }
      } catch (error) {
        console.error('Error processing message threads:', error);
        setError('Failed to load message threads');
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error('Error in message threads subscription:', error);
      setError('Failed to load message threads');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return {
    threads,
    loading,
    error,
  };
};