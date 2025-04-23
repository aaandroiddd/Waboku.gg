import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit, or, documentId } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { GAME_NAME_MAPPING } from '@/lib/game-mappings';

interface SimilarListingsDebuggerProps {
  currentListing: Listing;
}

export const SimilarListingsDebugger: React.FC<SimilarListingsDebuggerProps> = ({ currentListing }) => {
  const [debugResults, setDebugResults] = useState<{
    activeListingsCount: number;
    sameGameCount: number;
    sameCardNameCount: number;
    similarPriceCount: number;
    relatedGamesCount: number;
    queriesRun: number;
    queryResults: Record<string, any[]>;
    error: string | null;
    isLoading: boolean;
  }>({
    activeListingsCount: 0,
    sameGameCount: 0,
    sameCardNameCount: 0,
    similarPriceCount: 0,
    relatedGamesCount: 0,
    queriesRun: 0,
    queryResults: {},
    error: null,
    isLoading: false
  });

  // Process query results into Listing objects
  const processQueryResults = (querySnapshot: any): Listing[] => {
    return querySnapshot.docs.map((doc: any) => {
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
        favoriteCount: typeof data.favoriteCount === 'number' ? data.favoriteCount : 0,
        quantity: data.quantity ? Number(data.quantity) : undefined,
        cardName: data.cardName || undefined,
        gradingCompany: data.gradingCompany || undefined
      } as Listing;
    });
  };

  // Calculate price range for similar listings
  const calculatePriceRange = (price: number): { min: number, max: number } => {
    // For lower priced items, use a wider range
    if (price < 50) {
      return {
        min: Math.max(0, price * 0.4),
        max: price * 2.0
      };
    }
    // For medium priced items
    else if (price < 200) {
      return {
        min: price * 0.5,
        max: price * 1.8
      };
    }
    // For higher priced items, use a wider range
    else {
      return {
        min: price * 0.6,
        max: price * 1.6
      };
    }
  };

  // Get related game categories
  const getRelatedGameCategories = (game: string): string[] => {
    // Find the normalized game key
    const gameKey = Object.keys(GAME_NAME_MAPPING).find(key => 
      GAME_NAME_MAPPING[key as keyof typeof GAME_NAME_MAPPING].includes(game)
    );
    
    if (!gameKey) return [];
    
    // Return all variations of this game name for better matching
    return GAME_NAME_MAPPING[gameKey as keyof typeof GAME_NAME_MAPPING];
  };

  const runDiagnostics = async () => {
    try {
      setDebugResults(prev => ({ ...prev, isLoading: true, error: null }));
      
      const { db } = await getFirebaseServices();
      if (!db) {
        throw new Error('Firebase DB is not initialized');
      }
      
      const listingsRef = collection(db, 'listings');
      const priceRange = calculatePriceRange(currentListing.price);
      const relatedGames = getRelatedGameCategories(currentListing.game);
      
      // Query 1: Count all active listings
      const activeListingsQuery = query(
        listingsRef,
        where('status', '==', 'active')
      );
      
      const activeListingsSnapshot = await getDocs(activeListingsQuery);
      const activeListingsCount = activeListingsSnapshot.docs.length;
      
      // Query 2: Count listings with same game
      const sameGameQuery = query(
        listingsRef,
        where('status', '==', 'active'),
        where('game', '==', currentListing.game)
      );
      
      const sameGameSnapshot = await getDocs(sameGameQuery);
      const sameGameCount = sameGameSnapshot.docs.length;
      
      // Query 3: Count listings with same card name (if available)
      let sameCardNameCount = 0;
      let sameCardNameResults: Listing[] = [];
      
      if (currentListing.cardName) {
        const sameCardNameQuery = query(
          listingsRef,
          where('status', '==', 'active'),
          where('cardName', '==', currentListing.cardName)
        );
        
        const sameCardNameSnapshot = await getDocs(sameCardNameQuery);
        sameCardNameCount = sameCardNameSnapshot.docs.length;
        sameCardNameResults = processQueryResults(sameCardNameSnapshot);
      }
      
      // Query 4: Count listings with similar price
      const similarPriceQuery = query(
        listingsRef,
        where('status', '==', 'active'),
        where('price', '>=', priceRange.min),
        where('price', '<=', priceRange.max)
      );
      
      const similarPriceSnapshot = await getDocs(similarPriceQuery);
      const similarPriceCount = similarPriceSnapshot.docs.length;
      const similarPriceResults = processQueryResults(similarPriceSnapshot);
      
      // Query 5: Count listings with related games
      let relatedGamesCount = 0;
      let relatedGamesResults: Listing[] = [];
      
      if (relatedGames.length > 1) { // More than just the current game
        // Create an array of OR conditions for related games
        const gameQueries = relatedGames
          .filter(game => game !== currentListing.game) // Exclude the current game
          .map(game => where('game', '==', game));
        
        if (gameQueries.length > 0) {
          const relatedGamesQuery = query(
            listingsRef,
            where('status', '==', 'active'),
            or(...gameQueries)
          );
          
          const relatedGamesSnapshot = await getDocs(relatedGamesQuery);
          relatedGamesCount = relatedGamesSnapshot.docs.length;
          relatedGamesResults = processQueryResults(relatedGamesSnapshot);
        }
      }
      
      // Query 6: Exact match query (same game + card name)
      let exactMatchResults: Listing[] = [];
      
      if (currentListing.cardName) {
        const exactMatchQuery = query(
          listingsRef,
          where('status', '==', 'active'),
          where('game', '==', currentListing.game),
          where('cardName', '==', currentListing.cardName),
          where(documentId(), '!=', currentListing.id)
        );
        
        const exactMatchSnapshot = await getDocs(exactMatchQuery);
        exactMatchResults = processQueryResults(exactMatchSnapshot);
      }
      
      // Query 7: Same game + similar price range
      const gameAndPriceQuery = query(
        listingsRef,
        where('status', '==', 'active'),
        where('game', '==', currentListing.game),
        where('price', '>=', priceRange.min),
        where('price', '<=', priceRange.max),
        where(documentId(), '!=', currentListing.id)
      );
      
      const gameAndPriceSnapshot = await getDocs(gameAndPriceQuery);
      const gameAndPriceResults = processQueryResults(gameAndPriceSnapshot);
      
      // Query 8: Last resort - any active listings
      const lastResortQuery = query(
        listingsRef,
        where('status', '==', 'active'),
        where(documentId(), '!=', currentListing.id),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      
      const lastResortSnapshot = await getDocs(lastResortQuery);
      const lastResortResults = processQueryResults(lastResortSnapshot);
      
      setDebugResults({
        activeListingsCount,
        sameGameCount,
        sameCardNameCount,
        similarPriceCount,
        relatedGamesCount,
        queriesRun: 8,
        queryResults: {
          exactMatch: exactMatchResults,
          gameAndPrice: gameAndPriceResults,
          sameCardName: sameCardNameResults,
          similarPrice: similarPriceResults.slice(0, 5), // Limit to 5 for display
          relatedGames: relatedGamesResults.slice(0, 5), // Limit to 5 for display
          lastResort: lastResortResults
        },
        error: null,
        isLoading: false
      });
      
    } catch (error) {
      console.error('Error running diagnostics:', error);
      setDebugResults(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : String(error),
        isLoading: false
      }));
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Similar Listings Diagnostics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <div><strong>Current Listing:</strong> {currentListing.title}</div>
            <div><strong>Game:</strong> {currentListing.game}</div>
            {currentListing.cardName && <div><strong>Card Name:</strong> {currentListing.cardName}</div>}
            <div><strong>Price:</strong> ${currentListing.price.toFixed(2)}</div>
            <div><strong>Condition:</strong> {currentListing.condition}</div>
            <div><strong>Related Games:</strong> {getRelatedGameCategories(currentListing.game).join(', ')}</div>
          </div>
          
          <Separator />
          
          <Button 
            onClick={runDiagnostics} 
            disabled={debugResults.isLoading}
            className="w-full"
          >
            {debugResults.isLoading ? 'Running Diagnostics...' : 'Run Diagnostics'}
          </Button>
          
          {debugResults.error && (
            <div className="text-red-500 mt-2">
              Error: {debugResults.error}
            </div>
          )}
          
          {!debugResults.isLoading && debugResults.queriesRun > 0 && (
            <div className="space-y-4 mt-4">
              <h3 className="text-lg font-semibold">Diagnostic Results</h3>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 border rounded">
                  <div className="font-medium">Active Listings</div>
                  <div className="text-2xl">{debugResults.activeListingsCount}</div>
                </div>
                <div className="p-2 border rounded">
                  <div className="font-medium">Same Game</div>
                  <div className="text-2xl">{debugResults.sameGameCount}</div>
                </div>
                <div className="p-2 border rounded">
                  <div className="font-medium">Same Card Name</div>
                  <div className="text-2xl">{debugResults.sameCardNameCount}</div>
                </div>
                <div className="p-2 border rounded">
                  <div className="font-medium">Similar Price</div>
                  <div className="text-2xl">{debugResults.similarPriceCount}</div>
                </div>
              </div>
              
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="exactMatch">
                  <AccordionTrigger>
                    Exact Match Results ({debugResults.queryResults.exactMatch?.length || 0})
                  </AccordionTrigger>
                  <AccordionContent>
                    {debugResults.queryResults.exactMatch?.length > 0 ? (
                      <div className="space-y-2">
                        {debugResults.queryResults.exactMatch.map(listing => (
                          <div key={listing.id} className="p-2 border rounded">
                            <div className="font-medium">{listing.title}</div>
                            <div className="text-sm text-gray-500">
                              {listing.game} | ${listing.price.toFixed(2)} | {listing.condition}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500">No exact matches found</div>
                    )}
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="gameAndPrice">
                  <AccordionTrigger>
                    Same Game + Similar Price ({debugResults.queryResults.gameAndPrice?.length || 0})
                  </AccordionTrigger>
                  <AccordionContent>
                    {debugResults.queryResults.gameAndPrice?.length > 0 ? (
                      <div className="space-y-2">
                        {debugResults.queryResults.gameAndPrice.map(listing => (
                          <div key={listing.id} className="p-2 border rounded">
                            <div className="font-medium">{listing.title}</div>
                            <div className="text-sm text-gray-500">
                              {listing.game} | ${listing.price.toFixed(2)} | {listing.condition}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500">No matches found</div>
                    )}
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="lastResort">
                  <AccordionTrigger>
                    Last Resort Results ({debugResults.queryResults.lastResort?.length || 0})
                  </AccordionTrigger>
                  <AccordionContent>
                    {debugResults.queryResults.lastResort?.length > 0 ? (
                      <div className="space-y-2">
                        {debugResults.queryResults.lastResort.map(listing => (
                          <div key={listing.id} className="p-2 border rounded">
                            <div className="font-medium">{listing.title}</div>
                            <div className="text-sm text-gray-500">
                              {listing.game} | ${listing.price.toFixed(2)} | {listing.condition}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500">No active listings found</div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};