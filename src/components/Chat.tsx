import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages } from '@/hooks/useMessages';
import { Card } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar } from './ui/avatar';
import { useToast } from './ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { useRouter } from 'next/router';

interface ChatProps {
  chatId?: string;
  receiverId: string;
  receiverName: string;
  listingId?: string;
  onClose?: () => void;
  className?: string;
}

export function Chat({ 
  chatId, 
  receiverId, 
  receiverName, 
  listingId, 
  onClose,
  className = ''
}: ChatProps) {
  const { messages, sendMessage } = useMessages(chatId);
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState('');
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      // Future typing indicator implementation
    }, 2000);
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    if (!user) {
      setError('Please sign in to send messages');
      return;
    }

    if (!newMessage.trim()) return;

    try {
      const chatId = await sendMessage(newMessage.trim(), receiverId, listingId);
      
      setNewMessage('');
      setError('');
      
      toast({
        title: "Message sent",
        description: "Your message has been sent successfully.",
      });

      // If this is a new chat (no chatId prop), show the success dialog
      if (!chatId) {
        setShowSuccessDialog(true);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
    }
  };

  if (!user) return null;

  return (
    <>
      <Card className={`flex flex-col h-[500px] w-full max-w-md ${className}`}>
        {/* Chat Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Avatar>
              <MessageCircle className="w-5 h-5" />
            </Avatar>
            <span className="font-medium">{receiverName}</span>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>

        {/* Messages Area */}
        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.senderId === user.uid ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    message.senderId === user.uid
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <div>{message.content}</div>
                  <div className="text-xs mt-1 opacity-75">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Message Input */}
        <form onSubmit={handleSend} className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
              placeholder="Type your message..."
            />
            <Button 
              type="submit"
              disabled={!newMessage.trim()}
            >
              Send
            </Button>
          </div>
        </form>
      </Card>

      {showSuccessDialog && (
        <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Message Sent Successfully!</AlertDialogTitle>
              <AlertDialogDescription>
                Your message has been sent to {receiverName}. Would you like to view your messages dashboard?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex gap-2">
              <AlertDialogAction onClick={() => {
                setShowSuccessDialog(false);
                if (onClose) onClose();
              }}>
                Stay Here
              </AlertDialogAction>
              <AlertDialogAction onClick={() => {
                router.push('/dashboard/messages');
              }}>
                Go to Messages
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}