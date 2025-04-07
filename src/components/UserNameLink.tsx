import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getDatabase, ref, get, onValue } from 'firebase/database';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
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
  const isMounted = useRef<boolean>(true);
  
  // Function to fetch user profile from Realtime Database first, then fallback to Firestore
  const fetchUserProfile = async () => {
    if (!userId || fetchAttempted.current) return;
    
    console.log(`[UserNameLink] Starting fetch for user: ${userId}`);
    fetchAttempted.current = true;
    setLoading(true);
    setError(false);
    
    try {
      // Set a timeout to prevent hanging forever
      timeoutRef.current = setTimeout(() => {
        if (loading && !username && isMounted.current) {
          console.log(`[UserNameLink] Fetch timeout for user: ${userId}`);
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
        console.log(`[UserNameLink] Using cached data for user: ${userId}`, profileCache[userId].data);
        setUsername(profileCache[userId].data.username);
        setLoading(false);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        
        // Even if we have a cached value, we'll do a background refresh 
        // to ensure we have the latest displayName (but we won't wait for it)
        setTimeout(() => {
          if (!isMounted.current) return;
          
          // This runs after returning the cached value to keep the UI responsive
          getDoc(doc(db, 'users', userId)).then(userDoc => {
            if (userDoc.exists()) {
              const userData = userDoc.data();
              const latestDisplayName = userData.displayName || userData.username || null;
              
              // If the display name has changed, update the cache and UI
              if (latestDisplayName && latestDisplayName !== profileCache[userId].data.username) {
                console.log(`[UserNameLink] Background refresh: Display name changed for ${userId}`, {
                  cached: profileCache[userId].data.username,
                  latest: latestDisplayName
                });
                
                // Update cache
                profileCache[userId] = {
                  data: { 
                    username: latestDisplayName, 
                    avatarUrl: userData.avatarUrl || userData.photoURL || null 
                  },
                  timestamp: Date.now()
                };
                
                // Update UI if component is still mounted
                if (isMounted.current) {
                  setUsername(latestDisplayName);
                }
              }
            }
          }).catch(err => {
            // Silent fail for background refresh
            console.error('[UserNameLink] Background refresh error:', err);
          });
        }, 100);
        
        return;
      }
      
      // Try to get from Realtime Database first
      const { database } = getFirebaseServices();
      let displayNameFound = false;
      
      if (database) {
        // Try multiple paths where user data might be stored
        const paths = [
          `users/${userId}`,
          `userProfiles/${userId}`,
          `profiles/${userId}`,
          `userData/${userId}`
        ];
        
        console.log(`[UserNameLink] Checking Realtime DB paths for user: ${userId}`);
        
        for (const path of paths) {
          try {
            const userRef = ref(database, path);
            const snapshot = await get(userRef);
            
            if (snapshot.exists()) {
              const userData = snapshot.val();
              
              // Explicitly prioritize displayName from Realtime Database
              const displayName = userData.displayName || userData.username || userData.name || null;
              
              console.log(`[UserNameLink] Realtime DB data for ${userId} at ${path}:`, { 
                displayName: userData.displayName,
                username: userData.username,
                name: userData.name,
                resolved: displayName 
              });
              
              if (displayName) {
                // Update cache
                profileCache[userId] = {
                  data: { 
                    username: displayName, 
                    avatarUrl: userData.avatarUrl || userData.photoURL || null 
                  },
                  timestamp: Date.now()
                };
                
                if (isMounted.current) {
                  setUsername(displayName);
                  setLoading(false);
                  displayNameFound = true;
                }
                
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                break;
              }
            }
          } catch (pathError) {
            console.error(`[UserNameLink] Error checking path ${path}:`, pathError);
            // Continue to next path
          }
        }
        
        // If we found a display name in Realtime DB, we can return early
        if (displayNameFound) return;
        
        // Try listening for real-time updates as a last resort for Realtime DB
        try {
          console.log(`[UserNameLink] Setting up real-time listener for user: ${userId}`);
          const userRef = ref(database, `users/${userId}`);
          
          // Set up a one-time listener with a short timeout
          const unsubscribe = onValue(userRef, (snapshot) => {
            if (snapshot.exists()) {
              const userData = snapshot.val();
              const displayName = userData.displayName || userData.username || userData.name || null;
              
              console.log(`[UserNameLink] Real-time update for ${userId}:`, {
                displayName,
                userData
              });
              
              if (displayName && isMounted.current) {
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
                displayNameFound = true;
                
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
              }
              
              // Unsubscribe after getting data
              unsubscribe();
            } else {
              // Unsubscribe if no data
              unsubscribe();
            }
          }, (error) => {
            console.error(`[UserNameLink] Real-time listener error:`, error);
            unsubscribe();
          });
          
          // Set a timeout to unsubscribe if we don't get data quickly
          setTimeout(() => {
            unsubscribe();
          }, 2000);
          
          // If we found a display name from the real-time listener, return early
          if (displayNameFound) return;
        } catch (listenerError) {
          console.error(`[UserNameLink] Error setting up real-time listener:`, listenerError);
        }
      } else {
        console.log(`[UserNameLink] Realtime Database not available for user: ${userId}`);
      }
      
      // If not found in Realtime Database, try Firestore
      try {
        console.log(`[UserNameLink] Checking Firestore for user: ${userId}`);
        
        // Try multiple collections where user data might be stored
        const collections = ['users', 'profiles', 'userProfiles'];
        let firestoreDisplayNameFound = false;
        
        for (const collection of collections) {
          if (firestoreDisplayNameFound) break;
          
          try {
            const userDoc = await getDoc(doc(db, collection, userId));
            
            if (userDoc.exists()) {
              const userData = userDoc.data();
              
              // Explicitly prioritize displayName from Firestore
              const displayName = userData.displayName || userData.username || userData.name || null;
              
              console.log(`[UserNameLink] Firestore data for ${userId} in ${collection}:`, { 
                displayName: userData.displayName,
                username: userData.username,
                name: userData.name,
                resolved: displayName 
              });
              
              if (displayName) {
                // Update cache
                profileCache[userId] = {
                  data: { 
                    username: displayName, 
                    avatarUrl: userData.avatarUrl || userData.photoURL || null 
                  },
                  timestamp: Date.now()
                };
                
                if (isMounted.current) {
                  setUsername(displayName);
                  setLoading(false);
                  firestoreDisplayNameFound = true;
                }
                
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                break;
              }
            }
          } catch (collectionError) {
            console.error(`[UserNameLink] Error checking collection ${collection}:`, collectionError);
            // Continue to next collection
          }
        }
        
        // If we found a display name in Firestore, we can return
        if (firestoreDisplayNameFound) return;
        
        // If we get here, we didn't find a display name in any collection
        console.log(`[UserNameLink] No display name found in Firestore for ${userId}`);
        
        // Fall back to initialUsername or "Unknown User"
        if (initialUsername) {
          console.log(`[UserNameLink] Using initialUsername for ${userId}: ${initialUsername}`);
          if (isMounted.current) {
            setUsername(initialUsername);
            setError(false);
          }
        } else {
          console.log(`[UserNameLink] Using fallback "Unknown User" for ${userId}`);
          if (isMounted.current) {
            setUsername('Unknown User');
            setError(true);
          }
        }
      } catch (firestoreError) {
        console.error('[UserNameLink] Firestore fetch failed:', firestoreError);
        // If Firestore fails but we had an initialUsername, use that
        if (initialUsername) {
          if (isMounted.current) {
            setUsername(initialUsername);
            setError(false);
          }
        } else {
          if (isMounted.current) {
            setUsername('Unknown User');
            setError(true);
          }
        }
      }
    } catch (err) {
      console.error(`[UserNameLink] Error fetching user profile for ${userId}:`, err);
      // If any error occurs but we had an initialUsername, use that
      if (initialUsername) {
        if (isMounted.current) {
          setUsername(initialUsername);
          setError(false);
        }
      } else {
        if (isMounted.current) {
          setUsername('Unknown User');
          setError(true);
        }
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  };
  
  useEffect(() => {
    // If the userId changes or we don't have a username, fetch the profile
    if (userId && !username && !fetchAttempted.current) {
      console.log(`[UserNameLink] Triggering fetch for user: ${userId}`);
      fetchUserProfile();
    }
    
    // Clean up on unmount
    return () => {
      isMounted.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [userId, username]);
  
  // If initialUsername changes, update the state
  useEffect(() => {
    if (initialUsername && !username) {
      console.log(`[UserNameLink] Using initialUsername: ${initialUsername}`);
      setUsername(initialUsername);
      setLoading(false);
    }
  }, [initialUsername, username]);
  
  // Reset fetch attempted flag when userId changes
  useEffect(() => {
    fetchAttempted.current = false;
    isMounted.current = true;
    
    // Force a re-fetch when userId changes
    if (userId) {
      console.log(`[UserNameLink] UserId changed, resetting fetch state: ${userId}`);
      setLoading(true);
      setError(false);
      setUsername(initialUsername || null);
      fetchUserProfile();
    }
    
    return () => {
      isMounted.current = false;
    };
  }, [userId]);
  
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