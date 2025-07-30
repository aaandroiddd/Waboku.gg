import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useOffers } from '@/hooks/useOffers';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Bug, Eye } from 'lucide-react';

export default function DashboardOfferDebugger() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDebugging, setIsDebugging] = useState(false);
  const [debugResults, setDebugResults] = useState<any>(null);

  // Use the same hook as the dashboard overview
  const { receivedOffers, loading: offersLoading, error: offersError, fetchOffers } = useOffers();

  // Replicate the same filtering logic as DashboardOverview
  const safeReceivedOffers = React.useMemo(() => {
    try {
      const offers = Array.isArray(receivedOffers) ? receivedOffers.filter(Boolean) : [];
      console.log('DashboardOfferDebugger - Processing received offers:', {
        totalOffers: offers.length,
        rawReceivedOffers: receivedOffers,
        offers: offers.map(offer => ({
          id: offer.id,
          amount: offer.amount,
          status: offer.status,
          listingTitle: offer.listingSnapshot?.title,
          createdAt: offer.createdAt,
          cleared: offer.cleared,
          expiresAt: offer.expiresAt,
          isExpired: offer.expiresAt ? new Date() > new Date(offer.expiresAt) : false
        }))
      });
      
      // Filter to show non-cleared offers that are still relevant for the dashboard
      // Include pending, accepted, countered, and non-expired offers
      const activeOffers = offers.filter(offer => {
        const isNotCleared = !offer.cleared;
        const now = new Date();
        const isExpired = offer.expiresAt ? now > new Date(offer.expiresAt) : false;
        
        // Include all non-cleared offers that haven't expired, regardless of status
        // This matches the behavior of the offers page more closely
        const shouldInclude = isNotCleared && !isExpired;
        
        console.log(`DashboardOfferDebugger - Offer ${offer.id}: cleared=${offer.cleared}, status=${offer.status}, expired=${isExpired}, shouldInclude=${shouldInclude}`);
        
        return shouldInclude;
      });
      
      console.log('DashboardOfferDebugger - Filtered active offers:', {
        totalActiveOffers: activeOffers.length,
        activeOffers: activeOffers.map(offer => ({
          id: offer.id,
          amount: offer.amount,
          status: offer.status,
          listingTitle: offer.listingSnapshot?.title,
          expiresAt: offer.expiresAt,
          isExpired: offer.expiresAt ? new Date() > new Date(offer.expiresAt) : false
        }))
      });
      
      return activeOffers;
    } catch (error) {
      console.warn('DashboardOfferDebugger - Error processing offers:', error);
      return [];
    }
  }, [receivedOffers]);

  const handleDebugOffers = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    setIsDebugging(true);
    try {
      console.log('=== DASHBOARD OFFER DEBUG START ===');
      
      // Get current state
      const currentState = {
        user: {
          uid: user.uid,
          email: user.email
        },
        hookState: {
          receivedOffers: receivedOffers,
          offersLoading: offersLoading,
          offersError: offersError,
          receivedOffersLength: receivedOffers?.length || 0
        },
        filteredOffers: {
          safeReceivedOffers: safeReceivedOffers,
          safeReceivedOffersLength: safeReceivedOffers?.length || 0
        },
        timestamp: new Date().toISOString()
      };

      console.log('Current Dashboard State:', currentState);

      // Test API endpoint directly
      const token = await user.getIdToken();
      const apiResponse = await fetch('/api/offers/get-offers', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      let apiData = null;
      if (apiResponse.ok) {
        apiData = await apiResponse.json();
        console.log('API Response:', apiData);
      } else {
        const errorText = await apiResponse.text();
        console.error('API Error:', {
          status: apiResponse.status,
          statusText: apiResponse.statusText,
          error: errorText
        });
      }

      // Test direct Firebase query
      let firebaseData = null;
      try {
        const { getFirebaseServices } = await import('@/lib/firebase');
        const { db } = getFirebaseServices();
        const { collection, query, where, orderBy, getDocs } = await import('firebase/firestore');
        
        const receivedOffersQuery = query(
          collection(db, 'offers'),
          where('sellerId', '==', user.uid),
          where('status', 'in', ['pending', 'accepted', 'declined', 'countered', 'cancelled', 'expired']),
          orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(receivedOffersQuery);
        firebaseData = {
          totalDocs: snapshot.docs.length,
          offers: snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              amount: data.amount,
              status: data.status,
              cleared: data.cleared,
              expiresAt: data.expiresAt?.toDate(),
              listingTitle: data.listingSnapshot?.title,
              createdAt: data.createdAt?.toDate()
            };
          })
        };
        console.log('Direct Firebase Query:', firebaseData);
      } catch (firebaseError) {
        console.error('Firebase Query Error:', firebaseError);
        firebaseData = { error: firebaseError.message };
      }

      const debugResults = {
        currentState,
        apiData,
        firebaseData,
        comparison: {
          hookVsApi: {
            hookCount: receivedOffers?.length || 0,
            apiCount: apiData?.receivedOffers?.length || 0,
            match: (receivedOffers?.length || 0) === (apiData?.receivedOffers?.length || 0)
          },
          hookVsFirebase: {
            hookCount: receivedOffers?.length || 0,
            firebaseCount: firebaseData?.totalDocs || 0,
            match: (receivedOffers?.length || 0) === (firebaseData?.totalDocs || 0)
          }
        }
      };

      setDebugResults(debugResults);
      console.log('=== DASHBOARD OFFER DEBUG END ===');

      toast({
        title: "Debug Complete",
        description: "Check the browser console and results below for detailed information",
      });

    } catch (error: any) {
      console.error('Debug Error:', error);
      toast({
        title: "Debug Error",
        description: error.message || "An error occurred during debugging",
        variant: "destructive",
      });
    } finally {
      setIsDebugging(false);
    }
  };

  const handleRefreshOffers = async () => {
    try {
      await fetchOffers();
      toast({
        title: "Refreshed",
        description: "Offers have been refreshed",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to refresh offers",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Dashboard Offer Debugger
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={handleDebugOffers}
              disabled={isDebugging || !user}
            >
              {isDebugging ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Debugging...
                </>
              ) : (
                <>
                  <Bug className="mr-2 h-4 w-4" />
                  Debug Offers
                </>
              )}
            </Button>
            <Button 
              variant="outline"
              onClick={handleRefreshOffers}
              disabled={offersLoading || !user}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Offers
            </Button>
          </div>

          {!user && (
            <div className="text-red-600">
              User not authenticated - please sign in first
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Hook State */}
      <Card>
        <CardHeader>
          <CardTitle>Current Hook State (Same as Dashboard Overview)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <strong>Loading:</strong> {offersLoading ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Error:</strong> {offersError || 'None'}
            </div>
            <div>
              <strong>Raw Received Offers:</strong> {receivedOffers?.length || 0}
            </div>
            <div>
              <strong>Filtered Offers (Dashboard Logic):</strong> {safeReceivedOffers?.length || 0}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtered Offers Display */}
      <Card>
        <CardHeader>
          <CardTitle>Filtered Offers (Dashboard Overview Logic)</CardTitle>
        </CardHeader>
        <CardContent>
          {offersLoading ? (
            <div className="space-y-3">
              {Array(3).fill(0).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div>
                    <Skeleton className="h-4 w-16 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          ) : safeReceivedOffers && safeReceivedOffers.length > 0 ? (
            <div className="space-y-3">
              {safeReceivedOffers.slice(0, 5).map((offer) => (
                <div key={offer.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium text-sm">${offer.amount}</p>
                    <p className="text-xs text-muted-foreground">
                      {offer.listingSnapshot?.title || 'Unknown listing'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ID: {offer.id}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={offer.status === 'pending' ? 'default' : 'secondary'}>
                      {offer.status}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      Cleared: {offer.cleared ? 'Yes' : 'No'}
                    </div>
                    {offer.expiresAt && (
                      <div className="text-xs text-muted-foreground">
                        Expires: {new Date(offer.expiresAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No offers found (same as dashboard)</p>
          )}
        </CardContent>
      </Card>

      {/* Debug Results */}
      {debugResults && (
        <Card>
          <CardHeader>
            <CardTitle>Debug Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold">Comparison Summary:</h4>
                <div className="mt-2 space-y-1">
                  <div>Hook vs API: {debugResults.comparison.hookVsApi.hookCount} vs {debugResults.comparison.hookVsApi.apiCount} 
                    <Badge variant={debugResults.comparison.hookVsApi.match ? 'default' : 'destructive'} className="ml-2">
                      {debugResults.comparison.hookVsApi.match ? 'Match' : 'Mismatch'}
                    </Badge>
                  </div>
                  <div>Hook vs Firebase: {debugResults.comparison.hookVsFirebase.hookCount} vs {debugResults.comparison.hookVsFirebase.firebaseCount}
                    <Badge variant={debugResults.comparison.hookVsFirebase.match ? 'default' : 'destructive'} className="ml-2">
                      {debugResults.comparison.hookVsFirebase.match ? 'Match' : 'Mismatch'}
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold">Raw Debug Data:</h4>
                <pre className="mt-2 p-4 bg-muted rounded-lg text-xs overflow-auto max-h-96">
                  {JSON.stringify(debugResults, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}