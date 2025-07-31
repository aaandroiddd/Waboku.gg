import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle, Clock, Database, Users } from 'lucide-react';

interface AccountTierResult {
  tier: 'free' | 'premium';
  isPremium: boolean;
  source: 'cache' | 'database' | 'error';
  lastChecked: number;
  subscription?: {
    status: string;
    stripeSubscriptionId?: string;
    endDate?: string;
    renewalDate?: string;
  };
}

interface BatchTestResult {
  userId: string;
  result: AccountTierResult;
  error?: string;
}

export default function AccountTierDebugger() {
  const [singleUserId, setSingleUserId] = useState('');
  const [batchUserIds, setBatchUserIds] = useState('');
  const [singleResult, setSingleResult] = useState<AccountTierResult | null>(null);
  const [batchResults, setBatchResults] = useState<BatchTestResult[]>([]);
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testSingleUser = async () => {
    if (!singleUserId.trim()) {
      setError('Please enter a user ID');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSingleResult(null);

    try {
      const response = await fetch('/api/debug/test-account-tier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}`
        },
        body: JSON.stringify({
          action: 'single',
          userId: singleUserId.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to test account tier');
      }

      setSingleResult(data.result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const testBatchUsers = async () => {
    const userIds = batchUserIds
      .split('\n')
      .map(id => id.trim())
      .filter(id => id.length > 0);

    if (userIds.length === 0) {
      setError('Please enter at least one user ID');
      return;
    }

    if (userIds.length > 20) {
      setError('Maximum 20 user IDs allowed for batch testing');
      return;
    }

    setIsLoading(true);
    setError(null);
    setBatchResults([]);

    try {
      const response = await fetch('/api/debug/test-account-tier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}`
        },
        body: JSON.stringify({
          action: 'batch',
          userIds
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to test batch account tiers');
      }

      setBatchResults(data.results);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getCacheStats = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/debug/test-account-tier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}`
        },
        body: JSON.stringify({
          action: 'cache-stats'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get cache stats');
      }

      setCacheStats(data.stats);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const clearCache = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/debug/test-account-tier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}`
        },
        body: JSON.stringify({
          action: 'clear-cache'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to clear cache');
      }

      setCacheStats(null);
      alert('Cache cleared successfully');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'cache':
        return <Clock className="h-4 w-4" />;
      case 'database':
        return <Database className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'cache':
        return 'bg-blue-100 text-blue-800';
      case 'database':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5" />
        <h2 className="text-xl font-semibold">Account Tier Debugger</h2>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Single User Test */}
      <Card>
        <CardHeader>
          <CardTitle>Single User Test</CardTitle>
          <CardDescription>
            Test account tier detection for a single user
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter user ID"
              value={singleUserId}
              onChange={(e) => setSingleUserId(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={testSingleUser} 
              disabled={isLoading}
            >
              {isLoading ? 'Testing...' : 'Test User'}
            </Button>
          </div>

          {singleResult && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={singleResult.isPremium ? 'default' : 'secondary'}>
                    {singleResult.tier.toUpperCase()}
                  </Badge>
                  <Badge className={getSourceColor(singleResult.source)}>
                    <div className="flex items-center gap-1">
                      {getSourceIcon(singleResult.source)}
                      {singleResult.source}
                    </div>
                  </Badge>
                </div>
                <span className="text-sm text-gray-500">
                  {formatTimestamp(singleResult.lastChecked)}
                </span>
              </div>

              {singleResult.subscription && (
                <div className="space-y-2">
                  <h4 className="font-medium">Subscription Details:</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium">Status:</span> {singleResult.subscription.status}
                    </div>
                    {singleResult.subscription.stripeSubscriptionId && (
                      <div>
                        <span className="font-medium">Stripe ID:</span> {singleResult.subscription.stripeSubscriptionId}
                      </div>
                    )}
                    {singleResult.subscription.endDate && (
                      <div>
                        <span className="font-medium">End Date:</span> {new Date(singleResult.subscription.endDate).toLocaleDateString()}
                      </div>
                    )}
                    {singleResult.subscription.renewalDate && (
                      <div>
                        <span className="font-medium">Renewal Date:</span> {new Date(singleResult.subscription.renewalDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch User Test */}
      <Card>
        <CardHeader>
          <CardTitle>Batch User Test</CardTitle>
          <CardDescription>
            Test account tier detection for multiple users (max 20, one per line)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <textarea
              placeholder="Enter user IDs (one per line)"
              value={batchUserIds}
              onChange={(e) => setBatchUserIds(e.target.value)}
              className="w-full h-32 p-3 border rounded-md resize-none"
            />
            <Button 
              onClick={testBatchUsers} 
              disabled={isLoading}
            >
              {isLoading ? 'Testing...' : 'Test Batch'}
            </Button>
          </div>

          {batchResults.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Batch Results ({batchResults.length} users):</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {batchResults.map((result, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-white px-2 py-1 rounded">
                          {result.userId}
                        </code>
                        {result.error ? (
                          <Badge variant="destructive">ERROR</Badge>
                        ) : (
                          <>
                            <Badge variant={result.result.isPremium ? 'default' : 'secondary'}>
                              {result.result.tier.toUpperCase()}
                            </Badge>
                            <Badge className={getSourceColor(result.result.source)}>
                              <div className="flex items-center gap-1">
                                {getSourceIcon(result.result.source)}
                                {result.result.source}
                              </div>
                            </Badge>
                          </>
                        )}
                      </div>
                      {!result.error && (
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(result.result.lastChecked)}
                        </span>
                      )}
                    </div>
                    {result.error && (
                      <div className="text-sm text-red-600 mt-1">
                        {result.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cache Management */}
      <Card>
        <CardHeader>
          <CardTitle>Cache Management</CardTitle>
          <CardDescription>
            View and manage the account tier cache
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={getCacheStats} disabled={isLoading}>
              Get Cache Stats
            </Button>
            <Button onClick={clearCache} disabled={isLoading} variant="outline">
              Clear Cache
            </Button>
          </div>

          {cacheStats && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Cache Statistics</h4>
                <Badge>{cacheStats.size} entries</Badge>
              </div>

              {cacheStats.entries.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium">Cached Entries:</h5>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {cacheStats.entries.map((entry: any, index: number) => (
                      <div key={index} className="flex items-center justify-between text-sm bg-white p-2 rounded">
                        <div className="flex items-center gap-2">
                          <code className="text-xs">{entry.userId}</code>
                          <Badge variant={entry.tier === 'premium' ? 'default' : 'secondary'} className="text-xs">
                            {entry.tier.toUpperCase()}
                          </Badge>
                        </div>
                        <span className="text-xs text-gray-500">
                          {Math.round(entry.age / 1000)}s ago
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}