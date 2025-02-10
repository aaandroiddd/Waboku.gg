import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ListingCard } from '@/components/ListingCard';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { ListingTimer } from '@/components/ListingTimer';

interface ArchivedListing {
  id: string;
  title: string;
  price: number;
  imageUrl: string;
  description: string;
  archivedAt: number;
  // Add other relevant fields
}

export default function ArchivedListings() {
  const { user } = useAuth();
  const [archivedListings, setArchivedListings] = useState<ArchivedListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArchivedListings = async () => {
      if (!user) return;

      try {
        // Fetch archived listings from Firebase
        // You'll need to implement this in your Firebase setup
        const listingsRef = firebase.firestore()
          .collection('listings')
          .where('userId', '==', user.uid)
          .where('status', '==', 'archived')
          .orderBy('archivedAt', 'desc');

        const snapshot = await listingsRef.get();
        const listings = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as ArchivedListing[];

        setArchivedListings(listings);
      } catch (error) {
        console.error('Error fetching archived listings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchArchivedListings();
  }, [user]);

  const handleDelete = async (listingId: string) => {
    try {
      await firebase.firestore()
        .collection('listings')
        .doc(listingId)
        .delete();

      setArchivedListings(prev => 
        prev.filter(listing => listing.id !== listingId)
      );
    } catch (error) {
      console.error('Error deleting listing:', error);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 space-y-4">
        <h1 className="text-2xl font-bold">Archived Listings</h1>
        {archivedListings.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            No archived listings found
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {archivedListings.map((listing) => (
              <div key={listing.id} className="relative">
                <ListingCard
                  listing={listing}
                  onDelete={() => handleDelete(listing.id)}
                  showDeleteButton
                />
                <div className="mt-2">
                  <ListingTimer
                    createdAt={listing.archivedAt}
                    duration={7 * 24 * 60 * 60 * 1000} // 7 days in milliseconds
                    onExpire={() => handleDelete(listing.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}