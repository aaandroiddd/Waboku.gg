import { useEffect, useState } from 'react';
import { LoadingAnimation } from './LoadingAnimation';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from './Logo';

interface DashboardLoadingScreenProps {
  message?: string;
  currentStep?: number;
  totalSteps?: number;
}

export function DashboardLoadingScreen({ 
  message = "Loading your dashboard...",
  currentStep,
  totalSteps
}: DashboardLoadingScreenProps) {
  const [loadingStep, setLoadingStep] = useState(0);
  const loadingMessages = [
    message,
    "Checking authentication...",
    "Fetching your listings...",
    "Processing listing data...",
    "Checking listing expiration status...",
    "Loading profile information...",
    "Preparing dashboard view...",
    "Almost there..."
  ];

  useEffect(() => {
    // If currentStep is provided, use it instead of auto-incrementing
    if (currentStep !== undefined) {
      setLoadingStep(currentStep);
      return;
    }
    
    // Otherwise simulate loading steps with a slightly faster pace
    const interval = setInterval(() => {
      setLoadingStep(prev => {
        if (prev < loadingMessages.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 800);

    return () => clearInterval(interval);
  }, [loadingMessages, currentStep]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-4"
    >
      <div className="w-full max-w-md flex flex-col items-center">
        <Logo className="mb-8 w-40" />
        
        <LoadingAnimation 
          color="var(--theme-primary, #000)" 
          size="60"
          className="my-6"
        />
        
        <AnimatePresence mode="wait">
          <motion.p
            key={loadingStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="text-muted-foreground text-center font-medium"
          >
            {loadingMessages[loadingStep]}
          </motion.p>
        </AnimatePresence>
        
        <div className="w-full mt-8">
          <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-primary"
              initial={{ width: "5%" }}
              animate={{ 
                width: totalSteps 
                  ? `${(currentStep || 0) / totalSteps * 100}%`
                  : `${(loadingStep + 1) / loadingMessages.length * 100}%` 
              }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}