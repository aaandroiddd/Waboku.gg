import React, { useState, useEffect, useRef } from 'react';
import { Listing } from '@/types/database';
import { SimplifiedListingCard } from './SimplifiedListingCard';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/router';
import { getFirebaseServices, registerListener, removeListenersByPrefix } from '@/lib/firebase';
import { collection, query, where, limit, documentId } from 'firebase/firestore';

interface OptimizedSimilarListingsProps {
  currentListing: Listing;
  maxListings?: number;
}

export const OptimizedSimilarListings = ({ currentListing, maxListings = 8 }: OptimizedSimilarListingsProps) => {
  const [similarListings, setSimilarListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!currentListing?.id || !currentListing?.game || fetchedRef.current) return;
    
    const fetchSimilarListings = async () => {
      try {
        setIsLoading(true);
        const { db } = getFirebaseServices();
        if (!db) throw new Error('Firebase DB not initialized');

        // Create a unique ID for this query
        const listenerId = `similar-listings-${currentListing.id}`;
        
        // Simple query for listings with the same game
        const gameQuery = query(
          collection(db, 'listings'),
          where('status', '==', 'active'),
          where('game', '==', currentListing.game),
          where(documentId(), '!=', currentListing.id),
          limit(maxListings)
        );
        
        // Register the listener with the connection manager
        registerListener(listenerId, gameQuery, (snapshot) => {
          const results = snapshot.docs.map(doc => {
            const data = doc.data();
            
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate() || new Date(),
              expiresAt: data.expiresAt?.toDate() || new Date(),
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
            };
          });
          
          // Sort by newest first
          const sortedResults = results.sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          
          setSimilarListings(sortedResults);
          setIsLoading(false);
        }, (error) => {
          console.error('Error fetching similar listings:', error);
          setIsLoading(false);
        });
        
        fetchedRef.current = true;
      } catch (error) {
        console.error('Error setting up similar listings query:', error);
        setIsLoading(false);
      }
    };

    fetchSimilarListings();

    // Cleanup function
    return () => {
      const cleanupId = `similar-listings-${currentListing.id}`;
      removeListenersByPrefix(cleanupId);
    };
  }, [currentListing?.id, currentListing?.game, maxListings]);

  if (isLoading) {
    return (
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Similar Items</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-3">
                <div className="aspect-square bg-muted rounded-lg mb-2"></div>
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (similarListings.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Similar Items</h2>
        <Button variant="ghost" onClick={() => router.push('/listings')} className="flex items-center">
          View All <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
      
      <Carousel className="w-full">
        <CarouselContent className="-ml-4">
          {similarListings.map((listing) => (
            <CarouselItem key={listing.id} className="pl-4 md:basis-1/4 lg:basis-1/4">
              <SimplifiedListingCard listing={listing} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
};