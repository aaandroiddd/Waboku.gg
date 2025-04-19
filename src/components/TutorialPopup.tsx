import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useTutorial } from '@/contexts/TutorialContext';

interface TutorialPopupProps {
  type: 'buyNow' | 'makeOffer' | 'acceptOffer' | 'checkoutProcess';
  title: string;
  content: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
}

export const TutorialPopup: React.FC<TutorialPopupProps> = ({
  type,
  title,
  content,
  isOpen,
  onClose,
}) => {
  const { completeTutorial } = useTutorial();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleClose = () => {
    completeTutorial(type, dontShowAgain);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {content}
        </div>
        <DialogFooter className="flex flex-col sm:flex-row gap-2 items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="dontShowAgain" 
              checked={dontShowAgain} 
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            />
            <label
              htmlFor="dontShowAgain"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Don't show this again
            </label>
          </div>
          <Button onClick={handleClose}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TutorialPopup;