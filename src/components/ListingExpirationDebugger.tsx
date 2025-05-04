import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { useToast } from "@/components/ui/use-toast";

export function ListingExpirationDebugger() {
  const [isChecking, setIsChecking] = useState(false);
  const [results, setResults] = useState<{
    total: number;
    active: number;
    expiredCount: number;
    fixed: number;
    issues: Array<{id: string, title: string, issue: string}>;
  } | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const checkAndFixExpirations = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to check listings",
        variant: "destructive",
      });
      return;
    }

    setIsChecking(true);
    
    try {
      const { db } = await getFirebaseServices();
      
      // Track results
      const checkResults = {
        total: 0,
        active: 0,
        expiredCount: 0,
        fixed: 0,
        issues: [] as Array<{id: string, title: string, issue: string}>
      };
      
      // Fetch all user listings
      const listingsRef = collection(db, 'listings');
      const q = query(
        listingsRef, 
        where('userId', '==', user.uid),
        where('status', '==', 'active')
      );
      
      const querySnapshot = await getDocs(q);
      checkResults.total = querySnapshot.size;
      
      // Process each listing
      for (const docSnapshot of querySnapshot.docs) {
        const listing = docSnapshot.data();
        checkResults.active++;
        
        // Check expiration date
        let expiresAt = null;
        let createdAt = null;
        let hasExpirationIssue = false;
        
        // Parse createdAt
        try {
          if (listing.createdAt) {
            if ('toDate' in listing.createdAt) {
              createdAt = listing.createdAt.toDate();
            } else if ('seconds' in listing.createdAt) {
              createdAt = new Date(listing.createdAt.seconds * 1000);
            } else {
              createdAt = new Date(listing.createdAt);
            }
          }
        } catch (e) {
          console.error(`Error parsing createdAt for listing ${docSnapshot.id}:`, e);
        }
        
        // Parse expiresAt
        try {
          if (listing.expiresAt) {
            if ('toDate' in listing.expiresAt) {
              expiresAt = listing.expiresAt.toDate();
            } else if ('seconds' in listing.expiresAt) {
              expiresAt = new Date(listing.expiresAt.seconds * 1000);
            } else {
              expiresAt = new Date(listing.expiresAt);
            }
          }
        } catch (e) {
          console.error(`Error parsing expiresAt for listing ${docSnapshot.id}:`, e);
          hasExpirationIssue = true;
        }
        
        // If no valid expiresAt, calculate it from createdAt
        if (!expiresAt && createdAt) {
          const tierDuration = (listing.accountTier === 'premium' ? 720 : 48) * 60 * 60 * 1000;
          expiresAt = new Date(createdAt.getTime() + tierDuration);
          hasExpirationIssue = true;
        }
        
        // Check if the listing should be expired
        const now = new Date();
        if (expiresAt && now > expiresAt) {
          checkResults.expiredCount++;
          checkResults.issues.push({
            id: docSnapshot.id,
            title: listing.title || 'Untitled',
            issue: `Listing expired on ${expiresAt.toISOString()}`
          });
        }
        
        // Fix missing or incorrect expiresAt
        if (hasExpirationIssue && createdAt) {
          try {
            const tierDuration = (listing.accountTier === 'premium' ? 720 : 48) * 60 * 60 * 1000;
            const correctExpiresAt = new Date(createdAt.getTime() + tierDuration);
            
            // Update the document with the correct expiresAt
            await updateDoc(doc(db, 'listings', docSnapshot.id), {
              expiresAt: correctExpiresAt
            });
            
            checkResults.fixed++;
          } catch (e) {
            console.error(`Error fixing expiresAt for listing ${docSnapshot.id}:`, e);
          }
        }
      }
      
      setResults(checkResults);
      
      toast({
        title: "Check Complete",
        description: `Checked ${checkResults.total} listings, found ${checkResults.expiredCount} expired, fixed ${checkResults.fixed} with date issues.`,
        duration: 5000,
      });
      
    } catch (error) {
      console.error('Error checking listings:', error);
      toast({
        title: "Error",
        description: `Failed to check listings: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Listing Expiration Debugger</CardTitle>
        <CardDescription>
          Check and fix issues with listing expiration dates
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {results && (
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
                <div className="space-y-1 mt-2">
                  <p>Total listings: {results.total}</p>
                  <p>Active listings: {results.active}</p>
                  <p>Expired listings: {results.expiredCount}</p>
                  <p>Fixed listings: {results.fixed}</p>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          <Button 
            onClick={checkAndFixExpirations} 
            disabled={isChecking}
          >
            {isChecking ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              'Check & Fix Expiration Dates'
            )}
          </Button>
          
          {results && results.issues.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Issues Found:</h3>
              <div className="max-h-40 overflow-y-auto">
                <ul className="text-sm space-y-1">
                  {results.issues.map((issue, index) => (
                    <li key={index} className="text-muted-foreground">
                      • {issue.title}: {issue.issue}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}