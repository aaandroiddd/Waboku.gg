import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Steps, Step } from '@/components/ui/steps';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InfoIcon, CheckCircle, AlertCircle } from 'lucide-react';

interface StripeConnectGuideProps {
  accountStatus: 'none' | 'pending' | 'active' | 'error';
}

export function StripeConnectGuide({ accountStatus }: StripeConnectGuideProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stripe Connect Setup Guide</CardTitle>
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

        <Alert className="mt-6">
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>Important Information</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5 space-y-1 text-sm">
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