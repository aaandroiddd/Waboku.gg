import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ACCOUNT_TIERS } from "@/types/account";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

export function PricingPlans() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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
      const idToken = await user.getIdToken();
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create checkout session');
      }

      if (!data.sessionUrl) {
        throw new Error('No checkout URL received');
      }

      // Open Stripe Checkout in the same window (not in an iframe)
      window.open(data.sessionUrl, '_self');
    } catch (error) {
      console.error('Subscription error:', error);
      toast({
        title: "Error",
        description: "Failed to start subscription process. Please try again.",
        variant: "destructive",
      });
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
          {isLoading ? "Loading..." : "Upgrade to Premium"}
        </Button>
      </Card>
    </div>
  );
}