import { motion } from "framer-motion";
import { ReactNode, useEffect } from "react";
import { useLoading } from "@/contexts/LoadingContext";

interface PageTransitionProps {
  children: ReactNode;
}

const pageVariants = {
  initial: {
    opacity: 0,
    // Remove the y-axis movement to prevent layout shift
    y: 0,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3, // Reduced from 0.4 to 0.3 for faster transitions
      ease: [0.23, 1, 0.32, 1],
    },
  },
  exit: {
    opacity: 0,
    y: 0, // Keep at 0 to prevent layout shift during exit
    transition: {
      duration: 0.2,
      ease: [0.23, 1, 0.32, 1],
    },
  },
};

export function PageTransition({ children }: PageTransitionProps) {
  const { stopLoading } = useLoading();

  // When the component mounts, stop loading immediately
  useEffect(() => {
    // Immediately stop loading to prevent layout shifts
    stopLoading();
    
    return () => {};
  }, [stopLoading]);

  // Check if we're running on a mobile device to reduce animation complexity
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <motion.div
      initial={isMobile ? { opacity: 0 } : "initial"}
      animate={isMobile ? { opacity: 1 } : "animate"}
      exit={isMobile ? { opacity: 0 } : "exit"}
      variants={!isMobile ? pageVariants : undefined}
      transition={isMobile ? { duration: 0.3 } : undefined}
      onAnimationComplete={() => stopLoading()}
      // Add layout="position" to help maintain layout during animations
      layout="position"
    >
      {children}
    </motion.div>
  );
}