import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Loader2, X, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/price';

interface OrderDetails {
  orderId: string;
  listingTitle: string;
  sellerName: string;
  amount: number;
  pickupToken?: string;
}

export default function PickupConfirmPage() {
  const router = useRouter();
  const { orderId } = router.query;
  const { user } = useAuth();
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get order details from router state or localStorage
    const storedDetails = localStorage.getItem(`pickup_confirmation_${orderId}`);
    if (storedDetails) {
      try {
        const details = JSON.parse(storedDetails);
        setOrderDetails(details);
      } catch (error) {
        console.error('Error parsing stored order details:', error);
        toast.error('Invalid order details. Please try scanning the code again.');
        router.back();
      }
    } else {
      toast.error('No order details found. Please scan the pickup code again.');
      router.back();
    }
    setIsLoading(false);
  }, [orderId, router]);

  const handleConfirmPickup = async () => {
    if (!user || !orderDetails) return;

    const tokenToUse = orderDetails.pickupToken;
    if (!tokenToUse) {
      toast.error('Missing pickup token. Please scan the code again.');
      return;
    }

    try {
      setIsConfirming(true);
      console.log('Confirming pickup for order:', orderDetails.orderId);

      const response = await fetch('/api/orders/complete-pickup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: orderDetails.orderId,
          userId: user.uid,
          role: 'buyer',
          pickupToken: tokenToUse,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to confirm pickup');
      }

      toast.success(data.message);
      
      // Clean up stored details
      localStorage.removeItem(`pickup_confirmation_${orderId}`);
      
      // Redirect to orders page
      router.push('/dashboard/orders');

    } catch (error) {
      console.error('Error confirming pickup:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to confirm pickup');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = () => {
    // Clean up stored details
    localStorage.removeItem(`pickup_confirmation_${orderId}`);
    router.back();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading pickup details...</span>
        </div>
      </div>
    );
  }

  if (!orderDetails) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No pickup details found.</p>
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between p-4 border-b border-border bg-background">
        <div className="flex items-center gap-3">
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-muted rounded-md transition-colors"
            type="button"
            aria-label="Go back"
            disabled={isConfirming}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">Confirm Pickup</h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Ready to Confirm Pickup</h2>
            <p className="text-muted-foreground">
              Please verify the order details below and confirm that you have received the item from the seller.
            </p>
          </div>
          
          <Card>
            <CardContent className="p-6">
              <h3 className="font-medium mb-4 text-base">Order Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground text-sm">Item:</span>
                  <span className="font-medium text-right flex-1 ml-2 text-sm">{orderDetails.listingTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Seller:</span>
                  <span className="font-medium text-sm">{orderDetails.sellerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Amount:</span>
                  <span className="font-medium text-sm">{formatPrice(orderDetails.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Order ID:</span>
                  <span className="font-mono text-xs">{orderDetails.orderId.slice(0, 8)}...</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium mb-2 text-base">What happens next?</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>The order will be marked as completed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>You'll be able to leave a review for this transaction</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>The seller will receive confirmation of the completed pickup</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">!</span>
              </div>
              <div>
                <h3 className="font-medium mb-1 text-amber-900 dark:text-amber-100">Important</h3>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Only confirm pickup after you have physically received the item and verified its condition matches the listing description.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="shrink-0 p-4 border-t border-border bg-background">
        <div className="max-w-md mx-auto space-y-3">
          <Button
            onClick={handleConfirmPickup}
            disabled={isConfirming}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            {isConfirming && <Loader2 className="h-4 w-4 animate-spin" />}
            {isConfirming ? 'Confirming Pickup...' : 'Confirm Pickup'}
          </Button>
          <Button
            onClick={handleCancel}
            disabled={isConfirming}
            variant="outline"
            className="w-full font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Cancel
          </Button>
        </div>
      </footer>
    </div>
  );
}