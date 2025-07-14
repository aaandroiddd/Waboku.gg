import { useEffect, useState, useRef } from 'react';
import { getDatabase, ref, onValue, remove, get } from 'firebase/database';
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
  
  // Cache for user profiles to avoid repeated fetches
  const profileCache = useRef<Record<string, {
    data: { username: string };
    timestamp: number;
  }>>({});
  
  // Cache expiration time (5 minutes)
  const CACHE_EXPIRATION = 5 * 60 * 1000;

  // Helper function to fetch user profile with caching
  const fetchUserProfile = async (userId: string, database: any): Promise<string> => {
    if (!userId) return `User ${userId.substring(0, 8)}`;

    try {
      // Check cache first
      const cachedProfile = profileCache.current[userId];
      if (cachedProfile && Date.now() - cachedProfile.timestamp < CACHE_EXPIRATION) {
        return cachedProfile.data.username;
      }

      let username = `User ${userId.substring(0, 8)}`;

      // Try Firestore first since that's where user profiles are stored
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          username = userData.displayName || 
                   userData.username || 
                   (userData.email && userData.email.split('@')[0]) || 
                   username;
          
          // Update cache
          profileCache.current[userId] = {
            data: { username },
            timestamp: Date.now()
          };
          
          return username;
        }
      } catch (firestoreError) {
        console.error(`Error fetching user ${userId} from Firestore:`, firestoreError);
      }

      // Fallback to Realtime Database if Firestore fails
      if (database) {
        try {
          const userRef = ref(database, `users/${userId}`);
          const userSnapshot = await get(userRef);
          
          if (userSnapshot.exists()) {
            const userData = userSnapshot.val();
            username = userData.displayName || 
                     userData.username || 
                     (userData.email && userData.email.split('@')[0]) || 
                     username;
          }
        } catch (dbError) {
          console.error(`Error fetching user ${userId} from Realtime Database:`, dbError);
        }
      }

      // Update cache
      profileCache.current[userId] = {
        data: { username },
        timestamp: Date.now()
      };

      return username;
    } catch (error) {
      console.error(`Error fetching profile for ${userId}:`, error);
      return `User ${userId.substring(0, 8)}`;
    }
  };

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
              const username = await fetchUserProfile(userId, database);

              blockedUsersData.push({
                userId,
                username,
                // Handle both old format (boolean true) and new format (timestamp)
                blockedAt: typeof data[userId] === 'number' ? data[userId] : Date.now()
              });
            } catch (error) {
              console.error(`Error processing blocked user ${userId}:`, error);
              // Add fallback entry even if there's an error
              blockedUsersData.push({
                userId,
                username: `User ${userId.substring(0, 8)}`,
                blockedAt: typeof data[userId] === 'number' ? data[userId] : Date.now()
              });
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
      const response = await fetch('/api/users/unblock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({
          unblockedUserId: userId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to unblock user');
      }

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