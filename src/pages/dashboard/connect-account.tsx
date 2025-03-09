import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { CheckCircle, AlertCircle, ExternalLink, ArrowRight } from 'lucide-react';

export default function ConnectAccount() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [accountStatus, setAccountStatus] = useState<'none' | 'pending' | 'active' | 'error'>('none');
  const [errorMessage, setErrorMessage] = useState('');
  const { success, error } = router.query;

  useEffect(() => {
    if (!user) return;

    const checkConnectAccount = async () => {
      try {
        const response = await fetch('/api/stripe/connect/account-status', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to check account status');
        }

        const data = await response.json();
        setAccountStatus(data.status);
      } catch (error) {
        console.error('Error checking account status:', error);
        setAccountStatus('error');
      }
    };

    checkConnectAccount();
  }, [user, success]);

  useEffect(() => {
    if (success === 'true') {
      setAccountStatus('active');
    } else if (error) {
      setAccountStatus('error');
      setErrorMessage(typeof error === 'string' ? error : 'An error occurred during onboarding');
    }
  }, [success, error]);

  const handleCreateConnectAccount = async () => {
    if (!user) {
      router.push('/auth/sign-in');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/stripe/connect/create-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create Connect account');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error: any) {
      console.error('Error creating Connect account:', error);
      setErrorMessage(error.message || 'Failed to create Connect account');
      setAccountStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConnectAccount = async () => {
    if (!user) {
      router.push('/auth/sign-in');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/stripe/connect/update-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update Connect account');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error: any) {
      console.error('Error updating Connect account:', error);
      setErrorMessage(error.message || 'Failed to update Connect account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Seller Account</h1>
          <p className="text-muted-foreground">
            Set up your Stripe Connect account to receive payments from buyers
          </p>
        </div>

        <Separator />

        {accountStatus === 'active' && (
          <Alert className="bg-green-500/10 border-green-500 text-green-500">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Account Connected</AlertTitle>
            <AlertDescription>
              Your Stripe Connect account is active and ready to receive payments.
            </AlertDescription>
          </Alert>
        )}

        {accountStatus === 'error' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {errorMessage || 'There was an error with your Stripe Connect account. Please try again.'}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Stripe Connect</CardTitle>
            <CardDescription>
              Connect your Stripe account to receive payments directly from buyers on our platform.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h3 className="font-medium">Benefits of Stripe Connect</h3>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                    <li>Receive payments directly to your bank account</li>
                    <li>Secure payment processing</li>
                    <li>Automatic payouts on a schedule you choose</li>
                    <li>Detailed reporting and transaction history</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium">How it works</h3>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                    <li>Complete the Stripe onboarding process</li>
                    <li>Verify your identity and banking information</li>
                    <li>Start selling cards and receiving payments</li>
                    <li>Platform fee: 10% of each transaction</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4 sm:justify-between">
            {accountStatus === 'none' && (
              <Button
                onClick={handleCreateConnectAccount}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {loading ? 'Setting up...' : 'Set Up Stripe Connect'}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            )}

            {accountStatus === 'pending' && (
              <Button
                onClick={handleUpdateConnectAccount}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {loading ? 'Loading...' : 'Complete Onboarding'}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            )}

            {accountStatus === 'active' && (
              <Button
                onClick={handleUpdateConnectAccount}
                variant="outline"
                className="w-full sm:w-auto"
              >
                Update Account Details
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="w-full sm:w-auto"
            >
              Back to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    </DashboardLayout>
  );
}