import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDatabase, ref, get, onValue } from 'firebase/database';
import { getFirebaseServices } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function MessageSystemDebugger() {
  const { user } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [realTimeData, setRealTimeData] = useState<any>(null);

  const checkMessageSystem = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { database } = getFirebaseServices();
      if (!database) {
        setDebugInfo({ error: 'Database connection failed' });
        return;
      }

      // Check user's message threads
      const userThreadsRef = ref(database, `users/${user.uid}/messageThreads`);
      const threadsSnapshot = await get(userThreadsRef);
      const threadsData = threadsSnapshot.val();

      // Check all chats where user is a participant
      const chatsRef = ref(database, 'chats');
      const chatsSnapshot = await get(chatsRef);
      const allChats = chatsSnapshot.val() || {};
      
      const userChats = Object.entries(allChats).filter(([chatId, chatData]: [string, any]) => {
        return chatData.participants?.[user.uid] && !chatData.deletedBy?.[user.uid];
      });

      // Check messages for each chat
      const chatMessages = {};
      for (const [chatId] of userChats) {
        const messagesRef = ref(database, `messages/${chatId}`);
        const messagesSnapshot = await get(messagesRef);
        const messages = messagesSnapshot.val();
        chatMessages[chatId] = messages ? Object.keys(messages).length : 0;
      }

      setDebugInfo({
        userId: user.uid,
        userThreads: threadsData,
        userThreadsCount: threadsData ? Object.keys(threadsData).length : 0,
        allUserChats: userChats.map(([id, data]) => ({ id, ...data })),
        allUserChatsCount: userChats.length,
        chatMessages,
        mismatch: (threadsData ? Object.keys(threadsData).length : 0) !== userChats.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      setDebugInfo({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Set up real-time listener for user's message threads
  useEffect(() => {
    if (!user) return;

    const { database } = getFirebaseServices();
    if (!database) return;

    const userThreadsRef = ref(database, `users/${user.uid}/messageThreads`);
    
    const unsubscribe = onValue(userThreadsRef, (snapshot) => {
      const data = snapshot.val();
      setRealTimeData({
        messageThreads: data,
        count: data ? Object.keys(data).length : 0,
        timestamp: new Date().toISOString()
      });
    });

    return () => unsubscribe();
  }, [user]);

  const fixUserThreads = async () => {
    if (!user || !debugInfo?.allUserChats) return;
    
    setLoading(true);
    try {
      const { database } = getFirebaseServices();
      if (!database) return;

      // Create message threads for all chats where user is a participant
      const updates: Record<string, any> = {};
      
      for (const chat of debugInfo.allUserChats) {
        const otherParticipantId = Object.keys(chat.participants).find(id => id !== user.uid);
        if (otherParticipantId) {
          updates[`users/${user.uid}/messageThreads/${chat.id}`] = {
            recipientId: otherParticipantId,
            chatId: chat.id,
            lastMessageTime: chat.lastMessage?.timestamp || chat.createdAt || Date.now(),
            unreadCount: 0, // Start with 0 for existing chats
            ...(chat.subject ? { subject: chat.subject } : {}),
            ...(chat.listingId ? { listingId: chat.listingId, listingTitle: chat.listingTitle } : {})
          };
        }
      }

      if (Object.keys(updates).length > 0) {
        const { update } = await import('firebase/database');
        await update(ref(database), updates);
        
        // Refresh debug info
        await checkMessageSystem();
      }
    } catch (error) {
      console.error('Error fixing user threads:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      checkMessageSystem();
    }
  }, [user]);

  if (!user) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Message System Debug Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={checkMessageSystem} disabled={loading} variant="outline">
            Refresh Debug Info
          </Button>
          {debugInfo?.mismatch && (
            <Button onClick={fixUserThreads} disabled={loading}>
              Fix Message Threads
            </Button>
          )}
        </div>
        
        {realTimeData && (
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <h4 className="font-medium mb-2 text-green-800">Real-time Message Threads:</h4>
            <pre className="text-sm overflow-auto max-h-32 text-green-700">
              {JSON.stringify(realTimeData, null, 2)}
            </pre>
          </div>
        )}
        
        {debugInfo && (
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-medium mb-2">Debug Information:</h4>
            <pre className="text-sm overflow-auto max-h-96">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}