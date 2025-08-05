import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ACCOUNT_TIERS } from "@/types/account";
import { useState, useEffect } from "react";

export function PricingPlans() {
  const { user, profile } = useAuth();
  
  // Check if user has premium subscription
  const [isPremium, setIsPremium] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  
  useEffect(() => {
    const checkPremiumStatus = async () => {
      if (!user) {
        setIsCheckingStatus(false);
        return;
      }
      
      setIsCheckingStatus(true);
      try {
        // First check if the profile data already indicates premium status
        if (profile?.accountTier === 'premium' || 
            profile?.account?.subscription?.currentPlan === 'premium' ||
            profile?.account?.subscription?.status === 'active') {
          console.log('Premium status detected from profile data:', {
            accountTier: profile.accountTier,
            subscriptionPlan: profile.account?.subscription?.currentPlan,
            subscriptionStatus: profile.account?.subscription?.status
          });
          setIsPremium(true);
          setIsCheckingStatus(false);
          return;
        }
        
        // If not, check with the API
        const response = await fetch('/api/stripe/check-subscription', {
          headers: {
            'Authorization': `Bearer ${await user.getIdToken()}`
          }
        });
        const data = await response.json();
        console.log('Premium status from API:', data);
        setIsPremium(data.isPremium);
      } catch (error) {
        console.error('Error checking premium status:', error);
        setIsPremium(false);
      } finally {
        setIsCheckingStatus(false);
      }
    };
    
    checkPremiumStatus();
  }, [user, profile]);

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
            <span>Up to 5 active listings</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>Basic messaging system</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>Standard search visibility</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>24-hour offer expiration</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>Basic profile features</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>Standard customer support</span>
          </div>
        </div>
      </Card>

      {/* Premium Plan */}
      <Card className={`p-6 space-y-4 ${isPremium ? 'border-2 border-green-500' : ''}`}>
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
            <span>Advanced messaging features</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>Enhanced search visibility & priority placement</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>Flexible offer expiration (24h/48h/3d/7d)</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>Bulk listing creation tools</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>Advanced analytics & insights</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>Priority customer support</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>Premium seller badge</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>Extended listing duration options</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>Markdown formatting in listings</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>Email notifications for offers & messages</span>
          </div>
        </div>
      </Card>
    </div>
  );
}