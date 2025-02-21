import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Check, CheckCheck, Image, Smile, Trash2 } from 'lucide-react';
import { UserNameLink } from './UserNameLink';
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

  const { messages, loading: messagesLoading, sendMessage, markAsRead, deleteChat } = useMessages(chatId);
  const [loadingState, setLoadingState] = useState<'loading' | 'error' | 'success'>('loading');
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

    // Check if the listing is archived when the component mounts
    if (listingId) {
      const checkListingStatus = async () => {
        try {
          const { db } = getFirebaseServices();
          if (!db) return;
          
          const listingDoc = await getDoc(doc(db, 'listings', listingId));
          if (listingDoc.exists()) {
            const data = listingDoc.data();
            if (data.status === 'archived' || data.archivedAt) {
              setError('This listing has been archived and is no longer available for messaging.');
              setNewMessage('');
            }
          }
        } catch (err) {
          console.error('Error checking listing status:', err);
        }
      };
      
      checkListingStatus();
    }
  }, [listingId, listingTitle]);

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

    if (!receiverId) {
      setError('Invalid recipient. Please try again.');
      return;
    }

    if (!newMessage.trim()) return;

    try {
      setError('');
      const newChatId = await sendMessage(newMessage.trim(), receiverId, listingId, listingTitle);
      
      if (!newChatId) {
        throw new Error('Failed to create or update chat');
      }
      
      setNewMessage('');
      setIsAtBottom(true);
      scrollToBottom();
      
      // Only show toast for initial messages (when there's no existing chatId)
      if (!chatId) {
        toast({
          title: "Success",
          description: "Message sent successfully",
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/dashboard/messages')}
            >
              View Messages
            </Button>
          )
        });
        setShowSuccessDialog(true);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message. Please try again.';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const handleDeleteChat = async () => {
    if (!chatId || !user) return;
    
    try {
      const database = getDatabase();
      const chatRef = dbRef(database, `chats/${chatId}/deletedBy/${user.uid}`);
      await set(chatRef, true);
      
      toast({
        title: "Success",
        description: "The conversation has been deleted from your messages."
      });
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

  // Track user profiles for messages
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});

  // Fetch user profiles for messages
  useEffect(() => {
    const fetchUserProfiles = async () => {
      const uniqueUserIds = [...new Set(messages.map(msg => msg.senderId))];
      const profiles: Record<string, any> = {};
      
      for (const userId of uniqueUserIds) {
        if (!userProfiles[userId]) {
          try {
            const userDoc = await getDoc(doc(firebaseDb, 'users', userId));
            const userData = userDoc.data();
            profiles[userId] = {
              username: userData?.displayName || userData?.username || 'Anonymous User',
              avatarUrl: userData?.avatarUrl || userData?.photoURL || null,
            };
          } catch (err) {
            console.error(`Error fetching profile for ${userId}:`, err);
            profiles[userId] = {
              username: 'Anonymous User',
              avatarUrl: null,
            };
          }
        }
      }
      
      setUserProfiles(prev => ({ ...prev, ...profiles }));
    };

    if (messages.length > 0) {
      fetchUserProfiles();
    }
  }, [messages]);

  return (
    <>
      <Card className={`flex flex-col h-full w-full ${className}`}>
        {/* Chat Header */}
        <div className="flex flex-col p-4 border-b bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar>
                {receiverProfile?.avatarUrl ? (
                  <img src={receiverProfile.avatarUrl} alt={displayName} />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    <path d="M8 10h.01"/>
                    <path d="M12 10h.01"/>
                    <path d="M16 10h.01"/>
                  </svg>
                )}
              </Avatar>
              <div className="flex flex-col">
                <UserNameLink userId={receiverId} initialUsername={displayName} />
                {messages[0]?.subject && (
                  <div className="text-sm font-medium text-primary">
                    {messages[0].subject}
                  </div>
                )}
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
                    <div className="flex flex-col gap-1">
                      {!isUserMessage && (
                        <div className="text-xs text-muted-foreground ml-2">
                          <UserNameLink 
                            userId={message.senderId} 
                            initialUsername={userProfiles[message.senderId]?.username || 'Loading...'}
                          />
                        </div>
                      )}
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