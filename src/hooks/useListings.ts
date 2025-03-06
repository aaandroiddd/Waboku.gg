import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, QueryConstraint, addDoc, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getFirebaseServices } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

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
      const updateData = {
        status: 'archived',
        archivedAt: now,
        originalCreatedAt: listingData.createdAt,
        expirationReason: 'user_deleted',
        expiresAt: sevenDaysFromNow,
        // Preserve the original listing data
        previousStatus: listingData.status,
        previousExpiresAt: listingData.expiresAt
      };
      
      await updateDoc(listingRef, updateData);
      
      // Update local state to reflect the archived status
      setListings(prevListings => prevListings.map(listing => 
        listing.id === listingId 
          ? {
              ...listing,
              status: 'archived',
              archivedAt: now,
              originalCreatedAt: listing.createdAt,
              expirationReason: 'user_deleted',
              expiresAt: sevenDaysFromNow
            }
          : listing
      ));

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
        const standardExpiration = new Date(now);
        standardExpiration.setDate(standardExpiration.getDate() + 30);
        
        updateData.createdAt = now;
        updateData.expiresAt = standardExpiration;
        updateData.archivedAt = null;
        updateData.originalCreatedAt = null;
      } else {
        // For inactive status, keep current expiration but remove archive-related fields
        updateData.archivedAt = null;
        updateData.originalCreatedAt = null;
      }

      // Update the listing status
      await updateDoc(listingRef, updateData);
      
      // Update local state
      setListings(prevListings => 
        prevListings.map(listing => 
          listing.id === listingId 
            ? { 
                ...listing, 
                ...updateData,
                createdAt: updateData.createdAt || listing.createdAt,
                expiresAt: updateData.expiresAt || listing.expiresAt
              } 
            : listing
        )
      );

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
      // Create the listing document with image URLs
      const listingRef = collection(db, 'listings');
      // Prepare base listing data without grading fields
      const { gradeLevel, gradingCompany, ...baseData } = cleanListingData;
      
      // Remove cardReference if it's null
      const { cardReference, ...dataWithoutCard } = baseData;
      
      // Set expiration date to 30 days from creation by default
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

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
        expiresAt, // Add expiration date
        status: 'active',
        isGraded: Boolean(cleanListingData.isGraded),
        ...(cardReference ? { cardReference } : {}),
        // Add location data if available
        ...(latitude !== null && longitude !== null ? { latitude, longitude } : {})
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
  }, [userId]);

  return { 
    listings, 
    isLoading, 
    error, 
    createListing, 
    fetchListing, 
    updateListing,
    updateListingStatus,
    permanentlyDeleteListing,
    deleteListing,
    restoreListing
  };
}