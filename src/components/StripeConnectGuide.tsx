import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InfoIcon, CheckCircle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Steps, Step } from '@/components/ui/steps';
import { cn } from '@/lib/utils';

interface StripeConnectGuideProps {
  accountStatus: 'none' | 'pending' | 'active' | 'error';
}

export function StripeConnectGuide({ accountStatus }: StripeConnectGuideProps) {
  return (
    <Card className="border-none shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Stripe Connect Setup Guide</CardTitle>
          <Badge variant="outline" className="ml-2">Step-by-Step</Badge>
        </div>
        <CardDescription>
          Follow these steps to set up your Stripe Connect account and start receiving payments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {accountStatus === 'error' && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error with your Stripe Connect account</AlertTitle>
            <AlertDescription>
              There was an issue with your Stripe Connect account setup. Please try again or contact support if the issue persists.
            </AlertDescription>
          </Alert>
        )}

        {accountStatus === 'active' && (
          <Alert className="bg-green-500/10 border-green-500 text-green-500 mb-4">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Account Successfully Connected</AlertTitle>
            <AlertDescription>
              Your Stripe Connect account is active and ready to receive payments. You can now sell cards and receive payments directly to your bank account.
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-8">
          <Steps>
            <Step 
              title="Create a Stripe Connect Account" 
              description="Click the 'Set Up Stripe Connect' button to start the process."
              status={accountStatus === 'none' ? 'current' : 'complete'}
            />
            
            <Step 
              title="Complete Stripe Onboarding" 
              description="Fill out the required information including your personal details, business information, and banking details."
              status={
                accountStatus === 'none' 
                  ? 'upcoming' 
                  : accountStatus === 'pending' 
                    ? 'current' 
                    : 'complete'
              }
            />
            
            <Step 
              title="Verify Your Identity" 
              description="Stripe requires identity verification to comply with financial regulations. You'll need to provide identification documents."
              status={
                accountStatus === 'none' || accountStatus === 'pending' 
                  ? 'upcoming' 
                  : 'complete'
              }
            />
            
            <Step 
              title="Add Banking Information" 
              description="Connect your bank account to receive payouts from your sales."
              status={
                accountStatus === 'none' || accountStatus === 'pending' 
                  ? 'upcoming' 
                  : 'complete'
              }
            />
            
            <Step 
              title="Start Selling" 
              description="Once your account is active, you can start selling cards and receive payments directly to your bank account."
              status={
                accountStatus === 'active' 
                  ? 'complete' 
                  : 'upcoming'
              }
            />
          </Steps>
        </div>

        <Alert className="mt-6 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
          <InfoIcon className="h-4 w-4 text-blue-500" />
          <AlertTitle className="text-blue-700 dark:text-blue-300">Important Information</AlertTitle>
          <AlertDescription className="text-blue-600 dark:text-blue-400">
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>Stripe Connect allows you to receive payments directly to your bank account</li>
              <li>Our platform charges a 10% fee on each transaction</li>
              <li>Payouts are typically processed within 2-7 business days, depending on your bank</li>
              <li>You must complete all verification steps to receive payments</li>
              <li>For security reasons, you cannot change your banking information frequently</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}