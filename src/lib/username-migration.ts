import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';

interface ListingWithUserData {
  id: string;
  userId: string;
  username: string;
  actualUsername?: string;
}

/**
 * Utility function to check if a string looks like a user ID
 * User IDs are typically alphanumeric strings that don't look like usernames
 */
export function looksLikeUserId(str: string): boolean {
  if (!str) return false;
  
  // Check if it starts with common user ID patterns
  if (str.startsWith('User ') && str.length < 15) return true;
  
  // Check if it's a long alphanumeric string (typical Firebase UID)
  if (str.length > 20 && /^[a-zA-Z0-9]+$/.test(str)) return true;
  
  // Check if it contains no spaces and is all lowercase/uppercase (typical UID pattern)
  if (str.length > 15 && !/\s/.test(str) && (/^[a-z0-9]+$/.test(str) || /^[A-Z0-9]+$/.test(str))) return true;
  
  return false;
}

/**
 * Get the actual username for a user ID from Firestore
 */
export async function getActualUsername(userId: string): Promise<string> {
  try {
    const { db } = await getFirebaseServices();
    if (!db) throw new Error('Firebase not initialized');
    
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.displayName || userData.username || `User ${userId.substring(0, 8)}`;
    }
    
    return `User ${userId.substring(0, 8)}`;
  } catch (error) {
    console.error('Error fetching username for user:', userId, error);
    return `User ${userId.substring(0, 8)}`;
  }
}

/**
 * Check and fix listings that have user IDs in the username field
 */
export async function checkAndFixListingUsernames(limit: number = 50): Promise<{
  checked: number;
  fixed: number;
  errors: string[];
}> {
  const results = {
    checked: 0,
    fixed: 0,
    errors: [] as string[]
  };
  
  try {
    const { db } = await getFirebaseServices();
    if (!db) throw new Error('Firebase not initialized');
    
    // Get active listings
    const listingsRef = collection(db, 'listings');
    const q = query(
      listingsRef,
      where('status', '==', 'active')
    );
    
    const querySnapshot = await getDocs(q);
    console.log(`Found ${querySnapshot.docs.length} active listings to check`);
    
    const listingsToFix: ListingWithUserData[] = [];
    
    // Check each listing
    for (const docSnapshot of querySnapshot.docs.slice(0, limit)) {
      results.checked++;
      const data = docSnapshot.data();
      const listing: ListingWithUserData = {
        id: docSnapshot.id,
        userId: data.userId,
        username: data.username || ''
      };
      
      // Check if the username looks like a user ID
      if (looksLikeUserId(listing.username)) {
        console.log(`Listing ${listing.id} has user ID in username field: "${listing.username}"`);
        
        // Get the actual username
        const actualUsername = await getActualUsername(listing.userId);
        listing.actualUsername = actualUsername;
        listingsToFix.push(listing);
      }
    }
    
    console.log(`Found ${listingsToFix.length} listings that need username fixes`);
    
    // Fix the listings
    for (const listing of listingsToFix) {
      try {
        const listingRef = doc(db, 'listings', listing.id);
        await updateDoc(listingRef, {
          username: listing.actualUsername,
          updatedAt: new Date()
        });
        
        console.log(`Fixed listing ${listing.id}: "${listing.username}" -> "${listing.actualUsername}"`);
        results.fixed++;
      } catch (error) {
        const errorMsg = `Failed to fix listing ${listing.id}: ${error}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
      }
    }
    
    return results;
  } catch (error) {
    const errorMsg = `Error in checkAndFixListingUsernames: ${error}`;
    console.error(errorMsg);
    results.errors.push(errorMsg);
    return results;
  }
}

/**
 * Batch fix usernames for a specific set of listing IDs
 */
export async function fixSpecificListingUsernames(listingIds: string[]): Promise<{
  fixed: number;
  errors: string[];
}> {
  const results = {
    fixed: 0,
    errors: [] as string[]
  };
  
  try {
    const { db } = await getFirebaseServices();
    if (!db) throw new Error('Firebase not initialized');
    
    for (const listingId of listingIds) {
      try {
        const listingRef = doc(db, 'listings', listingId);
        const listingDoc = await getDoc(listingRef);
        
        if (!listingDoc.exists()) {
          results.errors.push(`Listing ${listingId} not found`);
          continue;
        }
        
        const data = listingDoc.data();
        const currentUsername = data.username || '';
        
        if (looksLikeUserId(currentUsername)) {
          const actualUsername = await getActualUsername(data.userId);
          
          await updateDoc(listingRef, {
            username: actualUsername,
            updatedAt: new Date()
          });
          
          console.log(`Fixed listing ${listingId}: "${currentUsername}" -> "${actualUsername}"`);
          results.fixed++;
        }
      } catch (error) {
        const errorMsg = `Failed to fix listing ${listingId}: ${error}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
      }
    }
    
    return results;
  } catch (error) {
    const errorMsg = `Error in fixSpecificListingUsernames: ${error}`;
    console.error(errorMsg);
    results.errors.push(errorMsg);
    return results;
  }
}

/**
 * Get a sample of listings with their username status for debugging
 */
export async function getListingUsernameSample(limit: number = 10): Promise<{
  id: string;
  userId: string;
  username: string;
  looksLikeUserId: boolean;
  actualUsername?: string;
}[]> {
  try {
    const { db } = await getFirebaseServices();
    if (!db) throw new Error('Firebase not initialized');
    
    const listingsRef = collection(db, 'listings');
    const q = query(
      listingsRef,
      where('status', '==', 'active')
    );
    
    const querySnapshot = await getDocs(q);
    const sample = [];
    
    for (const docSnapshot of querySnapshot.docs.slice(0, limit)) {
      const data = docSnapshot.data();
      const username = data.username || '';
      const isUserId = looksLikeUserId(username);
      
      const item: any = {
        id: docSnapshot.id,
        userId: data.userId,
        username: username,
        looksLikeUserId: isUserId
      };
      
      if (isUserId) {
        item.actualUsername = await getActualUsername(data.userId);
      }
      
      sample.push(item);
    }
    
    return sample;
  } catch (error) {
    console.error('Error getting listing username sample:', error);
    return [];
  }
}