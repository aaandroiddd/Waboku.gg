import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export function ListingDebugger() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    total: number;
    active: number;
    byGame: Record<string, number>;
  }>({
    total: 0,
    active: 0,
    byGame: {}
  });

  const fetchListings = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { db } = await getFirebaseServices();
      if (!db) {
        throw new Error('Firebase DB is not initialized');
      }
      
      const listingsRef = collection(db, 'listings');
      const q = query(listingsRef, limit(100));
      const snapshot = await getDocs(q);
      
      const fetchedListings: Listing[] = [];
      const gameStats: Record<string, number> = {};
      let activeCount = 0;
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const listing = {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          expiresAt: data.expiresAt?.toDate() || new Date(),
          price: Number(data.price) || 0,
          imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
          isGraded: Boolean(data.isGraded),
          status: data.status || 'active',
          condition: data.condition || 'Not specified',
          game: data.game || 'Not specified',
          city: data.city || 'Unknown',
          state: data.state || 'Unknown',
        } as Listing;
        
        fetchedListings.push(listing);
        
        // Track stats
        if (listing.status === 'active') {
          activeCount++;
        }
        
        if (listing.game) {
          gameStats[listing.game] = (gameStats[listing.game] || 0) + 1;
        }
      });
      
      setListings(fetchedListings);
      setStats({
        total: fetchedListings.length,
        active: activeCount,
        byGame: gameStats
      });
    } catch (err) {
      console.error('Error fetching listings:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Listing Debugger</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button onClick={fetchListings} disabled={loading}>
            {loading ? 'Loading...' : 'Fetch Listings'}
          </Button>
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {listings.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-secondary rounded-md">
                  <div className="font-semibold">Total Listings</div>
                  <div className="text-2xl">{stats.total}</div>
                </div>
                <div className="p-3 bg-secondary rounded-md">
                  <div className="font-semibold">Active Listings</div>
                  <div className="text-2xl">{stats.active}</div>
                </div>
                <div className="p-3 bg-secondary rounded-md">
                  <div className="font-semibold">Games</div>
                  <div className="text-2xl">{Object.keys(stats.byGame).length}</div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="font-semibold mb-2">Listings by Game</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.byGame).map(([game, count]) => (
                    <Badge key={game} variant="outline">
                      {game}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="font-semibold mb-2">Sample Listings</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {listings.slice(0, 10).map((listing) => (
                    <div key={listing.id} className="p-2 border rounded-md">
                      <div className="flex justify-between">
                        <span className="font-medium">{listing.title}</span>
                        <Badge variant={listing.status === 'active' ? 'default' : 'secondary'}>
                          {listing.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Game: {listing.game} | Condition: {listing.condition} | Price: ${listing.price}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        ID: {listing.id}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}