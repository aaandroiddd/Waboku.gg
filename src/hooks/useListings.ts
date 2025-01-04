import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, QueryConstraint, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getFirebaseServices } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from './useFavorites';

interface UseListingsProps {
  userId?: string;
  searchQuery?: string;
}

export function useListings({ userId, searchQuery }: UseListingsProps = {}) {
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
  const { favorites } = useFavorites();

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
        // When archiving, set the archivedAt timestamp
        updateData.archivedAt = new Date();
      } else if (status === 'active') {
        // When activating/restoring, set new createdAt and remove archivedAt
        updateData.createdAt = new Date();
        updateData.archivedAt = null;
      } else {
        // For inactive status, just remove archivedAt
        updateData.archivedAt = null;
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
      
      const newListing = {
        ...baseData,
        imageUrls,
        userId: user.uid,
        username: user.displayName || 'Anonymous',
        createdAt: new Date(),
        status: 'active',
        isGraded: Boolean(cleanListingData.isGraded)
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

  useEffect(() => {
    const fetchListings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const { db } = await getFirebaseServices();
        const listingsRef = collection(db, 'listings');
        const constraints: QueryConstraint[] = [];

        // Match the existing index order
        if (userId) {
          // This will use index #2
          constraints.push(where('userId', '==', userId));
          constraints.push(orderBy('createdAt', 'desc'));
        } else {
          // This will use index #3
          constraints.push(where('status', '==', 'active'));
          constraints.push(orderBy('createdAt', 'desc'));
        }

        console.log('Executing query with constraints:', constraints);
        const q = query(listingsRef, ...constraints);
        
        const querySnapshot = await getDocs(q);
        console.log(`Found ${querySnapshot.size} listings`);
          
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
            listing.title?.toLowerCase().includes(searchLower) ||
            listing.description?.toLowerCase().includes(searchLower)
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
  }, [userId, searchQuery, favorites]);

  return { 
    listings, 
    isLoading, 
    error, 
    createListing, 
    fetchListing, 
    updateListingStatus,
    permanentlyDeleteListing
  };
}