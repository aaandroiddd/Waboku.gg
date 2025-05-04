import React, { useState, useEffect, useRef } from 'react';
import { Listing } from '@/types/database';
import { SimplifiedListingCard } from './SimplifiedListingCard';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/router';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, query, where, limit, documentId } from 'firebase/firestore';
import { registerListener, removeListenersByPrefix } from '@/lib/firebaseConnectionManager';

interface OwnerListingsProps {
  ownerId: string;
  currentListingId: string;
  maxListings?: number;
  ownerName?: string;
}

export const OwnerListings = ({ ownerId, currentListingId, maxListings = 8, ownerName = "Seller" }: OwnerListingsProps) => {
  const [ownerListings, setOwnerListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!ownerId || !currentListingId || fetchedRef.current) return;
    
    const fetchOwnerListings = async () => {
      try {
        setIsLoading(true);
        const { db } = getFirebaseServices();
        if (!db) throw new Error('Firebase DB not initialized');

        // Create a unique ID for this query
        const listenerId = `owner-listings-${ownerId}-${currentListingId}`;
        
        // Query for active listings by this owner, excluding the current listing
        const ownerQuery = query(
          collection(db, 'listings'),
          where('status', '==', 'active'),
          where('userId', '==', ownerId),
          where(documentId(), '!=', currentListingId),
          limit(maxListings)
        );
        
        // Register the listener with the connection manager
        registerListener(listenerId, ownerQuery, (snapshot) => {
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
          
          setOwnerListings(sortedResults);
          setIsLoading(false);
        }, (error) => {
          console.error('Error fetching owner listings:', error);
          setIsLoading(false);
        });
        
        fetchedRef.current = true;
      } catch (error) {
        console.error('Error setting up owner listings query:', error);
        setIsLoading(false);
      }
    };

    fetchOwnerListings();

    // Cleanup function
    return () => {
      const cleanupId = `owner-listings-${ownerId}-${currentListingId}`;
      removeListenersByPrefix(cleanupId);
    };
  }, [ownerId, currentListingId, maxListings]);

  if (isLoading) {
    return (
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">More from this Seller</h2>
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

  if (ownerListings.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">More from {ownerName}</h2>
        <Button 
          variant="ghost" 
          onClick={() => router.push(`/profile/${ownerId}`)} 
          className="flex items-center"
        >
          View All <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
      
      <Carousel className="w-full">
        <CarouselContent className="-ml-4">
          {ownerListings.map((listing) => (
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