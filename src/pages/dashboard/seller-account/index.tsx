import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import SellerAccountGuide from '@/components/SellerAccountGuide';
import SellerAccountBenefits from '@/components/SellerAccountBenefits';
import SellerAccountFAQ from '@/components/SellerAccountFAQ';
import { useSellerAccount } from '@/hooks/useSellerAccount';
import { useSellerLevel } from '@/hooks/useSellerLevel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import Head from 'next/head';
import PayoutDashboard from '@/components/PayoutDashboard';
import SellerLevelDashboard from '@/components/SellerLevelDashboard';
import { useStripeVerified } from '@/hooks/useStripeVerified';

// Simple loading state component
const LoadingState = () => (
  <div className="flex justify-center items-center p-12">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
  </div>
);

const SellerAccountPage = () => {
  const router = useRouter();
  
  // Track local loading states
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isUpdatingAccount, setIsUpdatingAccount] = useState(false);
  const [returnMessage, setReturnMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Use our simplified hook
  const { accountStatus, isLoading, error, createAccount, updateAccount, refreshStatus } = useSellerAccount();
  const { sellerLevelData, isLoading: levelLoading } = useSellerLevel();
  const { isVerified, reason: verifyReason, loading: verifyLoading } = useStripeVerified();
  
  // Get the active tab from URL query parameter
  const activeTab = (router.query.tab as string) || 'setup';
  
  // Handle account creation with local loading state
  const handleCreateAccount = () => {
    setIsCreatingAccount(true);
    createAccount().catch(() => {}).finally(() => {
      setIsCreatingAccount(false);
    });
  };
  
  // Handle account update with local loading state
  const handleUpdateAccount = () => {
    setIsUpdatingAccount(true);
    updateAccount().catch(() => {}).finally(() => {
      setIsUpdatingAccount(false);
    });
  };
  
  // Handle return from Stripe Connect
  useEffect(() => {
    const handleStripeReturn = async () => {
      const { success, error: errorParam } = router.query;
      
      if (success === 'true') {
        setReturnMessage({
          type: 'success',
          message: 'Successfully returned from Stripe Connect. Refreshing account status...'
        });
        
        // Show success toast
        toast.success('Stripe Connect setup completed!', {
          description: 'Refreshing your account status...'
        });
        
        // Wait a moment then refresh the account status
        setTimeout(async () => {
          try {
            await refreshStatus();
            setReturnMessage({
              type: 'success',
              message: 'Account status updated successfully!'
            });
            
            // Clear the message after a few seconds
            setTimeout(() => {
              setReturnMessage(null);
              // Clean up URL parameters
              router.replace('/dashboard/seller-account', undefined, { shallow: true });
            }, 3000);
          } catch (err) {
            console.error('Error refreshing account status:', err);
            setReturnMessage({
              type: 'error',
              message: 'Account setup completed, but there was an issue refreshing the status. Please refresh the page.'
            });
            
            toast.error('Error refreshing account status', {
              description: 'Please refresh the page to see updated information.'
            });
          }
        }, 1000);
      } else if (errorParam === 'refresh') {
        setReturnMessage({
          type: 'error',
          message: 'There was an issue with the Stripe Connect setup. Please try again.'
        });
        
        toast.error('Stripe Connect setup failed', {
          description: 'Please try setting up your account again.'
        });
        
        // Clear the message after a few seconds
        setTimeout(() => {
          setReturnMessage(null);
          // Clean up URL parameters
          router.replace('/dashboard/seller-account', undefined, { shallow: true });
        }, 5000);
      }
    };

    if (router.isReady) {
      handleStripeReturn();
    }
  }, [router.isReady, router.query, refreshStatus]);

  useEffect(() => {
    if (!router.isReady) return;
    if (activeTab === 'seller-level' && !verifyLoading && !isVerified) {
      router.replace('/dashboard/seller-account?tab=setup', undefined, { shallow: true });
      toast.info('Stripe verification required', {
        description: 'Please complete Account Setup to access Seller Level.'
      });
    }
  }, [router.isReady, activeTab, isVerified, verifyLoading, router]);
  
  // Determine if any loading state is active
  const isAnyLoading = isLoading || isCreatingAccount || isUpdatingAccount;

  return (
    <>
      <Head>
        <title>Seller Account | Dashboard</title>
      </Head>
      
      <DashboardLayout>
        <div className="container max-w-6xl py-6 space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Seller Account</h1>
            <p className="text-muted-foreground mt-2">
              Set up and manage your seller account to receive payments for your listings
            </p>
          </div>

          <Separator />

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {returnMessage && (
            <Alert variant={returnMessage.type === 'success' ? 'default' : 'destructive'}>
              {returnMessage.type === 'success' ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {returnMessage.type === 'success' ? 'Success' : 'Error'}
              </AlertTitle>
              <AlertDescription>{returnMessage.message}</AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <LoadingState />
          ) : (
            <Tabs value={activeTab} onValueChange={(value) => router.push(`/dashboard/seller-account?tab=${value}`, undefined, { shallow: true })} className="w-full">
              <TabsList className="flex flex-col sm:grid sm:grid-cols-4 w-full h-auto gap-1 sm:gap-0">
                <TabsTrigger value="setup" className="w-full justify-start text-sm sm:text-base px-4 py-3 sm:px-6">Account Setup</TabsTrigger>
                <TabsTrigger value="payouts" className="w-full justify-start text-sm sm:text-base px-4 py-3 sm:px-6">Payouts & Earnings</TabsTrigger>
                <TabsTrigger value="seller-level" disabled={!isVerified} title={!isVerified ? 'Complete Account Setup to unlock Seller Level' : undefined} className="w-full justify-start text-sm sm:text-base px-4 py-3 sm:px-6 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Seller Level
                  {sellerLevelData && !levelLoading && (
                    <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                      {sellerLevelData.level}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="info" className="w-full justify-start text-sm sm:text-base px-4 py-3 sm:px-6">Info & FAQ</TabsTrigger>
              </TabsList>
              
              <TabsContent value="setup" className="mt-6">
                <SellerAccountGuide 
                  accountStatus={accountStatus}
                  isLoading={isAnyLoading}
                  onCreateAccount={handleCreateAccount}
                  onUpdateAccount={handleUpdateAccount}
                  onRefreshStatus={refreshStatus}
                />
              </TabsContent>
              
              <TabsContent value="payouts" className="mt-6">
                <PayoutDashboard />
              </TabsContent>
              
              <TabsContent value="seller-level" className="mt-6">
                {!verifyLoading && !isVerified ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Stripe verification required</AlertTitle>
                    <AlertDescription>
                      {verifyReason || 'Please complete your Stripe Connect verification to access Seller Level features.'}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <SellerLevelDashboard />
                )}
              </TabsContent>
              
              <TabsContent value="info" className="mt-6">
                <div className="space-y-8">
                  <SellerAccountBenefits />
                  <SellerAccountFAQ />
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DashboardLayout>
    </>
  );
};

export default SellerAccountPage;