import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Calendar,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink
} from 'lucide-react';
import { usePayouts } from '@/hooks/usePayouts';
import { PayoutData, TransferData } from '@/types/payout';

const formatCurrency = (amount: number, currency: string = 'usd') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
};

const formatDate = (timestamp: number) => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp * 1000));
};

const formatDateTime = (timestamp: number) => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp * 1000));
};

const getPayoutStatusBadge = (status: PayoutData['status']) => {
  switch (status) {
    case 'paid':
      return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Paid</Badge>;
    case 'pending':
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pending</Badge>;
    case 'in_transit':
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">In Transit</Badge>;
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    case 'canceled':
      return <Badge variant="outline">Canceled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const PayoutDashboard: React.FC = () => {
  const { payoutData, isLoading, error, refreshPayouts } = usePayouts();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Payouts & Earnings</h2>
          <Button disabled variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            Loading...
          </Button>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Payouts & Earnings</h2>
          <Button onClick={refreshPayouts} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!payoutData) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Payouts & Earnings</h2>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No payout data available. Make sure your Stripe Connect account is set up and active.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { summary, balance, payouts, pendingPayouts, transfers, payoutSchedule, accountDetails } = payoutData;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Payouts & Earnings</h2>
        <Button onClick={refreshPayouts} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.totalEarnings, accountDetails.default_currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.availableBalance, accountDetails.default_currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              Ready for payout
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Balance</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.pendingBalance, accountDetails.default_currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              Processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payouts</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.totalPayouts, accountDetails.default_currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payout Schedule Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Payout Schedule
          </CardTitle>
          <CardDescription>
            Your automatic payout settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium mb-1">Frequency</p>
              <p className="text-sm text-muted-foreground capitalize">
                {payoutSchedule.interval} 
                {payoutSchedule.interval === 'weekly' && payoutSchedule.weekly_anchor && 
                  ` (${payoutSchedule.weekly_anchor}s)`
                }
                {payoutSchedule.interval === 'monthly' && payoutSchedule.monthly_anchor && 
                  ` (${payoutSchedule.monthly_anchor}${payoutSchedule.monthly_anchor === 1 ? 'st' : 
                    payoutSchedule.monthly_anchor === 2 ? 'nd' : 
                    payoutSchedule.monthly_anchor === 3 ? 'rd' : 'th'} of month)`
                }
              </p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Delay</p>
              <p className="text-sm text-muted-foreground">
                {typeof payoutSchedule.delay_days === 'number' 
                  ? `${payoutSchedule.delay_days} days` 
                  : payoutSchedule.delay_days
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Payouts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownRight className="h-5 w-5" />
              Recent Payouts
            </CardTitle>
            <CardDescription>
              Money sent to your bank account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payouts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No payouts in the last 30 days
              </p>
            ) : (
              <div className="space-y-4">
                {payouts.slice(0, 5).map((payout) => (
                  <div key={payout.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          {formatCurrency(payout.amount, payout.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(payout.arrival_date)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {getPayoutStatusBadge(payout.status)}
                      {payout.failure_message && (
                        <p className="text-xs text-red-600 mt-1">
                          {payout.failure_message}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {payouts.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    And {payouts.length - 5} more payouts...
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Earnings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5" />
              Recent Earnings
            </CardTitle>
            <CardDescription>
              Money received from sales
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transfers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No earnings in the last 30 days
              </p>
            ) : (
              <div className="space-y-4">
                {transfers.slice(0, 5).map((transfer) => (
                  <div key={transfer.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="text-sm font-medium">
                          {formatCurrency(transfer.amount, transfer.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(transfer.created)}
                        </p>
                        {transfer.metadata?.listingId && (
                          <p className="text-xs text-muted-foreground">
                            Sale #{transfer.metadata.listingId.slice(0, 8)}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-200">
                      Earned
                    </Badge>
                  </div>
                ))}
                {transfers.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    And {transfers.length - 5} more earnings...
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Payouts */}
      {pendingPayouts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Payouts
            </CardTitle>
            <CardDescription>
              Payouts currently being processed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingPayouts.map((payout) => (
                <div key={payout.id} className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    <div>
                      <p className="text-sm font-medium">
                        {formatCurrency(payout.amount, payout.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Expected: {formatDate(payout.arrival_date)}
                      </p>
                    </div>
                  </div>
                  {getPayoutStatusBadge(payout.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Status */}
      <Card>
        <CardHeader>
          <CardTitle>Account Status</CardTitle>
          <CardDescription>
            Your Stripe Connect account information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Payouts Enabled</span>
              {accountDetails.payouts_enabled ? (
                <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Yes
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  No
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Charges Enabled</span>
              {accountDetails.charges_enabled ? (
                <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Yes
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  No
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Country</span>
              <span className="text-sm text-muted-foreground uppercase">
                {accountDetails.country}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Currency</span>
              <span className="text-sm text-muted-foreground uppercase">
                {accountDetails.default_currency}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
          <CardDescription>
            Questions about your payouts or earnings?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              • Payouts typically arrive in 2-7 business days depending on your bank
            </p>
            <p className="text-sm text-muted-foreground">
              • New accounts may have longer holds for the first few transactions
            </p>
            <p className="text-sm text-muted-foreground">
              • You can view detailed transaction history in your Stripe dashboard
            </p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" asChild>
                <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Stripe Dashboard
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/support" target="_blank" rel="noopener noreferrer">
                  Contact Support
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PayoutDashboard;