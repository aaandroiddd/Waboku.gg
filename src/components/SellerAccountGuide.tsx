import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, AlertCircle, ArrowRight, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface SellerAccountGuideProps {
  accountStatus: {
    isConnected: boolean;
    isEnabled: boolean;
    needsMoreInfo: boolean;
    accountLink?: string;
  };
  isLoading: boolean;
  onCreateAccount: () => Promise<void>;
  onUpdateAccount: () => Promise<void>;
}

const SellerAccountGuide: React.FC<SellerAccountGuideProps> = ({
  accountStatus,
  isLoading,
  onCreateAccount,
  onUpdateAccount,
}) => {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleCreateAccount = async () => {
    setIsCreating(true);
    try {
      await onCreateAccount();
      toast({
        title: "Account creation initiated",
        description: "You'll be redirected to Stripe to complete your account setup.",
      });
    } catch (error) {
      toast({
        title: "Error creating account",
        description: "There was a problem creating your Stripe Connect account. Please try again.",
        variant: "destructive",
      });
      console.error("Error creating account:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateAccount = async () => {
    setIsUpdating(true);
    try {
      await onUpdateAccount();
      toast({
        title: "Account update initiated",
        description: "You'll be redirected to Stripe to update your account information.",
      });
    } catch (error) {
      toast({
        title: "Error updating account",
        description: "There was a problem updating your Stripe Connect account. Please try again.",
        variant: "destructive",
      });
      console.error("Error updating account:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-6">
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
          <CardFooter>
            {!accountStatus.isConnected ? (
              <Button 
                onClick={handleCreateAccount} 
                disabled={isLoading || isCreating}
                className="w-full"
              >
                {isCreating ? "Creating Account..." : "Create Seller Account"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : accountStatus.needsMoreInfo ? (
              <Button 
                onClick={handleUpdateAccount} 
                disabled={isLoading || isUpdating}
                className="w-full"
              >
                {isUpdating ? "Updating..." : "Complete Account Setup"}
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button 
                onClick={handleUpdateAccount} 
                variant="outline" 
                disabled={isLoading || isUpdating}
                className="w-full"
              >
                {isUpdating ? "Updating..." : "Update Account Information"}
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default SellerAccountGuide;