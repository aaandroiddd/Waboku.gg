import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Calendar, Database, CreditCard } from 'lucide-react';

interface DiagnosticResult {
  userId: string;
  issues: string[];
  firestoreData: any;
  realtimeData: any;
  stripeData: any;
  recommendations: string[];
  fixesApplied: string[];
}

export default function SubscriptionDataDiagnostic() {
  const [userId, setUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState('');

  const runDiagnostic = async () => {
    if (!userId.trim()) {
      setError('Please enter a user ID');
      return;
    }

    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/admin/diagnose-subscription-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: userId.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to run diagnostic');
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred while running the diagnostic');
    } finally {
      setIsLoading(false);
    }
  };

  const fixSubscriptionData = async () => {
    if (!result) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/fix-subscription-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: result.userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fix subscription data');
      }

      const data = await response.json();
      
      // Update result with fixes applied
      setResult(prev => prev ? {
        ...prev,
        fixesApplied: data.fixesApplied || [],
        issues: data.remainingIssues || []
      } : null);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fixing subscription data');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Not set';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      return date.toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      canceled: 'bg-yellow-100 text-yellow-800',
      none: 'bg-gray-100 text-gray-800',
      error: 'bg-red-100 text-red-800',
    };

    return (
      <Badge className={statusColors[status] || 'bg-gray-100 text-gray-800'}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Subscription Data Diagnostic
          </CardTitle>
          <CardDescription>
            Diagnose and fix subscription data inconsistencies, invalid dates, and caching issues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="userId">User ID</Label>
            <Input
              id="userId"
              placeholder="Enter user ID to diagnose"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={runDiagnostic} 
              disabled={isLoading || !userId.trim()}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Database className="h-4 w-4" />
              )}
              Run Diagnostic
            </Button>

            {result && result.issues.length > 0 && (
              <Button 
                onClick={fixSubscriptionData} 
                disabled={isLoading}
                variant="outline"
                className="flex items-center gap-2"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Apply Fixes
              </Button>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center gap-2 text-red-800">
                <XCircle className="h-4 w-4" />
                <span className="font-medium">Error</span>
              </div>
              <p className="text-red-700 mt-1">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-6">
          {/* Issues Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.issues.length > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
                Issues Found: {result.issues.length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.issues.length > 0 ? (
                <ul className="space-y-2">
                  {result.issues.map((issue, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{issue}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-green-700">No issues detected with subscription data.</p>
              )}
            </CardContent>
          </Card>

          {/* Fixes Applied */}
          {result.fixesApplied && result.fixesApplied.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Fixes Applied: {result.fixesApplied.length}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.fixesApplied.map((fix, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{fix}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Firestore Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Firestore Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Account Tier</Label>
                  <div className="mt-1">
                    {getStatusBadge(result.firestoreData?.accountTier || 'unknown')}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Subscription Status</Label>
                  <div className="mt-1">
                    {getStatusBadge(result.firestoreData?.subscription?.status || 'unknown')}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Start Date</Label>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatDate(result.firestoreData?.subscription?.startDate)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">End Date</Label>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatDate(result.firestoreData?.subscription?.endDate)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Renewal Date</Label>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatDate(result.firestoreData?.subscription?.renewalDate)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Canceled At</Label>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatDate(result.firestoreData?.subscription?.canceledAt)}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Stripe Subscription ID</Label>
                <p className="text-sm text-gray-600 mt-1 font-mono">
                  {result.firestoreData?.subscription?.stripeSubscriptionId || 'Not set'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Realtime Database Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Realtime Database Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Account Tier</Label>
                  <div className="mt-1">
                    {getStatusBadge(result.realtimeData?.tier || 'unknown')}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Subscription Status</Label>
                  <div className="mt-1">
                    {getStatusBadge(result.realtimeData?.subscription?.status || 'unknown')}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Start Date</Label>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatDate(result.realtimeData?.subscription?.startDate)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">End Date</Label>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatDate(result.realtimeData?.subscription?.endDate)}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Last Updated</Label>
                <p className="text-sm text-gray-600 mt-1">
                  {result.realtimeData?.subscription?.lastUpdated 
                    ? new Date(result.realtimeData.subscription.lastUpdated).toLocaleString()
                    : 'Not set'
                  }
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Stripe Data */}
          {result.stripeData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Stripe Data
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <div className="mt-1">
                      {getStatusBadge(result.stripeData.status || 'unknown')}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Customer ID</Label>
                    <p className="text-sm text-gray-600 mt-1 font-mono">
                      {result.stripeData.customerId || 'Not found'}
                    </p>
                  </div>
                </div>

                {result.stripeData.subscription && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Current Period Start</Label>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDate(result.stripeData.subscription.current_period_start 
                            ? new Date(result.stripeData.subscription.current_period_start * 1000).toISOString()
                            : null
                          )}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Current Period End</Label>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDate(result.stripeData.subscription.current_period_end 
                            ? new Date(result.stripeData.subscription.current_period_end * 1000).toISOString()
                            : null
                          )}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {result.recommendations && result.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-blue-500" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.recommendations.map((recommendation, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Raw Data */}
          <Card>
            <CardHeader>
              <CardTitle>Raw Data (JSON)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={JSON.stringify(result, null, 2)}
                readOnly
                className="font-mono text-xs h-64"
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}