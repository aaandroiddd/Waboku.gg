import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useMemo } from 'react';
import { getDatabase, ref, onValue, get, update } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { db, getFirebaseServices } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useUnread } from '@/contexts/UnreadContext';
import { Skeleton } from "@/components/ui/skeleton";
import { Chat } from '@/components/Chat';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { UserNameLink } from '@/components/UserNameLink';
import { MessagesPageInitializer } from '@/components/MessagesPageInitializer';
import { DatabaseConnectionStatus } from '@/components/DatabaseConnectionStatus';
import { FirestoreDisabler } from '@/components/FirestoreDisabler';
import { ClearFirestoreCache } from '@/components/ClearFirestoreCache';
import { MessageThreadDebugger } from '@/components/MessageThreadDebugger';
import { MessageSystemDebugger } from '@/components/MessageSystemDebugger';
import { prefetchUserData } from '@/hooks/useUserData';

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
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [participantProfiles, setParticipantProfiles] = useState<Record<string, ParticipantProfile>>({});
  const [isMobileView, setIsMobileView] = useState(false);
  const [profilesLoading, setProfilesLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Cache for user profiles to avoid repeated fetches
  const profileCache = useRef<Record<string, {
    data: { username: string; avatarUrl: string | null };
    timestamp: number;
  }>>({});
  
  // Cache expiration time (5 minutes)
  const CACHE_EXPIRATION = 5 * 60 * 1000;

  const fetchUserProfile = async (userId: string) => {
    if (!userId) return null;
    
    try {
      setProfilesLoading(prev => ({ ...prev, [userId]: true }));
      
      // Check cache first
      const cachedProfile = profileCache.current[userId];
      if (cachedProfile && Date.now() - cachedProfile.timestamp < CACHE_EXPIRATION) {
        console.log(`Using cached profile for ${userId}`);
        return cachedProfile.data;
      }
      
      // Use Realtime Database instead of Firestore since Firestore is disabled on this page
      const { database } = getFirebaseServices();
      if (!database) {
        console.error('Realtime Database not available for user profile fetch');
        return { username: 'Unknown User', avatarUrl: null };
      }
      
      try {
        const userRef = ref(database, `users/${userId}`);
        const userSnapshot = await get(userRef);
        
        let result;
        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          result = {
            username: userData.displayName || userData.username || userData.email?.split('@')[0] || 'Unknown User',
            avatarUrl: userData.avatarUrl || userData.photoURL || null
          };
          console.log(`Fetched user profile from Realtime Database for ${userId}:`, result.username);
        } else {
          // If user doesn't exist in Realtime Database, try to get from localStorage cache
          // or use a fallback that's more user-friendly
          const fallbackUsername = `User ${userId.substring(0, 8)}`;
          result = { 
            username: fallbackUsername, 
            avatarUrl: null 
          };
          console.log(`User ${userId} not found in Realtime Database, using fallback: ${fallbackUsername}`);
        }
        
        // Update cache
        profileCache.current[userId] = {
          data: result,
          timestamp: Date.now()
        };
        
        return result;
      } catch (dbError) {
        console.error(`Error fetching from Realtime Database for ${userId}:`, dbError);
        
        // Fallback to a more user-friendly unknown user format
        const fallbackUsername = `User ${userId.substring(0, 8)}`;
        const result = { 
          username: fallbackUsername, 
          avatarUrl: null 
        };
        
        // Cache the fallback with shorter expiration
        profileCache.current[userId] = {
          data: result,
          timestamp: Date.now() - (CACHE_EXPIRATION / 2) // Expire sooner to retry later
        };
        
        return result;
      }
    } catch (err) {
      console.error(`Error fetching profile for ${userId}:`, err);
      
      // More user-friendly fallback
      const fallbackUsername = `User ${userId.substring(0, 8)}`;
      return { username: fallbackUsername, avatarUrl: null };
    } finally {
      setProfilesLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

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

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const { database } = getFirebaseServices();
    
    if (!database) {
      setError('Database connection failed');
      setLoading(false);
      return;
    }

    // Use the user's messageThreads to get their chats
    const userThreadsRef = ref(database, `users/${user.uid}/messageThreads`);

    const processUserThreads = async (threadsData: any) => {
      // If no message threads exist, try to sync them from existing chats
      if (!threadsData) {
        console.log('No message threads found, attempting to sync...');
        
        try {
          const synced = await syncMessageThreads();
          if (synced) {
            // Reload after sync
            const userThreadsRef = ref(database, `users/${user.uid}/messageThreads`);
            const newThreadsSnapshot = await get(userThreadsRef);
            const newThreadsData = newThreadsSnapshot.val();
            
            if (newThreadsData) {
              return processUserThreads(newThreadsData);
            }
          }
        } catch (error) {
          console.error('Error syncing message threads:', error);
        }
        
        setChats([]);
        setLoading(false);
        return;
      }

      // Get chat IDs from user's message threads
      const chatIds = Object.keys(threadsData);
      
      if (chatIds.length === 0) {
        setChats([]);
        setLoading(false);
        return;
      }

      // Fetch individual chats that the user participates in
      const chatPromises = chatIds.map(async (chatId) => {
        try {
          const chatRef = ref(database, `chats/${chatId}`);
          const chatSnapshot = await get(chatRef);
          const chatData = chatSnapshot.val();
          
          if (chatData && chatData.participants?.[user.uid] && !chatData.deletedBy?.[user.uid]) {
            return {
              id: chatId,
              ...chatData
            };
          }
          return null;
        } catch (error) {
          console.error(`Error fetching chat ${chatId}:`, error);
          return null;
        }
      });

      const chatResults = await Promise.all(chatPromises);
      const validChats = chatResults
        .filter((chat): chat is ChatPreview => chat !== null)
        .sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));

      setChats(validChats);
      
      // Fetch user profiles for participants
      const uniqueParticipants = new Set<string>();
      validChats.forEach(chat => {
        Object.keys(chat.participants || {}).forEach(participantId => {
          if (participantId !== user.uid) {
            uniqueParticipants.add(participantId);
          }
        });
      });

      // Fetch profiles for participants
      const participantIds = Array.from(uniqueParticipants);
      const profiles: Record<string, ParticipantProfile> = {};
      await Promise.all(
        participantIds.map(async (id) => {
          const profile = await fetchUserProfile(id);
          if (profile) {
            profiles[id] = profile;
          }
        })
      );
      
      setParticipantProfiles(prev => ({ ...prev, ...profiles }));
      setLoading(false);
    };

    // Initial load
    setLoading(true);
    get(userThreadsRef)
      .then(snapshot => processUserThreads(snapshot.val()))
      .catch(err => {
        console.error('Error loading user message threads:', err);
        setError('Failed to load messages');
        setLoading(false);
      });

    // Real-time updates for user's message threads
    const unsubscribe = onValue(userThreadsRef, 
      snapshot => processUserThreads(snapshot.val()),
      error => {
        console.error('Real-time update error:', error);
        setError('Failed to receive updates');
      }
    );

    return () => unsubscribe();
  }, [user]);

  const getOtherParticipant = (chat?: ChatPreview | null) => {
    if (!chat?.participants) return { id: '', name: 'Unknown User' };
    
    const otherParticipantId = Object.keys(chat.participants).find(id => id !== user?.uid);
    if (!otherParticipantId) return { id: '', name: 'Unknown User' };

    // If we don't have this user's profile yet and it's not already loading, trigger a fetch
    if (!participantProfiles[otherParticipantId] && !profilesLoading[otherParticipantId]) {
      // Use a setTimeout to avoid blocking the render
      setTimeout(() => {
        fetchUserProfile(otherParticipantId);
      }, 0);
    }

    const profile = participantProfiles[otherParticipantId];
    const isLoading = profilesLoading[otherParticipantId];
    
    // Try all available sources for the username in order of preference
    let username = 'Unknown User';
    
    // First try chat participant names (from the chat object)
    if (chat.participantNames?.[otherParticipantId]) {
      username = chat.participantNames[otherParticipantId];
    }
    // Then try profile username (from our fetched profiles)
    else if (profile?.username) {
      username = profile.username;
    }
    // Show loading state if profile is being fetched
    else if (isLoading) {
      username = 'Loading...';
    }
    
    return {
      id: otherParticipantId,
      name: username
    };
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
              <h2 className="text-xl font-semibold">Messages</h2>
              <p className="text-sm text-muted-foreground">Your conversations</p>
            </div>
            
            {loading ? (
              <div className="p-4 space-y-4">
                <Skeleton className="w-full h-20" />
                <Skeleton className="w-full h-20" />
                <Skeleton className="w-full h-20" />
              </div>
            ) : chats.length === 0 ? (
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
                      setLoading(true);
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
                      } finally {
                        setLoading(false);
                      }
                    }}
                    variant="outline"
                    size="sm"
                    disabled={loading}
                  >
                    {loading ? 'Syncing...' : 'Sync Messages'}
                  </Button>
                </div>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="space-y-3 p-4">
                  {chats.map((chat) => {
                    const otherParticipant = getOtherParticipant(chat);
                    const isUnread = chat.lastMessage && 
                                    chat.lastMessage.receiverId === user?.uid && 
                                    chat.lastMessage.read === false;
                    
                    return (
                      <Button
                        key={chat.id}
                        variant={selectedChat === chat.id ? "secondary" : "ghost"}
                        className={`w-full justify-start h-auto py-3 relative ${isUnread ? 'bg-muted/50' : ''}`}
                        onClick={() => setSelectedChat(chat.id)}
                      >
                        {isUnread && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-full"></div>
                        )}
                        <div className="text-left w-full space-y-1.5">
                          <div className="font-medium flex items-center gap-2">
                            {otherParticipant.id ? (
                              <UserNameLink 
                                userId={otherParticipant.id} 
                                initialUsername={otherParticipant.name !== 'Unknown User' ? otherParticipant.name : undefined}
                              />
                            ) : (
                              <span>Unknown User</span>
                            )}
                            {isUnread && (
                              <div className="h-2 w-2 rounded-full bg-primary"></div>
                            )}
                          </div>
                          {chat.subject && (
                            <div className="text-sm font-medium text-primary truncate">
                              {chat.subject}
                            </div>
                          )}
                          {chat.listingTitle && (
                            <div className="text-sm font-medium text-muted-foreground truncate border-l-2 border-primary pl-2">
                              {chat.listingTitle}
                            </div>
                          )}
                          {chat.lastMessage && (
                            <div className={`text-sm truncate mt-1 ${isUnread ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                              {chat.lastMessage.content}
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
                    receiverId={getOtherParticipant(chats.find(c => c.id === selectedChat)!).id}
                    receiverName={getOtherParticipant(chats.find(c => c.id === selectedChat)!).name}
                    listingId={chats.find(c => c.id === selectedChat)?.listingId}
                    listingTitle={chats.find(c => c.id === selectedChat)?.listingTitle}
                    className="h-full max-w-none rounded-none border-0"
                    onDelete={() => setSelectedChat(null)}
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