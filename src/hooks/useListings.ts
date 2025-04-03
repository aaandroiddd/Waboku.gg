import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, QueryConstraint, addDoc, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getFirebaseServices } from '@/lib/firebase';
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
}

export function useListings({ userId, searchQuery, showOnlyActive = false }: UseListingsProps = {}) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

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

  const deleteListing = async (listingId: string) => {
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

      // Set up archive data with 7-day expiration
      const now = new Date();
      const sevenDaysFromNow = new Date(now);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      // Update the listing to archived status instead of deleting
      // Use server timestamp for better consistency
      const updateData = {
        status: 'archived',
        archivedAt: now,
        originalCreatedAt: listingData.createdAt,
        expirationReason: 'user_deleted',
        expiresAt: sevenDaysFromNow,
        updatedAt: now, // Add updatedAt timestamp
        // Preserve the original listing data
        previousStatus: listingData.status,
        previousExpiresAt: listingData.expiresAt
      };
      
      console.log(`Archiving listing ${listingId} with data:`, updateData);
      
      // Update in Firebase
      await updateDoc(listingRef, updateData);
      
      // Double-check that the update was successful
      const updatedSnap = await getDoc(listingRef);
      if (updatedSnap.exists()) {
        const updatedData = updatedSnap.data();
        console.log(`Listing ${listingId} updated status:`, updatedData.status);
        
        if (updatedData.status !== 'archived') {
          console.error(`Failed to update listing status to archived. Current status: ${updatedData.status}`);
          // Try one more time with a different approach
          await updateDoc(listingRef, { status: 'archived' });
        }
      }
      
      // Update local state to reflect the archived status
      setListings(prevListings => prevListings.map(listing => 
        listing.id === listingId 
          ? {
              ...listing,
              status: 'archived',
              archivedAt: now,
              originalCreatedAt: listing.createdAt,
              expirationReason: 'user_deleted',
              expiresAt: sevenDaysFromNow,
              updatedAt: now
            }
          : listing
      ));

      // Clear any cached listings data to ensure fresh data on next load
      try {
        // Create a cache key for the user's listings
        const userListingsCacheKey = `listings_${user.uid}_all_none`;
        const activeListingsCacheKey = `listings_${user.uid}_active_none`;
        
        // Clear from localStorage to ensure fresh data on next page load
        localStorage.removeItem(userListingsCacheKey);
        localStorage.removeItem(activeListingsCacheKey);
        
        console.log('Cleared listings cache after archiving');
      } catch (cacheError) {
        console.error('Error clearing listings cache:', cacheError);
        // Continue even if cache clearing fails
      }

      return true;
    } catch (error: any) {
      console.error('Error archiving listing:', error);
      throw new Error(error.message || 'Error archiving listing');
    }
  };

  const restoreListing = async (listingId: string) => {
    return updateListingStatus(listingId, 'active');
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
        
        updateData.archivedAt = now;
        updateData.expiresAt = archiveExpiration;
        updateData.originalCreatedAt = listingData.createdAt;
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
        updateData.archivedAt = null; // Remove archived timestamp
        updateData.originalCreatedAt = null; // Remove original creation date
        updateData.accountTier = accountTier; // Store the account tier with the listing
        updateData.expirationReason = null; // Remove expiration reason if it exists
        
        // Make sure to remove any fields that might affect visibility
        updateData.soldTo = null; // Ensure the listing isn't marked as sold
        updateData.previousStatus = null; // Clear previous status
        updateData.previousExpiresAt = null; // Clear previous expiration date
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
      // This is crucial for ensuring the UI reflects the updated status after navigation
      try {
        // Create a cache key for the user's listings
        const userListingsCacheKey = `listings_${user.uid}_all_none`;
        const activeListingsCacheKey = `listings_${user.uid}_active_none`;
        const allListingsCacheKey = `listings_all_active_none`;
        
        // Clear from localStorage to ensure fresh data on next page load
        localStorage.removeItem(userListingsCacheKey);
        localStorage.removeItem(activeListingsCacheKey);
        localStorage.removeItem(allListingsCacheKey);
        
        // Clear any search-related caches that might contain this listing
        const cacheKeys = Object.keys(localStorage).filter(key => 
          key.startsWith('listings_') && key.includes('_active_')
        );
        
        for (const key of cacheKeys) {
          localStorage.removeItem(key);
        }
        
        console.log('Cleared listings cache after status update');
      } catch (cacheError) {
        console.error('Error clearing listings cache:', cacheError);
        // Continue even if cache clearing fails
      }

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
      
      console.log('Raw listing data keys:', Object.keys(data));
      
      // Process timestamps with detailed logging
      let createdAt = new Date();
      let expiresAt = new Date();
      let updatedAt = new Date();
      
      try {
        console.log('Processing timestamps - createdAt type:', typeof data.createdAt);
        
        // Check if createdAt exists and is a Firestore timestamp
        if (data.createdAt && typeof data.createdAt.toDate === 'function') {
          createdAt = data.createdAt.toDate();
          console.log('Converted createdAt from Firestore timestamp');
        } else if (data.createdAt) {
          // Handle if it's already a Date or a timestamp number
          createdAt = new Date(data.createdAt);
          console.log('Converted createdAt from date/number');
        }
        
        // Check if expiresAt exists and is a Firestore timestamp
        console.log('Processing timestamps - expiresAt type:', typeof data.expiresAt);
        if (data.expiresAt && typeof data.expiresAt.toDate === 'function') {
          expiresAt = data.expiresAt.toDate();
          console.log('Converted expiresAt from Firestore timestamp');
        } else if (data.expiresAt) {
          // Handle if it's already a Date or a timestamp number
          expiresAt = new Date(data.expiresAt);
          console.log('Converted expiresAt from date/number');
        } else {
          // Create a default expiration date if none exists
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now
          console.log('Created default expiresAt');
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
      
      // Process numeric values with detailed logging
      console.log('Processing numeric values - price type:', typeof data.price, 'value:', data.price);
      console.log('Processing numeric values - quantity type:', typeof data.quantity, 'value:', data.quantity);
      
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
        
      console.log('Processed numeric values - price:', price, 'quantity:', quantity, 'gradeLevel:', gradeLevel);
      
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
      
      console.log('Processed listing object ID:', listing.id);
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

      // Get user's location for the listing
      let latitude = null;
      let longitude = null;
      
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch (locationError) {
        console.log('Location access not granted or unavailable');
      }

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
      return { id: docRef.id, ...newListing };
    } catch (error: any) {
      console.error('Error creating listing:', error);
      throw new Error(error.message || 'Error creating listing');
    }
  };

  // Debug function to check specific listing
  const checkSpecificListing = async () => {
    try {
      const { db } = await getFirebaseServices();
      const listingRef = doc(db, 'listings', 'F69t6xo6IFkEGfTvTsev');
      const listingSnap = await getDoc(listingRef);
      
      if (listingSnap.exists()) {
        const data = listingSnap.data();
        console.log('Direct check of listing F69t6xo6IFkEGfTvTsev:', {
          exists: true,
          id: listingSnap.id,
          status: data.status,
          expiresAt: data.expiresAt?.toDate(),
          archivedAt: data.archivedAt?.toDate(),
          createdAt: data.createdAt?.toDate(),
          title: data.title,
          price: data.price
        });
      } else {
        console.log('Direct check: Listing F69t6xo6IFkEGfTvTsev does not exist');
      }
    } catch (error) {
      console.error('Error checking specific listing:', error);
    }
  };

  // Create a cache key based on the current options
  const cacheKey = `listings_${userId || 'all'}_${showOnlyActive ? 'active' : 'all'}_${searchQuery || 'none'}`;
  
  // Initialize client cache outside of useEffect
  const { getFromCache, saveToCache } = useClientCache<Listing[]>({
    key: cacheKey,
    expirationMinutes: 5 // Cache expires after 5 minutes
  });
  
  useEffect(() => {
    // Calculate distance between two points using Haversine formula
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371; // Earth's radius in kilometers
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    const fetchListings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('useListings: Fetching listings...');
        
        // Check if we have cached data
        const { data: cachedListings, expired } = getFromCache();
        
        if (cachedListings && !expired) {
          console.log(`Using cached listings data (${cachedListings.length} items)`);
          // Set listings from cache immediately to improve perceived performance
          setListings(cachedListings);
          setIsLoading(false);
          
          // If we're using cached data, we can return early
          // This provides a faster initial render
          return;
        }
        
        // Get user's location
        let userLocation: { latitude: number | null; longitude: number | null } = { latitude: null, longitude: null };
        
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });
          userLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
        } catch (locationError) {
          console.log('Location access not granted or unavailable');
        }

        const { db } = await getFirebaseServices();
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

        const q = query(listingsRef, ...queryConstraints);
        const querySnapshot = await getDocs(q);
        
        let fetchedListings = querySnapshot.docs.map(doc => {
          const data = doc.data();
          const listing = {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            expiresAt: data.expiresAt?.toDate() || (() => {
              // Create a default expiration date if none exists
              const defaultExpiry = new Date();
              defaultExpiry.setDate(defaultExpiry.getDate() + 30); // 30 days from now
              return defaultExpiry;
            })(),
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
          } as Listing & { distance: number };

          // Calculate distance if we have both user location and listing location
          if (userLocation.latitude && userLocation.longitude && data.latitude && data.longitude) {
            listing.distance = calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              data.latitude,
              data.longitude
            );
          }

          return listing;
        });

        // If there's a search query, filter results in memory
        if (searchQuery?.trim()) {
          const searchLower = searchQuery.toLowerCase();
          fetchedListings = fetchedListings.filter(listing => 
            listing.title?.toLowerCase().includes(searchLower)
          );
        }

        // Sort listings by distance if location is available, otherwise keep creation date sort
        if (userLocation.latitude && userLocation.longitude) {
          fetchedListings.sort((a, b) => {
            // First prioritize recent listings within 50km
            const aIsNearby = a.distance <= 50;
            const bIsNearby = b.distance <= 50;
            
            if (aIsNearby && !bIsNearby) return -1;
            if (!aIsNearby && bIsNearby) return 1;
            
            // For listings in the same distance category, sort by date
            if (aIsNearby === bIsNearby) {
              return b.createdAt.getTime() - a.createdAt.getTime();
            }
            
            // If neither is nearby, sort by distance
            return a.distance - b.distance;
          });
        }
        
        // Cache the results for faster loading next time
        saveToCache(fetchedListings);
        console.log(`Cached ${fetchedListings.length} listings for future use`);
        
        setListings(fetchedListings);
      } catch (err: any) {
        console.error('Error fetching listings:', err);
        setError(err.message || 'Error fetching listings');
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch on initial load or when userId changes
    if (!searchQuery) {
      fetchListings();
    }
  }, [userId, showOnlyActive, searchQuery]);

// Calculate distance between two points using Haversine formula
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

  // Function to manually refresh listings data
  const refreshListings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Manually refreshing listings data...');
      
      // Clear the cache for this specific query
      localStorage.removeItem(cacheKey);
      
      // Get user's location
      let userLocation: { latitude: number | null; longitude: number | null } = { latitude: null, longitude: null };
      
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        userLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
      } catch (locationError) {
        console.log('Location access not granted or unavailable');
      }

      const { db } = await getFirebaseServices();
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

      const q = query(listingsRef, ...queryConstraints);
      const querySnapshot = await getDocs(q);
      
      let fetchedListings = querySnapshot.docs.map(doc => {
        const data = doc.data();
        const listing = {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          expiresAt: data.expiresAt?.toDate() || (() => {
            // Create a default expiration date if none exists
            const defaultExpiry = new Date();
            defaultExpiry.setDate(defaultExpiry.getDate() + 30); // 30 days from now
            return defaultExpiry;
          })(),
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
        } as Listing & { distance: number };

        // Calculate distance if we have both user location and listing location
        if (userLocation.latitude && userLocation.longitude && data.latitude && data.longitude) {
          listing.distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            data.latitude,
            data.longitude
          );
        }

        return listing;
      });

      // If there's a search query, filter results in memory
      if (searchQuery?.trim()) {
        const searchLower = searchQuery.toLowerCase();
        fetchedListings = fetchedListings.filter(listing => 
          listing.title?.toLowerCase().includes(searchLower)
        );
      }

      // Sort listings by distance if location is available, otherwise keep creation date sort
      if (userLocation.latitude && userLocation.longitude) {
        fetchedListings.sort((a, b) => {
          // First prioritize recent listings within 50km
          const aIsNearby = a.distance <= 50;
          const bIsNearby = b.distance <= 50;
          
          if (aIsNearby && !bIsNearby) return -1;
          if (!aIsNearby && bIsNearby) return 1;
          
          // For listings in the same distance category, sort by date
          if (aIsNearby === bIsNearby) {
            // Safely handle date comparison by ensuring createdAt is a Date object
            const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
            const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
            return bTime - aTime;
          }
          
          // If neither is nearby, sort by distance
          return a.distance - b.distance;
        });
      }
      
      // Cache the results for faster loading next time
      saveToCache(fetchedListings);
      console.log(`Cached ${fetchedListings.length} listings after manual refresh`);
      
      setListings(fetchedListings);
      return fetchedListings;
    } catch (err: any) {
      console.error('Error refreshing listings:', err);
      setError(err.message || 'Error refreshing listings');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

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
    deleteListing,
    restoreListing,
    refreshListings
  };
}