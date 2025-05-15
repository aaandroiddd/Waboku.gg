import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, RefreshCw } from 'lucide-react';

export function ListingsFetchDebugger() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchListingsDirectly = async () => {
    if (!user) {
      setError('User not logged in');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { db } = await getFirebaseServices();
      if (!db) {
        throw new Error('Firebase Firestore is not initialized');
      }

      console.log('Directly fetching listings for user:', user.uid);
      
      const listingsRef = collection(db, 'listings');
      const q = query(
        listingsRef,
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      
      const fetchedListings = snapshot.docs.map(doc => {
        const data = doc.data();
        
        // Process timestamps for better display
        let createdAt, expiresAt, archivedAt;
        
        try {
          // Handle createdAt timestamp
          if (data.createdAt?.toDate) {
            createdAt = data.createdAt.toDate();
          } else if (data.createdAt) {
            createdAt = new Date(data.createdAt);
          }
          
          // Handle expiresAt timestamp
          if (data.expiresAt?.toDate) {
            expiresAt = data.expiresAt.toDate();
          } else if (data.expiresAt) {
            expiresAt = new Date(data.expiresAt);
          }
          
          // Handle archivedAt timestamp
          if (data.archivedAt?.toDate) {
            archivedAt = data.archivedAt.toDate();
          } else if (data.archivedAt) {
            archivedAt = new Date(data.archivedAt);
          }
        } catch (e) {
          console.error('Error processing timestamps:', e);
        }
        
        return {
          id: doc.id,
          ...data,
          createdAt,
          expiresAt,
          archivedAt
        };
      });

      console.log('Direct fetch results:', fetchedListings);
      
      setDebugInfo({
        timestamp: new Date().toISOString(),
        userId: user.uid,
        totalListings: fetchedListings.length,
        listingSample: fetchedListings.slice(0, 3).map(listing => ({
          id: listing.id,
          title: listing.title,
          status: listing.status,
          createdAt: listing.createdAt,
          expiresAt: listing.expiresAt,
          archivedAt: listing.archivedAt,
          offersOnly: listing.offersOnly
        })),
        hasActiveListings: fetchedListings.some(listing => listing.status === 'active'),
        hasArchivedListings: fetchedListings.some(listing => listing.status === 'archived'),
        statusCounts: fetchedListings.reduce((acc: any, listing) => {
          acc[listing.status || 'unknown'] = (acc[listing.status || 'unknown'] || 0) + 1;
          return acc;
        }, {})
      });
    } catch (err: any) {
      console.error('Error in direct listings fetch:', err);
      setError(err.message || 'Error fetching listings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="pb-3">
        <h3 className="text-lg font-medium">Listings Fetch Debugger</h3>
        <p className="text-sm text-muted-foreground">
          Diagnose issues with listings not appearing in your dashboard
        </p>
      </div>
      <div className="space-y-4">
        <Button 
          onClick={fetchListingsDirectly} 
          disabled={loading}
          variant="outline"
        >
          {loading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Check Listings in Firestore
            </>
          )}
        </Button>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {debugInfo && (
          <div className="mt-4">
            <div className="mb-2 flex justify-between items-center">
              <h3 className="font-semibold">Results</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? 'Show Less' : 'Show More'}
              </Button>
            </div>
            
            <div className="space-y-2 text-sm">
              <div><strong>Total Listings:</strong> {debugInfo.totalListings}</div>
              <div><strong>Status Counts:</strong> {Object.entries(debugInfo.statusCounts).map(([status, count]) => (
                <span key={status} className="mr-3">
                  {status}: {count}
                </span>
              ))}</div>
              
              {expanded && (
                <>
                  <div><strong>User ID:</strong> {debugInfo.userId}</div>
                  <div><strong>Timestamp:</strong> {debugInfo.timestamp}</div>
                  <div><strong>Has Active Listings:</strong> {debugInfo.hasActiveListings ? 'Yes' : 'No'}</div>
                  
                  {debugInfo.listingSample.length > 0 && (
                    <div className="mt-2">
                      <strong>Sample Listings:</strong>
                      <div className="mt-1 space-y-2">
                        {debugInfo.listingSample.map((listing: any) => (
                          <div key={listing.id} className="p-2 bg-muted rounded-md">
                            <div><strong>ID:</strong> {listing.id}</div>
                            <div><strong>Title:</strong> {listing.title}</div>
                            <div><strong>Status:</strong> {listing.status}</div>
                            <div><strong>Created:</strong> {listing.createdAt?.toString()}</div>
                            <div><strong>Expires:</strong> {listing.expiresAt?.toString()}</div>
                            {listing.archivedAt && (
                              <div><strong>Archived At:</strong> {listing.archivedAt?.toString()}</div>
                            )}
                            <div><strong>Offers Only:</strong> {listing.offersOnly ? 'Yes' : 'No'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}