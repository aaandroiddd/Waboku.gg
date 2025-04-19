import React, { useState, useEffect } from 'react';
import TutorialPopup from './TutorialPopup';
import { useTutorial } from '@/contexts/TutorialContext';

interface BuyNowTutorialProps {
  isActive: boolean;
  onComplete: () => void;
}

export const BuyNowTutorial: React.FC<BuyNowTutorialProps> = ({ isActive, onComplete }) => {
  const { shouldShowTutorial } = useTutorial();
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isActive && shouldShowTutorial('buyNow')) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [isActive, shouldShowTutorial]);

  const steps = [
    {
      title: "Buy Now Process - Step 1",
      content: (
        <div className="space-y-2">
          <p>Welcome to the Buy Now process! Here's what will happen:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>You'll confirm your shipping address</li>
            <li>Review your purchase details</li>
            <li>Complete payment through our secure checkout</li>
          </ol>
          <p className="text-sm text-muted-foreground mt-2">
            This ensures a smooth and secure transaction for both you and the seller.
          </p>
        </div>
      )
    },
    {
      title: "Buy Now Process - Step 2",
      content: (
        <div className="space-y-2">
          <p>After your payment is processed:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>The seller will be notified of your purchase</li>
            <li>Your order status will change to "Awaiting Shipping"</li>
            <li>You'll receive updates as your order progresses</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-2">
            You can track your order status in your dashboard under "Orders".
          </p>
        </div>
      )
    }
  ];

  const handleClose = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsOpen(false);
      onComplete();
    }
  };

  if (!isOpen) return null;

  return (
    <TutorialPopup
      type="buyNow"
      title={steps[currentStep].title}
      content={steps[currentStep].content}
      isOpen={isOpen}
      onClose={handleClose}
    />
  );
};

export default BuyNowTutorial;