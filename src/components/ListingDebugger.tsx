import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Listing } from '@/types/database';
import { parseDate, isExpired } from '@/lib/date-utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface ListingDebuggerProps {
  listingId: string;
}

export function ListingDebugger({ listingId }: ListingDebuggerProps) {
  const [listing, setListing] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibilityChecks, setVisibilityChecks] = useState<{
    check: string;
    passed: boolean;
    details: string;
  }[]>([]);

  useEffect(() => {
    async function fetchListing() {
      try {
        setLoading(true);
        setError(null);
        
        const { db } = await getFirebaseServices();
        const listingRef = doc(db, 'listings', listingId);
        const listingSnap = await getDoc(listingRef);
        
        if (!listingSnap.exists()) {
          setError('Listing not found');
          return;
        }
        
        const data = listingSnap.data();
        setListing(data);
        
        // Perform visibility checks
        const checks = [];
        
        // Check 1: Status
        checks.push({
          check: 'Status Check',
          passed: data.status === 'active',
          details: `Status is "${data.status}" (should be "active")`
        });
        
        // Check 2: Expiration
        const now = new Date();
        const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : parseDate(data.expiresAt, null);
        
        if (!expiresAt) {
          checks.push({
            check: 'Expiration Check',
            passed: false,
            details: 'Could not parse expiration date'
          });
        } else {
          const isExpired = now > expiresAt;
          checks.push({
            check: 'Expiration Check',
            passed: !isExpired,
            details: `Expires at ${expiresAt.toISOString()} (${isExpired ? 'expired' : 'not expired'})`
          });
        }
        
        // Check 3: Required Fields
        const requiredFields = ['title', 'price', 'imageUrls', 'userId', 'username'];
        const missingFields = requiredFields.filter(field => !data[field]);
        
        checks.push({
          check: 'Required Fields Check',
          passed: missingFields.length === 0,
          details: missingFields.length === 0 
            ? 'All required fields are present' 
            : `Missing fields: ${missingFields.join(', ')}`
        });
        
        // Check 4: Image URLs
        const hasValidImages = Array.isArray(data.imageUrls) && data.imageUrls.length > 0;
        
        checks.push({
          check: 'Images Check',
          passed: hasValidImages,
          details: hasValidImages 
            ? `Has ${data.imageUrls.length} images` 
            : 'No valid images found'
        });
        
        // Check 5: Terms Accepted
        checks.push({
          check: 'Terms Accepted Check',
          passed: data.termsAccepted === true,
          details: `Terms accepted: ${data.termsAccepted === true ? 'Yes' : 'No'}`
        });
        
        setVisibilityChecks(checks);
      } catch (err: any) {
        console.error('Error fetching listing:', err);
        setError(err.message || 'Error fetching listing');
      } finally {
        setLoading(false);
      }
    }
    
    if (listingId) {
      fetchListing();
    }
  }, [listingId]);

  const clearListingCache = () => {
    try {
      // Clear all listing-related caches
      const cacheKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('listings_')
      );
      
      for (const key of cacheKeys) {
        localStorage.removeItem(key);
      }
      
      alert('Listing cache cleared successfully. Please refresh the page.');
    } catch (error) {
      console.error('Error clearing cache:', error);
      alert('Error clearing cache. Please try again.');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!listing) {
    return null;
  }

  // Calculate overall visibility status
  const isVisible = visibilityChecks.every(check => check.passed);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Listing Visibility Debugger</span>
          <Badge variant={isVisible ? "success" : "destructive"}>
            {isVisible ? 'Should be visible' : 'Has visibility issues'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Listing Details</h3>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="text-sm font-medium">ID:</div>
              <div className="text-sm">{listingId}</div>
              
              <div className="text-sm font-medium">Title:</div>
              <div className="text-sm">{listing.title}</div>
              
              <div className="text-sm font-medium">Status:</div>
              <div className="text-sm">{listing.status}</div>
              
              <div className="text-sm font-medium">Game:</div>
              <div className="text-sm">{listing.game}</div>
              
              <div className="text-sm font-medium">Created:</div>
              <div className="text-sm">
                {listing.createdAt?.toDate 
                  ? listing.createdAt.toDate().toLocaleString() 
                  : String(listing.createdAt)}
              </div>
              
              <div className="text-sm font-medium">Expires:</div>
              <div className="text-sm">
                {listing.expiresAt?.toDate 
                  ? listing.expiresAt.toDate().toLocaleString() 
                  : String(listing.expiresAt)}
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div>
            <h3 className="text-lg font-medium">Visibility Checks</h3>
            <div className="space-y-2 mt-2">
              {visibilityChecks.map((check, index) => (
                <div key={index} className="flex items-start gap-2 p-2 rounded-md bg-secondary/50">
                  {check.passed 
                    ? <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" /> 
                    : <XCircle className="h-5 w-5 text-red-500 mt-0.5" />}
                  <div>
                    <div className="font-medium">{check.check}</div>
                    <div className="text-sm text-muted-foreground">{check.details}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <Separator />
          
          <div className="flex flex-col gap-4">
            <div className="flex justify-between">
              <Button variant="outline" onClick={clearListingCache}>
                Clear Listing Cache
              </Button>
              
              <Button onClick={() => window.location.reload()}>
                Refresh Page
              </Button>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Fix Listing</h3>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/listings/fix-specific', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ 
                          listingId,
                          action: 'debug'
                        }),
                      });
                      
                      const data = await response.json();
                      alert(JSON.stringify(data, null, 2));
                    } catch (error) {
                      console.error('Error debugging listing:', error);
                      alert('Error debugging listing. See console for details.');
                    }
                  }}
                >
                  Debug Listing
                </Button>
                
                <Button 
                  variant="default" 
                  onClick={async () => {
                    if (confirm('Are you sure you want to reactivate this listing?')) {
                      try {
                        const response = await fetch('/api/listings/fix-specific', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ 
                            listingId,
                            action: 'reactivate'
                          }),
                        });
                        
                        const data = await response.json();
                        alert('Listing reactivated successfully. Please refresh the page.');
                      } catch (error) {
                        console.error('Error reactivating listing:', error);
                        alert('Error reactivating listing. See console for details.');
                      }
                    }
                  }}
                >
                  Reactivate Listing
                </Button>
                
                <Button 
                  variant="destructive" 
                  onClick={async () => {
                    if (confirm('Are you sure you want to archive this listing?')) {
                      try {
                        const response = await fetch('/api/listings/fix-specific', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ 
                            listingId,
                            action: 'archive'
                          }),
                        });
                        
                        const data = await response.json();
                        alert('Listing archived successfully. Please refresh the page.');
                      } catch (error) {
                        console.error('Error archiving listing:', error);
                        alert('Error archiving listing. See console for details.');
                      }
                    }
                  }}
                >
                  Archive Listing
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}