import { PricingPlans } from '@/components/PricingPlans';
import { useAccount } from '@/contexts/AccountContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/router';
import { Footer } from '@/components/Footer';
import { useEffect, useRef } from 'react';
import { getDatabase, ref, set } from 'firebase/database';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Card } from '@/components/ui/card';
import { AccountTierDebugger } from '@/components/dashboard/AccountTierDebugger';
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
  // Move all hooks to the top of the component to ensure consistent hook calls
  const { accountTier, subscription = {}, cancelSubscription, isLoading, refreshAccountData } = useAccount();
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { session_id, upgrade } = router.query;
  
  // Use a ref to track if we've already refreshed the data on initial load
  const initialRefreshDoneRef = useRef(false);

  useEffect(() => {
    // Refresh account data when the page loads, but only once
    if (!initialRefreshDoneRef.current) {
      console.log('[AccountStatus] Initial data refresh');
      refreshAccountData();
      initialRefreshDoneRef.current = true;
    }
    
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
            
            // For all environments, check if the subscription was updated
            try {
              // Wait a moment for the webhook to process
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              // Don't force a page reload, just update the UI
              toast({
                title: "Success!",
                description: "Your subscription has been processed. Your account has been upgraded to premium.",
              });
              
              // Refresh the account data to reflect the changes
              await refreshAccountData();
              
              // Force reload the page to ensure all subscription data is properly loaded
              // This helps with users who previously deleted their accounts
              window.location.reload();
            } catch (err) {
              console.error('Failed to check subscription status:', err);
            }
          })
          .catch(err => console.error('Error refreshing token:', err));
      } else {
        toast({
          title: "Success!",
          description: "Your subscription has been processed. Your account will be upgraded shortly.",
        });
      }
      
      // Remove the query parameters from the URL without refreshing the page
      router.replace('/dashboard/account-status', undefined, { shallow: true });
    }
  }, [session_id, upgrade, toast, router, user, refreshAccountData]);

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

      // For both preview and production, use the API to ensure proper handling
      if (!subscription.stripeSubscriptionId) {
        throw new Error('No active subscription ID found');
      }

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get a fresh token
      const idToken = await user.getIdToken(true);

      // Make API call with all required data
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          subscriptionId: subscription.stripeSubscriptionId,
          userId: user.uid,
          isPreview: process.env.NEXT_PUBLIC_CO_DEV_ENV === 'preview'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to cancel subscription');
      }

      const data = await response.json();
      console.log('Cancellation response:', data);

      // Show success message with end date
      const endDateFormatted = data.endDate ? formatDate(data.endDate) : 'the end of your billing period';
      toast({
        title: "Subscription Canceled",
        description: `Your premium features will remain active until ${endDateFormatted}.`,
      });

      // Instead of reloading the page, just refresh the account data
      await refreshAccountData();
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

  // Render email verification message if user is not verified
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
            <div className="flex items-center justify-end gap-2 mb-2">
              <h1 className="text-3xl font-bold text-foreground">Account Status</h1>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  toast({
                    title: "Refreshing...",
                    description: "Updating your subscription status...",
                  });
                  refreshAccountData().then(() => {
                    toast({
                      title: "Updated",
                      description: "Your subscription status has been refreshed.",
                    });
                  });
                }}
                disabled={isLoading}
              >
                {isLoading ? "Refreshing..." : "Refresh Status"}
              </Button>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <p className="text-muted-foreground">Current Plan:</p>
              <Badge 
                variant={accountTier === 'premium' ? 'default' : 'secondary'} 
                className={`
                  ${accountTier === 'premium' && !subscription?.cancelAtPeriodEnd ? 'bg-gradient-to-r from-blue-500 to-purple-500' : ''}
                  ${(subscription?.status === 'canceled' || subscription?.cancelAtPeriodEnd) ? 'bg-gradient-to-r from-orange-500 to-red-500' : ''}
                `}
              >
                {accountTier === 'premium' && !subscription?.cancelAtPeriodEnd ? 'Premium ⭐' : 
                 (subscription?.status === 'canceled' || subscription?.cancelAtPeriodEnd) ? 'Premium (Canceling)' : 'Free'}
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
                {accountTier === 'premium' && subscription.stripeSubscriptionId?.startsWith('admin_') && subscription.status === 'active' ? 'Active (Admin)' : 
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
                   (subscription.stripeSubscriptionId?.includes('admin_') && subscription.endDate ? formatDate(subscription.endDate) : 
                   subscription.stripeSubscriptionId?.includes('admin_') ? formatDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)) : 'N/A')}
                </span>
              </div>
            )}
            {subscription.status === 'canceled' && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Access Until:</span>
                <span>{subscription.endDate ? formatDate(subscription.endDate) : 'End of billing period'}</span>
              </div>
            )}
            {subscription.status === 'active' && !subscription.stripeSubscriptionId?.includes('admin_') && (
              <p className="text-sm text-muted-foreground mt-2">
                Your subscription renews automatically every 30 days.
              </p>
            )}
            {accountTier === 'premium' && (
              subscription.stripeSubscriptionId?.includes('admin_') ? (
                <p className="text-sm text-muted-foreground mt-2">
                  Your account has been upgraded to premium by an administrator.
                </p>
              ) : subscription.status === 'active' ? (
                <p className="text-sm text-muted-foreground mt-2">
                  Your subscription renews automatically every 30 days.
                </p>
              ) : null
            )}
            {subscription.status === 'canceled' && subscription.endDate && (
              <div className="mt-4">
                <div className="p-4 mb-4 border rounded-md bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                  <h3 className="text-base font-medium text-amber-800 dark:text-amber-300 mb-2">Subscription Canceled</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Your premium features will remain active until <span className="font-semibold">{formatDate(subscription.endDate)}</span>.
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mt-2">
                    After this date, your account will revert to the free tier.
                  </p>
                </div>
                <Button 
                  onClick={async () => {
                    try {
                      // Show loading state
                      toast({
                        title: "Processing...",
                        description: "Preparing subscription checkout...",
                      });

                      // Always use Stripe checkout for all environments
                      console.log('Starting resubscription process with Stripe checkout');
                      
                      // First, clear the canceled subscription status
                      try {
                        const db = getDatabase();
                        const subscriptionRef = ref(db, `users/${user?.uid}/account/subscription`);
                        
                        // Mark the subscription as replaced
                        await set(subscriptionRef, {
                          ...subscription,
                          status: 'replaced',
                          lastUpdated: Date.now()
                        });
                        
                        console.log('Cleared canceled subscription status');
                      } catch (clearError) {
                        console.error('Error clearing canceled subscription:', clearError);
                        // Continue anyway as this is not critical
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

                      // First, clear the canceled subscription status via a separate API call
                      try {
                        // Update the subscription status in the database to indicate it's being replaced
                        const db = getDatabase();
                        const subscriptionRef = ref(db, `users/${user.uid}/account/subscription`);
                        
                        // Make a copy of the subscription object and update the status
                        const updatedSubscription = {
                          ...(subscription || {}),
                          status: 'replaced',
                          lastUpdated: Date.now()
                        };
                        
                        // Set the entire object to ensure all required fields are present
                        await set(subscriptionRef, updatedSubscription);
                        
                        console.log('Cleared canceled subscription status before resubscribing');
                      } catch (clearError) {
                        console.error('Error clearing canceled subscription:', clearError);
                        // Continue anyway as this is not critical
                      }

                      // Add a small delay to ensure the database update completes
                      await new Promise(resolve => setTimeout(resolve, 500));

                      // Now make the API call to create a new checkout session
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

                        const retryData = await retryResponse.json();
                        
                        if (retryData.isPreview) {
                          // For preview environment, use Next.js router
                          router.push(retryData.sessionUrl);
                        } else {
                          // Use client-side redirect for production Stripe checkout
                          window.location.assign(retryData.sessionUrl);
                        }
                        return;
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
            {subscription.status === 'none' && accountTier === 'premium' && subscription.stripeSubscriptionId?.startsWith('admin_') && (
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
                      <AlertDialogDescription className="space-y-2">
                        <p>
                          Your premium features will remain active until the end of your current billing period 
                          {subscription.renewalDate ? ` (${formatDate(subscription.renewalDate)})` : ''}.
                        </p>
                        <p>
                          After that date, your account will revert to the free tier.
                        </p>
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
        
        {/* Special button for users who recreated their account and have subscription issues */}
        <Card className="p-6 mb-8 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
          <h3 className="text-lg font-semibold mb-2 text-amber-800 dark:text-amber-300">Having Subscription Issues?</h3>
          <p className="text-sm text-amber-700 dark:text-amber-400 mb-4">
            If you previously deleted your account and created a new one, you might experience issues with your subscription.
            Click the button below to fix potential subscription conflicts.
          </p>
          <Button 
            variant="outline"
            className="border-amber-500 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900"
            onClick={async () => {
              try {
                toast({
                  title: "Processing...",
                  description: "Checking and fixing subscription data...",
                });
                
                if (!user) {
                  throw new Error('You must be logged in to perform this action');
                }
                
                // Get a fresh token
                const idToken = await user.getIdToken(true);
                
                // Call our dedicated cleanup endpoint
                const response = await fetch('/api/stripe/cleanup-subscription', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json'
                  }
                });
                
                if (!response.ok) {
                  const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
                  throw new Error(errorData.message || 'Failed to clean up subscription data');
                }
                
                // Refresh account data
                await refreshAccountData();
                
                toast({
                  title: "Completed",
                  description: "Subscription data has been checked and fixed. Please try upgrading again if needed.",
                });
                
                // Force reload the page to ensure all subscription data is properly loaded
                window.location.reload();
              } catch (error: any) {
                console.error('Error fixing subscription:', error);
                toast({
                  title: "Error",
                  description: error.message || "Failed to fix subscription data. Please contact support.",
                  variant: "destructive",
                });
              }
            }}
          >
            Fix Subscription Data
          </Button>
        </Card>
        
        {/* Account Tier Debugger */}
        <AccountTierDebugger />
      </div>
      <Footer />
    </div>
  );
}

// Define a proper getLayout function that ensures consistent rendering
AccountStatus.getLayout = function getLayout(page: React.ReactElement) {
  // Return the page directly without wrapping it in DashboardLayout
  // This is important because we want to use a custom layout for this page
  return page;
};