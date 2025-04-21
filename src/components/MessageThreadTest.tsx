import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getDatabase, ref, push, set, get, onValue } from 'firebase/database';
import { database } from '@/lib/firebase';

export function MessageThreadTest() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [receiverId, setReceiverId] = useState('');
  const [messageText, setMessageText] = useState('');
  const [chatId, setChatId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [messages, setMessages] = useState<any[]>([]);

  // Load messages when chatId changes
  useEffect(() => {
    if (!chatId || !database) return;
    
    const messagesRef = ref(database, `messages/${chatId}`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      if (snapshot.exists()) {
        const messagesData = snapshot.val();
        const messagesList = Object.entries(messagesData).map(([id, data]: [string, any]) => ({
          id,
          ...data
        }));
        setMessages(messagesList);
      } else {
        setMessages([]);
      }
    });
    
    return () => unsubscribe();
  }, [chatId]);

  const createChat = async () => {
    if (!user || !receiverId) {
      setError('User ID and receiver ID are required');
      return;
    }

    try {
      setError('');
      setSuccess('');
      setDebugInfo({});
      
      // Check if chat already exists
      const db = getDatabase();
      const chatsRef = ref(db, 'chats');
      const chatsSnapshot = await get(chatsRef);
      
      let existingChatId = null;
      
      if (chatsSnapshot.exists()) {
        const chats = chatsSnapshot.val();
        
        // Find a chat where both users are participants
        for (const [id, chat] of Object.entries(chats)) {
          const chatData = chat as any;
          if (
            chatData.participants && 
            chatData.participants[user.uid] && 
            chatData.participants[receiverId]
          ) {
            existingChatId = id;
            break;
          }
        }
      }
      
      if (existingChatId) {
        setChatId(existingChatId);
        setSuccess(`Using existing chat: ${existingChatId}`);
        setDebugInfo({ chatId: existingChatId, action: 'using_existing' });
        return existingChatId;
      }
      
      // Create a new chat
      const newChatRef = push(ref(db, 'chats'));
      const newChatId = newChatRef.key;
      
      // Create participants object with both users
      const participants: Record<string, boolean> = {
        [user.uid]: true,
        [receiverId]: true
      };
      
      const chatData = {
        participants,
        createdAt: Date.now()
      };
      
      await set(newChatRef, chatData);
      
      setChatId(newChatId || '');
      setSuccess(`Chat created successfully: ${newChatId}`);
      setDebugInfo({ chatId: newChatId, action: 'created_new', data: chatData });
      
      return newChatId;
    } catch (error) {
      console.error('Error creating chat:', error);
      setError(`Error creating chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setDebugInfo({ error: error instanceof Error ? error.message : 'Unknown error' });
      return null;
    }
  };

  const sendMessage = async () => {
    if (!user || !receiverId || !messageText.trim()) {
      setError('User ID, receiver ID, and message text are required');
      return;
    }

    try {
      setError('');
      setSuccess('');
      
      // Ensure we have a chat ID
      const activeChatId = chatId || await createChat();
      if (!activeChatId) {
        setError('Failed to create or get chat ID');
        return;
      }
      
      // Create the message object
      const message = {
        senderId: user.uid,
        receiverId: receiverId,
        content: messageText.trim(),
        type: 'text',
        timestamp: Date.now(),
        read: false
      };
      
      // Add the message to the messages collection
      const db = getDatabase();
      const messageRef = push(ref(db, `messages/${activeChatId}`));
      await set(messageRef, message);
      
      // Update the last message in the chat
      await set(ref(db, `chats/${activeChatId}/lastMessage`), {
        ...message,
        id: messageRef.key
      });
      
      setSuccess('Message sent successfully');
      setMessageText('');
      
      toast({
        title: "Success",
        description: "Message sent successfully",
      });
    } catch (error) {
      console.error('Error sending message:', error);
      setError(`Error sending message: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      toast({
        title: "Error",
        description: `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Message Thread Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!user && (
          <div className="bg-destructive/10 text-destructive p-3 rounded">
            You must be signed in to use this tool.
          </div>
        )}
        
        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-100 text-green-800 p-3 rounded">
            {success}
          </div>
        )}
        
        <div className="space-y-2">
          <div className="font-medium">Your User ID:</div>
          <div className="bg-muted p-2 rounded text-sm font-mono break-all">
            {user?.uid || 'Not signed in'}
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="font-medium">Receiver User ID:</div>
          <Input 
            value={receiverId} 
            onChange={(e) => setReceiverId(e.target.value)} 
            placeholder="Enter receiver's user ID"
          />
        </div>
        
        {chatId && (
          <div className="space-y-2">
            <div className="font-medium">Active Chat ID:</div>
            <div className="bg-muted p-2 rounded text-sm font-mono break-all">
              {chatId}
            </div>
          </div>
        )}
        
        <div className="space-y-2">
          <Button onClick={createChat} disabled={!user || !receiverId}>
            Create/Find Chat
          </Button>
        </div>
        
        {chatId && (
          <>
            <div className="space-y-2">
              <div className="font-medium">Message:</div>
              <Input 
                value={messageText} 
                onChange={(e) => setMessageText(e.target.value)} 
                placeholder="Type your message"
              />
            </div>
            
            <div className="space-y-2">
              <Button onClick={sendMessage} disabled={!messageText.trim()}>
                Send Message
              </Button>
            </div>
            
            <div className="space-y-2">
              <div className="font-medium">Messages:</div>
              <div className="border rounded p-3 max-h-60 overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="text-muted-foreground text-center py-4">
                    No messages yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => (
                      <div 
                        key={message.id} 
                        className={`p-2 rounded ${
                          message.senderId === user?.uid 
                            ? 'bg-primary text-primary-foreground ml-auto max-w-[80%]' 
                            : 'bg-muted mr-auto max-w-[80%]'
                        }`}
                      >
                        <div className="text-sm">{message.content}</div>
                        <div className="text-xs opacity-70 mt-1">
                          {new Date(message.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        
        <div className="space-y-2">
          <div className="font-medium">Debug Info:</div>
          <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}