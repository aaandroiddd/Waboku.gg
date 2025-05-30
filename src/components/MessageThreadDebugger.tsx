import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDatabase, ref, get } from 'firebase/database';
import { getFirebaseServices } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function MessageThreadDebugger() {
  const { user } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkUserThreads = async () => {
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

      setDebugInfo({
        userId: user.uid,
        userThreads: threadsData,
        userThreadsCount: threadsData ? Object.keys(threadsData).length : 0,
        allUserChats: userChats.map(([id, data]) => ({ id, ...data })),
        allUserChatsCount: userChats.length,
        mismatch: (threadsData ? Object.keys(threadsData).length : 0) !== userChats.length
      });
    } catch (error) {
      setDebugInfo({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

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
            lastMessageTime: chat.lastMessageTime || chat.createdAt || Date.now(),
            unreadCount: chat.unreadCount?.[user.uid] || 0,
            ...(chat.subject ? { subject: chat.subject } : {}),
            ...(chat.listingId ? { listingId: chat.listingId, listingTitle: chat.listingTitle } : {})
          };
        }
      }

      if (Object.keys(updates).length > 0) {
        const { update } = await import('firebase/database');
        await update(ref(database), updates);
        
        // Refresh debug info
        await checkUserThreads();
      }
    } catch (error) {
      console.error('Error fixing user threads:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      checkUserThreads();
    }
  }, [user]);

  if (!user) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Message Threads Debug Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={checkUserThreads} disabled={loading} variant="outline">
            Refresh Debug Info
          </Button>
          {debugInfo?.mismatch && (
            <Button onClick={fixUserThreads} disabled={loading}>
              Fix Message Threads
            </Button>
          )}
        </div>
        
        {debugInfo && (
          <div className="bg-muted p-4 rounded-lg">
            <pre className="text-sm overflow-auto max-h-96">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}