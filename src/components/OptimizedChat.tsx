import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { optimizedOnValue, optimizedGet } from '@/lib/database-query-optimizer';
import { ref, push, set, serverTimestamp } from 'firebase/database';
import { database } from '@/lib/firebase';

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: number;
}

interface OptimizedChatProps {
  chatId: string;
  currentUserId: string;
  currentUserName: string;
  recipientId?: string;
  recipientName?: string;
}

const OptimizedChat: React.FC<OptimizedChatProps> = ({
  chatId,
  currentUserId,
  currentUserName,
  recipientId,
  recipientName
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Number of messages to load initially
  const MESSAGE_LIMIT = 50;
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Load messages with optimized query
  useEffect(() => {
    setLoading(true);
    setError(null);
    
    const messagesPath = `/chat/threads/${chatId}/messages`;
    
    // Use optimized onValue with limit
    const unsubscribe = optimizedOnValue(
      messagesPath,
      (data) => {
        if (data) {
          // Convert object to array and sort by timestamp
          const messageArray = Object.entries(data).map(([id, message]: [string, any]) => ({
            id,
            ...message,
            timestamp: message.timestamp || 0
          }));
          
          // Sort by timestamp
          messageArray.sort((a, b) => a.timestamp - b.timestamp);
          
          setMessages(messageArray);
        } else {
          setMessages([]);
        }
        setLoading(false);
      },
      MESSAGE_LIMIT, // Limit to last 50 messages
      'timestamp' // Order by timestamp
    );
    
    // Cleanup listener on unmount
    return () => {
      unsubscribe();
    };
  }, [chatId]);
  
  // Send a new message
  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    
    try {
      const messagesPath = `/chat/threads/${chatId}/messages`;
      const newMessageRef = push(ref(database, messagesPath));
      
      await set(newMessageRef, {
        text: newMessage.trim(),
        senderId: currentUserId,
        senderName: currentUserName,
        timestamp: Date.now()
      });
      
      // Update thread metadata (last message, etc.)
      await set(ref(database, `/chat/threads/${chatId}/metadata`), {
        lastMessage: newMessage.trim(),
        lastMessageTimestamp: Date.now(),
        lastMessageSenderId: currentUserId,
        participants: {
          [currentUserId]: true,
          ...(recipientId ? { [recipientId]: true } : {})
        }
      });
      
      // Clear input after sending
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
    }
  };
  
  return (
    <Card className="w-full h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle>
          {recipientName ? `Chat with ${recipientName}` : 'Chat'}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-grow overflow-hidden p-0">
        <ScrollArea className="h-[450px] p-4">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <p>Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex justify-center items-center h-full">
              <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex ${message.senderId === currentUserId ? 'flex-row-reverse' : 'flex-row'} items-start gap-2 max-w-[80%]`}>
                    <Avatar className="h-8 w-8">
                      <div className="bg-primary text-primary-foreground rounded-full h-full w-full flex items-center justify-center text-sm">
                        {message.senderName.charAt(0).toUpperCase()}
                      </div>
                    </Avatar>
                    
                    <div
                      className={`rounded-lg p-3 ${
                        message.senderId === currentUserId
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm">{message.text}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>
      </CardContent>
      
      <CardFooter className="border-t p-4">
        {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
        
        <div className="flex w-full gap-2">
          <Input
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <Button onClick={sendMessage} disabled={!newMessage.trim()}>
            Send
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default OptimizedChat;