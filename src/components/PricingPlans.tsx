import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ACCOUNT_TIERS } from "@/types/account";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { loadStripe } from '@stripe/stripe-js';

// Make sure to load Stripe outside of components
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export function PricingPlans() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Function to check if Stripe is blocked
  const isStripeBlocked = async () => {
    try {
      const response = await fetch('https://js.stripe.com/v3/', { mode: 'no-cors' });
      return false;
    } catch (error) {
      return true;
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
    
    // Show initial loading state to user
    toast({
      title: "Preparing checkout...",
      description: "Please wait while we set up your subscription.",
    });

    try {
      // Check if Stripe is blocked
      if (await isStripeBlocked()) {
        toast({
          title: "Payment System Blocked",
          description: "Please disable your ad blocker or privacy extensions to proceed with the payment. Our payment system uses Stripe, a secure payment processor.",
          variant: "destructive",
        });
        return;
      }

      // Initialize Stripe
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Unable to connect to payment provider');
      }

      // Get user token
      const idToken = await user.getIdToken();
      if (!idToken) {
        throw new Error('Authentication error');
      }

      // Create checkout session
      console.log('Creating checkout session...');
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create checkout session');
      }

      if (!data.sessionUrl) {
        throw new Error('Invalid checkout session');
      }

      // Show success message and redirect
      toast({
        title: "Redirecting to checkout",
        description: "You'll be redirected to complete your payment securely.",
      });

      // Direct redirect without timeout
      window.location.assign(data.sessionUrl);

    } catch (error: any) {
      console.error('Subscription error:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to start subscription process. Please try again.';
      if (error.message.includes('payment provider')) {
        errorMessage = 'Unable to connect to payment service. Please check your internet connection and try again.';
      } else if (error.message.includes('Authentication')) {
        errorMessage = 'Please sign in again and retry.';
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto p-4">
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
          Current Plan
        </Button>
      </Card>

      {/* Premium Plan */}
      <Card className="p-6 space-y-4 border-2 border-primary">
        <div className="space-y-2">
          <h3 className="text-2xl font-bold">Premium ⭐</h3>
          <p className="text-gray-500 dark:text-gray-400">
            Advanced features for serious collectors
          </p>
        </div>
        <div className="space-y-1">
          <div className="text-3xl font-bold">$9.99</div>
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
          disabled={isLoading}
        >
          {isLoading ? "Preparing Checkout..." : "Upgrade to Premium"}
        </Button>
      </Card>
    </div>
  );
}