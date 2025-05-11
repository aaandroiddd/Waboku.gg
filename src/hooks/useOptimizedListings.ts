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
    // Skip if we're supposed to skip initial fetch
    if (skipInitialFetch) {
      console.log('Skipping initial fetch as requested');
      setIsLoading(false);
      return;
    }

    // Check if we have cached data
    const { data: cachedListings, expired } = getFromCache();
    
    if (cachedListings && !expired) {
      console.log(`Using cached listings data (${cachedListings.length} items)`);
      // Set listings from cache immediately to improve perceived performance
      setListings(cachedListings);
      setIsLoading(false);
    }

    const setupListener = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('useOptimizedListings: Setting up Firestore listener...');
        
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
            console.log(`Received snapshot with ${snapshot.docs.length} listings`);
            
            const fetchedListings = snapshot.docs.map(doc => {
              const data = doc.data();
              
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
              
              const listing = {
                id: doc.id,
                ...data,
                createdAt,
                expiresAt,
                price: Number(data.price) || 0,
                imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
                isGraded: Boolean(data.isGraded),
                gradeLevel: data.gradeLevel ? Number(data.gradeLevel) : undefined,
                status: data.status || 'active',
                condition: data.condition || 'Not specified',
                game: data.game || 'Not specified',
                city: data.city || 'Unknown',
                state: data.state || 'Unknown',
                gradingCompany: data.gradingCompany || undefined,
                distance: 0 // Default distance
              } as Listing;

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

      // Prepare update data
      const updateData: any = { status };
      const now = new Date();
      
      if (status === 'archived') {
        // When archiving, set archive time and 7-day expiration
        const archiveExpiration = new Date(now);
        archiveExpiration.setDate(archiveExpiration.getDate() + 7);
        
        // Store the original status for potential restoration
        updateData.previousStatus = listingData.status;
        updateData.previousExpiresAt = listingData.expiresAt;
        
        // Set archive-specific fields
        updateData.archivedAt = now;
        updateData.expiresAt = archiveExpiration;
        updateData.originalCreatedAt = listingData.createdAt;
        updateData.updatedAt = now;
      } else if (status === 'active') {
        // When activating/restoring, set new dates and remove archive-related fields
        
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
        
        // Get the appropriate listing duration based on account tier
        // Free tier: 48 hours, Premium tier: 720 hours (30 days)
        const tierDuration = accountTier === 'premium' ? 720 : 48;
        
        // Calculate expiration time in hours
        const expirationTime = new Date(now);
        expirationTime.setHours(expirationTime.getHours() + tierDuration);
        
        // When restoring from archived, ensure we properly reset all archive-related fields
        updateData.status = 'active';
        updateData.createdAt = now;
        updateData.updatedAt = now;
        updateData.expiresAt = expirationTime;
        
        // IMPORTANT: Explicitly set all archive-related fields to null to ensure proper visibility
        updateData.archivedAt = null; // Remove archived timestamp
        updateData.originalCreatedAt = null; // Remove original creation date
        updateData.expirationReason = null; // Remove expiration reason if it exists
        updateData.soldTo = null; // Ensure the listing isn't marked as sold
        updateData.previousStatus = null; // Clear previous status
        updateData.previousExpiresAt = null; // Clear previous expiration date
        
        // Store the account tier with the listing
        updateData.accountTier = accountTier;
      } else {
        // For inactive status, keep current expiration but remove archive-related fields
        updateData.archivedAt = null;
        updateData.originalCreatedAt = null;
        updateData.updatedAt = now;
      }

      console.log(`Updating listing ${listingId} status to ${status} with data:`, updateData);
      
      // Update the listing status
      await updateDoc(listingRef, updateData);
      
      // Verify the update was successful
      const updatedSnap = await getDoc(listingRef);
      if (updatedSnap.exists()) {
        const updatedData = updatedSnap.data();
        console.log(`Listing ${listingId} updated status:`, updatedData.status);
        
        if (updatedData.status !== status) {
          console.error(`Failed to update listing status to ${status}. Current status: ${updatedData.status}`);
          // Try one more time with a direct status update
          await updateDoc(listingRef, { status: status });
        }
      }
      
      // Update local state
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

      return true;
    } catch (error: any) {
      console.error('Error updating listing status:', error);
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