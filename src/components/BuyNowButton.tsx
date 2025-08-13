import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthRedirect } from '@/contexts/AuthRedirectContext';
import { useRouter } from 'next/router';
import { toast } from 'sonner';
import BuyNowTutorial from './BuyNowTutorial';
import CheckoutTutorial from './CheckoutTutorial';
import { useStripeVerifiedUser } from '@/hooks/useStripeVerifiedUser';

interface BuyNowButtonProps {
  listingId: string;
  sellerId: string;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  children?: React.ReactNode;
}

// Lazy load Stripe only when needed
let stripePromise: Promise<any> | null = null;

const getStripe = () => {
  if (!stripePromise) {
    stripePromise = import('@stripe/stripe-js').then(({ loadStripe }) =>
      loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')
    );
  }
  return stripePromise;
};

export function BuyNowButton({
  listingId,
  sellerId,
  disabled = false,
  className = '',
  variant = 'default',
  size = 'default',
  children
}: BuyNowButtonProps) {
  const { user } = useAuth();
  const { saveRedirectState } = useAuthRedirect();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showBuyNowTutorial, setShowBuyNowTutorial] = useState(false);
  const [showCheckoutTutorial, setShowCheckoutTutorial] = useState(false);
  const [tutorialCompleted, setTutorialCompleted] = useState(false);

  const { isVerified: sellerVerified, reason: sellerReason, loading: sellerLoading } = useStripeVerifiedUser(sellerId);
  const isButtonDisabled = disabled || isLoading || sellerLoading || !sellerVerified;

  const handleBuyNow = async () => {
    if (!user) {
      toast.error('Please sign in to purchase this item');
      // Save the current action before redirecting
      saveRedirectState('buy_now', { listingId });
      router.push('/auth/sign-in');
      return;
    }

    if (user.uid === sellerId) {
      toast.error('You cannot purchase your own listing');
      return;
    }

    // Verify seller can receive payments before proceeding
    if (sellerLoading) {
      toast.message('Checking seller payment status...');
      return;
    }
    if (!sellerVerified) {
      toast.error(`This seller can't accept payments yet: ${sellerReason}`);
      return;
    }

    // Show the buy now tutorial first
    setShowBuyNowTutorial(true);
  };

  const proceedToCheckout = async () => {
    setIsLoading(true);
    try {
      // Show checkout tutorial
      setShowCheckoutTutorial(true);
    } catch (error: any) {
      console.error('Error in buy now process:', error);
      toast.error(error.message || 'Failed to process purchase. Please try again.');
      setIsLoading(false);
    }
  };

  const proceedToStripeCheckout = async () => {
    setIsLoading(true);
    try {
      const token = await user?.getIdToken();
      const response = await fetch('/api/stripe/connect/create-buy-now-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          listingId,
          userId: user?.uid,
          email: user?.email
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Lazy load and redirect to Stripe Checkout
      const stripe = await getStripe();
      if (stripe) {
        const { error } = await stripe.redirectToCheckout({
          sessionId: data.sessionId,
        });

        if (error) {
          throw new Error(error.message || 'Failed to redirect to checkout');
        }
      }
    } catch (error: any) {
      console.error('Error in buy now process:', error);
      toast.error(error.message || 'Failed to process purchase. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuyNowTutorialComplete = (skipTutorial = false) => {
    setShowBuyNowTutorial(false);
    setTutorialCompleted(true);
    
    // If the user chose to skip tutorials, go directly to Stripe checkout
    if (skipTutorial) {
      proceedToStripeCheckout();
    } else {
      proceedToCheckout();
    }
  };

  const handleCheckoutTutorialComplete = (skipTutorial = false) => {
    setShowCheckoutTutorial(false);
    proceedToStripeCheckout();
  };

  return (
    <>
      <BuyNowTutorial 
        isActive={showBuyNowTutorial} 
        onComplete={handleBuyNowTutorialComplete} 
      />
      <CheckoutTutorial 
        isActive={showCheckoutTutorial} 
        onComplete={handleCheckoutTutorialComplete} 
      />
      <Button
        onClick={handleBuyNow}
        disabled={isButtonDisabled}
        title={sellerLoading ? 'Checking seller payment status...' : (!sellerVerified ? `Seller cannot receive payments: ${sellerReason}` : undefined)}
        className={className}
        variant={variant}
        size={size}
      >
        {isLoading ? 'Processing...' : children || 'Buy Now'}
      </Button>
    </>
  );
}