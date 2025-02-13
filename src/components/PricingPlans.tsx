import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ACCOUNT_TIERS } from "@/types/account";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { loadStripe } from '@stripe/stripe-js';

// Make sure to load Stripe outside of components
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export function PricingPlans() {
  const { user, profile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  // Check if user has premium subscription
  const [isPremium, setIsPremium] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  
  useEffect(() => {
    const checkPremiumStatus = async () => {
      if (!user) {
        setIsCheckingStatus(false);
        return;
      }
      
      setIsCheckingStatus(true);
      try {
        const response = await fetch('/api/stripe/check-subscription', {
          headers: {
            'Authorization': `Bearer ${await user.getIdToken()}`
          }
        });
        const data = await response.json();
        setIsPremium(data.isPremium);
        setSubscriptionId(data.subscriptionId);
      } catch (error) {
        console.error('Error checking premium status:', error);
        setIsPremium(false);
        setSubscriptionId(null);
      } finally {
        setIsCheckingStatus(false);
      }
    };
    
    checkPremiumStatus();
  }, [user]);

  const handleCancelSubscription = async () => {
    if (!user || !subscriptionId) {
      toast({
        title: "Error",
        description: "Unable to cancel subscription. Please try again later.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ subscriptionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      toast({
        title: "Subscription Cancelled",
        description: "Your subscription will end at the end of the current billing period.",
      });

      // Refresh subscription status
      const checkResponse = await fetch('/api/stripe/check-subscription', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      const data = await checkResponse.json();
      setIsPremium(data.isPremium);
      setSubscriptionId(data.subscriptionId);
    } catch (error) {
      console.error('Error canceling subscription:', error);
      toast({
        title: "Error",
        description: "Failed to cancel subscription. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to subscribe to premium.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Get user token
      const idToken = await user.getIdToken();
      if (!idToken) {
        throw new Error('Authentication error');
      }

      toast({
        title: "Setting up checkout...",
        description: "Please wait while we prepare your upgrade.",
      });

      // Create checkout session
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Checkout error details:', data);
        throw new Error(data.message || data.error || 'Failed to create checkout session');
      }

      // Proceed with Stripe checkout regardless of environment

      if (!data.sessionUrl) {
        throw new Error('Invalid checkout session');
      }

      toast({
        title: "Redirecting to secure checkout",
        description: "You'll be redirected to Stripe to complete your payment.",
      });

      // Add a small delay to ensure toast is shown
      setTimeout(() => {
        window.location.href = data.sessionUrl;
      }, 1000);

    } catch (error: any) {
      console.error('Subscription error:', error);
      
      let errorMessage = 'Failed to start subscription process. Please try again.';
      if (error.message.includes('payment provider')) {
        errorMessage = 'Unable to connect to payment service. Please check your internet connection.';
      } else if (error.message.includes('Authentication')) {
        errorMessage = 'Your session has expired. Please sign in again.';
      }

      toast({
        title: "Subscription Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      setIsLoading(false);
    }
  };

  const getBasicButtonState = () => {
    if (!user) {
      return {
        text: "Sign in to continue",
        disabled: true,
        variant: "outline" as const,
        onClick: undefined
      };
    }

    if (isCheckingStatus) {
      return {
        text: "Loading...",
        disabled: true,
        variant: "outline" as const,
        onClick: undefined
      };
    }

    if (isLoading) {
      return {
        text: "Processing...",
        disabled: true,
        variant: "outline" as const,
        onClick: undefined
      };
    }

    if (!isPremium) {
      return {
        text: "Current Plan",
        disabled: true,
        variant: "outline" as const,
        onClick: undefined
      };
    }

    // For premium users - show downgrade option
    return {
      text: "Downgrade to Basic",
      disabled: false,
      variant: "secondary" as const,
      onClick: handleCancelSubscription
    };
  };

  const getPremiumButtonState = () => {
    if (!user) {
      return {
        text: "Sign in to upgrade",
        disabled: true,
        variant: "default" as const
      };
    }
    
    if (isCheckingStatus) {
      return {
        text: "Loading...",
        disabled: true,
        variant: "outline" as const
      };
    }

    if (isLoading) {
      return {
        text: "Processing...",
        disabled: true,
        variant: "outline" as const
      };
    }
    
    const hasActiveSubscription = isPremium && subscriptionId;
    const isCanceled = profile?.account?.subscription?.status === 'canceled';
    const endDate = profile?.account?.subscription?.endDate;
    const now = new Date();
    const isExpired = endDate ? new Date(endDate) <= now : false;

    if (hasActiveSubscription && !isCanceled) {
      return {
        text: "Current Plan",
        disabled: true,
        variant: "outline" as const
      };
    }

    if (isCanceled && !isExpired) {
      return {
        text: "Subscription Ending Soon",
        disabled: true,
        variant: "outline" as const
      };
    }

    return {
      text: "Upgrade to Premium",
      disabled: false,
      variant: "default" as const
    };
  };

  const basicButtonState = getBasicButtonState();
  const premiumButtonState = getPremiumButtonState();

  return (
    <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto p-4 subscription-plans">
      {/* Free Plan */}
      <Card className={`p-6 space-y-4 ${!isPremium ? 'border-2 border-green-500' : ''}`}>
        <div className="space-y-2">
          <h3 className="text-2xl font-bold">Free</h3>
          <p className="text-gray-500 dark:text-gray-400">
            Basic features for casual traders
          </p>
        </div>
        <div className="text-3xl font-bold">$0</div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>{ACCOUNT_TIERS.free.maxActiveListings} active listings</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>{ACCOUNT_TIERS.free.listingDuration}h listing duration</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>Basic search</span>
          </div>
        </div>
        <Button 
          className="w-full" 
          variant={basicButtonState.variant}
          disabled={basicButtonState.disabled}
          onClick={basicButtonState.onClick}
        >
          {basicButtonState.text}
        </Button>
      </Card>

      {/* Premium Plan */}
      <Card className={`p-6 space-y-4 ${isPremium ? 'border-2 border-green-500' : 'border-2 border-primary'}`}>
        <div className="space-y-2">
          <h3 className="text-2xl font-bold">Premium ⭐</h3>
          <p className="text-gray-500 dark:text-gray-400">
            Advanced features for serious collectors
          </p>
        </div>
        <div className="space-y-1">
          <div className="text-3xl font-bold">$4.99</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">per month</div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>Unlimited active listings</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>30-day listing duration</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>Advanced search features</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>Priority messaging</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>Bulk listing tools</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>Price history access</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>Ad-free experience</span>
          </div>
        </div>
        <Button 
          className="w-full" 
          onClick={handleSubscribe}
          disabled={premiumButtonState.disabled}
          variant={premiumButtonState.variant}
        >
          {premiumButtonState.text}
        </Button>
      </Card>
    </div>
  );
}