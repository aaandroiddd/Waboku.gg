import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Listing } from "@/types/database";
import { useAuth } from '@/contexts/AuthContext';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useLoading } from '@/hooks/useLoading';
import { RestoredListingFixer } from '@/components/RestoredListingFixer';
import { ListingExpirationDebugger } from '@/components/ListingExpirationDebugger';

interface ListingVisibilityFixerProps {
  onRefresh: () => Promise<void>;
  isLoading: boolean;
}

export function ListingVisibilityFixer({ onRefresh, isLoading }: ListingVisibilityFixerProps) {
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<{
    totalListings: number;
    activeListings: number;
    visibleListings: number;
    issues: string[];
    fixAttempted: boolean;
    fixSuccessful: boolean;
  } | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const [connectionError, setConnectionError] = useState<string | null>(null);
  const { isLoading: loadingState, withLoading } = useLoading();

  const runDiagnosis = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to diagnose listing issues",
        variant: "destructive",
      });
      return;
    }

    try {
      setDiagnosing(true);
      setDiagnosisResult(null);
      setConnectionError(null);
      
      console.log("Starting listing visibility diagnosis");
      
      // Wrap Firebase operations in a try-catch with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Firebase connection timed out")), 10000);
      });
      
      // Fetch all user listings directly from Firestore with timeout
      const fetchListings = async () => {
        try {
          const { db } = await getFirebaseServices();
          const listingsRef = collection(db, 'listings');
          const q = query(
            listingsRef, 
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc')
          );
          
          return await getDocs(q);
        } catch (error) {
          console.error("Firebase fetch error:", error);
          throw new Error(`Firebase connection error: ${error instanceof Error ? error.message : String(error)}`);
        }
      };
      
      // Race between the fetch and the timeout
      const querySnapshot = await Promise.race([fetchListings(), timeoutPromise])
        .catch(error => {
          setConnectionError(error.message);
          throw error;
        }) as any;
      
      // Process the results
      const allListings: Listing[] = [];
      const issues: string[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        try {
          // Convert timestamps to dates
          const createdAt = data.createdAt?.toDate() || new Date();
          const expiresAt = data.expiresAt?.toDate() || new Date();
          
          const listing = {
            id: doc.id,
            ...data,
            createdAt,
            expiresAt,
            price: Number(data.price) || 0,
          } as Listing;
          
          allListings.push(listing);
          
          // Check for potential issues
          if (!listing.status) {
            issues.push(`Listing ${doc.id} has no status field`);
          }
          
          if (listing.status === 'active') {
            // Check if the listing has expired
            if (new Date() > expiresAt) {
              issues.push(`Listing ${doc.id} has expired but is still marked as active`);
            }
            
            // Check for missing required fields
            if (!listing.title) issues.push(`Active listing ${doc.id} is missing a title`);
            if (!listing.price && listing.price !== 0) issues.push(`Active listing ${doc.id} is missing a price`);
            
            // Check for image issues
            if (!listing.imageUrls || !Array.isArray(listing.imageUrls) || listing.imageUrls.length === 0) {
              issues.push(`Active listing ${doc.id} has no images`);
            }
          }
        } catch (error) {
          console.error(`Error processing listing ${doc.id}:`, error);
          issues.push(`Error processing listing ${doc.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
      
      // Count active listings
      const activeListings = allListings.filter(listing => listing.status === 'active');
      
      // Count visible listings (active and not expired)
      const now = new Date();
      const visibleListings = activeListings.filter(listing => {
        return now <= listing.expiresAt;
      });
      
      // Set diagnosis result
      setDiagnosisResult({
        totalListings: allListings.length,
        activeListings: activeListings.length,
        visibleListings: visibleListings.length,
        issues,
        fixAttempted: false,
        fixSuccessful: false
      });
      
      console.log("Diagnosis complete:", {
        totalListings: allListings.length,
        activeListings: activeListings.length,
        visibleListings: visibleListings.length,
        issues
      });
      
    } catch (error) {
      console.error("Error during diagnosis:", error);
      toast({
        title: "Diagnosis failed",
        description: `Error: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
    } finally {
      setDiagnosing(false);
    }
  };

  const attemptFix = async () => {
    if (!user || !diagnosisResult) return;
    
    try {
      setDiagnosing(true);
      
      console.log("Attempting to fix listing visibility issues");
      
      // Clear all listing-related caches
      if (typeof window !== 'undefined') {
        const cacheKeys = Object.keys(localStorage).filter(key => 
          key.startsWith('listings_')
        );
        
        for (const key of cacheKeys) {
          localStorage.removeItem(key);
          console.log(`Cleared cache: ${key}`);
        }
      }
      
      // Call the API to fix expired listings
      const response = await fetch('/api/listings/fix-expired', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.uid }),
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${await response.text()}`);
      }
      
      const result = await response.json();
      console.log("Fix result:", result);
      
      // Update diagnosis result
      setDiagnosisResult({
        ...diagnosisResult,
        fixAttempted: true,
        fixSuccessful: true
      });
      
      // Refresh listings
      await onRefresh();
      
      toast({
        title: "Fix attempted",
        description: "Listing visibility issues have been addressed. Your dashboard has been refreshed.",
      });
      
    } catch (error) {
      console.error("Error fixing issues:", error);
      
      setDiagnosisResult({
        ...diagnosisResult,
        fixAttempted: true,
        fixSuccessful: false
      });
      
      toast({
        title: "Fix failed",
        description: `Error: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
    } finally {
      setDiagnosing(false);
    }
  };

  return (
    <div className="space-y-4">
      {connectionError && (
        <Alert variant="destructive">
          <WifiOff className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-2">
              <p>There was a problem connecting to the database: {connectionError}</p>
              <p>This could be due to network issues or temporary service disruption.</p>
              <div className="mt-4">
                <Button 
                  onClick={() => {
                    setConnectionError(null);
                    runDiagnosis();
                  }}
                  variant="outline"
                >
                  Try Again
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {diagnosisResult && !connectionError ? (
        <Alert variant={diagnosisResult.issues.length > 0 ? "destructive" : "default"}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Listing Visibility Diagnosis</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-2">
              <p>Total listings: {diagnosisResult.totalListings}</p>
              <p>Active listings: {diagnosisResult.activeListings}</p>
              <p>Visible listings: {diagnosisResult.visibleListings}</p>
              
              {diagnosisResult.issues.length > 0 ? (
                <>
                  <p className="font-semibold">Issues found:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    {diagnosisResult.issues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                  
                  {!diagnosisResult.fixAttempted ? (
                    <Button 
                      onClick={attemptFix} 
                      disabled={diagnosing}
                      className="mt-2"
                    >
                      {diagnosing ? "Fixing..." : "Attempt Fix"}
                    </Button>
                  ) : (
                    <p className={diagnosisResult.fixSuccessful ? "text-green-500" : "text-red-500"}>
                      {diagnosisResult.fixSuccessful 
                        ? "Fix was successful. Your listings should now display correctly." 
                        : "Fix attempt failed. Please try again or contact support."}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-green-500 mt-2">No issues found with your listings.</p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
      
      <div className="flex gap-4">
        <Button 
          variant="outline" 
          onClick={runDiagnosis} 
          disabled={diagnosing || isLoading}
        >
          {diagnosing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Diagnosing...
            </>
          ) : (
            "Diagnose Listing Issues"
          )}
        </Button>
        
        <Button 
          variant="outline" 
          onClick={onRefresh} 
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            "Refresh Listings"
          )}
        </Button>
      </div>
      
      {/* Add the RestoredListingFixer component */}
      <div className="mt-6">
        <h3 className="text-lg font-medium mb-4">Fix Restored Listings</h3>
        <p className="text-muted-foreground mb-4">
          If you've restored listings from archived status and they're not appearing on the front page or in search results,
          use this tool to fix them.
        </p>
        <RestoredListingFixer />
      </div>
      
      {/* Add the ListingExpirationDebugger component */}
      <div className="mt-6">
        <h3 className="text-lg font-medium mb-4">Fix Listing Expiration Issues</h3>
        <p className="text-muted-foreground mb-4">
          If your listings are incorrectly showing as expired, use this tool to check and fix expiration dates.
        </p>
        <ListingExpirationDebugger />
      </div>
    </div>
  );
}