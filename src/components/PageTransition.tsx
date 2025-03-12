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

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
      onAnimationComplete={() => stopLoading()}
    >
      {children}
    </motion.div>
  );
}