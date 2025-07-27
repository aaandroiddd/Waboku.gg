import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useAuth } from '@/contexts/AuthContext';
import { useAccount } from '@/contexts/AccountContext';
import { ACCOUNT_TIERS } from '@/types/account';
import { Listing } from '@/types/database';
import { AlertCircle, RefreshCw, Clock, User, Database } from "lucide-react";

interface ListingExpirationDebuggerProps {
  listings: Listing[];
  visible?: boolean;
}

interface ExpirationAnalysis {
  listingId: string;
  title: string;
  status: string;
  createdAt: Date;
  expiresAt: Date | null;
  accountTier: string;
  expectedDuration: number;
  actualDuration: number | null;
  isCorrect: boolean;
  issues: string[];
  calculatedExpiry: Date;
}

export function ListingExpirationDebugger({ listings, visible = false }: ListingExpirationDebuggerProps) {
  const { user } = useAuth();
  const { accountTier, features, isLoading: accountLoading } = useAccount();
  const [analysis, setAnalysis] = useState<ExpirationAnalysis[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const analyzeListings = () => {
    if (!user || !listings.length) return;

    setIsAnalyzing(true);
    const results: ExpirationAnalysis[] = [];

    listings.forEach(listing => {
      const issues: string[] = [];
      
      // Parse dates safely
      let createdAt: Date;
      let expiresAt: Date | null = null;
      
      try {
        if (listing.createdAt instanceof Date) {
          createdAt = listing.createdAt;
        } else if (typeof listing.createdAt === 'object' && listing.createdAt && 'toDate' in listing.createdAt) {
          createdAt = (listing.createdAt as any).toDate();
        } else {
          createdAt = new Date(listing.createdAt);
        }
      } catch (e) {
        createdAt = new Date();
        issues.push('Invalid createdAt timestamp');
      }

      try {
        if (listing.expiresAt) {
          if (listing.expiresAt instanceof Date) {
            expiresAt = listing.expiresAt;
          } else if (typeof listing.expiresAt === 'object' && listing.expiresAt && 'toDate' in listing.expiresAt) {
            expiresAt = (listing.expiresAt as any).toDate();
          } else {
            expiresAt = new Date(listing.expiresAt);
          }
        }
      } catch (e) {
        issues.push('Invalid expiresAt timestamp');
      }

      // Get the listing's stored account tier vs current user tier
      const listingTier = listing.accountTier || 'free';
      const currentTier = accountTier || 'free';
      
      if (listingTier !== currentTier) {
        issues.push(`Listing tier (${listingTier}) doesn't match current user tier (${currentTier})`);
      }

      // Calculate expected duration based on current account tier
      const expectedDuration = ACCOUNT_TIERS[currentTier as 'free' | 'premium'].listingDuration;
      const calculatedExpiry = new Date(createdAt.getTime() + (expectedDuration * 60 * 60 * 1000));

      // Calculate actual duration if expiresAt exists
      let actualDuration: number | null = null;
      if (expiresAt) {
        actualDuration = Math.round((expiresAt.getTime() - createdAt.getTime()) / (60 * 60 * 1000));
      } else {
        issues.push('No expiresAt field found');
      }

      // Check if expiration is correct
      let isCorrect = true;
      if (expiresAt) {
        const timeDiff = Math.abs(expiresAt.getTime() - calculatedExpiry.getTime());
        const hoursDiff = timeDiff / (60 * 60 * 1000);
        
        // Allow for small differences (up to 1 hour) due to timing
        if (hoursDiff > 1) {
          isCorrect = false;
          issues.push(`Expiration time is off by ${Math.round(hoursDiff)} hours`);
        }
      } else {
        isCorrect = false;
      }

      // Check if listing is expired but still active
      const now = new Date();
      if (listing.status === 'active' && expiresAt && expiresAt < now) {
        issues.push('Listing is expired but still marked as active');
        isCorrect = false;
      }

      results.push({
        listingId: listing.id,
        title: listing.title,
        status: listing.status,
        createdAt,
        expiresAt,
        accountTier: listingTier,
        expectedDuration,
        actualDuration,
        isCorrect,
        issues,
        calculatedExpiry
      });
    });

    setAnalysis(results);
    setIsAnalyzing(false);
  };

  useEffect(() => {
    if (visible && listings.length > 0 && !accountLoading) {
      analyzeListings();
    }
  }, [visible, listings, accountTier, accountLoading]);

  const fixListingExpiration = async (listingId: string) => {
    if (!user) return;

    try {
      const response = await fetch('/api/listings/fix-expiration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({
          listingId,
          accountTier
        })
      });

      if (response.ok) {
        // Re-analyze after fix
        analyzeListings();
      }
    } catch (error) {
      console.error('Error fixing listing expiration:', error);
    }
  };

  const fixAllListings = async () => {
    if (!user) return;

    const problematicListings = analysis.filter(a => !a.isCorrect);
    
    for (const listing of problematicListings) {
      await fixListingExpiration(listing.listingId);
    }
  };

  if (!visible) return null;

  const problematicCount = analysis.filter(a => !a.isCorrect).length;
  const totalCount = analysis.length;

  return (
    <Card className="mb-6 border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
          <Clock className="h-5 w-5" />
          Listing Expiration Debugger
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="text-sm">Current Tier: </span>
              <Badge variant={accountTier === 'premium' ? 'default' : 'secondary'}>
                {accountTier} ({ACCOUNT_TIERS[accountTier as 'free' | 'premium'].listingDuration}h)
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <span className="text-sm">
                {problematicCount} of {totalCount} listings have issues
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={analyzeListings}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Re-analyze
            </Button>
            {problematicCount > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={fixAllListings}
              >
                Fix All Issues
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? 'Hide' : 'Show'} Details
            </Button>
          </div>
        </div>

        {problematicCount > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Found {problematicCount} listing(s) with incorrect expiration times. 
              This can cause listings to show wrong countdown timers or expire at incorrect times.
            </AlertDescription>
          </Alert>
        )}

        {showDetails && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {analysis.map((item) => (
              <div
                key={item.listingId}
                className={`p-3 rounded-lg border ${
                  item.isCorrect 
                    ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                    : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-sm truncate">{item.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      <div>Status: {item.status} | Tier: {item.accountTier}</div>
                      <div>Created: {item.createdAt.toLocaleString()}</div>
                      {item.expiresAt && (
                        <div>Expires: {item.expiresAt.toLocaleString()}</div>
                      )}
                      <div>Should expire: {item.calculatedExpiry.toLocaleString()}</div>
                      {item.actualDuration && (
                        <div>
                          Duration: {item.actualDuration}h (expected: {item.expectedDuration}h)
                        </div>
                      )}
                    </div>
                    {item.issues.length > 0 && (
                      <div className="mt-2">
                        {item.issues.map((issue, idx) => (
                          <div key={idx} className="text-xs text-red-600 dark:text-red-400">
                            • {issue}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Badge variant={item.isCorrect ? 'default' : 'destructive'}>
                      {item.isCorrect ? 'OK' : 'Issue'}
                    </Badge>
                    {!item.isCorrect && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fixListingExpiration(item.listingId)}
                      >
                        Fix
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}