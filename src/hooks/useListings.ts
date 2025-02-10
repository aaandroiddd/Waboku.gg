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
  'weiss': ['weiss schwarz']
};

interface UseListingsProps {
  userId?: string;
  searchQuery?: string;
  showOnlyActive?: boolean;
}

export function useListings({ userId, searchQuery, showOnlyActive = false }: UseListingsProps = {}) {
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

  const restoreListing = async (listingId: string) => {
    return updateListingStatus(listingId, 'active');
  };
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

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
      
      if (status === 'archived') {
        // When archiving, store both the archive time and the original creation time
        updateData.archivedAt = new Date();
        updateData.originalCreatedAt = listingData.createdAt;
      } else if (status === 'active') {
        // When activating/restoring, set new createdAt and remove archive-related fields
        updateData.createdAt = new Date();
        updateData.archivedAt = null;
        updateData.originalCreatedAt = null;
      } else {
        // For inactive status, remove archive-related fields
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
                createdAt: updateData.createdAt || listing.createdAt 
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
      const { db } = await getFirebaseServices();
      const listingRef = doc(db, 'listings', listingId);
      const listingSnap = await getDoc(listingRef);
      
      if (!listingSnap.exists()) {
        throw new Error('Listing not found');
      }

      const data = listingSnap.data();
      if (!data) {
        throw new Error('Listing data is empty');
      }
      
      // Check if the listing is archived
      if (data.status === 'archived' || data.archivedAt) {
        throw new Error('This listing has been archived and is no longer available');
      }
      return {
        id: listingSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        price: Number(data.price) || 0,
        imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
        isGraded: Boolean(data.isGraded),
        gradeLevel: data.gradeLevel ? Number(data.gradeLevel) : undefined,
        status: data.status || 'active',
        condition: data.condition || 'Not specified',
        game: data.game || 'Not specified',
        city: data.city || 'Unknown',
        state: data.state || 'Unknown',
        gradingCompany: data.gradingCompany || undefined
      } as Listing;
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

      const newListing = {
        ...dataWithoutCard,
        imageUrls,
        userId: user.uid,
        username: user.displayName || 'Anonymous',
        createdAt: new Date(),
        expiresAt, // Add expiration date
        status: 'active',
        isGraded: Boolean(cleanListingData.isGraded),
        ...(cardReference ? { cardReference } : {})
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
    // Fix the listing that's not showing up
    const fixListing = async () => {
      try {
        const { db } = await getFirebaseServices();
        const listingRef = doc(db, 'listings', 'bo4AaFHrWo8h2QNWdPya');
        const listingSnap = await getDoc(listingRef);
        
        if (listingSnap.exists()) {
          const data = listingSnap.data();
          
          // Calculate new expiration date (30 days from now)
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);
          
          // Update the listing with correct fields
          await updateDoc(listingRef, {
            status: 'active',
            archivedAt: null,
            expiresAt,
            // Ensure other required fields are present
            createdAt: data.createdAt || new Date(),
          });
          
          console.log('Debug - Fixed listing bo4AaFHrWo8h2QNWdPya');
        }
      } catch (error) {
        console.error('Error fixing listing:', error);
      }
    };

    fixListing();
    const debugListingAndQuery = async () => {
      try {
        const { db } = await getFirebaseServices();
        const listingRef = doc(db, 'listings', 'bo4AaFHrWo8h2QNWdPya');
        const listingSnap = await getDoc(listingRef);
        
        if (listingSnap.exists()) {
          const data = listingSnap.data();
          console.log('Debug - Direct DB check for bo4AaFHrWo8h2QNWdPya:', {
            exists: true,
            id: listingSnap.id,
            status: data.status,
            expiresAt: data.expiresAt?.toDate(),
            archivedAt: data.archivedAt?.toDate(),
            createdAt: data.createdAt?.toDate(),
            title: data.title,
            price: data.price,
            allFields: data
          });

          // Test the query that should return this listing
          const listingsRef = collection(db, 'listings');
          const q = query(
            listingsRef,
            where('status', '==', 'active'),
            orderBy('createdAt', 'desc')
          );
          
          const querySnapshot = await getDocs(q);
          const found = querySnapshot.docs.some(doc => doc.id === 'bo4AaFHrWo8h2QNWdPya');
          console.log('Debug - Query test result:', {
            totalResults: querySnapshot.size,
            listingFound: found
          });
        }
      } catch (error) {
        console.error('Error in debug check:', error);
      }
    };

    debugListingAndQuery();
    const debugListing = async () => {
      try {
        const { db } = await getFirebaseServices();
        const listingRef = doc(db, 'listings', 'bo4AaFHrWo8h2QNWdPya');
        const listingSnap = await getDoc(listingRef);
        
        if (listingSnap.exists()) {
          const data = listingSnap.data();
          console.log('Debug - Listing bo4AaFHrWo8h2QNWdPya:', {
            exists: true,
            id: listingSnap.id,
            status: data.status,
            expiresAt: data.expiresAt?.toDate(),
            archivedAt: data.archivedAt?.toDate(),
            createdAt: data.createdAt?.toDate(),
            title: data.title,
            price: data.price,
            allFields: data
          });
        } else {
          console.log('Debug - Listing bo4AaFHrWo8h2QNWdPya does not exist');
        }
      } catch (error) {
        console.error('Error in debug check:', error);
      }
    };

    debugListing();
    const fetchListings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Remove authentication check for viewing listings
        // as this should be publicly accessible
        
        const { db } = await getFirebaseServices();
        const listingsRef = collection(db, 'listings');
        
        // Get current date for expiration check
        const now = new Date();
        
        // Create base query for listings
        let queryConstraints: QueryConstraint[] = [
          orderBy('createdAt', 'desc')
        ];

        // Add user filter if userId is provided
        if (userId) {
          queryConstraints.unshift(where('userId', '==', userId));
        }

        // Add status filter if showOnlyActive is true
        if (showOnlyActive) {
          queryConstraints.unshift(where('status', '==', 'active'));
        }

        const q = query(listingsRef, ...queryConstraints);
        
        console.log('Debug: Executing Firestore query for active listings');

        console.log('Debug: Executing Firestore query with timestamp:', now.toISOString());
        
        console.log('Executing Firestore query for active listings...');
        const querySnapshot = await getDocs(q);
        console.log(`Found ${querySnapshot.size} listings in Firestore`);
        
        // Debug log each listing
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          console.log('Listing:', {
            id: doc.id,
            title: data.title,
            status: data.status,
            createdAt: data.createdAt?.toDate(),
            expiresAt: data.expiresAt?.toDate()
          });
        });
        
        // Debug log for specific listing
        const specificListing = querySnapshot.docs.find(doc => doc.id === 'F69t6xo6IFkEGfTvTsev');
        if (specificListing) {
          const data = specificListing.data();
          console.log('Found specific listing F69t6xo6IFkEGfTvTsev:', {
            id: specificListing.id,
            status: data.status,
            expiresAt: data.expiresAt?.toDate(),
            archivedAt: data.archivedAt?.toDate(),
            createdAt: data.createdAt?.toDate()
          });
        } else {
          console.log('Listing F69t6xo6IFkEGfTvTsev not found in query results');
        }
          
        let fetchedListings = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            price: Number(data.price) || 0,
            imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
            isGraded: Boolean(data.isGraded),
            gradeLevel: data.gradeLevel ? Number(data.gradeLevel) : undefined,
            status: data.status || 'active',
            condition: data.condition || 'Not specified',
            game: data.game || 'Not specified',
            city: data.city || 'Unknown',
            state: data.state || 'Unknown',
            gradingCompany: data.gradingCompany || undefined
          } as Listing;
        });

        // If there's a search query, filter results in memory to handle case-insensitive search
        if (searchQuery) {
          const searchLower = searchQuery.toLowerCase();
          fetchedListings = fetchedListings.filter(listing => 
            listing.title?.toLowerCase().includes(searchLower)
          );
          console.log(`After search filter: ${fetchedListings.length} listings`);
        }
        
        setListings(fetchedListings);
      } catch (err: any) {
        console.error('Error fetching listings:', {
          error: err,
          message: err.message,
          code: err.code,
          stack: err.stack
        });
        setError(err.message || 'Error fetching listings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchListings();
  }, [userId, searchQuery]);

  return { 
    listings, 
    isLoading, 
    error, 
    createListing, 
    fetchListing, 
    updateListingStatus,
    permanentlyDeleteListing,
    deleteListing,
    restoreListing
  };
}