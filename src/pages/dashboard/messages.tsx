import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react';
import { getDatabase, ref, onValue } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Chat } from '@/components/Chat';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';

const DashboardLayout = dynamic(
  () => import('@/components/dashboard/DashboardLayout').then(mod => mod.DashboardLayout),
  {
    loading: () => (
      <div className="p-8">
        <Skeleton className="w-full h-[200px]" />
      </div>
    ),
    ssr: false
  }
);

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
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [participantProfiles, setParticipantProfiles] = useState<Record<string, any>>({});
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const database = getDatabase();
    const chatsRef = ref(database, 'chats');

    const unsubscribe = onValue(chatsRef, async (snapshot) => {
      try {
        const data = snapshot.val();
        if (!data) {
          setChats([]);
          setLoading(false);
          return;
        }

        const chatList = Object.entries(data)
          .map(([id, chat]: [string, any]) => ({
            id,
            ...chat,
          }))
          .filter((chat) => chat.participants && chat.participants[user.uid])
          .sort((a, b) => {
            const timestampA = a.lastMessage?.timestamp || 0;
            const timestampB = b.lastMessage?.timestamp || 0;
            return timestampB - timestampA;
          });

        // Get unique participants
        const uniqueParticipants = new Set<string>();
        chatList.forEach(chat => {
          Object.keys(chat.participants || {}).forEach(participantId => {
            if (participantId !== user.uid) {
              uniqueParticipants.add(participantId);
            }
          });
        });

        // Fetch profiles from Firestore
        const profiles: Record<string, any> = {};
        await Promise.all(Array.from(uniqueParticipants).map(async (id) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', id));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              profiles[id] = {
                username: userData.displayName || userData.username || 'Unknown User',
                avatarUrl: userData.avatarUrl || userData.photoURL || null
              };
            } else {
              profiles[id] = { username: 'Unknown User' };
            }
          } catch (err) {
            console.error(`Error fetching profile for ${id}:`, err);
            profiles[id] = { username: 'Unknown User' };
          }
        }));
        
        setParticipantProfiles(profiles);
        setChats(chatList);
      } catch (error) {
        console.error('Error loading chats:', error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const getOtherParticipant = (chat: ChatPreview) => {
    if (!chat.participants) return { id: '', name: 'Unknown User' };
    
    const otherParticipantId = Object.keys(chat.participants).find(id => id !== user?.uid);
    if (!otherParticipantId) return { id: '', name: 'Unknown User' };

    const profile = participantProfiles[otherParticipantId];
    return {
      id: otherParticipantId,
      name: profile?.username || 'Unknown User'
    };
  };

  if (!user) return null;

  const showChatList = !isMobileView || !selectedChat;
  const showChat = !isMobileView || selectedChat;

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        <div className="flex-1 flex">
          {showChatList && (
            <div className={`${isMobileView ? 'w-full' : 'w-80'} border-r bg-background flex flex-col`}>
              <div className="p-4 border-b">
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
                    onClick={() => window.location.href = '/listings'}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Browse Listings
                  </Button>
                </div>
              ) : (
                <ScrollArea className="flex-1">
                  <div className="space-y-2 p-4">
                    {chats.map((chat) => {
                      const otherParticipant = getOtherParticipant(chat);
                      return (
                        <Button
                          key={chat.id}
                          variant={selectedChat === chat.id ? "secondary" : "ghost"}
                          className="w-full justify-start"
                          onClick={() => setSelectedChat(chat.id)}
                        >
                          <div className="text-left w-full">
                            <div className="font-medium">{otherParticipant.name}</div>
                            {chat.listingTitle && (
                              <div className="text-sm font-medium text-muted-foreground truncate mb-1 border-l-2 border-primary pl-2">
                                {chat.listingTitle}
                              </div>
                            )}
                            {chat.lastMessage && (
                              <div className="text-sm text-muted-foreground truncate">
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
                <>
                  {isMobileView && (
                    <div className="p-2 border-b bg-background">
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
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  Select a conversation to view messages
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}