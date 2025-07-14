import { useEffect, useState } from 'react';
import { getDatabase, ref, onValue, remove } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { db, getFirebaseServices } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserX, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface BlockedUser {
  userId: string;
  username: string;
  blockedAt: number;
}

export function BlockedUsersManager() {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingUsers, setUnblockingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const { database } = getFirebaseServices();
    if (!database) {
      setLoading(false);
      return;
    }

    const blockedUsersRef = ref(database, `users/${user.uid}/blockedUsers`);

    const unsubscribe = onValue(blockedUsersRef, async (snapshot) => {
      try {
        const data = snapshot.val();
        
        if (data) {
          const blockedUserIds = Object.keys(data);
          const blockedUsersData: BlockedUser[] = [];

          // Fetch user details for each blocked user
          for (const userId of blockedUserIds) {
            try {
              // Try Firestore first
              let username = `User ${userId.substring(0, 8)}`;
              
              try {
                const userDoc = await getDoc(doc(db, 'users', userId));
                if (userDoc.exists()) {
                  const userData = userDoc.data();
                  username = userData.displayName || userData.username || userData.email?.split('@')[0] || username;
                }
              } catch (firestoreError) {
                console.error(`Error fetching user ${userId} from Firestore:`, firestoreError);
              }

              blockedUsersData.push({
                userId,
                username,
                blockedAt: typeof data[userId] === 'number' ? data[userId] : Date.now()
              });
            } catch (error) {
              console.error(`Error processing blocked user ${userId}:`, error);
            }
          }

          // Sort by blocked date (most recent first)
          blockedUsersData.sort((a, b) => b.blockedAt - a.blockedAt);
          setBlockedUsers(blockedUsersData);
        } else {
          setBlockedUsers([]);
        }
      } catch (error) {
        console.error('Error processing blocked users:', error);
        toast({
          title: "Error",
          description: "Failed to load blocked users",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleUnblockUser = async (userId: string, username: string) => {
    if (!user) return;

    setUnblockingUsers(prev => new Set(prev).add(userId));

    try {
      const { database } = getFirebaseServices();
      if (!database) {
        throw new Error('Database connection failed');
      }

      const blockedUserRef = ref(database, `users/${user.uid}/blockedUsers/${userId}`);
      await remove(blockedUserRef);

      toast({
        title: "User unblocked",
        description: `${username} has been unblocked and can now send you messages`,
      });
    } catch (error) {
      console.error('Error unblocking user:', error);
      toast({
        title: "Error",
        description: "Failed to unblock user. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUnblockingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  if (!user) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserX className="w-5 h-5" />
          Blocked Users
        </CardTitle>
        <CardDescription>
          Manage users you have blocked from sending you messages
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="w-full h-16" />
            <Skeleton className="w-full h-16" />
            <Skeleton className="w-full h-16" />
          </div>
        ) : blockedUsers.length === 0 ? (
          <div className="text-center py-8">
            <UserX className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">No blocked users</h3>
            <p className="text-sm text-muted-foreground">
              You haven't blocked any users yet
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="space-y-3">
              {blockedUsers.map((blockedUser) => (
                <div
                  key={blockedUser.userId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">{blockedUser.username}</div>
                    <div className="text-sm text-muted-foreground">
                      Blocked on {new Date(blockedUser.blockedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnblockUser(blockedUser.userId, blockedUser.username)}
                    disabled={unblockingUsers.has(blockedUser.userId)}
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {unblockingUsers.has(blockedUser.userId) ? 'Unblocking...' : 'Unblock'}
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}