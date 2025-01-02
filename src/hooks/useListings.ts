import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, QueryConstraint, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from './useFavorites';

interface UseListingsProps {
  userId?: string;
  searchQuery?: string;
}

export function useListings({ userId, searchQuery }: UseListingsProps = {}) {
  const createListing = async (listingData: any) => {
    if (!user) throw new Error('Must be logged in to create a listing');

    try {
      // First, upload images to Firebase Storage
      const imageUrls = [];
      const storage = getStorage();
      
      for (const imageFile of listingData.images) {
        const fileName = `${Date.now()}-${imageFile.name}`;
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

        // Wait for upload to complete and get download URL
        await uploadTask;
        const downloadURL = await getDownloadURL(storageRef);
        imageUrls.push(downloadURL);
      }

      // Remove the File objects and progress callback from listing data
      const { images, onUploadProgress, ...cleanListingData } = listingData;

      // Create the listing document with image URLs
      const listingRef = collection(db, 'listings');
      const newListing = {
        ...cleanListingData,
        imageUrls, // Add the array of image URLs
        userId: user.uid,
        username: user.displayName || 'Anonymous',
        createdAt: new Date(),
        status: 'active',
        isGraded: Boolean(cleanListingData.isGraded),
        gradeLevel: cleanListingData.isGraded ? Number(cleanListingData.gradeLevel) : undefined,
        gradingCompany: cleanListingData.isGraded ? cleanListingData.gradingCompany : undefined,
      };

      const docRef = await addDoc(listingRef, newListing);
      return { id: docRef.id, ...newListing };
    } catch (error: any) {
      console.error('Error creating listing:', error);
      throw new Error(error.message || 'Error creating listing');
    }
  };
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { favorites } = useFavorites();

  useEffect(() => {
    const fetchListings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        if (userId === 'favorites') {
          let filteredFavorites = favorites;
          if (searchQuery) {
            filteredFavorites = favorites.filter(listing => 
              listing.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              listing.description?.toLowerCase().includes(searchQuery.toLowerCase())
            );
          }
          setListings(filteredFavorites);
          setIsLoading(false);
          return;
        }

        const listingsRef = collection(db, 'listings');
        const constraints: QueryConstraint[] = [];

        // Add user filter if specified
        if (userId) {
          constraints.push(where('userId', '==', userId));
        }

        // For search, we'll fetch all listings and filter in memory
        // This ensures we catch all possible matches regardless of case

        // Always order by creation date
        constraints.push(orderBy('createdAt', 'desc'));
        
        const q = query(listingsRef, ...constraints);
        const querySnapshot = await getDocs(q);
        
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
        }
        
        setListings(fetchedListings);
      } catch (err: any) {
        console.error('Error fetching listings:', err);
        setError(err.message || 'Error fetching listings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchListings();
  }, [userId, searchQuery, favorites]);

  return { listings, isLoading, error, createListing };
}