import { PricingPlans } from '@/components/PricingPlans';
import { useAccount } from '@/contexts/AccountContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/router';
import { Footer } from '@/components/Footer';
import { useEffect } from 'react';
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
      console.log('Current subscription state:', subscription); // Debug log
      console.log('Account tier:', accountTier); // Additional debug log
      
      if (!subscription.stripeSubscriptionId) {
        console.error('Missing subscription ID:', subscription); // Additional debug log
        toast({
          title: "Error",
          description: "No active subscription ID found. Please contact support.",
          variant: "destructive",
        });
        return;
      }
      await cancelSubscription();
      toast({
        title: "Subscription Canceled",
        description: "Your subscription will remain active until the end of the current billing period.",
      });
    } catch (error: any) {
      console.error('Cancellation error:', error); // Debug log
      console.error('Full error details:', { 
        message: error.message,
        stack: error.stack,
        subscription: subscription 
      }); // Additional debug info
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription. Please try again.",
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
              <Badge variant={accountTier === 'premium' ? 'default' : 'secondary'} className={accountTier === 'premium' ? 'bg-gradient-to-r from-blue-500 to-purple-500' : ''}>
                {accountTier === 'premium' ? 'Premium ⭐' : 'Free'}
              </Badge>
            </div>
          </div>
        </div>

        {accountTier === 'premium' && (
          <Card className="p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Subscription Details</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                  {subscription.status === 'active' ? 'Active' : 'Canceled'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Started:</span>
                <span>{formatDate(subscription.startDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Next Renewal:</span>
                <span>{formatDate(subscription.renewalDate)}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Your subscription renews automatically every 30 days.
              </p>
              
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
        )}
        
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