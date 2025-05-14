import React, { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import SellerAccountGuide from '@/components/SellerAccountGuide';
import SellerAccountBenefits from '@/components/SellerAccountBenefits';
import SellerAccountFAQ from '@/components/SellerAccountFAQ';
import { useSellerAccount } from '@/hooks/useSellerAccount';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Head from 'next/head';

// Simple loading state component
const LoadingState = () => (
  <div className="flex justify-center items-center p-12">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
  </div>
);

const SellerAccountPage = () => {
  // Track local loading states
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isUpdatingAccount, setIsUpdatingAccount] = useState(false);
  
  // Use our simplified hook
  const { accountStatus, isLoading, error, createAccount, updateAccount } = useSellerAccount();
  
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

          {isLoading ? (
            <LoadingState />
          ) : (
            <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
              <div>
                <SellerAccountGuide 
                  accountStatus={accountStatus}
                  isLoading={isAnyLoading}
                  onCreateAccount={handleCreateAccount}
                  onUpdateAccount={handleUpdateAccount}
                />
              </div>
              <div>
                <Tabs defaultValue="benefits" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="benefits">Benefits</TabsTrigger>
                    <TabsTrigger value="faq">FAQ</TabsTrigger>
                  </TabsList>
                  <TabsContent value="benefits" className="mt-6">
                    <SellerAccountBenefits />
                  </TabsContent>
                  <TabsContent value="faq" className="mt-6">
                    <SellerAccountFAQ />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </>
  );
};

export default SellerAccountPage;