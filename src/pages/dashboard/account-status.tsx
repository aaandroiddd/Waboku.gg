import { PricingPlans } from '@/components/PricingPlans';
import { useAccount } from '@/contexts/AccountContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/router';
import { Footer } from '@/components/Footer';
import { useEffect } from 'react';
import { getDatabase, ref, set } from 'firebase/database';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Card } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AccountStatus() {
  const { accountTier, subscription, cancelSubscription } = useAccount();
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { session_id, upgrade } = router.query;

  useEffect(() => {
    if (session_id || upgrade === 'success') {
      toast({
        title: "Success!",
        description: "Your subscription has been processed. Your account will be upgraded shortly.",
      });
      // Remove the query parameters from the URL without refreshing the page
      router.replace('/dashboard/account-status', undefined, { shallow: true });
    }
  }, [session_id, upgrade, toast, router]);

  const handleCancelSubscription = async () => {
    try {
      console.log('Initiating subscription cancellation:', {
        subscription,
        accountTier
      });
      
      // Validate subscription state
      if (!subscription) {
        throw new Error('No subscription information available');
      }

      if (subscription.status === 'canceled') {
        throw new Error('This subscription has already been canceled');
      }

      if (!subscription.stripeSubscriptionId) {
        throw new Error('No active subscription ID found');
      }

      // Show loading state
      toast({
        title: "Processing...",
        description: "Canceling your subscription...",
      });

      // Attempt to cancel
      await cancelSubscription();

      // Show success message
      toast({
        title: "Subscription Canceled",
        description: "Your subscription will remain active until the end of the current billing period.",
      });
    } catch (error: any) {
      console.error('Subscription cancellation failed:', {
        error: error.message,
        subscription,
        accountTier
      });

      // Handle specific error cases
      let errorMessage = "Failed to cancel subscription. Please try again.";
      let errorTitle = "Error";
      
      if (error.message.includes('already been canceled')) {
        errorMessage = "This subscription has already been canceled.";
        errorTitle = "Already Canceled";
      } else if (error.message.includes('No active subscription')) {
        errorMessage = "No active subscription found. Please contact support.";
        errorTitle = "No Subscription Found";
      } else if (error.message.includes('not found in our records')) {
        errorMessage = "Subscription not found in our records. Please contact support.";
        errorTitle = "Subscription Not Found";
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container max-w-7xl mx-auto p-6 flex-grow">
        <div className="flex justify-between items-start mb-8">
          <Button
            variant="ghost"
            onClick={() => router.back()}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="text-right">
            <h1 className="text-3xl font-bold text-foreground mb-2">Account Status</h1>
            <div className="flex items-center gap-2 justify-end">
              <p className="text-muted-foreground">Current Plan:</p>
              <Badge 
                variant={subscription.status === 'active' ? 'default' : 'secondary'} 
                className={subscription.status === 'active' ? 'bg-gradient-to-r from-blue-500 to-purple-500' : ''}
              >
                {subscription.status === 'active' ? 'Premium ⭐' : 'Free'}
              </Badge>
            </div>
          </div>
        </div>

        <Card className="p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Subscription Details</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                {subscription.status === 'active' ? 'Active' : 
                 subscription.status === 'canceled' ? 'Canceled' : 'No Active Subscription'}
              </Badge>
            </div>
            {subscription.startDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Original Start Date:</span>
                <span>{formatDate(subscription.startDate)}</span>
              </div>
            )}
            {subscription.status === 'active' && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Next Renewal:</span>
                <span>{formatDate(subscription.renewalDate)}</span>
              </div>
            )}
            {subscription.status === 'canceled' && subscription.endDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Access Until:</span>
                <span>{formatDate(subscription.endDate)}</span>
              </div>
            )}
            {subscription.status === 'active' && (
              <p className="text-sm text-muted-foreground mt-2">
                Your subscription renews automatically every 30 days.
              </p>
            )}
            {subscription.status === 'canceled' && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Your subscription is canceled. You will lose access to premium features on {formatDate(subscription.endDate)}.
                </p>
                <Button 
                  onClick={async () => {
                    try {
                      // Show loading state
                      toast({
                        title: "Processing...",
                        description: "Preparing subscription checkout...",
                      });

                      // For testing purposes in preview environment
                      if (process.env.NEXT_PUBLIC_CO_DEV_ENV === 'preview') {
                        // Simulate successful resubscription by directly updating Firebase
                        try {
                          const db = getDatabase();
                          const userRef = ref(db, `users/${user?.uid}/account`);
                          await set(userRef, {
                            tier: 'premium',
                            status: 'active',
                            stripeCustomerId: 'test_customer_' + Math.random().toString(36).substr(2, 9),
                            subscriptionId: 'test_sub_' + Math.random().toString(36).substr(2, 9),
                            lastUpdated: Date.now()
                          });

                          // Redirect to simulate the success flow
                          router.push('/dashboard/account-status?upgrade=success');
                          return;
                        } catch (error) {
                          console.error('Preview mode update failed:', error);
                          throw new Error('Failed to simulate subscription in preview mode');
                        }
                      }

                      const idToken = await user?.getIdToken(true); // Force token refresh
                      if (!idToken) {
                        throw new Error('Not authenticated');
                      }

                      const response = await fetch('/api/stripe/create-checkout', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${idToken}`,
                        },
                      });

                      if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Failed to create checkout session');
                      }

                      const data = await response.json();
                      
                      if (data.isPreview) {
                        window.location.href = data.sessionUrl;
                      } else {
                        // Use client-side redirect for production Stripe checkout
                        window.location.assign(data.sessionUrl);
                      }
                    } catch (error: any) {
                      console.error('Resubscribe error:', error);
                      toast({
                        title: "Error",
                        description: error.message || "Unable to process subscription. Please try again or contact support.",
                        variant: "destructive",
                      });
                    }
                  }}
                  className="w-full"
                >
                  Resubscribe to Premium
                </Button>
              </div>
            )}
            {subscription.status === 'none' && (
              <p className="text-sm text-muted-foreground mt-2">
                You are currently on the free plan. Upgrade to premium to access additional features.
              </p>
            )}
            
            {subscription.status === 'active' && (
              <div className="mt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">Cancel Subscription</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Premium Subscription?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Your premium features will remain active until the end of your current billing period. After that, your account will revert to the free tier.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCancelSubscription}>
                        Yes, Cancel
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </Card>
        
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">Subscription Plans</h2>
          <PricingPlans />
        </div>
      </div>
      <Footer />
    </div>
  );
}

AccountStatus.getLayout = function getLayout(page: React.ReactElement) {
  return page;
};