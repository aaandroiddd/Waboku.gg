import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, WifiOff, Check } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { getFirebaseServices } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { Skeleton } from "@/components/ui/skeleton";

export function ListingDebuggerTool() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<{
    connectionStatus: 'success' | 'error';
    listingsCount: number;
    activeListingsCount: number;
    errors: string[];
    fixAttempted: boolean;
    fixSuccessful: boolean;
  } | null>(null);
  const { toast } = useToast();
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const runDiagnostics = async () => {
    try {
      setIsRunning(true);
      setResults(null);
      setConnectionError(null);
      
      console.log("Starting listing diagnostics");
      
      // Set a timeout for the connection check
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Connection timed out")), 10000);
      });
      
      // Try to fetch listings from Firestore
      const fetchData = async () => {
        const { db } = await getFirebaseServices();
        
        // First check if we can connect at all
        const testQuery = query(collection(db, 'listings'), limit(1));
        const testSnapshot = await getDocs(testQuery);
        
        // Now fetch all active listings
        const listingsRef = collection(db, 'listings');
        const activeQuery = query(
          listingsRef, 
          where('status', '==', 'active'),
          orderBy('createdAt', 'desc')
        );
        
        const activeSnapshot = await getDocs(activeQuery);
        
        // Fetch all listings regardless of status
        const allQuery = query(
          listingsRef,
          orderBy('createdAt', 'desc')
        );
        
        const allSnapshot = await getDocs(allQuery);
        
        return {
          activeListings: activeSnapshot.docs,
          allListings: allSnapshot.docs
        };
      };
      
      // Race between the fetch and the timeout
      const data = await Promise.race([fetchData(), timeoutPromise])
        .catch(error => {
          setConnectionError(error.message);
          throw error;
        }) as any;
      
      // Process the results
      const errors: string[] = [];
      
      // Check for common issues
      if (data.activeListings.length === 0 && data.allListings.length > 0) {
        errors.push("No active listings found, but there are listings with other statuses");
      }
      
      if (data.allListings.length === 0) {
        errors.push("No listings found in the database at all");
      }
      
      // Set results
      setResults({
        connectionStatus: 'success',
        listingsCount: data.allListings.length,
        activeListingsCount: data.activeListings.length,
        errors,
        fixAttempted: false,
        fixSuccessful: false
      });
      
      console.log("Diagnostics complete:", {
        totalListings: data.allListings.length,
        activeListings: data.activeListings.length,
        errors
      });
      
    } catch (error) {
      console.error("Error during diagnostics:", error);
      toast({
        title: "Diagnostics failed",
        description: `Error: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const attemptFix = async () => {
    if (!results) return;
    
    try {
      setIsRunning(true);
      
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
        body: JSON.stringify({}),
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${await response.text()}`);
      }
      
      const result = await response.json();
      console.log("Fix result:", result);
      
      // Update results
      setResults({
        ...results,
        fixAttempted: true,
        fixSuccessful: true
      });
      
      toast({
        title: "Fix attempted",
        description: "Listing visibility issues have been addressed. Please refresh the page to see the changes.",
      });
      
    } catch (error) {
      console.error("Error fixing issues:", error);
      
      setResults({
        ...results,
        fixAttempted: true,
        fixSuccessful: false
      });
      
      toast({
        title: "Fix failed",
        description: `Error: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h3 className="text-lg font-medium">Listing Visibility Diagnostics</h3>
      
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
                    runDiagnostics();
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
      
      {results && !connectionError ? (
        <Alert variant={results.errors.length > 0 ? "destructive" : "default"}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Listing Visibility Diagnosis</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-2">
              <p>Total listings in database: {results.listingsCount}</p>
              <p>Active listings: {results.activeListingsCount}</p>
              
              {results.errors.length > 0 ? (
                <>
                  <p className="font-semibold">Issues found:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    {results.errors.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                  
                  {!results.fixAttempted ? (
                    <Button 
                      onClick={attemptFix} 
                      disabled={isRunning}
                      className="mt-2"
                    >
                      {isRunning ? "Fixing..." : "Attempt Fix"}
                    </Button>
                  ) : (
                    <p className={results.fixSuccessful ? "text-green-500" : "text-red-500"}>
                      {results.fixSuccessful 
                        ? "Fix was successful. Please refresh the page to see the changes." 
                        : "Fix attempt failed. Please try again or contact support."}
                    </p>
                  )}
                </>
              ) : (
                <div className="flex items-center text-green-500 mt-2">
                  <Check className="h-4 w-4 mr-2" />
                  <p>No issues found with listings visibility.</p>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
      
      {isRunning ? (
        <div className="space-y-2">
          <div className="flex items-center">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            <p>Running diagnostics...</p>
          </div>
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <Button 
          variant="outline" 
          onClick={runDiagnostics} 
          disabled={isRunning}
        >
          Run Listing Diagnostics
        </Button>
      )}
    </div>
  );
}