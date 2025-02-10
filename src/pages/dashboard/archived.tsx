import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ListingCard } from '@/components/ListingCard';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { ListingTimer } from '@/components/ListingTimer';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/components/ui/use-toast';
import { Listing } from '@/types/database';

export default function ArchivedListings() {
  const { user } = useAuth();
  const [archivedListings, setArchivedListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Function to get condition color based on condition
  const getConditionColor = (condition: string) => {
    const colors = {
      'Mint': { base: 'bg-green-100 text-green-800', hover: 'hover:bg-green-200' },
      'Near Mint': { base: 'bg-emerald-100 text-emerald-800', hover: 'hover:bg-emerald-200' },
      'Excellent': { base: 'bg-blue-100 text-blue-800', hover: 'hover:bg-blue-200' },
      'Good': { base: 'bg-yellow-100 text-yellow-800', hover: 'hover:bg-yellow-200' },
      'Light Played': { base: 'bg-orange-100 text-orange-800', hover: 'hover:bg-orange-200' },
      'Played': { base: 'bg-red-100 text-red-800', hover: 'hover:bg-red-200' },
      'Poor': { base: 'bg-gray-100 text-gray-800', hover: 'hover:bg-gray-200' }
    };
    return colors[condition as keyof typeof colors] || { base: 'bg-gray-100 text-gray-800', hover: 'hover:bg-gray-200' };
  };

  useEffect(() => {
    const fetchArchivedListings = async () => {
      if (!user) return;

      try {
        const listingsRef = collection(db, 'listings');
        const q = query(
          listingsRef,
          where('userId', '==', user.uid),
          where('status', '==', 'archived'),
          orderBy('archivedAt', 'desc')
        );

        const snapshot = await getDocs(q);
        const listings = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Listing[];

        setArchivedListings(listings);
      } catch (error) {
        console.error('Error fetching archived listings:', error);
        toast({
          title: "Error",
          description: "Failed to load archived listings. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchArchivedListings();
  }, [user, toast]);

  const handleDelete = async (listingId: string) => {
    try {
      await deleteDoc(doc(db, 'listings', listingId));
      setArchivedListings(prev => prev.filter(listing => listing.id !== listingId));
      toast({
        title: "Success",
        description: "Listing has been permanently deleted.",
      });
    } catch (error) {
      console.error('Error deleting listing:', error);
      toast({
        title: "Error",
        description: "Failed to delete the listing. Please try again later.",
        variant: "destructive",
      });
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
      <div className="p-4">
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
                  isFavorite={false}
                  onFavoriteClick={() => {}}
                  getConditionColor={getConditionColor}
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