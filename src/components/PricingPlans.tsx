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
  
  useEffect(() => {
    const checkPremiumStatus = async () => {
      if (!user) return;
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create checkout session');
      }

      const data = await response.json();

      // Handle preview environment
      if (data.isPreview) {
        toast({
          title: "Preview Environment",
          description: "Processing test upgrade...",
        });

        setTimeout(() => {
          window.location.href = `/api/stripe/dev-success?userId=${user.uid}`;
        }, 1000);
        return;
      }

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

  const getPremiumButtonState = () => {
    if (!user) {
      return {
        text: "Sign in to upgrade",
        disabled: true,
        variant: "default" as const
      };
    }
    
    // Check if user has an active or canceled but not expired subscription
    const hasActiveSubscription = isPremium && subscriptionId;
    const isCanceled = profile?.account?.subscription?.status === 'canceled';
    const endDate = profile?.account?.subscription?.endDate;
    const now = new Date();
    const isExpired = endDate && new Date(endDate) <= now;

    if (hasActiveSubscription) {
      if (isCanceled && !isExpired) {
        return {
          text: "Subscription Ending Soon",
          disabled: true,
          variant: "outline" as const
        };
      } else if (!isCanceled) {
        return {
          text: "Current Plan",
          disabled: true,
          variant: "outline" as const
        };
      }
    }

    // For free users or users with expired subscriptions
    return {
      text: isLoading ? "Processing..." : "Upgrade to Premium",
      disabled: isLoading,
      variant: "default" as const
    };
  };

  const premiumButtonState = getPremiumButtonState();

  return (
    <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto p-4 subscription-plans">
      {/* Free Plan */}
      <Card className="p-6 space-y-4">
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
        <Button className="w-full" variant="outline" disabled>
          {!isPremium ? 'Current Plan' : 'Basic Plan'}
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