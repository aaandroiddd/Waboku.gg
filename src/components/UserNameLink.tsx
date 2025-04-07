import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getDatabase, ref, get } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { db, getFirebaseServices } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';

interface UserNameLinkProps {
  userId: string;
  initialUsername?: string;
  className?: string;
  showProfileOnClick?: boolean;
}

// Cache for storing user profile data
const profileCache: Record<string, {
  data: { username: string; avatarUrl: string | null };
  timestamp: number;
}> = {};

const CACHE_EXPIRATION = 5 * 60 * 1000; // 5 minutes

export function UserNameLink({ 
  userId, 
  initialUsername, 
  className = "", 
  showProfileOnClick = true 
}: UserNameLinkProps) {
  const [username, setUsername] = useState<string | null>(initialUsername || null);
  const [loading, setLoading] = useState<boolean>(!initialUsername);
  const [error, setError] = useState<boolean>(false);
  const fetchAttempted = useRef<boolean>(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Function to fetch user profile from Realtime Database first, then fallback to Firestore
  const fetchUserProfile = async () => {
    if (!userId || fetchAttempted.current) return;
    
    fetchAttempted.current = true;
    setLoading(true);
    setError(false);
    
    try {
      // Set a timeout to prevent hanging forever
      timeoutRef.current = setTimeout(() => {
        if (loading && !username) {
          setLoading(false);
          setError(true);
          
          // If we have initialUsername, fall back to it
          if (initialUsername) {
            setUsername(initialUsername);
          } else {
            setUsername('Unknown User');
          }
        }
      }, 5000); // 5 second timeout
      
      // Check cache first
      if (profileCache[userId] && Date.now() - profileCache[userId].timestamp < CACHE_EXPIRATION) {
        setUsername(profileCache[userId].data.username);
        setLoading(false);
        clearTimeout(timeoutRef.current);
        return;
      }
      
      // Try to get from Realtime Database first
      const { database } = getFirebaseServices();
      
      if (database) {
        // Try multiple paths where user data might be stored
        const paths = [
          `users/${userId}`,
          `userProfiles/${userId}`
        ];
        
        for (const path of paths) {
          const userRef = ref(database, path);
          const snapshot = await get(userRef);
          
          if (snapshot.exists()) {
            const userData = snapshot.val();
            const displayName = userData.displayName || userData.username || null;
            
            if (displayName) {
              // Update cache
              profileCache[userId] = {
                data: { 
                  username: displayName, 
                  avatarUrl: userData.avatarUrl || userData.photoURL || null 
                },
                timestamp: Date.now()
              };
              
              setUsername(displayName);
              setLoading(false);
              clearTimeout(timeoutRef.current);
              return;
            }
          }
        }
      }
      
      // If not found in Realtime Database, try Firestore
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const displayName = userData.displayName || userData.username || 'Unknown User';
          
          // Update cache
          profileCache[userId] = {
            data: { 
              username: displayName, 
              avatarUrl: userData.avatarUrl || userData.photoURL || null 
            },
            timestamp: Date.now()
          };
          
          setUsername(displayName);
        } else {
          // If no data found, fall back to initialUsername or "Unknown User"
          setUsername(initialUsername || 'Unknown User');
          setError(!initialUsername);
        }
      } catch (firestoreError) {
        console.error('Firestore fetch failed:', firestoreError);
        // If Firestore fails but we had an initialUsername, use that
        if (initialUsername) {
          setUsername(initialUsername);
        } else {
          setUsername('Unknown User');
          setError(true);
        }
      }
    } catch (err) {
      console.error(`Error fetching user profile for ${userId}:`, err);
      // If any error occurs but we had an initialUsername, use that
      if (initialUsername) {
        setUsername(initialUsername);
      } else {
        setUsername('Unknown User');
        setError(true);
      }
    } finally {
      setLoading(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  };
  
  useEffect(() => {
    // If the userId changes or we don't have a username, fetch the profile
    if (userId && !username && !fetchAttempted.current) {
      fetchUserProfile();
    }
    
    // Clean up timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [userId, username]);
  
  // If initialUsername changes, update the state
  useEffect(() => {
    if (initialUsername && !username) {
      setUsername(initialUsername);
      setLoading(false);
    }
  }, [initialUsername, username]);
  
  if (loading) {
    return <Skeleton className="h-4 w-24 inline-block" />;
  }
  
  if (error || !username) {
    // Show the userId partially masked if we can't get the username
    const maskedId = userId 
      ? userId.substring(0, 4) + '...' + userId.substring(userId.length - 4) 
      : 'Unknown';
    
    return (
      <span className={`text-muted-foreground ${className}`} title={`User ID: ${userId}`}>
        User {maskedId}
      </span>
    );
  }
  
  // If showProfileOnClick is true, link to the user's profile page
  if (showProfileOnClick) {
    return (
      <Link href={`/profile/${userId}`} className={`font-medium hover:underline ${className}`}>
        {username}
      </Link>
    );
  }
  
  // Otherwise just show the username as text
  return <span className={`font-medium ${className}`}>{username}</span>;
}