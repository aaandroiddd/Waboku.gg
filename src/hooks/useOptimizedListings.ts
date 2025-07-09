import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  QueryConstraint, 
  addDoc, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getFirebaseServices, registerListener, removeListener } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useClientCache } from './useClientCache';
import { ACCOUNT_TIERS } from '@/types/account';

// Game name mappings for consistent filtering
const GAME_NAME_MAPPING: { [key: string]: string[] } = {
  'pokemon': ['pokemon'],
  'mtg': ['magic: the gathering', 'mtg'],
  'yugioh': ['yu-gi-oh!', 'yugioh'],
  'onepiece': ['one piece card game', 'onepiece'],
  'lorcana': ['disney lorcana', 'lorcana'],
  'digimon': ['digimon'],
  'dbs': ['dragon ball super card game', 'dbs'],
  'flesh-and-blood': ['flesh and blood'],
  'star-wars': ['star wars: unlimited'],
  'union-arena': ['union arena'],
  'universus': ['universus'],
  'vanguard': ['vanguard'],
  'weiss': ['weiss schwarz'],
  'accessories': ['accessories', 'tcg accessories']
};

interface UseListingsProps {
  userId?: string;
  searchQuery?: string;
  showOnlyActive?: boolean;
  skipInitialFetch?: boolean;
}

export function useOptimizedListings({ userId, searchQuery, showOnlyActive = false, skipInitialFetch = false }: UseListingsProps = {}) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const listenerRef = useRef<Unsubscribe | null>(null);
  const componentId = useRef(`listings-${userId || 'all'}-${Date.now()}`).current;

  // Create a cache key based on the current options
  const cacheKey = `listings_${userId || 'all'}_${showOnlyActive ? 'active' : 'all'}_${searchQuery || 'none'}`;
  
  // Initialize client cache outside of useEffect
  const { getFromCache, saveToCache } = useClientCache<Listing[]>({
    key: cacheKey,
    expirationMinutes: 5 // Cache expires after 5 minutes
  });

  // Function to clear all listing-related caches
  const clearAllListingCaches = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const cacheKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('listings_')
      );
      
      for (const key of cacheKeys) {
        localStorage.removeItem(key);
        console.log(`Cleared cache: ${key}`);
      }
      
      console.log('Cleared all listing caches');
    } catch (error) {
      console.error('Error clearing listing caches:', error);
    }
  }, []);

  // Setup the Firestore listener
  useEffect(() => {
    // Don't set up listener if we don't have a userId for user-specific queries
    if (userId === undefined) {
      console.log('useOptimizedListings: Waiting for userId to be defined before setting up listener');
      setIsLoading(true);
      return;
    }

    // Check if we have cached data first
    const { data: cachedListings, expired } = getFromCache();
    
    if (cachedListings && !expired && !skipInitialFetch) {
      console.log(`Using cached listings data (${cachedListings.length} items) while setting up listener`);
      // Set listings from cache immediately to improve perceived performance
      setListings(cachedListings);
      setIsLoading(false);
    }

    // Skip setting up listener if we're supposed to skip initial fetch
    if (skipInitialFetch) {
      console.log('Skipping initial fetch as requested');
      if (!cachedListings) {
        setIsLoading(false);
      }
      return;
    }

    const setupListener = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log(`useOptimizedListings: Setting up Firestore listener for userId: ${userId}`);
        
        const { db } = await getFirebaseServices();
        if (!db) {
          throw new Error('Firebase Firestore is not initialized');
        }
        
        const listingsRef = collection(db, 'listings');
        
        // Create base query for listings
        let queryConstraints: QueryConstraint[] = [];

        // Add user filter if userId is provided
        if (userId) {
          queryConstraints.push(where('userId', '==', userId));
        }

        // Add status filters
        if (showOnlyActive) {
          queryConstraints.push(where('status', '==', 'active'));
        } else if (userId) {
          queryConstraints.push(where('status', 'in', ['active', 'archived', 'inactive']));
        } else {
          queryConstraints.push(where('status', '==', 'active'));
        }

        // Always add sorting by creation date
        queryConstraints.push(orderBy('createdAt', 'desc'));

        console.log(`Creating query with constraints: userId=${userId}, showOnlyActive=${showOnlyActive}`);
        const q = query(listingsRef, ...queryConstraints);
        
        // Clean up any existing listener
        if (listenerRef.current) {
          console.log('Cleaning up existing listener');
          listenerRef.current();
          listenerRef.current = null;
        }
        
        // Register a new listener with the centralized system
        const listenerId = `${componentId}-listings`;
        
        // Set up the listener
        listenerRef.current = registerListener(
          listenerId,
          q,
          (snapshot) => {
            console.log(`Received snapshot with ${snapshot.docs.length} listings for user ${userId || 'unknown'}`);
            
            const fetchedListings = snapshot.docs.map(doc => {
              const data = doc.data();
              console.log(`Processing listing ${doc.id}: status=${data.status}, title=${data.title}`);
              
              // Create a default expiration date if none exists
              let expiresAt;
              try {
                if (data.expiresAt?.toDate) {
                  expiresAt = data.expiresAt.toDate();
                } else if (data.expiresAt) {
                  expiresAt = new Date(data.expiresAt);
                } else {
                  const defaultExpiry = new Date();
                  defaultExpiry.setDate(defaultExpiry.getDate() + 30); // 30 days from now
                  expiresAt = defaultExpiry;
                }
              } catch (e) {
                console.error(`Error parsing expiresAt for listing ${doc.id}:`, e);
                const defaultExpiry = new Date();
                defaultExpiry.setDate(defaultExpiry.getDate() + 30);
                expiresAt = defaultExpiry;
              }
              
              // Create a default createdAt if none exists
              let createdAt;
              try {
                if (data.createdAt?.toDate) {
                  createdAt = data.createdAt.toDate();
                } else if (data.createdAt) {
                  createdAt = new Date(data.createdAt);
                } else {
                  createdAt = new Date();
                }
              } catch (e) {
                console.error(`Error parsing createdAt for listing ${doc.id}:`, e);
                createdAt = new Date();
              }
              
              // Process additional timestamps
              let archivedAt = null;
              let updatedAt = null;
              let previousExpiresAt = null;
              
              try {
                // Process archivedAt if it exists
                if (data.archivedAt?.toDate) {
                  archivedAt = data.archivedAt.toDate();
                } else if (data.archivedAt) {
                  archivedAt = new Date(data.archivedAt);
                }
                
                // Process updatedAt if it exists
                if (data.updatedAt?.toDate) {
                  updatedAt = data.updatedAt.toDate();
                } else if (data.updatedAt) {
                  updatedAt = new Date(data.updatedAt);
                }
                
                // Process previousExpiresAt if it exists
                if (data.previousExpiresAt?.toDate) {
                  previousExpiresAt = data.previousExpiresAt.toDate();
                } else if (data.previousExpiresAt) {
                  previousExpiresAt = new Date(data.previousExpiresAt);
                }
              } catch (e) {
                console.error(`Error parsing additional timestamps for listing ${doc.id}:`, e);
              }
              
              const listing = {
                id: doc.id,
                ...data,
                createdAt,
                expiresAt,
                archivedAt,
                updatedAt,
                previousExpiresAt,
                price: Number(data.price) || 0,
                imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
                isGraded: Boolean(data.isGraded),
                offersOnly: Boolean(data.offersOnly),
                gradeLevel: data.gradeLevel ? Number(data.gradeLevel) : undefined,
                status: data.status || 'active',
                condition: data.condition || 'Not specified',
                game: data.game || 'Not specified',
                city: data.city || 'Unknown',
                state: data.state || 'Unknown',
                gradingCompany: data.gradingCompany || undefined,
                distance: 0 // Default distance
              } as Listing;
              
              // Log the status for debugging
              console.log(`Listing ${doc.id} status: ${listing.status}, archivedAt: ${listing.archivedAt}`);

              return listing;
            });

            // If there's a search query, filter results in memory
            let filteredListings = fetchedListings;
            if (searchQuery?.trim()) {
              const searchLower = searchQuery.toLowerCase();
              filteredListings = fetchedListings.filter(listing => 
                listing.title?.toLowerCase().includes(searchLower)
              );
            }
            
            // Cache the results for faster loading next time
            saveToCache(filteredListings);
            console.log(`Cached ${filteredListings.length} listings for future use`);
            
            setListings(filteredListings);
            setIsLoading(false);
          },
          (error) => {
            console.error('Error in Firestore listener:', error);
            setError(error.message || 'Error fetching listings');
            setIsLoading(false);
            
            // If there was an error, try to use cached data
            const { data: cachedListings } = getFromCache();
            if (cachedListings) {
              console.log('Using cached listings after error');
              setListings(cachedListings);
            }
          }
        );
        
        console.log(`Set up Firestore listener with ID: ${listenerId}`);
      } catch (err: any) {
        console.error('Error setting up listings listener:', err);
        setError(err.message || 'Error fetching listings');
        setIsLoading(false);
        
        // If there was an error, try to use cached data
        const { data: cachedListings } = getFromCache();
        if (cachedListings) {
          console.log('Using cached listings after setup error');
          setListings(cachedListings);
        }
      }
    };

    setupListener();

    // Clean up listener when component unmounts or dependencies change
    return () => {
      if (listenerRef.current) {
        console.log('Cleaning up listings listener on unmount');
        listenerRef.current();
        listenerRef.current = null;
        
        // Also remove from the registry
        removeListener(`${componentId}-listings`);
      }
    };
  }, [userId, showOnlyActive, componentId, getFromCache, saveToCache, skipInitialFetch]);

  // CRUD operations remain the same as in the original hook
  const updateListing = async (listingId: string, updateData: Partial<Listing>) => {
    if (!user) throw new Error('Must be logged in to update a listing');

    try {
      console.log('Updating listing:', listingId, updateData);
      const { db } = await getFirebaseServices();
      const listingRef = doc(db, 'listings', listingId);
      
      // First verify the listing exists and belongs to the user
      const listingSnap = await getDoc(listingRef);
      if (!listingSnap.exists()) {
        throw new Error('Listing not found');
      }
      
      const listingData = listingSnap.data();
      if (listingData.userId !== user.uid) {
        throw new Error('You do not have permission to update this listing');
      }

      // Add updatedAt timestamp
      const dataToUpdate = {
        ...updateData,
        updatedAt: new Date()
      };
      
      // Ensure coverImageIndex is properly included if it exists in the update data
      if (typeof updateData.coverImageIndex === 'number') {
        console.log('Setting coverImageIndex in update:', updateData.coverImageIndex);
        dataToUpdate.coverImageIndex = updateData.coverImageIndex;
      }
      
      // Update the listing
      await updateDoc(listingRef, dataToUpdate);
      
      // Update local state
      setListings(prevListings => 
        prevListings.map(listing => 
          listing.id === listingId 
            ? { ...listing, ...dataToUpdate } 
            : listing
        )
      );

      return true;
    } catch (error: any) {
      console.error('Error updating listing:', error);
      throw new Error(error.message || 'Error updating listing');
    }
  };

  const permanentlyDeleteListing = async (listingId: string) => {
    if (!user) throw new Error('Must be logged in to delete a listing');

    try {
      const { db } = await getFirebaseServices();
      const listingRef = doc(db, 'listings', listingId);
      
      // First verify the listing exists and belongs to the user
      const listingSnap = await getDoc(listingRef);
      if (!listingSnap.exists()) {
        throw new Error('Listing not found');
      }
      
      const listingData = listingSnap.data();
      if (listingData.userId !== user.uid) {
        throw new Error('You do not have permission to delete this listing');
      }

      // Delete the listing
      await deleteDoc(listingRef);
      
      // Update local state
      setListings(prevListings => prevListings.filter(listing => listing.id !== listingId));

      return true;
    } catch (error: any) {
      console.error('Error deleting listing:', error);
      throw new Error(error.message || 'Error deleting listing');
    }
  };

  const updateListingStatus = async (listingId: string, status: 'active' | 'inactive' | 'archived') => {
    if (!user) throw new Error('Must be logged in to update a listing');

    try {
      const { db } = await getFirebaseServices();
      const listingRef = doc(db, 'listings', listingId);
      
      // First verify the listing exists and belongs to the user
      const listingSnap = await getDoc(listingRef);
      if (!listingSnap.exists()) {
        throw new Error('Listing not found');
      }
      
      const listingData = listingSnap.data();
      if (listingData.userId !== user.uid) {
        throw new Error('You do not have permission to update this listing');
      }

      // Prepare update data with proper validation for Firestore security rules
      const now = new Date();
      let updateData: any = {};
      
      if (status === 'archived') {
        // When archiving, set archive time and 7-day expiration
        const archiveExpiration = new Date(now);
        archiveExpiration.setDate(archiveExpiration.getDate() + 7);
        
        updateData = {
          status: 'archived',
          archivedAt: now,
          expiresAt: archiveExpiration,
          originalCreatedAt: listingData.createdAt,
          updatedAt: now,
          previousStatus: listingData.status,
          previousExpiresAt: listingData.expiresAt
        };
      } else if (status === 'active') {
        // When activating/restoring, ensure all required fields are present and properly typed
        
        // Get user data to determine account tier
        let accountTier = 'free'; // Default to free tier
        let username = user.displayName || 'Anonymous';
        
        try {
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            accountTier = userData.accountTier || 'free';
            username = userData.username || userData.displayName || user.displayName || 'Anonymous';
          }
        } catch (error) {
          console.error('Error getting user account tier:', error);
          // Continue with free tier as fallback
        }
        
        // Get the appropriate listing duration based on account tier
        const tierDuration = ACCOUNT_TIERS[accountTier as 'free' | 'premium'].listingDuration;
        
        // Calculate expiration time based on current time to give the listing a fresh duration
        // This ensures restored listings get a full listing period and don't immediately expire
        const expirationTime = new Date(now);
        expirationTime.setHours(expirationTime.getHours() + tierDuration);
        
        console.log(`Restoring listing ${listingId}:`, {
          currentTime: now.toISOString(),
          accountTier,
          tierDuration: `${tierDuration} hours`,
          newExpirationTime: expirationTime.toISOString(),
          hoursFromNow: Math.round((expirationTime.getTime() - now.getTime()) / (1000 * 60 * 60)) + ' hours'
        });
        
        // Create a clean update object with only the fields we want to update
        // This approach avoids potential field validation issues by being more selective
        updateData = {
          // Core status and timing fields
          status: 'active',
          updatedAt: now,
          expiresAt: expirationTime,
          
          // Set creation date to current time to give the listing a fresh start
          createdAt: now,
          
          // Clear archive-related fields
          archivedAt: null,
          originalCreatedAt: null,
          expirationReason: null,
          soldTo: null,
          previousStatus: null,
          previousExpiresAt: null
        };

        // Only update core fields if they need to be refreshed
        // This minimizes the risk of validation errors on existing data
        if (!listingData.userId || listingData.userId !== user.uid) {
          updateData.userId = String(user.uid);
        }
        
        if (!listingData.username || listingData.username !== username) {
          updateData.username = String(username);
        }
        
        if (!listingData.accountTier || listingData.accountTier !== accountTier) {
          updateData.accountTier = String(accountTier);
        }

        // Validate that essential fields exist in the original data
        const requiredFields = ['title', 'price', 'description', 'city', 'state', 'game', 'condition', 'imageUrls'];
        for (const field of requiredFields) {
          if (!listingData[field] && listingData[field] !== 0 && listingData[field] !== false) {
            console.error(`Missing required field in existing listing: ${field}`);
            throw new Error(`Listing is missing required field: ${field}. Cannot restore.`);
          }
        }

        // Validate field constraints on existing data
        if (typeof listingData.title !== 'string' || listingData.title.length < 3 || listingData.title.length > 100) {
          throw new Error('Listing title is invalid. Cannot restore.');
        }
        
        const price = Number(listingData.price);
        if (isNaN(price) || price < 0 || price > 50000) {
          throw new Error('Listing price is invalid. Cannot restore.');
        }
        
        if (!Array.isArray(listingData.imageUrls) || listingData.imageUrls.length === 0 || listingData.imageUrls.length > 10) {
          throw new Error('Listing images are invalid. Cannot restore.');
        }

        console.log('Validation passed for restore operation');
      } else {
        // For inactive status, keep current expiration but remove archive-related fields
        updateData = {
          status: 'inactive',
          updatedAt: now,
          archivedAt: null,
          originalCreatedAt: null
        };
      }

      console.log(`Updating listing ${listingId} status to ${status} with minimal update data:`, updateData);
      
      // Update the listing status with minimal data to avoid validation issues
      await updateDoc(listingRef, updateData);
      
      // Verify the update was successful
      const updatedSnap = await getDoc(listingRef);
      if (updatedSnap.exists()) {
        const updatedData = updatedSnap.data();
        console.log(`Listing ${listingId} updated status:`, updatedData.status);
        
        if (updatedData.status !== status) {
          console.error(`Failed to update listing status to ${status}. Current status: ${updatedData.status}`);
          throw new Error(`Failed to update listing status to ${status}`);
        }
      }
      
      // Update local state immediately with the new status
      setListings(prevListings => 
        prevListings.map(listing => 
          listing.id === listingId 
            ? { 
                ...listing, 
                ...updateData,
                createdAt: updateData.createdAt || listing.createdAt,
                expiresAt: updateData.expiresAt || listing.expiresAt,
                updatedAt: updateData.updatedAt || new Date(),
                archivedAt: updateData.archivedAt,
                soldTo: updateData.soldTo,
                status: updateData.status
              } 
            : listing
        )
      );

      // Clear any cached listings data to ensure fresh data on next load
      clearAllListingCaches();
      
      // Force a small delay to ensure Firestore has processed the update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify the update persisted by checking Firestore again
      const finalVerification = await getDoc(listingRef);
      if (finalVerification.exists()) {
        const finalData = finalVerification.data();
        console.log(`Final verification - Listing ${listingId} status: ${finalData.status}`);
        
        if (finalData.status !== status) {
          console.error(`Status mismatch after update. Expected: ${status}, Got: ${finalData.status}`);
          // Update local state again to match Firestore
          setListings(prevListings => 
            prevListings.map(listing => 
              listing.id === listingId 
                ? { ...listing, status: finalData.status }
                : listing
            )
          );
          throw new Error(`Failed to persist status change to ${status}. Current status: ${finalData.status}`);
        }
      }

      return true;
    } catch (error: any) {
      console.error('Error updating listing status:', error);
      
      // Provide more specific error messages
      if (error.message?.includes('payment')) {
        throw new Error('Security validation failed. Please try again or contact support if the issue persists.');
      } else if (error.message?.includes('permissions')) {
        throw new Error('Permission denied. Please ensure you own this listing and try again.');
      } else if (error.message?.includes('Missing or insufficient permissions')) {
        throw new Error('Database permission error. Please refresh the page and try again.');
      }
      
      throw new Error(error.message || 'Error updating listing status');
    }
  };

  const fetchListing = async (listingId: string): Promise<Listing> => {
    try {
      console.log('Fetching listing with ID:', listingId);
      
      if (!listingId || typeof listingId !== 'string' || listingId.trim() === '') {
        throw new Error('Invalid listing ID');
      }
      
      const { db } = await getFirebaseServices();
      const listingRef = doc(db, 'listings', listingId);
      console.log('Created listing reference for path:', `listings/${listingId}`);
      
      const listingSnap = await getDoc(listingRef);
      console.log('Listing document fetch result - exists:', listingSnap.exists());
      
      if (!listingSnap.exists()) {
        throw new Error('Listing not found');
      }

      const data = listingSnap.data();
      if (!data) {
        throw new Error('Listing data is empty');
      }
      
      // Process timestamps with detailed logging
      let createdAt = new Date();
      let expiresAt = new Date();
      let updatedAt = new Date();
      
      try {
        // Check if createdAt exists and is a Firestore timestamp
        if (data.createdAt && typeof data.createdAt.toDate === 'function') {
          createdAt = data.createdAt.toDate();
        } else if (data.createdAt) {
          // Handle if it's already a Date or a timestamp number
          createdAt = new Date(data.createdAt);
        }
        
        // Check if expiresAt exists and is a Firestore timestamp
        if (data.expiresAt && typeof data.expiresAt.toDate === 'function') {
          expiresAt = data.expiresAt.toDate();
        } else if (data.expiresAt) {
          // Handle if it's already a Date or a timestamp number
          expiresAt = new Date(data.expiresAt);
        } else {
          // Create a default expiration date if none exists
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now
        }
        
        // Process updatedAt if it exists
        if (data.updatedAt && typeof data.updatedAt.toDate === 'function') {
          updatedAt = data.updatedAt.toDate();
        } else if (data.updatedAt) {
          updatedAt = new Date(data.updatedAt);
        }
      } catch (timestampError) {
        console.error('Error converting timestamps:', timestampError);
        // Use current date as fallback
      }
      
      // Process numeric values
      const price = typeof data.price === 'number' 
        ? data.price 
        : (data.price ? parseFloat(String(data.price)) : 0);
        
      const quantity = typeof data.quantity === 'number' 
        ? data.quantity 
        : (data.quantity ? parseInt(String(data.quantity), 10) : 1);
        
      const gradeLevel = data.gradeLevel 
        ? (typeof data.gradeLevel === 'number' 
            ? data.gradeLevel 
            : parseFloat(String(data.gradeLevel)))
        : undefined;
      
      // Create a proper listing object with the ID
      const listing = {
        id: listingSnap.id,
        ...data,
        createdAt,
        expiresAt,
        updatedAt,
        price,
        quantity,
        gradeLevel,
        // Ensure arrays are properly handled
        imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
        // Ensure boolean values are properly typed
        isGraded: Boolean(data.isGraded),
        // Ensure numeric index is properly typed
        coverImageIndex: typeof data.coverImageIndex === 'number' ? data.coverImageIndex : 0,
        // Ensure string values have fallbacks
        status: data.status || 'active',
        condition: data.condition || 'Not specified',
        game: data.game || 'Not specified',
        city: data.city || 'Unknown',
        state: data.state || 'Unknown',
        gradingCompany: data.gradingCompany || undefined
      } as Listing;
      
      return listing;
    } catch (error: any) {
      console.error('Error fetching listing:', error);
      throw new Error(error.message || 'Error fetching listing');
    }
  };

  const createListing = async (listingData: any) => {
    if (!user) throw new Error('Must be logged in to create a listing');

    try {
      console.log('Creating new listing:', listingData);
      // First, upload images to Firebase Storage
      const imageUrls = [];
      const storage = getStorage();
      
      for (const imageFile of listingData.images) {
        try {
          // Generate a filename that matches the storage rules pattern
          const timestamp = Date.now();
          const sanitizedOriginalName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '-');
          const extension = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg';
          const fileName = `${timestamp}-${sanitizedOriginalName}`;
          
          const storageRef = ref(storage, `listings/${user.uid}/${fileName}`);
          
          // Upload the file with progress monitoring
          const uploadTask = uploadBytesResumable(storageRef, imageFile);
          
          // Monitor upload progress if callback provided
          if (listingData.onUploadProgress) {
            uploadTask.on('state_changed', (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              listingData.onUploadProgress(progress);
            });
          }

          // Wait for upload to complete
          await uploadTask;
          
          // Get the download URL
          const downloadURL = await getDownloadURL(storageRef);
          imageUrls.push(downloadURL);
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
          throw new Error('Failed to upload image. Please try again.');
        }
      }

      // Remove the File objects and progress callback from listing data
      const { images, onUploadProgress, ...cleanListingData } = listingData;

      const { db } = await getFirebaseServices();
      
      // Get user data to determine account tier
      let accountTier = 'free'; // Default to free tier
      try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          accountTier = userData.accountTier || 'free';
        }
      } catch (error) {
        console.error('Error getting user account tier:', error);
        // Continue with free tier as fallback
      }
      
      // Get the appropriate listing duration based on account tier from ACCOUNT_TIERS
      // Free tier: 48 hours, Premium tier: 720 hours (30 days)
      const tierDuration = ACCOUNT_TIERS[accountTier as 'free' | 'premium'].listingDuration;
      console.log(`Setting listing expiration based on account tier: ${accountTier}, duration: ${tierDuration} hours`);
      
      // Create the listing document with image URLs
      const listingRef = collection(db, 'listings');
      // Prepare base listing data without grading fields
      const { gradeLevel, gradingCompany, ...baseData } = cleanListingData;
      
      // Remove cardReference if it's null
      const { cardReference, ...dataWithoutCard } = baseData;
      
      // Set expiration date based on account tier
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + tierDuration);

      // Don't automatically request user's location for the listing
      let latitude = null;
      let longitude = null;

      const newListing = {
        ...dataWithoutCard,
        imageUrls,
        coverImageIndex: cleanListingData.coverImageIndex || 0,
        userId: user.uid,
        username: user.displayName || 'Anonymous',
        createdAt: new Date(),
        expiresAt, // Add expiration date based on account tier
        status: 'active',
        isGraded: Boolean(cleanListingData.isGraded),
        accountTier, // Store the account tier with the listing
        ...(cardReference ? { cardReference } : {}),
        // Add location data if available
        ...(latitude !== null && longitude !== null ? { latitude, longitude } : {}),
        // Ensure state is set even if empty for backward compatibility
        state: cleanListingData.state || ''
      };

      // Only add grading fields if the card is graded
      if (newListing.isGraded && gradeLevel && gradingCompany) {
        newListing.gradeLevel = Number(gradeLevel);
        newListing.gradingCompany = gradingCompany;
      }

      const docRef = await addDoc(listingRef, newListing);
      
      // Clear cache to ensure fresh data
      clearAllListingCaches();
      
      return { id: docRef.id, ...newListing };
    } catch (error: any) {
      console.error('Error creating listing:', error);
      throw new Error(error.message || 'Error creating listing');
    }
  };

  // Function to manually refresh listings data
  const refreshListings = useCallback(async () => {
    try {
      console.log('Manually refreshing listings data...');
      
      // Clear the cache for this specific query
      localStorage.removeItem(cacheKey);
      
      // If we have an active listener, we don't need to do anything else
      // The listener will automatically update with the latest data
      console.log('Listings will be refreshed automatically by the active listener');
      
      return listings;
    } catch (err: any) {
      console.error('Error refreshing listings:', err);
      setError(err.message || 'Error refreshing listings');
      throw err;
    }
  }, [cacheKey, listings]);

  return { 
    listings, 
    setListings, // Expose setListings to allow direct state updates
    isLoading, 
    error, 
    createListing, 
    fetchListing, 
    updateListing,
    updateListingStatus,
    permanentlyDeleteListing,
    refreshListings,
    clearAllListingCaches // Expose the cache clearing function
  };
}