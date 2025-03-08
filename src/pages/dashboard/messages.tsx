import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import { getDatabase, ref, onValue, get } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { db, getFirebaseServices } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from "@/components/ui/skeleton";
import { Chat } from '@/components/Chat';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { UserNameLink } from '@/components/UserNameLink';

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
      
      // Try to get from Firestore
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      let result;
      if (userDoc.exists()) {
        const userData = userDoc.data();
        result = {
          username: userData.displayName || userData.username || 'Unknown User',
          avatarUrl: userData.avatarUrl || userData.photoURL || null
        };
      } else {
        // If document doesn't exist, try a second attempt after a short delay
        await new Promise(resolve => setTimeout(resolve, 500));
        const retryDoc = await getDoc(doc(db, 'users', userId));
        
        if (retryDoc.exists()) {
          const userData = retryDoc.data();
          result = {
            username: userData.displayName || userData.username || 'Unknown User',
            avatarUrl: userData.avatarUrl || userData.photoURL || null
          };
        } else {
          result = { username: 'Unknown User', avatarUrl: null };
        }
      }
      
      // Update cache
      profileCache.current[userId] = {
        data: result,
        timestamp: Date.now()
      };
      
      return result;
    } catch (err) {
      console.error(`Error fetching profile for ${userId}:`, err);
      return { username: 'Unknown User', avatarUrl: null };
    } finally {
      setProfilesLoading(prev => ({ ...prev, [userId]: false }));
    }
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

    const chatsRef = ref(database, 'chats');

    const processChats = async (data: any) => {
      if (!data) {
        setChats([]);
        return;
      }

      const chatList = Object.entries(data)
        .map(([id, chat]: [string, any]) => ({
          id,
          ...chat,
        }))
        .filter((chat) => 
          chat.participants && 
          chat.participants[user.uid] && 
          (!chat.deletedBy || !chat.deletedBy[user.uid])
        )
        .sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));

      const uniqueParticipants = new Set<string>();
      chatList.forEach(chat => {
        Object.keys(chat.participants || {}).forEach(participantId => {
          if (participantId !== user.uid) {
            uniqueParticipants.add(participantId);
          }
        });
      });

      const profiles: Record<string, ParticipantProfile> = {};
      await Promise.all(
        Array.from(uniqueParticipants).map(async (id) => {
          const profile = await fetchUserProfile(id);
          if (profile) {
            profiles[id] = profile;
          }
        })
      );
      
      setParticipantProfiles(prev => ({ ...prev, ...profiles }));
      setChats(chatList);
    };

    // Initial load
    get(chatsRef)
      .then(snapshot => processChats(snapshot.val()))
      .catch(err => {
        console.error('Error loading initial chats:', err);
        setError('Failed to load messages');
      })
      .finally(() => setLoading(false));

    // Real-time updates
    const unsubscribe = onValue(chatsRef, 
      snapshot => processChats(snapshot.val()),
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
          <div className="text-center">
            <h3 className="text-lg font-semibold text-red-600 mb-2">Error Loading Messages</h3>
            <p className="text-muted-foreground">{error}</p>
            <Button
              onClick={() => window.location.reload()}
              className="mt-4"
              variant="outline"
            >
              Retry
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const showChatList = !isMobileView || !selectedChat;
  const showChat = !isMobileView || selectedChat;

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)] flex overflow-hidden">
        {showChatList && (
          <div className={`${isMobileView ? 'w-full' : 'w-80'} border-r bg-background flex flex-col overflow-hidden`}>
            <div className="p-4 border-b flex-none">
              <h2 className="text-lg font-semibold">Messages</h2>
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
                <Button
                  onClick={() => router.push('/listings')}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Browse Listings
                </Button>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="space-y-3 p-4">
                  {chats.map((chat) => {
                    const otherParticipant = getOtherParticipant(chat);
                    return (
                      <Button
                        key={chat.id}
                        variant={selectedChat === chat.id ? "secondary" : "ghost"}
                        className="w-full justify-start h-auto py-3"
                        onClick={() => setSelectedChat(chat.id)}
                      >
                        <div className="text-left w-full space-y-1.5">
                          <div className="font-medium">
                            {otherParticipant.id ? (
                              <UserNameLink 
                                userId={otherParticipant.id} 
                                initialUsername={otherParticipant.name !== 'Unknown User' ? otherParticipant.name : undefined}
                              />
                            ) : (
                              <span>Unknown User</span>
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
                            <div className="text-sm text-muted-foreground truncate mt-1">
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
          <div className="flex-1 flex flex-col bg-muted/30">
            {selectedChat ? (
              <div className="flex flex-col h-full">
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
                <div className="flex-1">
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