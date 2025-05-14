import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  ArrowRight, 
  ShoppingBag, 
  RefreshCw,
  CreditCard,
  Bank,
  Calendar,
  BarChart3,
  Shield,
  DollarSign,
  Folder
} from 'lucide-react';
import { StripeConnectGuide } from '@/components/StripeConnectGuide';
import { useSellerAccountEligibility } from '@/hooks/useSellerAccountEligibility';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import { useStripeConnectAccount } from '@/hooks/useStripeConnectAccount';

export default function SellerAccount() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { success, error } = router.query;
  const { isEligible, isLoading: eligibilityLoading, hasActiveListings } = useSellerAccountEligibility();
  const { accountData, isLoading: accountLoading, error: accountError, refreshAccountStatus } = useStripeConnectAccount();

  // Handle URL query parameters for success/error
  useEffect(() => {
    if (success === 'true') {
      // Force refresh the account status when returning from successful onboarding
      refreshAccountStatus();
    } else if (error) {
      setErrorMessage(typeof error === 'string' ? error : 'An error occurred during onboarding');
    }
  }, [success, error, refreshAccountStatus]);

  const handleCreateConnectAccount = async () => {
    if (!user) {
      router.push('/auth/sign-in');
      return;
    }

    setLoading(true);
    try {
      // Get the auth token
      const token = await user.getIdToken(true);
      
      const response = await fetch('/api/stripe/connect/create-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create Connect account');
      }

      const { url } = await response.json();
      
      // Open in a new tab instead of redirecting the current page
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      console.error('Error creating Connect account:', error);
      setErrorMessage(error.message || 'Failed to create Connect account');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConnectAccount = async () => {
    if (!user) {
      router.push('/auth/sign-in');
      return;
    }

    setLoading(true);
    try {
      // Get the auth token
      const token = await user.getIdToken(true);
      
      const response = await fetch('/api/stripe/connect/update-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update Connect account');
      }

      const { url } = await response.json();
      
      // Open in a new tab instead of redirecting the current page
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      console.error('Error updating Connect account:', error);
      setErrorMessage(error.message || 'Failed to update Connect account');
    } finally {
      setLoading(false);
    }
  };

  // Determine if we should show the loading state
  const isPageLoading = eligibilityLoading || accountLoading;

  // Determine if the user has listings (from either source)
  const hasListings = hasActiveListings || accountData?.hasListings;

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 space-y-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-900 to-blue-800 p-8 md:p-12">
          <div className="absolute inset-0 bg-[url('/images/cards-pattern.svg')] opacity-10"></div>
          <div className="relative z-10">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">Seller Account</h1>
            <p className="text-xl text-blue-100 max-w-3xl">
              Set up your Stripe Connect account to receive payments directly from buyers on our platform
            </p>
          </div>
        </div>


        {/* Loading state */}
        {isPageLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <LoadingAnimation size="80" color="currentColor" className="text-primary" />
            <p className="mt-4 text-muted-foreground">Loading your seller account information...</p>
          </div>
        )}

        {/* Error state from account data */}
        {!isPageLoading && accountData?.status === 'error' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Loading Account</AlertTitle>
            <AlertDescription>
              <p className="mb-2">
                {accountData.errorMessage || 'There was an error loading your Stripe Connect account information.'}
              </p>
              <Button 
                onClick={refreshAccountStatus}
                variant="outline"
                size="sm"
                className="mt-2"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Error state from URL parameter */}
        {!isPageLoading && error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {errorMessage || 'There was an error with your Stripe Connect account. Please try again.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Show message for users who have listings according to API but aren't eligible according to hook */}
        {!isPageLoading && !isEligible && accountData?.hasListings && (
          <Alert variant="default" className="bg-blue-500/10 border-blue-500 text-blue-500">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Seller Account Setup</AlertTitle>
            <AlertDescription>
              <p className="mb-2">
                We've detected that you have listings, but there might be a synchronization issue. 
                Please refresh the page to continue setting up your seller account.
              </p>
              <div className="mt-4">
                <Button 
                  onClick={refreshAccountStatus}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Account Status
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Show not eligible message if user is not eligible and has no listings */}
        {!isPageLoading && !isEligible && !hasListings && (
          <Alert variant="default" className="bg-amber-500/10 border-amber-500 text-amber-500">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Seller Account Not Available</AlertTitle>
            <AlertDescription>
              You need to create at least one listing before you can set up a seller account.
              {hasActiveListings ? (
                <div className="mt-4">
                  <p className="mb-2">
                    It looks like you already have listings, but our system hasn't recognized them yet. 
                    Please try refreshing the page. If the issue persists, you can create a new listing.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      onClick={refreshAccountStatus}
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh Status
                    </Button>
                    <Button 
                      onClick={() => router.push('/dashboard/create-listing')}
                      className="bg-amber-500 hover:bg-amber-600 text-white"
                    >
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      Create New Listing
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <Button 
                    onClick={() => router.push('/dashboard/create-listing')}
                    className="bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    Create Your First Listing
                  </Button>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Only show the seller account UI if user is eligible or has listings */}
        {!isPageLoading && (isEligible || hasListings) && (
          <>
            {accountData?.status === 'active' && (
              <Alert className="bg-green-500/10 border-green-500 text-green-500">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Account Connected</AlertTitle>
                <AlertDescription>
                  Your Stripe Connect account is active and ready to receive payments.
                </AlertDescription>
              </Alert>
            )}

            {/* Show specific alerts for account issues */}
            {accountData?.status === 'pending' && accountData.detailsSubmitted && (!accountData.chargesEnabled || !accountData.payoutsEnabled) && (
              <Alert variant="default" className="bg-amber-500/10 border-amber-500 text-amber-500">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Account Setup Incomplete</AlertTitle>
                <AlertDescription>
                  <p className="mb-2">
                    Your Stripe Connect account is set up, but there are some issues that need to be resolved:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    {!accountData.chargesEnabled && (
                      <li>Charges are not enabled for your account</li>
                    )}
                    {!accountData.payoutsEnabled && (
                      <li>Payouts are not enabled for your account</li>
                    )}
                  </ul>
                  <p className="mt-2">
                    Please update your account details to resolve these issues.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Benefits of Stripe Connect Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              <div className="md:col-span-1">
                <h2 className="text-3xl font-bold tracking-tight">Benefits of Stripe Connect</h2>
                <Badge variant="outline" className="mt-2">Secure Payments</Badge>
              </div>
              <div className="md:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
                    <CardContent className="pt-6">
                      <div className="rounded-full w-12 h-12 flex items-center justify-center bg-primary/10 mb-4">
                        <Bank className="text-primary h-6 w-6" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Direct Deposits</h3>
                      <p className="text-muted-foreground">Receive payments directly to your bank account with no intermediaries.</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
                    <CardContent className="pt-6">
                      <div className="rounded-full w-12 h-12 flex items-center justify-center bg-primary/10 mb-4">
                        <Shield className="text-primary h-6 w-6" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Secure Processing</h3>
                      <p className="text-muted-foreground">Industry-leading security protocols protect your transactions and customer data.</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
                    <CardContent className="pt-6">
                      <div className="rounded-full w-12 h-12 flex items-center justify-center bg-primary/10 mb-4">
                        <Calendar className="text-primary h-6 w-6" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Scheduled Payouts</h3>
                      <p className="text-muted-foreground">Automatic payouts on a schedule you choose for consistent cash flow.</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
                    <CardContent className="pt-6">
                      <div className="rounded-full w-12 h-12 flex items-center justify-center bg-primary/10 mb-4">
                        <BarChart3 className="text-primary h-6 w-6" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Detailed Reporting</h3>
                      <p className="text-muted-foreground">Comprehensive transaction history and financial reporting tools.</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            <Separator className="my-8" />

            {/* How It Works Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              <div className="md:col-span-1">
                <h2 className="text-3xl font-bold tracking-tight">How It Works</h2>
                <Badge variant="outline" className="mt-2">Simple Process</Badge>
              </div>
              <div className="md:col-span-2">
                <ul className="space-y-6">
                  <li className="flex items-start">
                    <div className="flex-shrink-0 mr-4">
                      <div className="rounded-full w-10 h-10 bg-primary/10 flex items-center justify-center text-primary font-semibold">1</div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Complete the Stripe onboarding process</h3>
                      <p className="text-muted-foreground">Follow the guided steps to set up your Stripe Connect account with all required information.</p>
                    </div>
                  </li>
                  
                  <li className="flex items-start">
                    <div className="flex-shrink-0 mr-4">
                      <div className="rounded-full w-10 h-10 bg-primary/10 flex items-center justify-center text-primary font-semibold">2</div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Verify your identity and banking information</h3>
                      <p className="text-muted-foreground">Provide the necessary documentation to verify your identity and connect your bank account.</p>
                    </div>
                  </li>
                  
                  <li className="flex items-start">
                    <div className="flex-shrink-0 mr-4">
                      <div className="rounded-full w-10 h-10 bg-primary/10 flex items-center justify-center text-primary font-semibold">3</div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Start selling cards and receiving payments</h3>
                      <p className="text-muted-foreground">Once approved, your listings will be available for purchase with direct payment processing.</p>
                    </div>
                  </li>
                  
                  <li className="flex items-start">
                    <div className="flex-shrink-0 mr-4">
                      <div className="rounded-full w-10 h-10 bg-primary/10 flex items-center justify-center text-primary font-semibold">4</div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Platform fee: 10% of each transaction</h3>
                      <p className="text-muted-foreground">A small fee is deducted from each sale to cover payment processing and platform maintenance.</p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

            <Separator className="my-8" />

            {/* Action Card */}
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle>Stripe Connect</CardTitle>
                <CardDescription>
                  Connect your Stripe account to receive payments directly from buyers on our platform.
                </CardDescription>
              </CardHeader>
                <CardFooter className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4 sm:justify-between flex-wrap">
                  {accountData?.status === 'none' && (
                    <Button
                      onClick={handleCreateConnectAccount}
                      disabled={loading}
                      className="w-full sm:w-auto"
                      title="Opens in a new tab"
                    >
                      {loading ? 'Setting up...' : 'Set Up Stripe Connect'}
                      {!loading && <ExternalLink className="ml-2 h-4 w-4" />}
                    </Button>
                  )}

                  {accountData?.status === 'pending' && (
                    <Button
                      onClick={handleUpdateConnectAccount}
                      disabled={loading}
                      className="w-full sm:w-auto"
                      title="Opens in a new tab"
                    >
                      {loading ? 'Loading...' : 'Complete Onboarding'}
                      {!loading && <ExternalLink className="ml-2 h-4 w-4" />}
                    </Button>
                  )}

                  {accountData?.status === 'active' && (
                    <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                      <Button
                        onClick={handleUpdateConnectAccount}
                        variant="outline"
                        className="w-full sm:w-auto"
                        title="Opens in a new tab"
                      >
                        Update Account Details
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => router.push('/dashboard/sales-analytics')}
                        className="w-full sm:w-auto"
                      >
                        View Sales Analytics
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    onClick={() => router.push('/dashboard')}
                    className="w-full sm:w-auto"
                  >
                    Back to Dashboard
                  </Button>
                </CardFooter>
            </Card>
            
            <div className="mt-8">
              <StripeConnectGuide accountStatus={accountData?.status || 'none'} />
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}