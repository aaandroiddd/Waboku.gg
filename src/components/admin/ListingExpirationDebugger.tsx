import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ACCOUNT_TIERS } from '@/types/account';

interface ListingExpirationDebuggerProps {}

interface DebugResult {
  listingId: string;
  exists: boolean;
  data?: any;
  calculatedExpiration?: {
    fromCreatedAt: string;
    fromExpiresAt: string;
    accountTier: string;
    tierDuration: number;
    shouldHaveExpiredAt: string;
    actualArchivedAt?: string;
    timeDifference?: string;
    wasArchivedEarly?: boolean;
    wasArchivedLate?: boolean;
  };
  error?: string;
}

export function ListingExpirationDebugger({}: ListingExpirationDebuggerProps) {
  const [listingId, setListingId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DebugResult | null>(null);

  const debugListing = async () => {
    if (!listingId.trim()) {
      alert('Please enter a listing ID');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/debug/listing-expiration-debug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ listingId: listingId.trim() }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error debugging listing:', error);
      setResult({
        listingId: listingId.trim(),
        exists: false,
        error: 'Failed to debug listing: ' + (error as Error).message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      });
    } catch (error) {
      return dateString;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Listing Expiration Debugger</CardTitle>
        <CardDescription>
          Debug why a listing was archived at a specific time vs when it should have been archived
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter listing ID"
            value={listingId}
            onChange={(e) => setListingId(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && debugListing()}
          />
          <Button onClick={debugListing} disabled={isLoading}>
            {isLoading ? 'Debugging...' : 'Debug Listing'}
          </Button>
        </div>

        {result && (
          <div className="space-y-4">
            <Separator />
            
            <div>
              <h3 className="font-semibold mb-2">Debug Results for: {result.listingId}</h3>
              
              {result.error ? (
                <Alert variant="destructive">
                  <AlertDescription>{result.error}</AlertDescription>
                </Alert>
              ) : !result.exists ? (
                <Alert variant="destructive">
                  <AlertDescription>Listing not found</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {/* Basic Listing Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Basic Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <strong>Title:</strong> {result.data?.title || 'N/A'}
                        </div>
                        <div>
                          <strong>Status:</strong> 
                          <Badge variant={result.data?.status === 'active' ? 'default' : 'secondary'} className="ml-2">
                            {result.data?.status || 'N/A'}
                          </Badge>
                        </div>
                        <div>
                          <strong>User ID:</strong> {result.data?.userId || 'N/A'}
                        </div>
                        <div>
                          <strong>Account Tier:</strong> 
                          <Badge variant={result.data?.accountTier === 'premium' ? 'default' : 'outline'} className="ml-2">
                            {result.data?.accountTier || 'N/A'}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Timestamp Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Timestamps</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <strong>Created At:</strong> {result.data?.createdAt ? formatDate(result.data.createdAt) : 'N/A'}
                      </div>
                      <div>
                        <strong>Expires At (stored):</strong> {result.data?.expiresAt ? formatDate(result.data.expiresAt) : 'N/A'}
                      </div>
                      {result.data?.archivedAt && (
                        <div>
                          <strong>Archived At:</strong> {formatDate(result.data.archivedAt)}
                        </div>
                      )}
                      {result.data?.updatedAt && (
                        <div>
                          <strong>Updated At:</strong> {formatDate(result.data.updatedAt)}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Expiration Analysis */}
                  {result.calculatedExpiration && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Expiration Analysis</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <strong>Account Tier:</strong> 
                            <Badge variant={result.calculatedExpiration.accountTier === 'premium' ? 'default' : 'outline'} className="ml-2">
                              {result.calculatedExpiration.accountTier}
                            </Badge>
                            <span className="ml-2 text-sm text-muted-foreground">
                              ({result.calculatedExpiration.tierDuration} hours duration)
                            </span>
                          </div>
                          
                          <div>
                            <strong>Should Have Expired At:</strong> 
                            <span className="ml-2">{formatDate(result.calculatedExpiration.shouldHaveExpiredAt)}</span>
                          </div>
                          
                          {result.calculatedExpiration.actualArchivedAt && (
                            <>
                              <div>
                                <strong>Actually Archived At:</strong> 
                                <span className="ml-2">{formatDate(result.calculatedExpiration.actualArchivedAt)}</span>
                              </div>
                              
                              <div>
                                <strong>Time Difference:</strong> 
                                <span className="ml-2">{result.calculatedExpiration.timeDifference}</span>
                              </div>
                              
                              {result.calculatedExpiration.wasArchivedEarly && (
                                <Alert variant="destructive">
                                  <AlertDescription>
                                    ⚠️ This listing was archived EARLY! It should have remained active longer.
                                  </AlertDescription>
                                </Alert>
                              )}
                              
                              {result.calculatedExpiration.wasArchivedLate && (
                                <Alert>
                                  <AlertDescription>
                                    ℹ️ This listing was archived LATE. It should have been archived earlier.
                                  </AlertDescription>
                                </Alert>
                              )}
                              
                              {!result.calculatedExpiration.wasArchivedEarly && !result.calculatedExpiration.wasArchivedLate && (
                                <Alert>
                                  <AlertDescription>
                                    ✅ This listing was archived at the correct time.
                                  </AlertDescription>
                                </Alert>
                              )}
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Account Tier Reference */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Account Tier Reference</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <strong>Free Tier:</strong> {ACCOUNT_TIERS.free.listingDuration} hours ({ACCOUNT_TIERS.free.listingDuration / 24} days)
                        </div>
                        <div>
                          <strong>Premium Tier:</strong> {ACCOUNT_TIERS.premium.listingDuration} hours ({ACCOUNT_TIERS.premium.listingDuration / 24} days)
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Raw Data */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Raw Data</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}