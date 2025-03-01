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
  const { accountTier, subscription = {}, cancelSubscription, isLoading } = useAccount();
  const { user } = useAuth();
  
  // Redirect unverified users or show verification message
  if (user && !user.emailVerified) {
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
          </div>
          
          <Card className="p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Email Verification Required</h2>
            <p className="text-muted-foreground mb-4">
              Please verify your email address before accessing premium features. Check your inbox for a verification email.
            </p>
            <Button 
              onClick={async () => {
                try {
                  await user.sendEmailVerification();
                  toast({
                    title: "Verification Email Sent",
                    description: "Please check your inbox and follow the verification link.",
                  });
                } catch (error) {
                  toast({
                    title: "Error",
                    description: "Failed to send verification email. Please try again later.",
                    variant: "destructive",
                  });
                }
              }}
            >
              Resend Verification Email
            </Button>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }
  const router = useRouter();
  const { toast } = useToast();
  const { session_id, upgrade } = router.query;

  useEffect(() => {
    // Check for auth redirect state in localStorage
    const checkAuthRedirect = () => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const storedAuth = localStorage.getItem('waboku_auth_redirect');
          if (storedAuth) {
            console.log('Found auth redirect state, user should be authenticated');
            
            // Parse the stored auth data
            const authData = JSON.parse(storedAuth);
            console.log('Auth redirect data:', {
              uid: authData.uid ? `${authData.uid.substring(0, 5)}...` : 'missing',
              timestamp: authData.timestamp ? new Date(authData.timestamp).toISOString() : 'missing',
              age: authData.timestamp ? `${Math.floor((Date.now() - authData.timestamp) / 1000 / 60)} minutes` : 'unknown'
            });
            
            // Clear the stored auth state after checking
            localStorage.removeItem('waboku_auth_redirect');
          }
        }
      } catch (error) {
        console.error('Error checking auth redirect state:', error);
      }
    };
    
    if (session_id || upgrade === 'success') {
      // Check auth state first
      checkAuthRedirect();
      
      // Force token refresh to ensure we have the latest auth state
      if (user) {
        user.getIdToken(true)
          .then(async () => {
            console.log('Token refreshed after checkout');
            
            // For preview environment, update the database directly
            if (process.env.NEXT_PUBLIC_CO_DEV_ENV === 'preview' && user.uid) {
              try {
                const db = getDatabase();
                const userRef = ref(db, `users/${user.uid}/account`);
                
                // Set premium subscription data
                await set(userRef, {
                  tier: 'premium',
                  status: 'active',
                  subscription: {
                    status: 'active',
                    tier: 'premium',
                    stripeSubscriptionId: `preview_${Date.now()}`,
                    startDate: new Date().toISOString(),
                    renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    currentPeriodEnd: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
                    lastUpdated: Date.now()
                  }
                });
                
                console.log('Preview mode: Updated subscription data');
                
                // Force a reload of the account context to reflect the changes
                if (typeof window !== 'undefined') {
                  // Wait a moment for the database to update
                  setTimeout(() => {
                    window.location.reload();
                  }, 1500);
                }
              } catch (err) {
                console.error('Preview mode: Failed to update subscription data', err);
              }
            } else {
              // For production, check if the subscription was updated
              try {
                // Wait a moment for the webhook to process
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Force a reload to get the latest account data
                if (typeof window !== 'undefined') {
                  window.location.reload();
                }
              } catch (err) {
                console.error('Failed to check subscription status:', err);
              }
            }
          })
          .catch(err => console.error('Error refreshing token:', err));
      }
      
      toast({
        title: "Success!",
        description: "Your subscription has been processed. Your account will be upgraded shortly.",
      });
      
      // Remove the query parameters from the URL without refreshing the page
      router.replace('/dashboard/account-status', undefined, { shallow: true });
    }
  }, [session_id, upgrade, toast, router, user]);

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

      // Show loading state
      toast({
        title: "Processing...",
        description: "Canceling your subscription...",
      });

      // Handle preview environment
      if (process.env.NEXT_PUBLIC_CO_DEV_ENV === 'preview') {
        try {
          // Simulate cancellation by updating the subscription status
          const db = getDatabase();
          const userRef = ref(db, `users/${user?.uid}/account/subscription`);
          const currentDate = new Date();
          const endDate = new Date();
          endDate.setDate(currentDate.getDate() + 30); // Set end date to 30 days from now
          
          // Make sure we have all required fields to satisfy validation rules
          await set(userRef, {
            status: 'canceling', // Use 'canceling' instead of 'canceled' to match API behavior
            startDate: subscription.startDate || currentDate.toISOString(),
            endDate: endDate.toISOString(),
            stripeSubscriptionId: subscription.stripeSubscriptionId || 'preview-sub-canceled',
            canceledAt: currentDate.toISOString(),
            cancelAtPeriodEnd: true
          });

          toast({
            title: "Subscription Canceled",
            description: "Your subscription will remain active until " + endDate.toLocaleDateString(),
          });

          // Refresh the page after a short delay to show updated status
          setTimeout(() => {
            window.location.reload();
          }, 2000);
          
          return;
        } catch (previewError: any) {
          console.error('Preview mode update failed:', previewError);
          
          // If direct database update fails, fall back to API call
          console.log('Falling back to API call for preview environment');
        }
      }

      // Production flow
      if (!subscription.stripeSubscriptionId) {
        throw new Error('No active subscription ID found');
      }

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get a fresh token
      const idToken = await user.getIdToken(true);

      // Make direct API call with all required data
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          subscriptionId: subscription.stripeSubscriptionId,
          userId: user.uid
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to cancel subscription');
      }

      const data = await response.json();
      console.log('Cancellation response:', data);

      // Show success message
      toast({
        title: "Subscription Canceled",
        description: "Your subscription will remain active until the end of the current billing period.",
      });

      // Refresh the page after a short delay to show updated status
      setTimeout(() => {
        window.location.reload();
      }, 2000);
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
                variant={accountTier === 'premium' ? 'default' : 'secondary'} 
                className={`
                  ${accountTier === 'premium' ? 'bg-gradient-to-r from-blue-500 to-purple-500' : ''}
                  ${subscription?.status === 'canceled' ? 'bg-gradient-to-r from-orange-500 to-red-500' : ''}
                `}
              >
                {accountTier === 'premium' ? 'Premium ⭐' : 
                 subscription?.status === 'canceled' ? 'Premium (Canceling)' : 'Free'}
              </Badge>
            </div>
          </div>
        </div>

        <Card className="p-6 mb-8 border-2 border-primary">
          <h2 className="text-xl font-semibold mb-4">Subscription Details</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant={accountTier === 'premium' ? 'default' : 'secondary'} className="bg-blue-500">
                {accountTier === 'premium' && (subscription.status !== 'active' || subscription.stripeSubscriptionId?.includes('admin_')) ? 'Active (Admin)' : 
                 subscription.status === 'active' ? 'Active' : 
                 subscription.status === 'canceled' ? 'Canceled' : 'No Active Subscription'}
              </Badge>
            </div>
            {subscription.startDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Original Start Date:</span>
                <span>{formatDate(subscription.startDate)}</span>
              </div>
            )}
            {(subscription.status === 'active' || accountTier === 'premium') && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Next Renewal:</span>
                <span>
                  {subscription.renewalDate ? formatDate(subscription.renewalDate) : 
                   (subscription.stripeSubscriptionId?.includes('admin_') ? 'N/A (Admin Upgraded)' : 'N/A')}
                </span>
              </div>
            )}
            {subscription.status === 'canceled' && subscription.endDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Access Until:</span>
                <span>{formatDate(subscription.endDate)}</span>
              </div>
            )}
            {subscription.status === 'active' && !subscription.stripeSubscriptionId?.includes('admin_') && (
              <p className="text-sm text-muted-foreground mt-2">
                Your subscription renews automatically every 30 days.
              </p>
            )}
            {accountTier === 'premium' && subscription.stripeSubscriptionId?.includes('admin_') && (
              <p className="text-sm text-muted-foreground mt-2">
                Your account has been upgraded to premium by an administrator.
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

                      if (!user) {
                        throw new Error('User not authenticated');
                      }

                      // Force token refresh and get a fresh token
                      const freshToken = await user.getIdToken(true);
                      console.log('Token obtained successfully:', {
                        tokenLength: freshToken.length,
                        timestamp: new Date().toISOString()
                      });

                      const response = await fetch('/api/stripe/create-checkout', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${freshToken}`,
                        }
                      });
                      
                      console.log('Checkout response status:', response.status);
                      if (!response.ok) {
                        const errorText = await response.text();
                        console.error('Checkout error response:', errorText);
                        try {
                          const errorJson = JSON.parse(errorText);
                          throw new Error(errorJson.message || 'Failed to create checkout session');
                        } catch (e) {
                          throw new Error('Failed to create checkout session: ' + errorText);
                        }
                      }

                      if (response.status === 401) {
                        // Token might be expired, try to refresh and retry
                        const newToken = await user?.getIdToken(true);
                        if (!newToken) {
                          throw new Error('Failed to refresh authentication');
                        }

                        const retryResponse = await fetch('/api/stripe/create-checkout', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${newToken}`,
                          },
                        });

                        if (!retryResponse.ok) {
                          const errorData = await retryResponse.json();
                          throw new Error(errorData.message || 'Failed to create checkout session after token refresh');
                        }

                        return retryResponse.json();
                      }

                      if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Failed to create checkout session');
                      }

                      const data = await response.json();
                      
                      if (data.isPreview) {
                        // For preview environment, use Next.js router
                        router.push(data.sessionUrl);
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
            {subscription.status === 'none' && accountTier !== 'premium' && (
              <p className="text-sm text-muted-foreground mt-2">
                You are currently on the free plan. Upgrade to premium to access additional features.
              </p>
            )}
            {subscription.status === 'none' && accountTier === 'premium' && (
              <p className="text-sm text-muted-foreground mt-2">
                Your account has been upgraded to premium by an administrator. Enjoy all premium features!
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