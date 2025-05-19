import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

export function ListingRestorationTool() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const restoreListings = async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const token = await user.getIdToken();
      
      const response = await fetch('/api/listings/restore-archived', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to restore listings');
      }
      
      setResult(data);
    } catch (err: any) {
      console.error('Error restoring listings:', err);
      setError(err.message || 'An error occurred while restoring listings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Listing Restoration Tool</CardTitle>
        <CardDescription>
          If you have a premium account but some of your listings were incorrectly archived,
          you can use this tool to restore them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {result && (
          <Alert variant={result.success ? "default" : "destructive"} className="mb-4">
            {result.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              {result.success ? "Success" : "Error"}
            </AlertTitle>
            <AlertDescription>
              {result.message}
              {result.restoredCount > 0 && (
                <p className="mt-2">
                  Restored {result.restoredCount} out of {result.totalFound} archived listings.
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}
        
        <p className="text-sm text-muted-foreground mb-4">
          This tool will check for listings that were archived due to expiration but should still be active
          based on your premium account status. Any eligible listings will be automatically restored.
        </p>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={restoreListings} 
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Restoring...
            </>
          ) : (
            'Restore Incorrectly Archived Listings'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}