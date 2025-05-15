import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';

interface ModeratorBadgeProps {
  userId?: string;
  className?: string;
}

export const ModeratorBadge = ({ userId, className = '' }: ModeratorBadgeProps) => {
  const { user } = useAuth();
  const [isModerator, setIsModerator] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkModeratorStatus = async () => {
      try {
        // Use the provided userId or the current user's ID
        const uid = userId || user?.uid;
        
        if (!uid) {
          setLoading(false);
          return;
        }

        // Get Firestore instance from Firebase services
        const { db } = getFirebaseServices();
        if (!db) {
          console.error('Firestore database is not initialized');
          setLoading(false);
          return;
        }

        // Check if user has moderator role
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          
          // Handle different role formats
          let hasModerator = false;
          
          // Log the roles data for debugging
          console.log('ModeratorBadge - User roles data:', {
            uid,
            roles: userData.roles,
            rolesType: typeof userData.roles,
            isArray: Array.isArray(userData.roles)
          });
          
          // Check if roles is an array
          if (Array.isArray(userData.roles)) {
            hasModerator = userData.roles.includes('moderator');
          } 
          // Check if roles is a string
          else if (typeof userData.roles === 'string') {
            hasModerator = userData.roles === 'moderator';
          }
          // Check if isModerator is a boolean flag
          else if (userData.isModerator === true) {
            hasModerator = true;
          }
          
          // Also check if user is an admin (admins can access moderator features)
          if (!hasModerator && userData.isAdmin === true) {
            hasModerator = true;
          }
          
          console.log('ModeratorBadge - Moderator check result:', {
            uid,
            hasModerator
          });
          
          setIsModerator(hasModerator);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error checking moderator status:', error);
        setLoading(false);
      }
    };

    checkModeratorStatus();
  }, [userId, user]);

  if (loading || !isModerator) {
    return null;
  }

  return (
    <Badge 
      variant="outline" 
      className={`bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 flex items-center gap-1 ${className}`}
    >
      <Shield className="h-3 w-3" />
      <span>Moderator</span>
    </Badge>
  );
};