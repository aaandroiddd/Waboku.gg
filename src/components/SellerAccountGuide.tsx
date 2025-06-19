import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, AlertCircle, ArrowRight, ExternalLink, RefreshCw } from 'lucide-react';

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