import { motion } from "framer-motion";
import { ReactNode, useEffect } from "react";
import { useLoading } from "@/contexts/LoadingContext";

interface PageTransitionProps {
  children: ReactNode;
}

const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.23, 1, 0.32, 1],
    },
  },
  exit: {
    opacity: 0,
    y: 20,
    transition: {
      duration: 0.2,
      ease: [0.23, 1, 0.32, 1],
    },
  },
};

export function PageTransition({ children }: PageTransitionProps) {
  const { stopLoading } = useLoading();

  // When the animation completes, ensure loading is stopped
  useEffect(() => {
    const timer = setTimeout(() => {
      stopLoading();
    }, 400); // Match the duration of the animation
    
    return () => clearTimeout(timer);
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
    >
      {children}
    </motion.div>
  );
}