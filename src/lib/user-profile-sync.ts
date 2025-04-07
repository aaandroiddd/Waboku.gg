import { getFirebaseServices } from '@/lib/firebase';
import { ref, set, update, get } from 'firebase/database';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';

/**
 * Synchronizes user profile data between Firestore and Realtime Database
 * This ensures fast access to basic user information across the application
 * 
 * @param userId - The user's unique identifier
 * @param displayName - The user's display name
 * @param avatarUrl - The user's avatar URL (optional)
 * @returns Promise that resolves when sync is complete
 */
export const syncUserProfile = async (
  userId: string, 
  displayName: string, 
  avatarUrl?: string | null
): Promise<void> => {
  console.log(`[UserProfileSync] Syncing profile for user: ${userId}`);
  
  const { database } = getFirebaseServices();
  if (!database) {
    console.error('[UserProfileSync] Realtime Database not available');
    return;
  }
  
  try {
    // Store basic user info in RTDB for fast access
    const userRef = ref(database, `userProfiles/${userId}`);
    await set(userRef, {
      displayName,
      avatarUrl: avatarUrl || null,
      lastUpdated: Date.now()
    });
    
    console.log(`[UserProfileSync] Successfully synced profile for user: ${userId}`);
  } catch (error) {
    console.error(`[UserProfileSync] Error syncing profile for user ${userId}:`, error);
    throw error; // Re-throw to allow calling code to handle the error
  }
};

/**
 * Updates a user's profile in Firestore and syncs the data to Realtime Database
 * 
 * @param userId - The user's unique identifier
 * @param profileData - Object containing profile data to update
 * @returns Promise that resolves when update is complete
 */
export const updateUserProfile = async (
  userId: string, 
  profileData: { displayName?: string; avatarUrl?: string | null; [key: string]: any }
): Promise<void> => {
  console.log(`[UserProfileSync] Updating profile for user: ${userId}`, profileData);
  
  const { db } = getFirebaseServices();
  if (!db) {
    console.error('[UserProfileSync] Firestore not available');
    return;
  }
  
  try {
    // Update the Firestore document
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, profileData);
    
    // If displayName is being updated, sync to RTDB
    if (profileData.displayName) {
      await syncUserProfile(
        userId, 
        profileData.displayName, 
        profileData.avatarUrl !== undefined ? profileData.avatarUrl : null
      );
    }
    
    console.log(`[UserProfileSync] Successfully updated profile for user: ${userId}`);
  } catch (error) {
    console.error(`[UserProfileSync] Error updating profile for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Migrates all user profiles from Firestore to Realtime Database
 * This should be run once to populate the RTDB with existing user data
 * 
 * @returns Promise that resolves when migration is complete
 */
export const migrateUserProfiles = async (): Promise<void> => {
  console.log('[UserProfileSync] Starting user profile migration');
  
  const { db, database } = getFirebaseServices();
  if (!db || !database) {
    console.error('[UserProfileSync] Firebase services not available');
    return;
  }
  
  try {
    // Get all users from Firestore
    const usersSnapshot = await getDocs(collection(db, 'users'));
    
    if (usersSnapshot.empty) {
      console.log('[UserProfileSync] No users found in Firestore');
      return;
    }
    
    console.log(`[UserProfileSync] Found ${usersSnapshot.size} users to migrate`);
    
    const updates: Record<string, any> = {};
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.displayName) {
        updates[`userProfiles/${doc.id}`] = {
          displayName: userData.displayName,
          avatarUrl: userData.avatarUrl || userData.photoURL || null,
          lastUpdated: Date.now()
        };
      }
    });
    
    // Apply all updates at once for better performance
    if (Object.keys(updates).length > 0) {
      console.log(`[UserProfileSync] Applying batch update for ${Object.keys(updates).length} users`);
      await update(ref(database), updates);
      console.log('[UserProfileSync] Migration completed successfully');
    } else {
      console.log('[UserProfileSync] No users with display names found to migrate');
    }
  } catch (error) {
    console.error('[UserProfileSync] Error during user profile migration:', error);
    throw error;
  }
};

/**
 * Updates chat participant names in the Realtime Database
 * This ensures chat UI can display user names without additional lookups
 * 
 * @returns Promise that resolves when update is complete
 */
export const updateChatsWithUsernames = async (): Promise<void> => {
  console.log('[UserProfileSync] Starting chat participant names update');
  
  const { db, database } = getFirebaseServices();
  if (!db || !database) {
    console.error('[UserProfileSync] Firebase services not available');
    return;
  }
  
  try {
    // Get all chats from Realtime Database
    const chatsSnapshot = await get(ref(database, 'chats'));
    if (!chatsSnapshot.exists()) {
      console.log('[UserProfileSync] No chats found in Realtime Database');
      return;
    }
    
    const chats = chatsSnapshot.val();
    const updates: Record<string, any> = {};
    
    for (const [chatId, chat] of Object.entries(chats)) {
      // Skip if chat doesn't have participants or already has participant names
      if (!chat.participants || chat.participantNames) {
        continue;
      }
      
      const participantNames: Record<string, string> = {};
      
      for (const userId of Object.keys(chat.participants)) {
        // First try to get from Realtime Database (faster)
        const userProfileSnapshot = await get(ref(database, `userProfiles/${userId}`));
        
        if (userProfileSnapshot.exists()) {
          const userProfile = userProfileSnapshot.val();
          participantNames[userId] = userProfile.displayName || `User ${userId.substring(0, 6)}`;
        } else {
          // Fall back to Firestore
          const userDoc = await getDoc(doc(db, 'users', userId));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            participantNames[userId] = userData.displayName || `User ${userId.substring(0, 6)}`;
            
            // Also sync this user to RTDB for future lookups
            await syncUserProfile(
              userId, 
              userData.displayName || `User ${userId.substring(0, 6)}`,
              userData.avatarUrl || userData.photoURL || null
            );
          } else {
            participantNames[userId] = `User ${userId.substring(0, 6)}`;
          }
        }
      }
      
      updates[`chats/${chatId}/participantNames`] = participantNames;
    }
    
    // Apply all updates at once
    if (Object.keys(updates).length > 0) {
      console.log(`[UserProfileSync] Updating participant names for ${Object.keys(updates).length} chats`);
      await update(ref(database), updates);
      console.log('[UserProfileSync] Chat participant names updated successfully');
    } else {
      console.log('[UserProfileSync] No chats need participant names update');
    }
  } catch (error) {
    console.error('[UserProfileSync] Error updating chat participant names:', error);
    throw error;
  }
};