import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { toast } from 'sonner';
import { loadStripe } from '@stripe/stripe-js';
import AcceptedOfferTutorial from './AcceptedOfferTutorial';
import CheckoutTutorial from './CheckoutTutorial';

interface AcceptedOfferCheckoutProps {
  orderId: string;
  sellerId: string;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  children?: React.ReactNode;
}

// Initialize Stripe outside of the component
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

export function AcceptedOfferCheckout({
  orderId,
  sellerId,
  disabled = false,
  className = '',
  variant = 'default',
  children
}: AcceptedOfferCheckoutProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showOfferTutorial, setShowOfferTutorial] = useState(false);
  const [showCheckoutTutorial, setShowCheckoutTutorial] = useState(false);
  const [tutorialCompleted, setTutorialCompleted] = useState(false);

  const handleCheckout = async () => {
    if (!user) {
      toast.error('Please sign in to complete this purchase');
      router.push('/auth/sign-in');
      return;
    }

    if (user.uid === sellerId) {
      toast.error('You cannot purchase your own listing');
      return;
    }

    // Show the accepted offer tutorial first
    setShowOfferTutorial(true);
  };

  const proceedToCheckout = async () => {
    setIsLoading(true);
    try {
      // Show checkout tutorial
      setShowCheckoutTutorial(true);
    } catch (error: any) {
      console.error('Error in checkout process:', error);
      toast.error(error.message || 'Failed to process purchase. Please try again.');
      setIsLoading(false);
    }
  };

  const proceedToStripeCheckout = async () => {
    setIsLoading(true);
    try {
      const token = await user?.getIdToken();
      const response = await fetch('/api/stripe/connect/create-pending-order-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          orderId,
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
      console.error('Error in checkout process:', error);
      toast.error(error.message || 'Failed to process purchase. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOfferTutorialComplete = () => {
    setShowOfferTutorial(false);
    setTutorialCompleted(true);
    proceedToCheckout();
  };

  const handleCheckoutTutorialComplete = () => {
    setShowCheckoutTutorial(false);
    proceedToStripeCheckout();
  };

  return (
    <>
      <AcceptedOfferTutorial 
        isActive={showOfferTutorial} 
        onComplete={handleOfferTutorialComplete} 
      />
      <CheckoutTutorial 
        isActive={showCheckoutTutorial} 
        onComplete={handleCheckoutTutorialComplete} 
      />
      <Button
        onClick={handleCheckout}
        disabled={disabled || isLoading}
        className={className}
        variant={variant}
      >
        {isLoading ? 'Processing...' : children || 'Complete Purchase'}
      </Button>
    </>
  );
}