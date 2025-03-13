import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Check, CheckCheck, Image, Smile, Trash2, Ban } from 'lucide-react';
import { BlockUserDialog } from './BlockUserDialog';
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
import { getDoc, doc } from 'firebase/firestore';
import { firebaseDb, getFirebaseServices } from '@/lib/firebase';

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
  const [showBlockDialog, setShowBlockDialog] = useState(false);

  const handleBlockUser = async () => {
    if (!user || !receiverId) return;
    
    try {
      const response = await fetch('/api/users/block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({
          blockedUserId: receiverId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to block user');
      }

      toast({
        title: "User blocked",
        description: `You have blocked ${displayName}. They can no longer send you messages.`
      });

      if (onClose) {
        onClose();
      } else if (router) {
        router.push('/dashboard/messages');
      }
    } catch (error) {
      console.error('Error blocking user:', error);
      toast({
        title: "Error",
        description: "Failed to block user. Please try again.",
        variant: "destructive"
      });
    }
  };
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
      // Try to find the viewport element
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        // Scroll the viewport element
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior
        });
      } else {
        // Fallback to scrolling the ScrollArea component itself
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior
        });
      }
      
      // Set a flag to indicate we're at the bottom
      setIsAtBottom(true);
    }
  };

  // Handle scroll position detection with improved sensitivity
  useEffect(() => {
    if (!bottomRef.current || !scrollRef.current) return;

    // More sensitive intersection observer
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        setIsAtBottom(entry.isIntersecting);
      },
      { threshold: 0.01, rootMargin: "150px" } // Increased sensitivity and margin
    );

    observerRef.current.observe(bottomRef.current);

    // Additional scroll event listener for more reliable detection
    const handleScroll = () => {
      if (scrollRef.current) {
        const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
          const isBottom = Math.abs(viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop) < 20; // More forgiving threshold
          setIsAtBottom(isBottom);
        }
      }
    };

    const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (scrollElement) {
        scrollElement.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  // Auto-scroll to bottom for new messages with improved reliability
  useEffect(() => {
    if (messages.length > 0) {
      // Always scroll to bottom when a new message is added
      const lastMessage = messages[messages.length - 1];
      const isNewMessage = lastMessage && Date.now() - lastMessage.timestamp < 5000; // Message is less than 5 seconds old
      
      if (isNewMessage || isAtBottom) {
        // Use multiple timeouts to ensure scrolling works across different devices/browsers
        const timer1 = setTimeout(() => scrollToBottom('auto'), 50);
        const timer2 = setTimeout(() => scrollToBottom('auto'), 150);
        const timer3 = setTimeout(() => scrollToBottom('auto'), 300);
        
        return () => {
          clearTimeout(timer1);
          clearTimeout(timer2);
          clearTimeout(timer3);
        };
      }
    }
  }, [messages, isAtBottom]);
  
  // Always scroll to bottom on initial load and when chat changes
  useEffect(() => {
    if (messages.length > 0) {
      // Use a timeout to ensure the DOM has updated
      const timer = setTimeout(() => {
        scrollToBottom('auto');
        setIsAtBottom(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messagesLoading]);
  
  // Force scroll to bottom when chat is selected/loaded
  useEffect(() => {
    if (chatId && messages.length > 0) {
      // Use multiple timeouts with increasing delays to ensure scrolling works
      const timer1 = setTimeout(() => {
        scrollToBottom('auto');
        setIsAtBottom(true);
      }, 100);
      
      const timer2 = setTimeout(() => {
        scrollToBottom('auto');
        setIsAtBottom(true);
      }, 300);
      
      const timer3 = setTimeout(() => {
        scrollToBottom('auto');
        setIsAtBottom(true);
      }, 500);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [chatId, messages.length]);

  // Mark messages as read when they become visible
  useEffect(() => {
    if (chatId && messages.length > 0) {
      const unreadMessages = messages.filter(
        msg => msg.senderId !== user?.uid && !msg.read
      );
      
      if (unreadMessages.length > 0) {
        markAsRead(unreadMessages.map(msg => msg.id));
        
        // Update the chat's lastMessage.read status in the database
        if (unreadMessages.some(msg => msg.id === messages[messages.length - 1].id)) {
          const database = getDatabase();
          const lastMessageReadRef = ref(database, `chats/${chatId}/lastMessage/read`);
          set(lastMessageReadRef, true).catch(err => {
            console.error('Error updating lastMessage read status:', err);
          });
        }
      }
    }
  }, [messages, chatId, user?.uid, markAsRead]);

  const handleImageUpload = async (file: File) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be signed in to upload images",
        variant: "destructive"
      });
      return;
    }

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
      // Get a reference to the storage service
      const storage = getStorage();
      console.log("Storage initialized:", !!storage);
      
      // Create a unique filename
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      // Create a storage reference
      const chatFolder = chatId || 'new-chat';
      const imagePath = `chat-images/${chatFolder}/${fileName}`;
      console.log("Uploading to path:", imagePath);
      
      const imageRef = storageRef(storage, imagePath);
      
      // Upload the file
      console.log("Starting upload...");
      const snapshot = await uploadBytes(imageRef, file);
      console.log("Upload complete:", snapshot.metadata.name);
      
      // Get the download URL
      const imageUrl = await getDownloadURL(imageRef);
      console.log("Download URL obtained");
      
      // Send the message with the image URL
      await sendMessage(`![Image](${imageUrl})`, receiverId, listingId, listingTitle);
      
      toast({
        title: "Success",
        description: "Image uploaded successfully",
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      
      // Provide more detailed error information
      let errorMessage = "Failed to upload image. Please try again.";
      
      if (error instanceof Error) {
        // Check for specific Firebase Storage errors
        if (error.message.includes("storage/unauthorized")) {
          errorMessage = "You don't have permission to upload images. Please check your account status.";
        } else if (error.message.includes("storage/quota-exceeded")) {
          errorMessage = "Storage quota exceeded. Please try again later.";
        } else if (error.message.includes("storage/canceled")) {
          errorMessage = "Upload was canceled. Please try again.";
        } else if (error.message.includes("storage/invalid-format")) {
          errorMessage = "Invalid file format. Please upload a valid image file.";
        } else if (error.message.includes("network")) {
          errorMessage = "Network error. Please check your internet connection and try again.";
        }
        
        console.error("Detailed error:", error.message);
      }
      
      toast({
        title: "Error",
        description: errorMessage,
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

  // Track user profiles for messages using the centralized useUserData hook
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});
  
  // Fetch user profiles for messages using the centralized hook
  useEffect(() => {
    if (messages.length === 0) return;
    
    const uniqueUserIds = [...new Set(messages.map(msg => msg.senderId))];
    
    // Create a map to store all the profile promises
    const profilePromises: Record<string, Promise<any>> = {};
    
    // For each unique user ID, create a promise that resolves with the user data
    uniqueUserIds.forEach(userId => {
      if (!userId) return;
      
      // Skip if we already have this profile in state
      if (userProfiles[userId]?.username && userProfiles[userId]?.username !== 'Unknown User') return;
      
      // Create a promise that resolves when the user data is fetched
      profilePromises[userId] = new Promise((resolve) => {
        // Use a local variable to track if this promise has been resolved
        let isResolved = false;
        
        // Get the Firebase services
        const { db } = getFirebaseServices();
        if (!db) {
          resolve({ username: 'Unknown User', avatarUrl: null });
          return;
        }
        
        // Set up a one-time listener for the user document
        const userRef = doc(db, 'users', userId);
        
        // First try to get from cache
        getDoc(userRef)
          .then(docSnap => {
            if (docSnap.exists() && !isResolved) {
              const data = docSnap.data();
              isResolved = true;
              resolve({
                username: data.displayName || data.username || 'Unknown User',
                avatarUrl: data.avatarUrl || data.photoURL || null
              });
            }
          })
          .catch(err => {
            console.error(`Error fetching user data for ${userId}:`, err);
            if (!isResolved) {
              isResolved = true;
              resolve({ username: 'Unknown User', avatarUrl: null });
            }
          });
          
        // Set a timeout to resolve with Unknown User if taking too long
        setTimeout(() => {
          if (!isResolved) {
            console.warn(`Timeout fetching user data for ${userId}`);
            isResolved = true;
            resolve({ username: 'Unknown User', avatarUrl: null });
          }
        }, 5000); // 5 second timeout
      });
    });
    
    // Wait for all promises to resolve and update the state
    if (Object.keys(profilePromises).length > 0) {
      Promise.all(Object.entries(profilePromises).map(async ([userId, promise]) => {
        const userData = await promise;
        return [userId, userData];
      })).then(results => {
        const newProfiles = Object.fromEntries(results);
        setUserProfiles(prev => ({
          ...prev,
          ...newProfiles
        }));
      });
    }
  }, [messages]);

  return (
    <>
      <Card className={`flex flex-col h-full w-full overflow-hidden ${className}`}>
        {/* Chat Header */}
        <div className="flex-none p-4 border-b bg-card">
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
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowBlockDialog(true)}
                    title="Block user"
                  >
                    <Ban className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowDeleteDialog(true)}
                    title="Delete chat"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
              {onClose && (
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Close
                </Button>
              )}
            </div>
            <BlockUserDialog
              open={showBlockDialog}
              onOpenChange={setShowBlockDialog}
              userId={receiverId}
              username={displayName}
              onBlock={handleBlockUser}
            />
          </div>
        </div>

        {/* Main Content Area - Fixed height and proper scrolling */}
        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
          {/* Messages Area with Fixed Height ScrollArea */}
          <ScrollArea 
            ref={scrollRef}
            className="flex-1 h-full"
            type="always"
            onScroll={(e) => {
              const target = e.currentTarget;
              const viewport = target.querySelector('[data-radix-scroll-area-viewport]');
              if (viewport) {
                // More forgiving threshold for detecting bottom (20px)
                const isBottom = Math.abs(viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop) < 20;
                setIsAtBottom(isBottom);
              }
            }}
          >
            <div className="p-4 space-y-4">
              {error && (
                <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}
              
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
                      <div className="flex justify-center my-4">
                        <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                          {new Date(message.timestamp).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                        </div>
                      </div>
                    )}
                    <div className={`flex ${isUserMessage ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex flex-col gap-1 max-w-[80%] md:max-w-[70%]`}>
                        {!isUserMessage && (
                          <div className="text-xs text-muted-foreground ml-2">
                            <UserNameLink 
                              userId={message.senderId} 
                              initialUsername={userProfiles[message.senderId]?.username || 'Loading...'}
                            />
                          </div>
                        )}
                        <div
                          className={`rounded-lg p-3 break-words shadow-sm ${
                            isUserMessage
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted hover:bg-muted/90'
                          }`}
                        >
                          <MessageContent 
                            content={message.content}
                            className={isUserMessage ? 'text-primary-foreground' : ''}
                          />
                          <div className="flex items-center justify-end gap-1 text-xs mt-1.5 opacity-75">
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
              <div ref={bottomRef} className="h-px" />
            </div>
          </ScrollArea>

          {/* Scroll to bottom button - Fixed positioning with improved visibility */}
          {!isAtBottom && messages.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              className="absolute bottom-16 right-4 rounded-full opacity-90 hover:opacity-100 shadow-md z-10 flex items-center gap-1 px-3 py-2 bg-primary text-primary-foreground animate-pulse"
              onClick={() => {
                scrollToBottom();
                setIsAtBottom(true);
              }}
            >
              <span className="text-xs font-medium">New messages</span>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M12 5v14"/>
                <path d="m19 12-7 7-7-7"/>
              </svg>
            </Button>
          )}
        </div>

        {/* Message Input - Now properly fixed to bottom */}
        <div className="flex-none border-t bg-card">
          <form onSubmit={handleSend} className="p-4">
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
        </div>
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