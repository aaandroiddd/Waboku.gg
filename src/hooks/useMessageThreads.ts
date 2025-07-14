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
  isBlocked?: boolean;
}

export const useMessageThreads = () => {
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Cache for blocked status to avoid repeated checks
  const [blockedStatusCache, setBlockedStatusCache] = useState<Record<string, { isBlocked: boolean; timestamp: number }>>({});
  const CACHE_DURATION = 30000; // 30 seconds

  // Helper function to check if a user is blocked with caching
  const isUserBlocked = async (otherUserId: string, database: any): Promise<boolean> => {
    if (!database || !user) return false;
    
    // Check cache first
    const cached = blockedStatusCache[otherUserId];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.isBlocked;
    }
    
    try {
      const blockedUsersRef = ref(database, `users/${user.uid}/blockedUsers/${otherUserId}`);
      const snapshot = await get(blockedUsersRef);
      const isBlocked = snapshot.exists();
      
      // Update cache
      setBlockedStatusCache(prev => ({
        ...prev,
        [otherUserId]: { isBlocked, timestamp: Date.now() }
      }));
      
      return isBlocked;
    } catch (error) {
      console.error('Error checking blocked status:', error);
      return false;
    }
  };

  // Mark blocked users in threads instead of filtering them out
  const markBlockedUsers = async (threads: MessageThread[], database: any): Promise<MessageThread[]> => {
    if (!user || threads.length === 0) return threads;

    const markedThreads: MessageThread[] = [];
    
    for (const thread of threads) {
      const isBlocked = await isUserBlocked(thread.recipientId, database);
      markedThreads.push({
        ...thread,
        isBlocked
      });
    }

    return markedThreads;
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
    
    // Listen for unblock actions to clear cache
    const unblockRef = ref(database, `users/${user.uid}/lastUnblockAction`);
    const unblockUnsubscribe = onValue(unblockRef, (snapshot) => {
      if (snapshot.exists()) {
        // Clear the blocked status cache when an unblock action occurs
        console.log('Unblock action detected, clearing blocked status cache');
        setBlockedStatusCache({});
      }
    });

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
          
          // Mark blocked users instead of filtering them out
          const markedThreads = await markBlockedUsers(sortedThreads, database);
          
          // Fetch additional data for each thread (last message, recipient info)
          const enrichedThreads = await Promise.all(
            markedThreads.map(async (thread) => {
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

    return () => {
      unsubscribe();
      unblockUnsubscribe();
    };
  }, [user]);

  return {
    threads,
    loading,
    error,
  };
};