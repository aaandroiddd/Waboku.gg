import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, ArrowRight, ExternalLink, RefreshCw, Lock, MessageCircle, XCircle, Clock, AlertTriangle, Shield, Mail, Calendar } from 'lucide-react';
import { useSellerAccountEligibility } from '@/hooks/useSellerAccountEligibility';
import { useRouter } from 'next/router';
import Link from 'next/link';

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
  const { isEligible, requirements, loading: eligibilityLoading, error } = useSellerAccountEligibility();

  const getRequirementIcon = (requirementId: string) => {
    switch (requirementId) {
      case 'email_verified':
        return Mail;
      case 'mfa_enabled':
        return Shield;
      case 'account_age':
        return Calendar;
      default:
        return CheckCircle;
    }
  };
  
  // Show loading state while checking eligibility
  if (eligibilityLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Clock className="h-6 w-6 animate-spin" />
            Checking Eligibility...
          </CardTitle>
          <CardDescription>
            Please wait while we verify your account status...
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

  // Show error state
  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2 text-destructive">
            <XCircle className="h-6 w-6" />
            Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Unable to check your eligibility status: {error}
          </p>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  // If user is not eligible for Stripe Connect, show requirements
  if (!isEligible) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            Seller Account Setup Requirements
          </CardTitle>
          <CardDescription>
            Complete these requirements to enable seller account setup
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 mb-6">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              <div className="space-y-3">
                <p className="font-medium">Security Requirements</p>
                <p>
                  To ensure the security and integrity of our marketplace, you must meet the following 
                  requirements before setting up your seller account:
                </p>
              </div>
            </AlertDescription>
          </Alert>
          
          <div className="space-y-4">
            {requirements.map((requirement) => {
              const IconComponent = getRequirementIcon(requirement.id);
              return (
                <div 
                  key={requirement.id}
                  className={`flex items-start gap-3 p-4 rounded-lg border ${
                    requirement.met 
                      ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                      : 'bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-700'
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {requirement.loading ? (
                      <Clock className="h-5 w-5 animate-spin text-gray-400" />
                    ) : requirement.met ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <IconComponent className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">
                        {requirement.label}
                      </h4>
                      <Badge 
                        variant={requirement.met ? "default" : "secondary"}
                        className={requirement.met ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : ""}
                      >
                        {requirement.met ? "Complete" : "Required"}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {requirement.description}
                    </p>
                    {!requirement.met && requirement.id === 'email_verified' && (
                      <Link href="/auth/verify-email">
                        <Button size="sm" variant="outline">
                          Verify Email
                        </Button>
                      </Link>
                    )}
                    {!requirement.met && requirement.id === 'mfa_enabled' && (
                      <Link href="/dashboard/settings">
                        <Button size="sm" variant="outline">
                          Enable 2FA
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800 mt-6">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              Why these requirements?
            </h4>
            <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <p>• <strong>Email verification</strong> ensures we can contact you about important account matters</p>
              <p>• <strong>Two-factor authentication</strong> protects your account and earnings from unauthorized access</p>
              <p>• <strong>Account age requirement</strong> helps prevent fraudulent accounts and builds trust</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // If user is eligible, show the normal Stripe Connect setup
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
          {/* Eligibility Status */}
          <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              <div className="space-y-3">
                <p className="font-medium">Ready to Set Up Seller Account</p>
                <p className="text-sm">
                  All security requirements have been met. You can now proceed with Stripe Connect setup.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
                  {requirements.map((requirement) => {
                    const IconComponent = getRequirementIcon(requirement.id);
                    return (
                      <div 
                        key={requirement.id}
                        className="flex items-center gap-2 p-2 bg-white dark:bg-gray-900 rounded border border-green-200 dark:border-green-800"
                      >
                        <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />
                        <IconComponent className="h-3 w-3 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                          {requirement.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </AlertDescription>
          </Alert>
          
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