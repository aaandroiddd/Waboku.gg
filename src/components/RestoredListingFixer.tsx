import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { useListings } from '@/hooks/useListings';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';

export function RestoredListingFixer() {
  const [isChecking, setIsChecking] = useState(false);
  const [results, setResults] = useState<{
    total: number;
    active: number;
    restored: number;
    fixed: number;
    issues: Array<{id: string, title: string, issue: string}>;
  }>({
    total: 0,
    active: 0,
    restored: 0,
    fixed: 0,
    issues: []
  });
  const [success, setSuccess] = useState(false);
  const { user } = useAuth();
  const { listings, refreshListings } = useListings({ 
    userId: user?.uid,
    showOnlyActive: false
  });

  const checkAndFixListings = async () => {
    if (!user) return;
    
    setIsChecking(true);
    setSuccess(false);
    
    try {
      const { db } = await getFirebaseServices();
      
      // Track results
      const checkResults = {
        total: listings.length,
        active: 0,
        restored: 0,
        fixed: 0,
        issues: [] as Array<{id: string, title: string, issue: string}>
      };
      
      // Check each listing
      for (const listing of listings) {
        // Count active listings
        if (listing.status === 'active') {
          checkResults.active++;
          
          // Check for signs of a restored listing with visibility issues
          const wasRestored = listing.previousStatus === 'archived' || 
                             (listing.updatedAt && listing.createdAt && 
                              new Date(listing.updatedAt).getTime() > new Date(listing.createdAt).getTime() + (24 * 60 * 60 * 1000));
          
          if (wasRestored) {
            checkResults.restored++;
            
            // Check for visibility issues
            const hasVisibilityIssues = listing.previousStatus || 
                                       listing.archivedAt || 
                                       listing.originalCreatedAt ||
                                       listing.expirationReason;
            
            if (hasVisibilityIssues) {
              // This listing needs to be fixed
              checkResults.issues.push({
                id: listing.id,
                title: listing.title,
                issue: 'Restored listing has leftover archive fields'
              });
              
              // Fix the listing
              try {
                const listingRef = doc(db, 'listings', listing.id);
                
                // Update to remove archive-related fields
                await updateDoc(listingRef, {
                  previousStatus: null,
                  previousExpiresAt: null,
                  archivedAt: null,
                  originalCreatedAt: null,
                  expirationReason: null,
                  soldTo: null
                });
                
                checkResults.fixed++;
              } catch (error) {
                console.error(`Error fixing listing ${listing.id}:`, error);
              }
            }
          }
        }
      }
      
      setResults(checkResults);
      setSuccess(true);
      
      // Refresh listings to see the changes
      if (checkResults.fixed > 0) {
        await refreshListings();
      }
    } catch (error) {
      console.error('Error checking listings:', error);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fix Restored Listings</CardTitle>
        <CardDescription>
          Fix visibility issues with listings that were restored from archived status
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {success && (
            <Alert variant={results.fixed > 0 ? "success" : "default"}>
              {results.fixed > 0 ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {results.fixed > 0 
                  ? `Fixed ${results.fixed} listing${results.fixed !== 1 ? 's' : ''}` 
                  : 'Check Complete'}
              </AlertTitle>
              <AlertDescription>
                {results.fixed > 0 
                  ? `Successfully fixed visibility issues with ${results.fixed} restored listing${results.fixed !== 1 ? 's' : ''}.`
                  : results.restored > 0 
                    ? `Found ${results.restored} restored listing${results.restored !== 1 ? 's' : ''}, but no issues were detected.`
                    : `Checked ${results.total} listings. No visibility issues found.`}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex flex-col space-y-2">
            <Button 
              onClick={checkAndFixListings} 
              disabled={isChecking}
            >
              {isChecking ? 'Checking...' : 'Check & Fix Restored Listings'}
            </Button>
            
            {results.issues.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium mb-2">Issues Found:</h3>
                <ul className="text-sm space-y-1">
                  {results.issues.map((issue, index) => (
                    <li key={index} className="text-muted-foreground">
                      • {issue.title}: {issue.issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}