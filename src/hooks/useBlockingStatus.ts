import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebaseServices } from '@/lib/firebase';

export const useBlockingStatus = (otherUserId: string) => {
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockedBy, setIsBlockedBy] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !otherUserId || otherUserId === user.uid) {
      setIsBlocked(false);
      setIsBlockedBy(false);
      setLoading(false);
      return;
    }

    const checkBlockingStatus = async () => {
      try {
        const { database } = getFirebaseServices();
        if (!database) {
          setLoading(false);
          return;
        }

        const { ref, onValue } = await import('firebase/database');
        
        // Check if current user has blocked the other user
        const blockedUsersRef = ref(database, `users/${user.uid}/blockedUsers/${otherUserId}`);
        const blockedByRef = ref(database, `users/${user.uid}/blockedBy/${otherUserId}`);

        const unsubscribeBlocked = onValue(blockedUsersRef, (snapshot) => {
          setIsBlocked(snapshot.exists());
        });

        const unsubscribeBlockedBy = onValue(blockedByRef, (snapshot) => {
          setIsBlockedBy(snapshot.exists());
        });

        setLoading(false);

        return () => {
          unsubscribeBlocked();
          unsubscribeBlockedBy();
        };
      } catch (error) {
        console.error('Error checking blocking status:', error);
        setLoading(false);
      }
    };

    checkBlockingStatus();
  }, [user, otherUserId]);

  return {
    isBlocked,
    isBlockedBy,
    isEitherBlocked: isBlocked || isBlockedBy,
    loading
  };
};