import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Check, CheckCheck, Image, Smile, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages } from '@/hooks/useMessages';
import { Card } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar } from './ui/avatar';
import { useToast } from './ui/use-toast';
import { MessageContent } from './MessageContent';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { useRouter } from 'next/router';
import { useProfile } from '@/hooks/useProfile';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getDatabase, ref as dbRef, remove, set } from 'firebase/database';

interface ChatProps {
  chatId?: string;
  receiverId: string;
  receiverName?: string;
  listingId?: string;
  listingTitle?: string;
  onClose?: () => void;
  className?: string;
  onDelete?: () => void;
}

export function Chat({ 
  chatId, 
  receiverId, 
  receiverName: initialReceiverName, 
  listingId,
  listingTitle,
  onClose,
  onDelete,
  className = ''
}: ChatProps) {
  const { profile: receiverProfile } = useProfile(receiverId);
  const [displayName, setDisplayName] = useState(initialReceiverName);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (receiverProfile?.username) {
      setDisplayName(receiverProfile.username);
    }
  }, [receiverProfile]);

  const { messages, sendMessage, markAsRead, deleteChat } = useMessages(chatId);
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState('');
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [displayedListingTitle, setDisplayedListingTitle] = useState(listingTitle);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listingTitle) {
      setDisplayedListingTitle(listingTitle);
    }
  }, [listingTitle]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior
      });
    }
  };

  // Handle scroll position detection
  useEffect(() => {
    if (!bottomRef.current) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        setIsAtBottom(entry.isIntersecting);
      },
      { threshold: 0.5 }
    );

    observerRef.current.observe(bottomRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  // Auto-scroll to bottom for new messages
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [messages, isAtBottom]);

  // Mark messages as read when they become visible
  useEffect(() => {
    if (chatId && messages.length > 0) {
      const unreadMessages = messages.filter(
        msg => msg.senderId !== user?.uid && !msg.read
      );
      
      if (unreadMessages.length > 0) {
        markAsRead(unreadMessages.map(msg => msg.id));
      }
    }
  }, [messages, chatId, user?.uid, markAsRead]);

  const handleImageUpload = async (file: File) => {
    if (!user) return;

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        title: "Error",
        description: "Image size should be less than 5MB",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    try {
      const storage = getStorage();
      const imageRef = storageRef(storage, `chat-images/${chatId}/${Date.now()}_${file.name}`);
      await uploadBytes(imageRef, file);
      const imageUrl = await getDownloadURL(imageRef);
      await sendMessage(`![Image](${imageUrl})`, receiverId, listingId, listingTitle);
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Error",
        description: "Failed to upload image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
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
      const chatId = await sendMessage(newMessage.trim(), receiverId, listingId, listingTitle);
      
      setNewMessage('');
      setError('');
      setIsAtBottom(true);
      scrollToBottom();
      
      toast.success("Message sent successfully", {
        action: {
          label: "View Messages",
          onClick: () => router.push('/dashboard/messages')
        }
      });

      if (!chatId) {
        setShowSuccessDialog(true);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
    }
  };

  const handleDeleteChat = async () => {
    if (!chatId || !user) return;
    
    try {
      const database = getDatabase();
      const chatRef = dbRef(database, `chats/${chatId}/deletedBy/${user.uid}`);
      await set(chatRef, true);
      
      toast.success("The conversation has been deleted from your messages.");
      if (onDelete) {
        onDelete();
      }
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast({
        title: "Error",
        description: "Failed to delete the conversation. Please try again.",
        variant: "destructive"
      });
    }
  };

  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isThisYear = date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (isThisYear) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  if (!user) return null;

  return (
    <>
      <Card className={`flex flex-col h-[400px] w-full max-w-md ${className}`}>
        {/* Chat Header */}
        <div className="flex flex-col p-4 border-b bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar>
                <MessageCircle className="w-5 h-5" />
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium">{displayName}</span>
                {listingTitle && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-4 w-1 bg-primary rounded-full"></div>
                    {listingId ? (
                      <a 
                        href={`/listings/${listingId}`}
                        className="text-sm font-medium hover:underline hover:text-primary transition-colors"
                      >
                        {listingTitle}
                      </a>
                    ) : (
                      <span className="text-sm font-medium">
                        {listingTitle}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {chatId && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              {onClose && (
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Close
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea 
          ref={scrollRef} 
          className="flex-1 p-4"
          onScroll={(e) => {
            const target = e.target as HTMLDivElement;
            const isBottom = Math.abs(target.scrollHeight - target.clientHeight - target.scrollTop) < 1;
            setIsAtBottom(isBottom);
          }}
        >
          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            {messages.length === 0 && !chatId && (
              <div className="text-center text-sm text-muted-foreground p-4">
                Start the conversation by introducing yourself and asking about the listing.
              </div>
            )}
            {messages.map((message, index) => {
              const isUserMessage = message.senderId === user.uid;
              const showDate = index === 0 || 
                new Date(message.timestamp).toDateString() !== new Date(messages[index - 1].timestamp).toDateString();

              return (
                <React.Fragment key={message.id}>
                  {showDate && (
                    <div className="flex justify-center my-2">
                      <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                        {new Date(message.timestamp).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                      </div>
                    </div>
                  )}
                  <div className={`flex ${isUserMessage ? 'justify-end' : 'justify-start'} mb-2`}>
                    <div
                      className={`max-w-[70%] rounded-lg p-2.5 ${
                        isUserMessage
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <MessageContent 
                        content={message.content}
                        className={isUserMessage ? 'text-primary-foreground' : ''}
                      />
                      <div className="flex items-center justify-end gap-1 text-xs mt-1 opacity-75">
                        <span>{formatMessageTime(message.timestamp)}</span>
                        {isUserMessage && (
                          message.read 
                            ? <CheckCheck className="w-3 h-3" />
                            : <Check className="w-3 h-3" />
                        )}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={bottomRef} style={{ height: '1px' }} />
          </div>
        </ScrollArea>

        {/* Scroll to bottom button */}
        {!isAtBottom && messages.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            className="absolute bottom-20 right-6 rounded-full opacity-90 hover:opacity-100"
            onClick={() => {
              setIsAtBottom(true);
              scrollToBottom();
            }}
          >
            ↓
          </Button>
        )}

        {/* Message Input */}
        <form onSubmit={handleSend} className="p-4 border-t bg-card">
          <div className="flex gap-2">
            <div className="flex-1 flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="text-sm"
                disabled={isUploading}
              />
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleImageUpload(file);
                  }
                  e.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Image className="h-4 w-4" />
              </Button>
              <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={isUploading}
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="end">
                  <Picker
                    data={data}
                    onEmojiSelect={(emoji: any) => {
                      setNewMessage((prev) => prev + emoji.native);
                      setShowEmojiPicker(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button 
              type="submit"
              disabled={!newMessage.trim() || isUploading}
            >
              Send
            </Button>
          </div>
        </form>
      </Card>

      {/* Success Dialog */}
      {showSuccessDialog && (
        <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Message Sent Successfully!</AlertDialogTitle>
              <AlertDialogDescription>
                Your message has been sent to {displayName}. Would you like to view your messages dashboard?
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Are you sure you want to delete this conversation? This will:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Remove the messages from your view</li>
                <li>Keep the conversation visible for {displayName}</li>
                <li>Not affect the other person&apos;s access to the messages</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChat}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}