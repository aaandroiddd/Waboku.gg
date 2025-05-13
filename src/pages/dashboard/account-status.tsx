import { PricingPlans } from '@/components/PricingPlans';
import { useAccount } from '@/contexts/AccountContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/router';
import { Footer } from '@/components/Footer';
import { useEffect, useRef, useState } from 'react';
import { getDatabase, ref, set } from 'firebase/database';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Card } from '@/components/ui/card';
import { AccountTierDebugger } from '@/components/dashboard/AccountTierDebugger';
import { AccountStatusHistory } from '@/components/AccountStatusHistory';
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
import { LoadingScreen } from '@/components/LoadingScreen';

export default function AccountStatus() {
  // Move all hooks to the top of the component to ensure consistent hook calls
  const { accountTier, subscription = {}, cancelSubscription, isLoading, refreshAccountData } = useAccount();
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { session_id, upgrade } = router.query;
  
  // Track page initialization state
  const [pageState, setPageState] = useState<'initializing' | 'loading' | 'ready'>('initializing');
  const initializationComplete = useRef(false);

  // Consolidated initialization function
  useEffect(() => {
    // Skip if already initialized
    if (initializationComplete.current) return;
    
    const initializePage = async () => {
      try {
        setPageState('loading');
        console.log('[AccountStatus] Initializing page');
        
        // Handle Stripe checkout return if needed
        if (session_id || upgrade === 'success') {
          console.log('[AccountStatus] Handling return from Stripe checkout');
          
          try {
            // Import the auth persistence helpers
            const { 
              getStoredAuthState, 
              clearStoredAuthState, 
              attemptAuthRestoration,
              getStoredAuthToken
            } = await import('@/lib/auth-stripe-persistence');
            
            // First attempt to restore authentication
            const authRestored = await attemptAuthRestoration();
            console.log('[AccountStatus] Auth restoration attempt result:', authRestored);
            
            // Reconnect Firebase (single attempt)
            try {
              const { connectionManager } = await import('@/lib/firebase');
              if (connectionManager) {
                await connectionManager.reconnectFirebase();
                console.log('[AccountStatus] Firebase reconnection completed');
              }
            } catch (reconnectError) {
              console.error('[AccountStatus] Error reconnecting Firebase:', reconnectError);
            }
            
            // Force token refresh if user is available
            if (user) {
              try {
                await user.getIdToken(true);
                console.log('[AccountStatus] Token refreshed after checkout');
              } catch (tokenError) {
                console.error('[AccountStatus] Error refreshing token:', tokenError);
              }
            }
            
            // Force sync subscription data with Stripe
            try {
              console.log('[AccountStatus] Syncing subscription data with Stripe');
              const syncResponse = await fetch('/api/stripe/sync-subscription', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${await user?.getIdToken(true)}`
                }
              });
              
              if (syncResponse.ok) {
                console.log('[AccountStatus] Subscription sync successful');
                
                // Show success message
                toast({
                  title: "Success!",
                  description: "Your subscription has been processed. Your account has been upgraded to premium.",
                });
              } else {
                console.error('[AccountStatus] Subscription sync failed:', await syncResponse.text());
              }
            } catch (syncError) {
              console.error('[AccountStatus] Error syncing subscription:', syncError);
            }
            
            // Clear stored auth state after processing
            clearStoredAuthState();
          } catch (error) {
            console.error('[AccountStatus] Error handling Stripe return:', error);
          }
          
          // Remove query parameters from URL without refreshing the page
          router.replace('/dashboard/account-status', undefined, { shallow: true });
        }
        
        // Refresh account data once
        await refreshAccountData();
        
        // Mark initialization as complete
        initializationComplete.current = true;
        setPageState('ready');
        
      } catch (error) {
        console.error('[AccountStatus] Error during page initialization:', error);
        // Still mark as ready to avoid getting stuck in loading state
        setPageState('ready');
      }
    };
    
    initializePage();
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

      // Refresh the account data to reflect the changes
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

  // Show loading screen while initializing
  if (pageState === 'initializing' || pageState === 'loading') {
    return <LoadingScreen message="Loading account information..." />;
  }

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
            <div className="mb-2">
              <h1 className="text-3xl font-bold text-foreground">Account Status</h1>
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
            {accountTier === 'premium' && subscription.stripeSubscriptionId?.includes('admin_') && (
              <p className="text-sm text-muted-foreground mt-2">
                Your account has been upgraded to premium by an administrator.
              </p>
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
                      console.log('Token obtained successfully');

                      // Now make the API call to create a new checkout session
                      const response = await fetch('/api/stripe/create-checkout', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${freshToken}`,
                        }
                      });
                      
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
        
        {/* Account History section with collapsible content */}
        <div className="mb-8">
          <details className="group">
            <summary className="flex cursor-pointer items-center justify-between rounded-lg bg-muted px-4 py-2 hover:bg-muted/80">
              <div className="flex items-center gap-2">
                <img 
                  src="https://assets.co.dev/171838d1-5208-4d56-8fa3-d46502238350/image-330ace0.png" 
                  alt="Account history" 
                  className="h-5 w-5"
                />
                <span className="font-medium">Account History</span>
              </div>
              <svg
                className="h-5 w-5 transform transition-transform group-open:rotate-180"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </summary>
            <div className="mt-4 px-4">
              <AccountStatusHistory />
            </div>
          </details>
        </div>
        
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">Subscription Plans</h2>
          <PricingPlans />
        </div>
        
        {/* Advanced section with collapsible content */}
        <div className="mb-8">
          <details className="group">
            <summary className="flex cursor-pointer items-center justify-between rounded-lg bg-muted px-4 py-2 hover:bg-muted/80">
              <div className="flex items-center gap-2">
                <img 
                  src="https://assets.co.dev/171838d1-5208-4d56-8fa3-d46502238350/image-330ace0.png" 
                  alt="Advanced settings" 
                  className="h-5 w-5"
                />
                <span className="font-medium">Advanced</span>
              </div>
              <svg
                className="h-5 w-5 transform transition-transform group-open:rotate-180"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </summary>
            <div className="mt-4 px-4">
              <div className="space-y-4">
                {/* Refresh Status Button */}
                <Card className="p-6 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
                  <h3 className="text-lg font-semibold mb-2 text-blue-800 dark:text-blue-300">Refresh Subscription Status</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-400 mb-4">
                    If your subscription status doesn't appear to be up-to-date, you can manually refresh it.
                  </p>
                  <Button 
                    variant="outline"
                    className="border-blue-500 text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900"
                    onClick={async () => {
                      toast({
                        title: "Refreshing...",
                        description: "Updating your subscription status...",
                      });
                      await refreshAccountData();
                      toast({
                        title: "Updated",
                        description: "Your subscription status has been refreshed.",
                      });
                    }}
                    disabled={isLoading}
                  >
                    {isLoading ? "Refreshing..." : "Refresh Status"}
                  </Button>
                </Card>
                
                {/* Special button for users who recreated their account and have subscription issues */}
                <Card className="p-6 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
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
              </div>
            </div>
          </details>
        </div>
        
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