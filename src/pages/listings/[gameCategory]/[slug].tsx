import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc, query, collection, where, limit, getDocs } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';
import { parseListingUrl, getGameDisplayName } from '@/lib/listing-slug';
import { Listing } from '@/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Footer } from '@/components/Footer';

// Import the existing listing page component
import ListingPageComponent from '../[id]';

export default function SlugListingPage() {
  const router = useRouter();
  const { gameCategory, slug } = router.query;
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchListingBySlug() {
      if (!gameCategory || !slug || typeof gameCategory !== 'string' || typeof slug !== 'string') {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Parse the URL to extract the short ID
        const fullPath = `/listings/${gameCategory}/${slug}`;
        const parsed = parseListingUrl(fullPath);
        
        if (!parsed) {
          throw new Error('Invalid listing URL format');
        }

        const { listingId: shortId } = parsed;

        // Get Firebase services
        const { db } = getFirebaseServices();
        if (!db) {
          throw new Error('Database not initialized');
        }

        // First, try to find the listing by the short ID prefix
        // We'll query listings where the ID starts with the short ID
        const listingsRef = collection(db, 'listings');
        const q = query(
          listingsRef,
          where('__name__', '>=', shortId),
          where('__name__', '<', shortId + '\uf8ff'),
          limit(10)
        );

        const querySnapshot = await getDocs(q);
        let foundListing = null;

        // Find the exact match from the results
        querySnapshot.forEach((doc) => {
          if (doc.id.startsWith(shortId)) {
            foundListing = {
              id: doc.id,
              ...doc.data()
            };
          }
        });

        if (!foundListing) {
          throw new Error('Listing not found');
        }

        // Validate that the listing matches the expected game category
        const expectedGameSlug = gameCategory;
        const { getGameSlug } = await import('@/lib/listing-slug');
        const actualGameSlug = getGameSlug(foundListing.game);

        if (actualGameSlug !== expectedGameSlug) {
          // Redirect to the correct URL
          const { generateListingUrl } = await import('@/lib/listing-slug');
          const correctUrl = generateListingUrl(foundListing.title, foundListing.game, foundListing.id);
          router.replace(correctUrl);
          return;
        }

        // Convert timestamps
        const convertTimestamp = (timestamp: any): Date => {
          try {
            if (!timestamp) return new Date();
            if (timestamp && typeof timestamp.toDate === 'function') {
              return timestamp.toDate();
            }
            if (timestamp instanceof Date) {
              return timestamp;
            }
            if (typeof timestamp === 'number') {
              return new Date(timestamp);
            }
            if (typeof timestamp === 'string') {
              return new Date(timestamp);
            }
            return new Date();
          } catch (error) {
            console.error('Error converting timestamp:', error, timestamp);
            return new Date();
          }
        };

        // Process the listing data
        const createdAt = convertTimestamp(foundListing.createdAt);
        const expiresAt = foundListing.expiresAt ? 
          convertTimestamp(foundListing.expiresAt) : 
          new Date(createdAt.getTime() + (foundListing.isPremium ? 30 : 2) * 24 * 60 * 60 * 1000);

        let locationData = undefined;
        if (foundListing.location) {
          try {
            locationData = {
              latitude: typeof foundListing.location.latitude === 'number' ? foundListing.location.latitude : undefined,
              longitude: typeof foundListing.location.longitude === 'number' ? foundListing.location.longitude : undefined
            };
          } catch (error) {
            console.error('Error processing location data:', error);
          }
        }

        const listingData: Listing = {
          id: foundListing.id,
          title: foundListing.title || 'Untitled Listing',
          description: foundListing.description || '',
          price: typeof foundListing.price === 'number' ? foundListing.price : 
                 typeof foundListing.price === 'string' ? parseFloat(foundListing.price) : 0,
          condition: foundListing.condition || 'unknown',
          game: foundListing.game || 'other',
          imageUrls: Array.isArray(foundListing.imageUrls) ? foundListing.imageUrls : [],
          coverImageIndex: typeof foundListing.coverImageIndex === 'number' ? foundListing.coverImageIndex : 0,
          userId: foundListing.userId || '',
          username: foundListing.username || 'Unknown User',
          createdAt: createdAt,
          expiresAt: expiresAt,
          status: foundListing.status || 'active',
          isGraded: Boolean(foundListing.isGraded),
          gradeLevel: foundListing.gradeLevel ? Number(foundListing.gradeLevel) : undefined,
          gradingCompany: foundListing.gradingCompany,
          city: foundListing.city || 'Unknown',
          state: foundListing.state || 'Unknown',
          favoriteCount: typeof foundListing.favoriteCount === 'number' ? foundListing.favoriteCount : 0,
          quantity: foundListing.quantity ? Number(foundListing.quantity) : undefined,
          cardName: foundListing.cardName || undefined,
          location: locationData,
          soldTo: foundListing.soldTo || null,
          archivedAt: foundListing.archivedAt ? convertTimestamp(foundListing.archivedAt) : null,
          offersOnly: foundListing.offersOnly === true
        };

        setListing(listingData);
        setLoading(false);

        // Update the router query to include the full listing ID for the component
        router.replace(
          `/listings/${gameCategory}/${slug}`,
          `/listings/${gameCategory}/${slug}`,
          { shallow: true }
        );

        // Set the listing ID in the router query for the ListingPageComponent
        router.query.id = foundListing.id;

      } catch (err: any) {
        console.error('Error fetching listing by slug:', err);
        setError(err.message || 'Failed to load listing');
        setLoading(false);
      }
    }

    fetchListingBySlug();
  }, [gameCategory, slug, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="container mx-auto p-4 flex-1">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-64 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !listing) {
    const isArchived = error?.includes('archived');
    const isExpired = error?.includes('expired');
    return (
      <div className="min-h-screen flex flex-col">
        <div className="container mx-auto p-4 flex-1">
          <Card className="bg-muted">
            <CardContent className="p-6 text-center">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold mb-2">
                  {isArchived || isExpired ? 'Listing No Longer Available' : 'Listing Not Found'}
                </h2>
                <p className="text-muted-foreground">
                  {isArchived || isExpired ? 
                    'This listing has been sold or is no longer available.' : 
                    'We couldn\'t find the listing you\'re looking for.'}
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => router.push('/listings')}
              >
                Browse Available Listings
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  // If we have a listing, render the existing listing page component
  // but override the router query to include the listing ID
  const modifiedRouter = {
    ...router,
    query: {
      ...router.query,
      id: listing.id
    }
  };

  // Use a custom hook to override the router context
  return (
    <div>
      {/* We'll render the existing listing component but need to pass the listing data */}
      <ListingPageComponent />
    </div>
  );
}