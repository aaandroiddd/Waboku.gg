import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react';
import { getDatabase, ref, onValue, get } from 'firebase/database';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Chat } from '@/components/Chat';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

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

        // Fetch profiles for each participant
        const profilesRef = ref(database, 'profiles');
        const profilesSnapshot = await get(profilesRef);
        const profilesData = profilesSnapshot.val() || {};
        
        const profiles: Record<string, any> = {};
        uniqueParticipants.forEach(id => {
          profiles[id] = profilesData[id] || { username: 'Unknown User' };
        });
        
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

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Messages</CardTitle>
            <CardDescription>
              Your conversations with other users
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="w-full h-20" />
                <Skeleton className="w-full h-20" />
                <Skeleton className="w-full h-20" />
              </div>
            ) : chats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-8 h-8 text-muted-foreground"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z"
                    />
                  </svg>
                </div>
                <div className="max-w-sm">
                  <h3 className="text-lg font-semibold mb-2">No Messages Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start a conversation by browsing listings and messaging sellers about their cards.
                  </p>
                  <Button
                    onClick={() => window.location.href = '/listings'}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Browse Listings
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-[300px,1fr] gap-6">
                <Card className="h-[600px] flex flex-col">
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
                </Card>

                <div className="h-[600px]">
                  {selectedChat ? (
                    <Chat
                      chatId={selectedChat}
                      receiverId={getOtherParticipant(chats.find(c => c.id === selectedChat)!).id}
                      receiverName={getOtherParticipant(chats.find(c => c.id === selectedChat)!).name}
                      listingId={chats.find(c => c.id === selectedChat)?.listingId}
                      listingTitle={chats.find(c => c.id === selectedChat)?.listingTitle}
                    />
                  ) : (
                    <Card className="h-full flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        Select a conversation to view messages
                      </div>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}