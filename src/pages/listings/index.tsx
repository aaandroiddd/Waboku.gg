import { useEffect, useState } from 'react';
import { getFirestore, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { app } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { ListingGrid } from '@/components/ListingGrid';
import Head from 'next/head';
import Header from '@/components/Header';

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchListings() {
      const db = getFirestore(app);
      const q = query(
        collection(db, 'listings'),
        orderBy('createdAt', 'desc')
      );

      try {
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
      } catch (error) {
        console.error('Error fetching listings:', error);
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
          <h1 className="text-3xl font-bold mb-8">All Listings</h1>
          <ListingGrid listings={listings} loading={loading} />
        </main>
      </div>
    </>
  );
}