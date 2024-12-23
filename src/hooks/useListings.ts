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
import { getStorage, ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { app } from '@/lib/firebase';
import { Listing, CreateListingData } from '@/types/database';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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
      const fetchedListings = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date()
        };
      }) as Listing[];

      setListings(fetchedListings);
    } catch (err: any) {
      console.error('Error fetching listings:', err);
      setError(err.code === 'permission-denied' 
        ? 'Please sign in again to view your listings.' 
        : 'Unable to load listings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, db]);

  const uploadImage = async (
    file: File, 
    userId: string,
    onProgress?: (progress: number) => void
  ): Promise<string> => {
    // Add delay to ensure Firebase is fully initialized
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      console.log('Starting image upload:', {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        userId
      });
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storageRef = ref(storage, `listings/${userId}/${fileName}`);
      
      if (onProgress) {
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        return new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              onProgress(progress);
            },
            (error) => {
              reject(new Error(`Failed to upload image: ${error.message}`));
            },
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            }
          );
        });
      } else {
        const snapshot = await uploadBytes(storageRef, file);
        return await getDownloadURL(snapshot.ref);
      }
    } catch (error: any) {
      console.error('Error uploading image:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  };

  const createListing = async (data: CreateListingData & { onUploadProgress?: (progress: number) => void }) => {
    if (!user) throw new Error('Must be logged in to create a listing');

    console.log('Starting listing creation process...', {
      userId: user.uid,
      hasImages: data.images.length > 0,
      imageTypes: data.images.map(img => img.type),
      imageSizes: data.images.map(img => img.size),
    });
    try {
      // Validate the data
      if (!data.title || !data.price || !data.condition || !data.game) {
        throw new Error('Please fill in all required fields');
      }

      if (data.images.length === 0) {
        throw new Error('Please upload at least one image');
      }

      // Validate price
      const numericPrice = parseFloat(data.price);
      if (isNaN(numericPrice) || numericPrice <= 0) {
        throw new Error('Please enter a valid price');
      }

      // Upload images first
      let imageUrls: string[] = [];
      try {
        const totalImages = data.images.length;
        for (let i = 0; i < data.images.length; i++) {
          const image = data.images[i];
          
          // Validate image
          if (!image || !image.type || !ALLOWED_FILE_TYPES.includes(image.type)) {
            throw new Error('Invalid image format. Please use JPG, PNG or WebP');
          }

          if (image.size > MAX_FILE_SIZE) {
            throw new Error('Image size too large. Maximum size is 5MB');
          }

          const url = await uploadImage(image, user.uid, (progress) => {
            if (data.onUploadProgress) {
              // Calculate overall progress considering all images
              const overallProgress = ((i * 100) + progress) / totalImages;
              data.onUploadProgress(overallProgress);
            }
          });
          imageUrls.push(url);
        }
      } catch (uploadError: any) {
        console.error('Image upload error:', uploadError);
        throw new Error(uploadError.message || 'Failed to upload images. Please try again.');
      }

      // Create the listing document
      const listingData = {
        title: data.title.trim(),
        description: data.description.trim(),
        price: numericPrice,
        condition: data.condition,
        game: data.game,
        imageUrls,
        userId: user.uid,
        createdAt: serverTimestamp(),
        status: 'active' as const
      };

      // Add to Firestore
      const docRef = await addDoc(collection(db, 'listings'), listingData);
      
      if (!docRef.id) {
        throw new Error('Failed to create listing document');
      }

      // Create the new listing object
      const newListing = { 
        id: docRef.id, 
        ...listingData,
        createdAt: new Date()
      };
      
      // Update local state
      setListings(prev => [newListing, ...prev]);
      return newListing;
    } catch (err: any) {
      console.error('Error in createListing:', err);
      const errorMessage = err.message || 'Failed to create listing. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
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