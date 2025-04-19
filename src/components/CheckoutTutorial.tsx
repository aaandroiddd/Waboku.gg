import React, { useState, useEffect } from 'react';
import TutorialPopup from './TutorialPopup';
import { useTutorial } from '@/contexts/TutorialContext';

interface CheckoutTutorialProps {
  isActive: boolean;
  onComplete: (skipTutorial?: boolean) => void;
}

export const CheckoutTutorial: React.FC<CheckoutTutorialProps> = ({ isActive, onComplete }) => {
  const { shouldShowTutorial } = useTutorial();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isActive) {
      if (shouldShowTutorial('checkoutProcess')) {
        setIsOpen(true);
      } else {
        // If the tutorial should not be shown (user opted out before), skip it
        setIsOpen(false);
        onComplete(true); // Pass true to indicate we're skipping tutorials
      }
    } else {
      setIsOpen(false);
    }
  }, [isActive, shouldShowTutorial, onComplete]);

  const handleClose = () => {
    setIsOpen(false);
    onComplete();
  };

  if (!isOpen) return null;

  return (
    <TutorialPopup
      type="checkoutProcess"
      title="Secure Checkout Process"
      content={
        <div className="space-y-2">
          <p>You're about to complete your purchase. Here's what you need to know:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Your payment information is securely processed by Stripe</li>
            <li>You can update your shipping address before completing checkout</li>
            <li>After successful payment, your order status will automatically update to "Awaiting Shipping"</li>
            <li>The seller will be notified to prepare your item for shipping</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-2">
            If you have any issues during checkout, please contact our support team.
          </p>
        </div>
      }
      isOpen={isOpen}
      onClose={handleClose}
    />
  );
};

export default CheckoutTutorial;