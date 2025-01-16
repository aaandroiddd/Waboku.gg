import { AccountFeatures } from '@/components/AccountFeatures';
import { PricingPlans } from '@/components/PricingPlans';
import { useAccount } from '@/contexts/AccountContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/router';
import { Footer } from '@/components/Footer';
import { useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';

export default function AccountStatus() {
  const { accountTier } = useAccount();
  const router = useRouter();
  const { toast } = useToast();
  const { session_id } = router.query;

  useEffect(() => {
    if (session_id) {
      toast({
        title: "Success!",
        description: "Your subscription has been processed. Your account will be upgraded shortly.",
      });
      // Remove the session_id from the URL without refreshing the page
      router.replace('/dashboard/account-status', undefined, { shallow: true });
    }
  }, [session_id, toast, router]);

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
              <Badge variant={accountTier === 'premium' ? 'default' : 'secondary'} className={accountTier === 'premium' ? 'bg-gradient-to-r from-blue-500 to-purple-500' : ''}>
                {accountTier === 'premium' ? 'Premium ⭐' : 'Free'}
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">Available Features</h2>
          <AccountFeatures />
        </div>

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