import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

export default function FixSubscriptionsPage() {
  const router = useRouter();
  const [adminSecret, setAdminSecret] = useState('');
  const [userId, setUserId] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if admin secret is in URL
  useEffect(() => {
    const { adminSecret: secretFromUrl } = router.query;
    if (secretFromUrl) {
      setAdminSecret(secretFromUrl as string);
      checkAuthorization(secretFromUrl as string);
    }
  }, [router.query]);

  const checkAuthorization = async (secret: string) => {
    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': secret
        }
      });

      if (response.ok) {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
        setError('Invalid admin secret');
      }
    } catch (err) {
      setError('Failed to verify admin secret');
      setIsAuthorized(false);
    }
  };

  const handleAuthorize = async () => {
    setError(null);
    await checkAuthorization(adminSecret);
  };

  const fixSpecificUser = async () => {
    if (!userId) {
      setError('Please enter a user ID');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/stripe/fix-subscription-downgrades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret
        },
        body: JSON.stringify({ userId })
      });

      const data = await response.json();
      
      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to fix subscription');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const fixAllUsers = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/stripe/fix-subscription-downgrades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret
        },
        body: JSON.stringify({})
      });

      const data = await response.json();
      
      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to fix subscriptions');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="container mx-auto py-10">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Admin Authorization</CardTitle>
            <CardDescription>
              Enter the admin secret to access subscription fixing tools
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Input
                type="password"
                placeholder="Admin Secret"
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
              />
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleAuthorize} disabled={!adminSecret}>
              Authorize
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Fix Subscription Downgrades</h1>
      
      <Tabs defaultValue="specific">
        <TabsList className="mb-4">
          <TabsTrigger value="specific">Fix Specific User</TabsTrigger>
          <TabsTrigger value="all">Fix All Users</TabsTrigger>
        </TabsList>
        
        <TabsContent value="specific">
          <Card>
            <CardHeader>
              <CardTitle>Fix Subscription for Specific User</CardTitle>
              <CardDescription>
                Enter a user ID to fix their subscription status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Input
                  placeholder="User ID"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                />
                {error && (
                  <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={fixSpecificUser} disabled={isLoading || !userId}>
                {isLoading ? 'Fixing...' : 'Fix Subscription'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>Fix All User Subscriptions</CardTitle>
              <CardDescription>
                This will scan for and fix all users with inconsistent subscription data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={fixAllUsers} disabled={isLoading}>
                {isLoading ? 'Fixing All Users...' : 'Fix All Subscriptions'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
      
      {result && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Results</h2>
          
          {result.status === 'fixed' && (
            <Alert className="mb-4">
              <AlertTitle>Subscription Fixed</AlertTitle>
              <AlertDescription>
                The subscription for user {result.userId} has been fixed.
              </AlertDescription>
            </Alert>
          )}
          
          {result.status === 'consistent' && (
            <Alert>
              <AlertTitle>No Issues Found</AlertTitle>
              <AlertDescription>
                The subscription data for user {result.userId} is already consistent.
              </AlertDescription>
            </Alert>
          )}
          
          {result.fixed !== undefined && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p><strong>Total Users Checked:</strong> {result.total}</p>
                  <p><strong>Fixed:</strong> {result.fixed}</p>
                  <p><strong>Already Consistent:</strong> {result.consistent}</p>
                  <p><strong>Errors:</strong> {result.errors}</p>
                </div>
              </CardContent>
            </Card>
          )}
          
          {result.before && result.after && (
            <Card>
              <CardHeader>
                <CardTitle>Subscription Data Changes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium mb-2">Before</h3>
                    <div className="bg-muted p-4 rounded-md">
                      <p><strong>Firestore Tier:</strong> {result.before.firestore.tier}</p>
                      <p><strong>Firestore Status:</strong> {result.before.firestore.status}</p>
                      <p><strong>Firestore End Date:</strong> {result.before.firestore.endDate || 'N/A'}</p>
                      <Separator className="my-2" />
                      <p><strong>Realtime Tier:</strong> {result.before.realtime.tier}</p>
                      <p><strong>Realtime Status:</strong> {result.before.realtime.status}</p>
                      <p><strong>Realtime End Date:</strong> {result.before.realtime.endDate || 'N/A'}</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">After</h3>
                    <div className="bg-muted p-4 rounded-md">
                      <p><strong>Tier:</strong> {result.after.tier}</p>
                      <p><strong>Status:</strong> {result.after.status}</p>
                      <p><strong>End Date:</strong> {result.after.endDate || 'N/A'}</p>
                      <p><strong>Renewal Date:</strong> {result.after.renewalDate || 'N/A'}</p>
                      <p><strong>Manually Updated:</strong> {result.after.manuallyUpdated ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {result.details && result.details.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">Detailed Results</h3>
              <div className="space-y-4">
                {result.details.map((detail: any, index: number) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="text-base">User: {detail.userId}</CardTitle>
                      <CardDescription>Status: {detail.status}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p>{detail.message}</p>
                      
                      {detail.before && detail.after && (
                        <div className="mt-4 text-sm">
                          <p><strong>Before:</strong> {detail.before.firestore.tier} / {detail.before.realtime.tier}</p>
                          <p><strong>After:</strong> {detail.after.tier}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}