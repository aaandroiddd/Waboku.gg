import React, { useState, useEffect } from 'react';
import TutorialPopup from './TutorialPopup';
import { useTutorial } from '@/contexts/TutorialContext';

interface AcceptedOfferTutorialProps {
  isActive: boolean;
  onComplete: () => void;
}

export const AcceptedOfferTutorial: React.FC<AcceptedOfferTutorialProps> = ({ isActive, onComplete }) => {
  const { shouldShowTutorial } = useTutorial();
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isActive && shouldShowTutorial('acceptOffer')) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [isActive, shouldShowTutorial]);

  const steps = [
    {
      title: "Offer Accepted - Next Steps",
      content: (
        <div className="space-y-2">
          <p>Great news! Your offer has been accepted. Here's what happens next:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>You'll need to complete the purchase by checking out</li>
            <li>You can update your shipping address if needed</li>
            <li>Complete payment through our secure checkout</li>
          </ol>
          <p className="text-sm text-muted-foreground mt-2">
            Once payment is complete, your order status will automatically update to "Awaiting Shipping".
          </p>
        </div>
      )
    },
    {
      title: "After Checkout",
      content: (
        <div className="space-y-2">
          <p>After your payment is processed:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>The seller will be notified to ship your item</li>
            <li>You can track your order in your dashboard</li>
            <li>You'll receive updates as your order progresses</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-2">
            Remember to leave a review after you receive your item to help other buyers!
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
      type="acceptOffer"
      title={steps[currentStep].title}
      content={steps[currentStep].content}
      isOpen={isOpen}
      onClose={handleClose}
    />
  );
};

export default AcceptedOfferTutorial;