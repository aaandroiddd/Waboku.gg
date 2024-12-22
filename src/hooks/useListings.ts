import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getFirestore, collection, addDoc, query, where, getDocs, orderBy, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from '@/lib/firebase';

export function useListings() {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const db = getFirestore(app);
  const storage = getStorage(app);

  const fetchListings = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Create a simple query first
      const q = query(
        collection(db, 'listings'),
        where('userId', '==', user.uid)
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
  };

  const createListing = async (data: CreateListingData) => {
    if (!user) throw new Error('Must be logged in to create a listing');

    setLoading(true);
    setError(null);

    try {
      // Upload images first
      const imageUrls = await Promise.all(
        data.images.map(async (image) => {
          const storageRef = ref(storage, `listings/${user.uid}/${Date.now()}_${image.name}`);
          const snapshot = await uploadBytes(storageRef, image);
          return await getDownloadURL(snapshot.ref);
        })
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
        createdAt: new Date(),
        status: 'active' as const
      };

      const docRef = await addDoc(collection(db, 'listings'), listingData);
      const newListing = { id: docRef.id, ...listingData };
      
      setListings(prev => [newListing, ...prev]);
      return newListing;
    } catch (err: any) {
      setError(err.message);
      console.error('Error creating listing:', err);
      throw err;
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
      
      // Handle image uploads if there are new images
      let imageUrls = undefined;
      if (updates.images && updates.images.length > 0) {
        imageUrls = await Promise.all(
          updates.images.map(async (image) => {
            const storageRef = ref(storage, `listings/${user.uid}/${Date.now()}_${image.name}`);
            const snapshot = await uploadBytes(storageRef, image);
            return await getDownloadURL(snapshot.ref);
          })
        );
      }

      const updateData = {
        ...updates,
        ...(imageUrls && { imageUrls }),
        ...(updates.price && { price: parseFloat(updates.price) })
      };

      delete updateData.images; // Remove the images field as we don't store it in Firestore

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
      setError(err.message);
      console.error('Error updating listing:', err);
      throw err;
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
      setError(err.message);
      console.error('Error deleting listing:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    
    const loadListings = async () => {
      if (!user?.uid) return;
      
      // Wait for auth to be fully initialized
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (!mounted) return;
      
      try {
        await fetchListings();
      } catch (err: any) {
        if (err.code === 'permission-denied' || err.code === 'unauthenticated') {
          // If we get a permission error, wait and try one more time
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (mounted) {
            await fetchListings();
          }
        }
      }
    };

    loadListings();
    
    return () => {
      mounted = false;
    };
  }, [user?.uid]);

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