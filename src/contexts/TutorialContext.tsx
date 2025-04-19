import React, { createContext, useContext, useState, useEffect } from 'react';
import { useProfile } from '@/hooks/useProfile';

type TutorialType = 
  | 'buyNow' 
  | 'makeOffer' 
  | 'acceptOffer' 
  | 'checkoutProcess';

interface TutorialContextType {
  // Check if a specific tutorial should be shown
  shouldShowTutorial: (type: TutorialType) => boolean;
  
  // Mark a tutorial as completed and optionally save preference
  completeTutorial: (type: TutorialType, dontShowAgain?: boolean) => void;
  
  // Reset all tutorial preferences (for testing)
  resetTutorials: () => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, updateProfile } = useProfile();
  const [completedTutorials, setCompletedTutorials] = useState<Record<string, boolean>>({});

  // Load tutorial preferences from user profile
  useEffect(() => {
    if (profile?.tutorialPreferences) {
      setCompletedTutorials(profile.tutorialPreferences);
    }
  }, [profile]);

  const shouldShowTutorial = (type: TutorialType): boolean => {
    return !completedTutorials[type];
  };

  const completeTutorial = async (type: TutorialType, dontShowAgain = false) => {
    if (dontShowAgain) {
      const updatedPreferences = {
        ...completedTutorials,
        [type]: true
      };
      
      setCompletedTutorials(updatedPreferences);
      
      // Save to user profile if they're logged in
      if (profile?.uid) {
        try {
          await updateProfile({
            tutorialPreferences: updatedPreferences
          });
          console.log(`Tutorial preference saved: ${type}`);
        } catch (error) {
          console.error('Failed to save tutorial preference:', error);
        }
      }
    }
  };

  const resetTutorials = async () => {
    setCompletedTutorials({});
    if (profile?.uid) {
      try {
        await updateProfile({
          tutorialPreferences: {}
        });
        console.log('Tutorial preferences reset');
      } catch (error) {
        console.error('Failed to reset tutorial preferences:', error);
      }
    }
  };

  return (
    <TutorialContext.Provider value={{ shouldShowTutorial, completeTutorial, resetTutorials }}>
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
};