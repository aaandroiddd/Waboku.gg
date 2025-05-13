// src/components/StripeConnectGuide.tsx
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, Info, AlertCircle } from 'lucide-react';

type StripeConnectGuideProps = {
  accountStatus: 'none' | 'pending' | 'active' | 'error';
};

export function StripeConnectGuide({ accountStatus }: StripeConnectGuideProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stripe Connect Guide</CardTitle>
        <CardDescription>
          Learn how to complete the Stripe Connect onboarding process
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {accountStatus === 'none' && (
          <Alert variant="default" className="bg-blue-500/10 border-blue-500">
            <Info className="h-4 w-4 text-blue-500" />
            <AlertTitle className="text-blue-500">Get Started</AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              Click the "Set Up Stripe Connect" button above to begin the onboarding process.
            </AlertDescription>
          </Alert>
        )}

        {accountStatus === 'pending' && (
          <Alert variant="default" className="bg-amber-500/10 border-amber-500">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-500">Complete Onboarding</AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              Please complete all steps in the Stripe Connect onboarding process by clicking the "Complete Onboarding" button above.
            </AlertDescription>
          </Alert>
        )}

        {accountStatus === 'active' && (
          <Alert variant="default" className="bg-green-500/10 border-green-500">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertTitle className="text-green-500">Account Active</AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-300">
              Your Stripe Connect account is fully set up and ready to accept payments.
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Onboarding Steps</h3>
          
          <div className="space-y-4">
            <div className="flex">
              <div className={`flex-shrink-0 mr-4 h-8 w-8 rounded-full flex items-center justify-center ${
                accountStatus !== 'none' ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300' : 'bg-muted text-muted-foreground'
              }`}>
                {accountStatus !== 'none' ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <span>1</span>
                )}
              </div>
              <div>
                <h4 className="font-medium">Create a Stripe Connect account</h4>
                <p className="text-sm text-muted-foreground">
                  Start the process by setting up your Stripe Connect account through our platform.
                </p>
              </div>
            </div>

            <div className="flex">
              <div className={`flex-shrink-0 mr-4 h-8 w-8 rounded-full flex items-center justify-center ${
                accountStatus === 'active' ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300' : 'bg-muted text-muted-foreground'
              }`}>
                {accountStatus === 'active' ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <span>2</span>
                )}
              </div>
              <div>
                <h4 className="font-medium">Complete account verification</h4>
                <p className="text-sm text-muted-foreground">
                  Provide the required information to verify your identity and business details.
                </p>
              </div>
            </div>

            <div className="flex">
              <div className={`flex-shrink-0 mr-4 h-8 w-8 rounded-full flex items-center justify-center ${
                accountStatus === 'active' ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300' : 'bg-muted text-muted-foreground'
              }`}>
                {accountStatus === 'active' ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <span>3</span>
                )}
              </div>
              <div>
                <h4 className="font-medium">Link your bank account</h4>
                <p className="text-sm text-muted-foreground">
                  Connect your bank account to receive direct deposits from sales on our platform.
                </p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="font-semibold text-lg mb-2">Important Notes</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            <li>All information provided to Stripe is secure and encrypted.</li>
            <li>You'll need to provide legal documentation for identity verification.</li>
            <li>Bank account information is required for receiving payouts.</li>
            <li>Stripe may take 24-48 hours to verify your account after submission.</li>
            <li>Our platform fee (10%) is automatically deducted from each transaction.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
