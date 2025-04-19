import React, { useState, useEffect } from 'react';
import TutorialPopup from './TutorialPopup';
import { useTutorial } from '@/contexts/TutorialContext';

interface MakeOfferTutorialProps {
  isActive: boolean;
  onComplete: () => void;
}

export const MakeOfferTutorial: React.FC<MakeOfferTutorialProps> = ({ isActive, onComplete }) => {
  const { shouldShowTutorial } = useTutorial();
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isActive && shouldShowTutorial('makeOffer')) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [isActive, shouldShowTutorial]);

  const steps = [
    {
      title: "Make an Offer - Step 1",
      content: (
        <div className="space-y-2">
          <p>Welcome to the offer process! Here's how it works:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>You'll propose a price to the seller</li>
            <li>The seller will review your offer</li>
            <li>They can accept, decline, or counter your offer</li>
          </ol>
          <p className="text-sm text-muted-foreground mt-2">
            Making an offer doesn't guarantee a purchase - it starts a negotiation with the seller.
          </p>
        </div>
      )
    },
    {
      title: "Make an Offer - Step 2",
      content: (
        <div className="space-y-2">
          <p>After submitting your offer:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>The seller will be notified immediately</li>
            <li>You can track the status in your dashboard under "Offers"</li>
            <li>You'll receive a notification when the seller responds</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-2">
            If your offer is accepted, you'll proceed to checkout to complete the purchase.
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
      type="makeOffer"
      title={steps[currentStep].title}
      content={steps[currentStep].content}
      isOpen={isOpen}
      onClose={handleClose}
    />
  );
};

export default MakeOfferTutorial;