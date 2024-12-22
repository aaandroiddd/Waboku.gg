import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  updateDoc, 
  deleteDoc, 
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from '@/lib/firebase';
import { Listing, CreateListingData } from '@/types/database';

export function useListings() {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const db = getFirestore(app);
  const storage = getStorage(app);

  const fetchListings = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const q = query(
        collection(db, 'listings'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const fetchedListings = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Listing[];

      setListings(fetchedListings);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching listings:', err);
    } finally {
      setLoading(false);
    }
  }, [user, db]);

  const uploadImage = async (file: File, userId: string): Promise<string> => {
    try {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storageRef = ref(storage, `listings/${userId}/${fileName}`);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (error: any) {
      console.error('Error uploading image:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  };

  const createListing = async (data: CreateListingData) => {
    if (!user) throw new Error('Must be logged in to create a listing');

    setLoading(true);
    setError(null);

    try {
      // Validate the data
      if (!data.title || !data.price || !data.condition || !data.game) {
        throw new Error('Please fill in all required fields');
      }

      if (data.images.length === 0) {
        throw new Error('Please upload at least one image');
      }

      // Upload images
      const imageUrls = await Promise.all(
        data.images.map(image => uploadImage(image, user.uid))
      );

      // Create the listing document
      const listingData = {
        title: data.title,
        description: data.description,
        price: parseFloat(data.price),
        condition: data.condition,
        game: data.game,
        imageUrls,
        userId: user.uid,
        createdAt: serverTimestamp(),
        status: 'active' as const
      };

      const docRef = await addDoc(collection(db, 'listings'), listingData);
      const newListing = { 
        id: docRef.id, 
        ...listingData,
        createdAt: new Date() // Convert serverTimestamp to Date for frontend
      };
      
      setListings(prev => [newListing, ...prev]);
      return newListing;
    } catch (err: any) {
      const errorMessage = err.message || 'Error creating listing';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateListing = async (id: string, updates: Partial<CreateListingData>) => {
    if (!user) throw new Error('Must be logged in to update a listing');

    setLoading(true);
    setError(null);

    try {
      const listingRef = doc(db, 'listings', id);
      
      let imageUrls = undefined;
      if (updates.images?.length) {
        imageUrls = await Promise.all(
          updates.images.map(image => uploadImage(image, user.uid))
        );
      }

      const updateData = {
        ...updates,
        ...(imageUrls && { imageUrls }),
        ...(updates.price && { price: parseFloat(updates.price) })
      };

      delete updateData.images;

      await updateDoc(listingRef, updateData);

      setListings(prev =>
        prev.map(listing =>
          listing.id === id
            ? { ...listing, ...updateData }
            : listing
        )
      );

      return { id, ...updateData };
    } catch (err: any) {
      const errorMessage = err.message || 'Error updating listing';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const deleteListing = async (id: string) => {
    if (!user) throw new Error('Must be logged in to delete a listing');

    setLoading(true);
    setError(null);

    try {
      const listingRef = doc(db, 'listings', id);
      await deleteDoc(listingRef);
      setListings(prev => prev.filter(listing => listing.id !== id));
    } catch (err: any) {
      const errorMessage = err.message || 'Error deleting listing';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.uid) {
      fetchListings();
    } else {
      setListings([]);
    }
  }, [user?.uid, fetchListings]);

  return {
    listings,
    loading,
    error,
    createListing,
    updateListing,
    deleteListing,
    refreshListings: fetchListings,
  };
}