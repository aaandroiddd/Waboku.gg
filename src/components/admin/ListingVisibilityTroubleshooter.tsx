import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';

export const ListingVisibilityTroubleshooter = () => {
  const { user } = useAuth();
  const [listings, setListings] = useState<any[]>([]);
  const [activeListings, setActiveListings] = useState<any[]>([]);
  const [visibleListings, setVisibleListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [diagnosisComplete, setDiagnosisComplete] = useState(false);
  const [restoredCheckComplete, setRestoredCheckComplete] = useState(false);
  const [expirationCheckComplete, setExpirationCheckComplete] = useState(false);
  const [hasIssues, setHasIssues] = useState(false);

  const diagnoseListings = async () => {
    if (!user) return;
    
    setLoading(true);
    const db = getFirestore();
    
    try {
      // Get all listings for the user
      const listingsQuery = query(
        collection(db, 'listings'),
        where('userId', '==', user.uid)
      );
      
      const listingsSnapshot = await getDocs(listingsQuery);
      const allListings = listingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Filter active listings (not expired, not archived)
      const now = new Date();
      const active = allListings.filter(listing => {
        const expirationDate = listing.expirationDate?.toDate?.() || new Date(listing.expirationDate);
        return !listing.archived && expirationDate > now;
      });
      
      // Filter visible listings (active + not hidden)
      const visible = active.filter(listing => !listing.hidden);
      
      setListings(allListings);
      setActiveListings(active);
      setVisibleListings(visible);
      setDiagnosisComplete(true);
      setHasIssues(allListings.length > 0 && visible.length === 0);
    } catch (error) {
      console.error("Error diagnosing listings:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkRestoredListings = async () => {
    setLoading(true);
    try {
      // Logic to check for restored listings with visibility issues
      // This would check for listings that were archived and then restored
      setRestoredCheckComplete(true);
    } catch (error) {
      console.error("Error checking restored listings:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkExpirationDates = async () => {
    setLoading(true);
    try {
      // Logic to check for listings with incorrect expiration dates
      setExpirationCheckComplete(true);
    } catch (error) {
      console.error("Error checking expiration dates:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshListings = () => {
    setDiagnosisComplete(false);
    setRestoredCheckComplete(false);
    setExpirationCheckComplete(false);
    diagnoseListings();
  };

  useEffect(() => {
    if (user) {
      diagnoseListings();
    }
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      {listings.length > 0 && visibleListings.length === 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Active Listings Visible</AlertTitle>
          <AlertDescription>
            You have {listings.length} total listings, but none are currently showing as active. 
            This could be due to expired listings, caching issues, or visibility problems. 
            Use the tools below to diagnose and fix the issue.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Listing Visibility Diagnosis</CardTitle>
          <CardDescription>Check the status of your listings</CardDescription>
        </CardHeader>
        <CardContent>
          {diagnosisComplete ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Total listings: {listings.length}</span>
                {listings.length > 0 && <CheckCircle className="h-4 w-4 text-green-500" />}
              </div>
              
              <div className="flex items-center justify-between">
                <span>Active listings: {activeListings.length}</span>
                {activeListings.length > 0 && <CheckCircle className="h-4 w-4 text-green-500" />}
              </div>
              
              <div className="flex items-center justify-between">
                <span>Visible listings: {visibleListings.length}</span>
                {visibleListings.length > 0 ? 
                  <CheckCircle className="h-4 w-4 text-green-500" /> : 
                  <AlertCircle className="h-4 w-4 text-red-500" />
                }
              </div>
              
              {hasIssues ? (
                <p className="text-red-500 mt-2">Issues found with your listings.</p>
              ) : (
                <p className="text-green-500 mt-2">No issues found with your listings.</p>
              )}
            </div>
          ) : (
            <p>Click the button below to diagnose your listings.</p>
          )}
          
          <Button 
            onClick={refreshListings} 
            className="mt-4"
            disabled={loading}
          >
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Diagnosing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Listings
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fix Restored Listings</CardTitle>
          <CardDescription>
            If you've restored listings from archived status and they're not appearing on the front page or in search results, use this tool to fix them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={checkRestoredListings} 
            className="w-full"
            disabled={loading}
          >
            Check & Fix Restored Listings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fix Listing Expiration Issues</CardTitle>
          <CardDescription>
            If your listings are incorrectly showing as expired, use this tool to check and fix expiration dates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={checkExpirationDates} 
            className="w-full"
            disabled={loading}
          >
            Check & Fix Expiration Dates
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ListingVisibilityTroubleshooter;