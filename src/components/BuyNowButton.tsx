import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { toast } from 'sonner';
import { loadStripe } from '@stripe/stripe-js';
import BuyNowTutorial from './BuyNowTutorial';
import CheckoutTutorial from './CheckoutTutorial';

interface BuyNowButtonProps {
  listingId: string;
  sellerId: string;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

// Initialize Stripe outside of the component
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

export function BuyNowButton({
  listingId,
  sellerId,
  disabled = false,
  className = '',
  variant = 'default'
}: BuyNowButtonProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showBuyNowTutorial, setShowBuyNowTutorial] = useState(false);
  const [showCheckoutTutorial, setShowCheckoutTutorial] = useState(false);
  const [tutorialCompleted, setTutorialCompleted] = useState(false);

  const handleBuyNow = async () => {
    if (!user) {
      toast.error('Please sign in to purchase this item');
      router.push('/auth/sign-in');
      return;
    }

    if (user.uid === sellerId) {
      toast.error('You cannot purchase your own listing');
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

      // Redirect to Stripe Checkout
      const stripe = await stripePromise;
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
        disabled={disabled || isLoading}
        className={className}
        variant={variant}
      >
        {isLoading ? 'Processing...' : 'Buy Now'}
      </Button>
    </>
  );
}