import { useEffect, useState } from 'react';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { app } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Listing } from '@/types/database';
import { ListingGrid } from '@/components/ListingGrid';
import DashboardLayout from '@/components/dashboard/DashboardLayout';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    async function fetchFavorites() {
      if (!user) return;

      try {
        const db = getFirestore(app);
        const favoritesRef = collection(db, 'favorites');
        const favoritesQuery = query(favoritesRef, where('userId', '==', user.uid));
        const favoritesSnapshot = await getDocs(favoritesQuery);

        const listingPromises = favoritesSnapshot.docs.map(async (doc) => {
          const listingDoc = await getDocs(doc.data().listingId);
          if (listingDoc.exists()) {
            return {
              id: listingDoc.id,
              ...listingDoc.data(),
              createdAt: listingDoc.data().createdAt?.toDate() || new Date(),
            } as Listing;
          }
          return null;
        });

        const listings = (await Promise.all(listingPromises)).filter((listing): listing is Listing => listing !== null);
        setFavorites(listings);
      } catch (error) {
        console.error('Error fetching favorites:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchFavorites();
  }, [user]);

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">My Favorites</h1>
        <ListingGrid listings={favorites} loading={loading} />
      </div>
    </DashboardLayout>
  );
}