import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';
import { parseDate } from '@/lib/date-utils';
import { Listing } from '@/types/database';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

export function ListingsGridDebugger() {
  const [debugInfo, setDebugInfo] = useState<any>({
    status: 'idle',
    rawListings: [],
    visibleListings: [],
    filteredReasons: {},
    error: null
  });
  const [expanded, setExpanded] = useState(false);

  const fetchAndDebugListings = async () => {
    setDebugInfo(prev => ({ ...prev, status: 'loading' }));
    
    try {
      // Get Firebase services
      const { db } = await getFirebaseServices();
      if (!db) {
        throw new Error('Firebase Firestore is not initialized');
      }
      
      // Create query for active listings
      const listingsRef = collection(db, 'listings');
      const q = query(
        listingsRef, 
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc')
      );
      
      // Fetch listings
      const querySnapshot = await getDocs(q);
      console.log(`[ListingsGridDebugger] Fetched ${querySnapshot.docs.length} listings from Firestore`);
      
      // Process raw listings
      const rawListings = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          expiresAt: data.expiresAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      });
      
      // Apply visibility filtering logic manually
      const filteredReasons: Record<string, string> = {};
      const visibleListings = rawListings.filter(listing => {
        // Skip listings without proper ID
        if (!listing || !listing.id) {
          filteredReasons[listing?.id || 'unknown'] = 'Missing listing ID';
          return false;
        }
        
        try {
          // Check if the listing has a status field and it's active
          if (listing.status !== 'active') {
            filteredReasons[listing.id] = `Status is "${listing.status}" (not "active")`;
            return false;
          }
          
          // Check if the listing has expired
          const now = new Date();
          let expiresAt = null;
          
          // Handle different date formats
          if (listing.expiresAt instanceof Date) {
            expiresAt = listing.expiresAt;
          } else if (typeof listing.expiresAt === 'object' && listing.expiresAt && 'toDate' in listing.expiresAt) {
            // Handle Firestore Timestamp
            try {
              // @ts-ignore - Firestore timestamp
              expiresAt = listing.expiresAt.toDate();
            } catch (e) {
              console.error(`Failed to convert Firestore timestamp for listing ${listing.id}:`, e);
            }
          } else {
            // Try to parse as string or number
            expiresAt = parseDate(listing.expiresAt, null);
          }
          
          // If we couldn't parse the date, skip this listing
          if (!expiresAt) {
            filteredReasons[listing.id] = 'Invalid expiration date';
            return false;
          }
          
          // Check if the listing has expired
          if (now > expiresAt) {
            filteredReasons[listing.id] = `Expired on ${expiresAt.toISOString()}`;
            return false;
          }
          
          // Check for required fields
          const requiredFields = ['title', 'price', 'userId', 'username'];
          const missingFields = requiredFields.filter(field => !listing[field as keyof Listing]);
          
          if (missingFields.length > 0) {
            filteredReasons[listing.id] = `Missing required fields: ${missingFields.join(', ')}`;
            return false;
          }
          
          // Check for valid images
          if (!listing.imageUrls) {
            filteredReasons[listing.id] = 'imageUrls is undefined or null';
            return false;
          }
          
          if (!Array.isArray(listing.imageUrls)) {
            filteredReasons[listing.id] = `imageUrls is not an array: ${typeof listing.imageUrls}`;
            return false;
          }
          
          if (listing.imageUrls.length === 0) {
            filteredReasons[listing.id] = 'imageUrls array is empty';
            return false;
          }
          
          // Verify the first image URL is valid
          const firstImageUrl = listing.imageUrls[0];
          if (!firstImageUrl || typeof firstImageUrl !== 'string' || !firstImageUrl.startsWith('http')) {
            filteredReasons[listing.id] = `Invalid first image URL: ${firstImageUrl}`;
            return false;
          }
          
          // Include the listing if it passes all checks
          return true;
        } catch (error) {
          filteredReasons[listing.id] = `Error: ${error instanceof Error ? error.message : String(error)}`;
          return false;
        }
      });
      
      // Update state with results
      setDebugInfo({
        status: 'success',
        rawListings,
        visibleListings,
        filteredReasons,
        error: null
      });
      
    } catch (error) {
      console.error('[ListingsGridDebugger] Error:', error);
      setDebugInfo({
        status: 'error',
        rawListings: [],
        visibleListings: [],
        filteredReasons: {},
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const clearListingsCache = () => {
    if (typeof window !== 'undefined') {
      try {
        const cacheKeys = Object.keys(localStorage).filter(key => 
          key.startsWith('listings_')
        );
        
        for (const key of cacheKeys) {
          localStorage.removeItem(key);
          console.log(`Cleared cache: ${key}`);
        }
        
        alert(`Cleared ${cacheKeys.length} listing cache entries. Please refresh the page.`);
      } catch (error) {
        console.error('Error clearing listing caches:', error);
        alert('Error clearing cache: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  };

  const fixExpiredListings = async () => {
    try {
      const response = await fetch('/api/listings/fix-expired', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(`Fixed ${data.fixed || 0} expired listings. Please refresh the page.`);
        // Clear cache after fixing
        clearListingsCache();
      } else {
        alert(`Error: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error fixing expired listings:', error);
      alert('Error fixing expired listings: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Listings Grid Debugger</CardTitle>
        <CardDescription>
          Diagnose issues with listings not appearing on the page
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={fetchAndDebugListings} variant="default">
              Fetch and Debug Listings
            </Button>
            <Button onClick={clearListingsCache} variant="outline">
              Clear Listings Cache
            </Button>
            <Button onClick={fixExpiredListings} variant="outline">
              Fix Expired Listings
            </Button>
            <Button onClick={() => setExpanded(!expanded)} variant="ghost">
              {expanded ? 'Hide Details' : 'Show Details'}
            </Button>
          </div>
          
          {debugInfo.status === 'loading' && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <div className="mt-2">Loading listings from Firestore...</div>
            </div>
          )}
          
          {debugInfo.status === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{debugInfo.error}</AlertDescription>
            </Alert>
          )}
          
          {debugInfo.status === 'success' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-secondary rounded-md">
                  <div className="font-semibold">Raw Listings</div>
                  <div className="text-2xl">{debugInfo.rawListings.length}</div>
                </div>
                <div className="p-3 bg-secondary rounded-md">
                  <div className="font-semibold">Visible Listings</div>
                  <div className="text-2xl">{debugInfo.visibleListings.length}</div>
                </div>
              </div>
              
              {debugInfo.rawListings.length > 0 && debugInfo.visibleListings.length === 0 && (
                <Alert variant="warning">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No Visible Listings</AlertTitle>
                  <AlertDescription>
                    All listings were filtered out! Check the reasons below.
                  </AlertDescription>
                </Alert>
              )}
              
              {debugInfo.rawListings.length === 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No Listings Found</AlertTitle>
                  <AlertDescription>
                    No listings were found in Firestore. This could be because there are no listings in the database,
                    or there might be an issue with the Firestore connection.
                  </AlertDescription>
                </Alert>
              )}
              
              <Separator />
              
              {expanded && (
                <>
                  <div className="mt-4">
                    <h3 className="font-semibold mb-2">Filter Reasons ({Object.keys(debugInfo.filteredReasons).length})</h3>
                    {Object.keys(debugInfo.filteredReasons).length > 0 ? (
                      <div className="max-h-60 overflow-y-auto border rounded-md p-2">
                        {Object.entries(debugInfo.filteredReasons).map(([id, reason]) => (
                          <div key={id} className="text-sm py-1 border-b last:border-0">
                            <span className="font-mono text-xs">{id}</span>: {reason}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">No listings were filtered out.</div>
                    )}
                  </div>
                  
                  <Separator />
                  
                  <div className="mt-4">
                    <h3 className="font-semibold mb-2">Sample Listings</h3>
                    {debugInfo.rawListings.slice(0, 3).map((listing: any) => (
                      <div key={listing.id} className="text-sm border rounded-md p-2 mb-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-mono text-xs">{listing.id}</span>
                          <Badge variant={listing.status === 'active' ? 'default' : 'secondary'}>
                            {listing.status}
                          </Badge>
                        </div>
                        <div><span className="font-semibold">Title:</span> {listing.title}</div>
                        <div>
                          <span className="font-semibold">Expires:</span> {
                            listing.expiresAt instanceof Date 
                              ? listing.expiresAt.toISOString() 
                              : String(listing.expiresAt)
                          }
                        </div>
                        <div>
                          <span className="font-semibold">Created:</span> {
                            listing.createdAt instanceof Date 
                              ? listing.createdAt.toISOString() 
                              : String(listing.createdAt)
                          }
                        </div>
                        <div><span className="font-semibold">Images:</span> {
                          Array.isArray(listing.imageUrls) 
                            ? `${listing.imageUrls.length} images` 
                            : 'No images'
                        }</div>
                        <div><span className="font-semibold">User:</span> {listing.username} ({listing.userId})</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}