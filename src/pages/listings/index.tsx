import { useEffect, useState } from 'react';
import { getFirestore, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { app } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { ListingGrid } from '@/components/ListingGrid';
import Head from 'next/head';
import Header from '@/components/Header';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchListings() {
      setLoading(true);
      setError(null);
      
      try {
        const db = getFirestore(app);
        const q = query(
          collection(db, 'listings'),
          orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const fetchedListings = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            price: Number(data.price) || 0,
            favoriteCount: data.favoriteCount || 0,
            status: data.status || 'active',
            imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : []
          } as Listing;
        });

        setListings(fetchedListings);
      } catch (error) {
        console.error('Error fetching listings:', error);
        setError('Failed to load listings. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchListings();
  }, []);

  return (
    <>
      <Head>
        <title>All Listings - Waboku.gg</title>
        <meta
          name="description"
          content="Browse all trading card listings on Waboku.gg"
        />
      </Head>

      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-[1400px] mx-auto">
            <h1 className="text-2xl font-semibold mb-8">All Listings</h1>
            {error ? (
              <Alert variant="destructive" className="mb-8">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : (
              <ListingGrid listings={listings} loading={loading} />
            )}
          </div>
        </main>
      </div>
    </>
  );
}