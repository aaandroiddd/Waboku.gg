import React from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import SellerAccountGuide from '@/components/SellerAccountGuide';
import SellerAccountBenefits from '@/components/SellerAccountBenefits';
import SellerAccountFAQ from '@/components/SellerAccountFAQ';
import { useSellerAccount } from '@/hooks/useSellerAccount';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const SellerAccountPage: NextPage = () => {
  const { 
    accountStatus, 
    isLoading, 
    error, 
    createAccount, 
    updateAccount 
  } = useSellerAccount();

  return (
    <>
      <Head>
        <title>Seller Account | Dashboard</title>
        <meta name="description" content="Manage your seller account settings" />
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

          <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
            <div>
              <SellerAccountGuide 
                accountStatus={accountStatus}
                isLoading={isLoading}
                onCreateAccount={createAccount}
                onUpdateAccount={updateAccount}
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
        </div>
      </DashboardLayout>
    </>
  );
};

export default SellerAccountPage;