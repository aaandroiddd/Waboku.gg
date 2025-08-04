import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle, XCircle, Clock, User, CreditCard } from 'lucide-react';

interface SubscriptionData {
  userId: string;
  email: string;
  displayName: string;
  accountTier: string;
  subscription: {
    status: string;
    stripeSubscriptionId: string;
    startDate: string;
    endDate: string;
    renewalDate: string;
    cancelAtPeriodEnd: boolean;
    canceledAt: string;
    currentPlan: string;
  };
  calculatedStatus: {
    shouldBePremium: boolean;
    reason: string;
    daysRemaining: number;
    isWithinPaidPeriod: boolean;
  };
}

export default function CancelledSubscriptionDebugger() {
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [error, setError] = useState('');
  const [fixLoading, setFixLoading] = useState(false);
  const [fixResult, setFixResult] = useState('');

  const checkSubscription = async () => {
    if (!userId && !email) {
      setError('Please provide either a User ID or Email');
      return;
    }

    setLoading(true);
    setError('');
    setSubscriptionData(null);
    setFixResult('');

    try {
      const response = await fetch('/api/admin/debug-cancelled-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId || undefined,
          email: email || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check subscription');
      }

      setSubscriptionData(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fixSubscription = async () => {
    if (!subscriptionData) return;

    setFixLoading(true);
    setFixResult('');

    try {
      const response = await fetch('/api/admin/fix-cancelled-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: subscriptionData.userId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fix subscription');
      }

      setFixResult(data.message || 'Subscription fixed successfully');
      
      // Refresh the data
      await checkSubscription();
    } catch (err: any) {
      setFixResult(`Error: ${err.message || 'An error occurred'}`);
    } finally {
      setFixLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'canceled':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Canceled</Badge>;
      case 'inactive':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Inactive</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTierBadge = (tier: string) => {
    return tier === 'premium' ? 
      <Badge className="bg-purple-100 text-purple-800">Premium</Badge> : 
      <Badge variant="outline">Free</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Cancelled Subscription Debugger
        </CardTitle>
        <CardDescription>
          Debug and fix cancelled premium subscriptions that should still have access
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">User ID</label>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter user ID"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Email (alternative)</label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter user email"
            />
          </div>
        </div>

        <Button 
          onClick={checkSubscription} 
          disabled={loading || (!userId && !email)}
          className="w-full"
        >
          {loading ? 'Checking...' : 'Check Subscription Status'}
        </Button>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Error</span>
            </div>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        )}

        {subscriptionData && (
          <div className="space-y-4">
            <Separator />
            
            {/* User Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold flex items-center gap-2 mb-3">
                <User className="w-4 h-4" />
                User Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">User ID:</span>
                  <p className="font-mono text-xs bg-white p-1 rounded mt-1">{subscriptionData.userId}</p>
                </div>
                <div>
                  <span className="font-medium">Email:</span>
                  <p className="mt-1">{subscriptionData.email}</p>
                </div>
                <div>
                  <span className="font-medium">Display Name:</span>
                  <p className="mt-1">{subscriptionData.displayName || 'Not set'}</p>
                </div>
                <div>
                  <span className="font-medium">Current Account Tier:</span>
                  <div className="mt-1">{getTierBadge(subscriptionData.accountTier)}</div>
                </div>
              </div>
            </div>

            {/* Subscription Details */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4" />
                Subscription Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Status:</span>
                  <div className="mt-1">{getStatusBadge(subscriptionData.subscription.status)}</div>
                </div>
                <div>
                  <span className="font-medium">Current Plan:</span>
                  <p className="mt-1">{subscriptionData.subscription.currentPlan}</p>
                </div>
                <div>
                  <span className="font-medium">Stripe Subscription ID:</span>
                  <p className="font-mono text-xs bg-white p-1 rounded mt-1">
                    {subscriptionData.subscription.stripeSubscriptionId}
                  </p>
                </div>
                <div>
                  <span className="font-medium">Cancel at Period End:</span>
                  <p className="mt-1">{subscriptionData.subscription.cancelAtPeriodEnd ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <span className="font-medium">Start Date:</span>
                  <p className="mt-1">{new Date(subscriptionData.subscription.startDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="font-medium">End Date:</span>
                  <p className="mt-1">{new Date(subscriptionData.subscription.endDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="font-medium">Renewal Date:</span>
                  <p className="mt-1">{new Date(subscriptionData.subscription.renewalDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="font-medium">Canceled At:</span>
                  <p className="mt-1">
                    {subscriptionData.subscription.canceledAt ? 
                      new Date(subscriptionData.subscription.canceledAt).toLocaleDateString() : 
                      'Not canceled'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Analysis */}
            <div className={`p-4 rounded-lg ${
              subscriptionData.calculatedStatus.shouldBePremium ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <h3 className="font-semibold flex items-center gap-2 mb-3">
                {subscriptionData.calculatedStatus.shouldBePremium ? 
                  <CheckCircle className="w-4 h-4 text-green-600" /> : 
                  <XCircle className="w-4 h-4 text-red-600" />
                }
                Analysis
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Should be Premium:</span>
                  <span className={`ml-2 ${subscriptionData.calculatedStatus.shouldBePremium ? 'text-green-600' : 'text-red-600'}`}>
                    {subscriptionData.calculatedStatus.shouldBePremium ? 'Yes' : 'No'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Reason:</span>
                  <p className="mt-1">{subscriptionData.calculatedStatus.reason}</p>
                </div>
                <div>
                  <span className="font-medium">Days Remaining:</span>
                  <span className="ml-2">{subscriptionData.calculatedStatus.daysRemaining}</span>
                </div>
                <div>
                  <span className="font-medium">Within Paid Period:</span>
                  <span className={`ml-2 ${subscriptionData.calculatedStatus.isWithinPaidPeriod ? 'text-green-600' : 'text-red-600'}`}>
                    {subscriptionData.calculatedStatus.isWithinPaidPeriod ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            {/* Fix Button */}
            {subscriptionData.calculatedStatus.shouldBePremium && subscriptionData.accountTier !== 'premium' && (
              <Button 
                onClick={fixSubscription}
                disabled={fixLoading}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {fixLoading ? 'Fixing...' : 'Fix Subscription Status'}
              </Button>
            )}

            {fixResult && (
              <div className={`p-3 rounded-md ${
                fixResult.startsWith('Error') ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
              }`}>
                <p className={`text-sm ${fixResult.startsWith('Error') ? 'text-red-700' : 'text-green-700'}`}>
                  {fixResult}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}