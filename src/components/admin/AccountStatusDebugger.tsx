import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Crown, User, RefreshCw, Search } from 'lucide-react';

interface AccountStatusData {
  userId: string;
  accountTier: string;
  isPremium: boolean;
  subscription: {
    status: string;
    stripeSubscriptionId?: string;
    startDate?: string;
    endDate?: string;
    renewalDate?: string;
  };
  source: string;
  lastChecked: number;
}

export default function AccountStatusDebugger() {
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [accountData, setAccountData] = useState<AccountStatusData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkAccountStatus = async () => {
    if (!userId.trim()) {
      setError('Please enter a user ID');
      return;
    }

    setLoading(true);
    setError(null);
    setAccountData(null);

    try {
      const response = await fetch('/api/admin/debug-account-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId.trim(),
          adminSecret: process.env.NEXT_PUBLIC_ADMIN_SECRET
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to check account status');
      }

      setAccountData(data);
    } catch (err: any) {
      console.error('Account status check error:', err);
      setError(err.message || 'Failed to check account status');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Account Status Debugger
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter user ID to check account status"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && checkAccountStatus()}
          />
          <Button 
            onClick={checkAccountStatus} 
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Check
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}

        {accountData && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="font-semibold">Account Information</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>User ID:</span>
                    <span className="font-mono text-xs">{accountData.userId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Account Tier:</span>
                    <div className="flex items-center gap-2">
                      {accountData.isPremium ? (
                        <>
                          <Crown className="h-4 w-4 text-yellow-500" />
                          <Badge variant="default" className="bg-yellow-500">Premium</Badge>
                        </>
                      ) : (
                        <>
                          <User className="h-4 w-4 text-muted-foreground" />
                          <Badge variant="secondary">Free</Badge>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span>Data Source:</span>
                    <Badge variant="outline">{accountData.source}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Checked:</span>
                    <span className="text-xs">{formatDate(new Date(accountData.lastChecked).toISOString())}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Subscription Details</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <Badge variant={accountData.subscription.status === 'active' ? 'default' : 'secondary'}>
                      {accountData.subscription.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Stripe ID:</span>
                    <span className="font-mono text-xs">
                      {accountData.subscription.stripeSubscriptionId || 'None'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Start Date:</span>
                    <span className="text-xs">{formatDate(accountData.subscription.startDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>End Date:</span>
                    <span className="text-xs">{formatDate(accountData.subscription.endDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Renewal Date:</span>
                    <span className="text-xs">{formatDate(accountData.subscription.renewalDate)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-2">Status Summary</h3>
              <div className="text-sm space-y-1">
                <p>
                  <strong>Current Status:</strong> This user has a{' '}
                  <strong className={accountData.isPremium ? 'text-yellow-600' : 'text-gray-600'}>
                    {accountData.accountTier}
                  </strong>{' '}
                  account with subscription status{' '}
                  <strong>{accountData.subscription.status}</strong>.
                </p>
                {accountData.subscription.stripeSubscriptionId && (
                  <p>
                    <strong>Stripe Integration:</strong> Connected with ID{' '}
                    <code className="text-xs bg-muted px-1 rounded">
                      {accountData.subscription.stripeSubscriptionId}
                    </code>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}