import React, { useState } from 'react';
import { GetServerSideProps } from 'next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { verifyAdminAuth } from '@/middleware/adminAuth';

export const getServerSideProps: GetServerSideProps = async (context) => {
  return verifyAdminAuth(context);
};

export default function AccountTierSyncPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const triggerSync = async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const token = await user.getIdToken();
      
      const response = await fetch('/api/admin/sync-account-tiers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}`
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to sync account tiers');
      }
      
      setResult(data);
    } catch (err: any) {
      console.error('Error syncing account tiers:', err);
      setError(err.message || 'An error occurred while syncing account tiers');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Account Tier Sync</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Sync Account Tiers</CardTitle>
          <CardDescription>
            This tool will sync account tiers for all users based on their Stripe subscription status.
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
                {result.stats && (
                  <div className="mt-2">
                    <p>Total users: {result.stats.totalUsers}</p>
                    <p>Processed users: {result.stats.processedUsers}</p>
                    <p>Updated users: {result.stats.updatedUsers}</p>
                    <p>Failed users: {result.stats.failedUsers}</p>
                    <p>Skipped users: {result.stats.skippedUsers}</p>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
          
          <p className="text-sm text-muted-foreground mb-4">
            This process will:
          </p>
          <ul className="list-disc pl-5 text-sm text-muted-foreground mb-4 space-y-1">
            <li>Check all users in the database</li>
            <li>Verify their subscription status in Stripe</li>
            <li>Update their account tier in Firestore</li>
            <li>Ensure consistency between subscription data and account tier</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            This process may take several minutes to complete depending on the number of users.
          </p>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={triggerSync} 
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing Account Tiers...
              </>
            ) : (
              'Sync Account Tiers'
            )}
          </Button>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Sync</CardTitle>
          <CardDescription>
            Information about the scheduled account tier sync job.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-2">
            A background job runs every 6 hours to automatically sync account tiers for all users.
          </p>
          <p className="text-sm mb-2">
            The job is scheduled to run at: <code>0 */6 * * *</code> (every 6 hours at minute 0)
          </p>
          <p className="text-sm text-muted-foreground">
            You can manually trigger the sync using the button above if you need to sync immediately.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}