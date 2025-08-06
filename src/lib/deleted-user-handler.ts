import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ref, get } from 'firebase/database';

// Cache for deleted user status to avoid repeated checks
const deletedUserCache: Record<string, {
  isDeleted: boolean;
  lastUsername: string | null;
  timestamp: number;
}> = {};

// Cache expiration time (30 minutes)
const CACHE_EXPIRATION = 30 * 60 * 1000;

export interface UserDisplayInfo {
  displayName: string;
  isDeleted: boolean;
  canLinkToProfile: boolean;
  avatarUrl?: string | null;
}

/**
 * Check if a user account has been deleted and get their last known username
 * @param userId - The user ID to check
 * @returns Promise<{isDeleted: boolean, lastUsername: string | null}>
 */
export async function checkUserDeletionStatus(userId: string): Promise<{
  isDeleted: boolean;
  lastUsername: string | null;
}> {
  if (!userId || userId === 'none') {
    return { isDeleted: true, lastUsername: null };
  }

  // Check cache first
  const cached = deletedUserCache[userId];
  if (cached && Date.now() - cached.timestamp < CACHE_EXPIRATION) {
    return {
      isDeleted: cached.isDeleted,
      lastUsername: cached.lastUsername
    };
  }

  try {
    const { db, database } = getFirebaseServices();
    
    // First check Firestore for current user data
    let userData = null;
    let lastUsername = null;
    
    if (db) {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          userData = userDoc.data();
          lastUsername = userData.displayName || userData.username || 
                        (userData.email ? userData.email.split('@')[0] : null);
        }
      } catch (firestoreError) {
        console.warn('Error checking Firestore for user:', userId, firestoreError);
      }
    }

    // If no current data found, check if we have historical username data
    if (!userData && database) {
      try {
        // Check for stored username in a historical record
        const historicalRef = ref(database, `usernames/${userId}`);
        const historicalSnapshot = await get(historicalRef);
        
        if (historicalSnapshot.exists()) {
          const historicalData = historicalSnapshot.val();
          lastUsername = historicalData.username || historicalData.displayName;
        }
        
        // Also check the main users path in Realtime Database
        if (!lastUsername) {
          const userRef = ref(database, `users/${userId}`);
          const userSnapshot = await get(userRef);
          
          if (userSnapshot.exists()) {
            const rtdbUserData = userSnapshot.val();
            lastUsername = rtdbUserData.displayName || rtdbUserData.username || 
                          (rtdbUserData.email ? rtdbUserData.email.split('@')[0] : null);
          }
        }
      } catch (dbError) {
        console.warn('Error checking Realtime Database for user:', userId, dbError);
      }
    }

    const isDeleted = !userData;
    
    // Cache the result
    deletedUserCache[userId] = {
      isDeleted,
      lastUsername,
      timestamp: Date.now()
    };

    return { isDeleted, lastUsername };
  } catch (error) {
    console.error('Error checking user deletion status:', error);
    
    // On error, assume user exists to avoid false positives
    const result = { isDeleted: false, lastUsername: null };
    
    // Cache the error result for a shorter time
    deletedUserCache[userId] = {
      isDeleted: false,
      lastUsername: null,
      timestamp: Date.now() - (CACHE_EXPIRATION / 2) // Expire in 15 minutes
    };
    
    return result;
  }
}

/**
 * Get appropriate display information for a user, handling deleted accounts gracefully
 * @param userId - The user ID
 * @param storedUsername - Any username stored with the content (e.g., in reviews)
 * @param currentUserData - Current user data if already fetched
 * @returns Promise<UserDisplayInfo>
 */
export async function getUserDisplayInfo(
  userId: string,
  storedUsername?: string,
  currentUserData?: any
): Promise<UserDisplayInfo> {
  if (!userId || userId === 'none') {
    return {
      displayName: 'Unknown User',
      isDeleted: true,
      canLinkToProfile: false
    };
  }

  // If we have current user data, use it
  if (currentUserData && (currentUserData.username || currentUserData.displayName || currentUserData.email)) {
    const displayName = currentUserData.displayName || 
                       currentUserData.username || 
                       (currentUserData.email ? currentUserData.email.split('@')[0] : 'Unknown User');
    
    return {
      displayName,
      isDeleted: false,
      canLinkToProfile: true,
      avatarUrl: currentUserData.avatarUrl || currentUserData.photoURL
    };
  }

  // Check deletion status
  const { isDeleted, lastUsername } = await checkUserDeletionStatus(userId);

  if (isDeleted) {
    // For deleted users, show a user-friendly message instead of exposing the user ID
    let displayName = 'Deleted User';
    
    // If we have a stored username from when the content was created, we could show it
    // but for privacy/security, it's better to just show "Deleted User"
    // Uncomment the line below if you want to show the last known username
    // if (storedUsername && !storedUsername.startsWith('User ')) {
    //   displayName = `${storedUsername} (Deleted)`;
    // }

    return {
      displayName,
      isDeleted: true,
      canLinkToProfile: false
    };
  }

  // User exists but we don't have current data - use stored username or fallback
  const displayName = storedUsername || lastUsername || `User ${userId.substring(0, 8)}`;
  
  return {
    displayName,
    isDeleted: false,
    canLinkToProfile: !displayName.startsWith('User '),
    avatarUrl: null
  };
}

/**
 * Store username for historical reference when content is created
 * This helps us show better information for deleted users in the future
 * @param userId - The user ID
 * @param username - The username to store
 */
export async function storeUsernameForHistory(userId: string, username: string): Promise<void> {
  if (!userId || !username || username.startsWith('User ')) {
    return;
  }

  try {
    const { database } = getFirebaseServices();
    if (!database) return;

    const usernameRef = ref(database, `usernames/${userId}`);
    await import('firebase/database').then(({ set }) => 
      set(usernameRef, {
        username,
        lastUpdated: Date.now()
      })
    );
  } catch (error) {
    console.warn('Error storing username for history:', error);
    // Don't throw - this is not critical functionality
  }
}

/**
 * Clear the deleted user cache for a specific user (useful after unblocking or account restoration)
 * @param userId - The user ID to clear from cache
 */
export function clearDeletedUserCache(userId: string): void {
  delete deletedUserCache[userId];
}

/**
 * Clear all deleted user cache (useful for debugging or after major changes)
 */
export function clearAllDeletedUserCache(): void {
  Object.keys(deletedUserCache).forEach(key => {
    delete deletedUserCache[key];
  });
}