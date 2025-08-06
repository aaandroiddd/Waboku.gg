import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import SellerAccountGuide from '@/components/SellerAccountGuide';
import SellerAccountBenefits from '@/components/SellerAccountBenefits';
import SellerAccountFAQ from '@/components/SellerAccountFAQ';
import { useSellerAccount } from '@/hooks/useSellerAccount';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import Head from 'next/head';
import PayoutDashboard from '@/components/PayoutDashboard';

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
            <Tabs defaultValue="setup" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="setup">Account Setup</TabsTrigger>
                <TabsTrigger value="payouts">Payouts & Earnings</TabsTrigger>
                <TabsTrigger value="info">Info & FAQ</TabsTrigger>
              </TabsList>
              
              <TabsContent value="setup" className="mt-6">
                <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
                  <div>
                    <SellerAccountGuide 
                      accountStatus={accountStatus}
                      isLoading={isAnyLoading}
                      onCreateAccount={handleCreateAccount}
                      onUpdateAccount={handleUpdateAccount}
                      onRefreshStatus={refreshStatus}
                    />
                  </div>
                  <div>
                    <SellerAccountBenefits />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="payouts" className="mt-6">
                <PayoutDashboard />
              </TabsContent>
              
              <TabsContent value="info" className="mt-6">
                <SellerAccountFAQ />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DashboardLayout>
    </>
  );
};

export default SellerAccountPage;