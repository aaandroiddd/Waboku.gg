import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUnread } from '@/contexts/UnreadContext';
import { useMessageThreads } from '@/hooks/useMessageThreads';
import { Skeleton } from "@/components/ui/skeleton";
import { Chat } from '@/components/Chat';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { MessagesPageInitializer } from '@/components/MessagesPageInitializer';
import { FirestoreDisabler } from '@/components/FirestoreDisabler';
import { ClearFirestoreCache } from '@/components/ClearFirestoreCache';
import { toast } from '@/components/ui/use-toast';
import { RefreshCw } from 'lucide-react';

interface ChatPreview {
  id: string;
  participants: Record<string, boolean>;
  lastMessage?: {
    content: string;
    senderId: string;
    timestamp: number;
  };
  listingId?: string;
  listingTitle?: string;
  subject?: string;
  participantNames?: Record<string, string>;
}

interface ParticipantProfile {
  username: string;
  avatarUrl: string | null;
}

export default function MessagesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { clearUnreadCount, resetUnreadCount } = useUnread();
  const { threads, loading, error } = useMessageThreads();
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);



  // Clear unread count when component mounts
  useEffect(() => {
    clearUnreadCount('messages');
    
    // Reset when component unmounts
    return () => {
      resetUnreadCount('messages');
    };
  }, [clearUnreadCount, resetUnreadCount]);
  
  // Function to sync message threads when there's a mismatch
  const syncMessageThreads = async () => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/messages/sync-threads', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Message threads synced:', result);
        return result.syncedThreads > 0;
      }
    } catch (error) {
      console.error('Error syncing message threads:', error);
    }
    return false;
  };

  // Function to clean up orphaned message threads
  const cleanupOrphanedThreads = async () => {
    if (!user) return;

    try {
      console.log('[Messages] Starting cleanup process...');
      
      // Get a fresh ID token
      const token = await user.getIdToken(true);
      console.log('[Messages] Generated fresh ID token, length:', token.length);
      
      console.log('[Messages] Making API request to cleanup-threads-standalone...');
      
      const response = await fetch('/api/messages/cleanup-threads-standalone', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('[Messages] API response status:', response.status);
      
      const data = await response.json();
      console.log('[Messages] API response data:', data);
      
      if (response.ok) {
        if (data.cleaned > 0) {
          toast({
            title: "Cleanup Complete",
            description: `Removed ${data.cleaned} empty conversation${data.cleaned === 1 ? '' : 's'} from your messages.`,
          });
          // Reload the page to show updated message list
          window.location.reload();
        } else {
          toast({
            title: "No Cleanup Needed",
            description: "All your message threads are valid.",
          });
        }
      } else {
        console.error('[Messages] Cleanup API error response:', data);
        toast({
          title: "Cleanup Failed",
          description: data.error || 'Cleanup failed',
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('[Messages] Cleanup error:', error);
      toast({
        title: "Cleanup Failed",
        description: 'Cleanup failed: ' + error.message,
        variant: "destructive"
      });
    }
    return false;
  };

  if (!user) return null;

  if (error) {
    return (
      <DashboardLayout>
        <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
          <div className="text-center max-w-md mx-auto">
            <h3 className="text-lg font-semibold text-red-600 mb-2">Error Loading Messages</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            
            {/* Additional troubleshooting information with more detailed steps */}
            <div className="bg-muted p-4 rounded-lg text-left mb-4">
              <h4 className="font-medium mb-2">Troubleshooting steps:</h4>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                <li>Check your internet connection and make sure you're online</li>
                <li>
                  Try clearing your browser cache:
                  <ul className="list-circle list-inside ml-4 mt-1 space-y-1 text-xs">
                    <li>This will reset your Firebase connection</li>
                    <li>Your account will remain logged in</li>
                    <li>Use the "Clear Cache & Retry" button below</li>
                  </ul>
                </li>
                <li>If you're using a VPN or firewall, try disabling it temporarily</li>
                <li>If the issue persists, try using a different browser or device</li>
                <li>Make sure your browser is up to date</li>
              </ul>
            </div>
            
            <div className="bg-amber-500/10 border border-amber-500 p-4 rounded-lg text-left mb-4">
              <h4 className="font-medium mb-2 text-amber-600">Common causes:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Temporary network connectivity issues</li>
                <li>Browser cache conflicts with Firebase</li>
                <li>VPN or firewall blocking Firebase connections</li>
                <li>Browser extensions interfering with web connections</li>
              </ul>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button
                onClick={() => window.location.reload()}
                className="mt-2"
                variant="outline"
              >
                Retry
              </Button>
              <ClearFirestoreCache
                className="mt-2"
                variant="default"
                buttonText="Clear Cache & Retry"
              />
              <Button
                onClick={() => {
                  // Check if user is admin
                  const adminSecret = localStorage.getItem('admin_secret');
                  if (adminSecret) {
                    router.push('/admin/firebase-diagnostics');
                  } else {
                    toast({
                      title: "Admin access required",
                      description: "Firebase diagnostics are only available to administrators.",
                      variant: "destructive"
                    });
                  }
                }}
                className="mt-2"
                variant="secondary"
              >
                Contact Support
              </Button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const showChatList = !isMobileView || !selectedChat;
  const showChat = !isMobileView || selectedChat;

  return (
    <DashboardLayout>
      {/* Initialize the messages page to disable Firestore and use only Realtime Database */}
      <MessagesPageInitializer />
      
      {/* Disable Firestore to prevent 400 Bad Request errors */}
      <FirestoreDisabler />
      
      {/* Database connection status alerts have been disabled as requested */}
      
      <div className="h-[calc(100vh-8rem)] flex overflow-hidden">
        {showChatList && (
          <div className={`${isMobileView ? 'w-full' : 'w-80'} border-r bg-background flex flex-col overflow-hidden`}>
            <div className="p-4 border-b flex-none">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold">Messages</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cleanupOrphanedThreads}
                  disabled={loading}
                  className="gap-2"
                  title="Clean up empty conversations"
                >
                  <RefreshCw className="w-4 h-4" />
                  Cleanup
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">Your conversations</p>
            </div>
            
            {loading ? (
              <div className="p-4 space-y-4">
                <Skeleton className="w-full h-20" />
                <Skeleton className="w-full h-20" />
                <Skeleton className="w-full h-20" />
              </div>
            ) : threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 p-4 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-6 h-6 text-muted-foreground"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z"
                    />
                  </svg>
                </div>
                <h3 className="font-semibold mb-2">No Messages</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Start a conversation by browsing listings
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => router.push('/listings')}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Browse Listings
                  </Button>
                  <Button
                    onClick={async () => {
                      try {
                        const synced = await syncMessageThreads();
                        if (synced) {
                          // Reload the page to show synced messages
                          window.location.reload();
                        } else {
                          console.log('No messages to sync');
                        }
                      } catch (error) {
                        console.error('Error syncing messages:', error);
                      }
                    }}
                    variant="outline"
                    size="sm"
                    disabled={loading}
                  >
                    Sync Messages
                  </Button>
                </div>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="space-y-3 p-4">
                  {threads.map((thread) => {
                    const isUnread = thread.unreadCount > 0;
                    
                    return (
                      <Button
                        key={thread.chatId}
                        variant={selectedChat === thread.chatId ? "secondary" : "ghost"}
                        className={`w-full justify-start h-auto py-3 relative ${isUnread ? 'bg-muted/50' : ''}`}
                        onClick={() => setSelectedChat(thread.chatId)}
                      >
                        {isUnread && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-full"></div>
                        )}
                        <div className="text-left w-full space-y-1.5">
                          <div className="font-medium flex items-center gap-2">
                            <span className="font-medium">
                              {thread.recipientName || `User ${thread.recipientId.substring(0, 8)}`}
                            </span>
                            {isUnread && (
                              <div className="h-2 w-2 rounded-full bg-primary"></div>
                            )}
                          </div>
                          {thread.subject && (
                            <div className="text-sm font-medium text-primary truncate">
                              {thread.subject}
                            </div>
                          )}
                          {thread.listingTitle && (
                            <div className="text-sm font-medium text-muted-foreground truncate border-l-2 border-primary pl-2">
                              {thread.listingTitle}
                            </div>
                          )}
                          {thread.lastMessage && (
                            <div className={`text-sm truncate mt-1 ${isUnread ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                              {thread.lastMessage.content}
                            </div>
                          )}
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        {showChat && (
          <div className="flex-1 flex flex-col bg-muted/30 overflow-hidden">
            {selectedChat ? (
              <div className="flex flex-col h-full overflow-hidden">
                {isMobileView && (
                  <div className="flex-none p-2 border-b bg-background">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedChat(null)}
                      className="gap-2"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back to messages
                    </Button>
                  </div>
                )}
                <div className="flex-1 overflow-hidden">
                  <Chat
                    chatId={selectedChat}
                    receiverId={threads.find(t => t.chatId === selectedChat)?.recipientId || ''}
                    receiverName={threads.find(t => t.chatId === selectedChat)?.recipientName || 'Unknown User'}
                    listingId={threads.find(t => t.chatId === selectedChat)?.listingId}
                    listingTitle={threads.find(t => t.chatId === selectedChat)?.listingTitle}
                    className="h-full max-w-none rounded-none border-0"
                    onDelete={() => setSelectedChat(null)}
                    isBlocked={threads.find(t => t.chatId === selectedChat)?.isBlocked || false}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Select a conversation to view messages
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}