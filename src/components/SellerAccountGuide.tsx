import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, ArrowRight, ExternalLink, RefreshCw, Lock, MessageCircle } from 'lucide-react';
import { useStripeConnectEligibility } from '@/hooks/useStripeConnectEligibility';
import { useRouter } from 'next/router';

interface SellerAccountGuideProps {
  accountStatus: {
    isConnected: boolean;
    isEnabled: boolean;
    needsMoreInfo: boolean;
  };
  isLoading: boolean;
  onCreateAccount: () => void;
  onUpdateAccount: () => void;
  onRefreshStatus?: () => void;
}

const SellerAccountGuide: React.FC<SellerAccountGuideProps> = ({
  accountStatus,
  isLoading,
  onCreateAccount,
  onUpdateAccount,
  onRefreshStatus,
}) => {
  const router = useRouter();
  const { isEligible, isLoading: eligibilityLoading, approvedBy, approvedAt } = useStripeConnectEligibility();
  
  // If user is not eligible for Stripe Connect, show restricted access message
  if (!eligibilityLoading && !isEligible) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Lock className="h-6 w-6 text-amber-500" />
            Seller Account Access
          </CardTitle>
          <CardDescription>
            Stripe Connect setup requires approval from our support team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
            <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              <div className="space-y-3">
                <p className="font-medium">Access Restricted</p>
                <p>
                  For security and compliance reasons, Stripe Connect seller account setup requires manual approval from our support team.
                </p>
                <p>
                  To request access to seller features, please contact our support team with the following information:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
                  <li>Your intended use case for selling on our platform</li>
                  <li>Types of items you plan to list</li>
                  <li>Your experience with online marketplaces</li>
                  <li>Any relevant business information</li>
                </ul>
                <p className="text-sm">
                  Our team will review your request and enable seller account access if approved.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={() => router.push('/support')}
            className="w-full"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Contact Support for Access
          </Button>
        </CardFooter>
      </Card>
    );
  }
  
  // Show loading state while checking eligibility
  if (eligibilityLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Seller Account Status</CardTitle>
          <CardDescription>
            Checking account eligibility...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Seller Account Status</CardTitle>
        <CardDescription>
          Connect with Stripe to receive payments for your listings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Approval Status */}
          {isEligible && approvedBy && (
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <div className="space-y-1">
                  <p className="font-medium">Seller Account Approved</p>
                  <p className="text-sm">
                    Approved by support team{approvedAt && ` on ${approvedAt.toLocaleDateString()}`}
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex items-start gap-3">
            {accountStatus.isConnected ? (
              <CheckCircle className="h-6 w-6 text-green-500 mt-0.5" />
            ) : (
              <AlertCircle className="h-6 w-6 text-amber-500 mt-0.5" />
            )}
            <div>
              <h3 className="font-medium">Connect with Stripe</h3>
              <p className="text-sm text-muted-foreground">
                {accountStatus.isConnected
                  ? "Your account is connected to Stripe"
                  : "Connect your account to Stripe to receive payments"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            {accountStatus.isEnabled ? (
              <CheckCircle className="h-6 w-6 text-green-500 mt-0.5" />
            ) : (
              <AlertCircle className="h-6 w-6 text-amber-500 mt-0.5" />
            )}
            <div>
              <h3 className="font-medium">Account Verification</h3>
              <p className="text-sm text-muted-foreground">
                {accountStatus.isEnabled
                  ? "Your account is verified and ready to receive payments"
                  : "Complete your account verification to receive payments"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            {!accountStatus.needsMoreInfo ? (
              <CheckCircle className="h-6 w-6 text-green-500 mt-0.5" />
            ) : (
              <AlertCircle className="h-6 w-6 text-amber-500 mt-0.5" />
            )}
            <div>
              <h3 className="font-medium">Account Information</h3>
              <p className="text-sm text-muted-foreground">
                {!accountStatus.needsMoreInfo
                  ? "All required information has been provided"
                  : "Additional information is needed to complete your account setup"}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {!accountStatus.isConnected ? (
          <Button 
            onClick={onCreateAccount} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? "Loading..." : "Create Seller Account"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : accountStatus.needsMoreInfo ? (
          <Button 
            onClick={onUpdateAccount} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? "Loading..." : "Complete Account Setup"}
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button 
            onClick={onUpdateAccount} 
            variant="outline" 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? "Loading..." : "Update Account Information"}
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        )}
        
        {onRefreshStatus && (
          <Button 
            onClick={onRefreshStatus}
            variant="ghost"
            size="sm"
            disabled={isLoading}
            className="w-full"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? "Refreshing..." : "Refresh Status"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default SellerAccountGuide;