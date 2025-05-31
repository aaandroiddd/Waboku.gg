import { motion } from "framer-motion";
import { ReactNode, useEffect } from "react";
import { useLoading } from "@/contexts/LoadingContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface PageTransitionProps {
  children: ReactNode;
}

const pageVariants = {
  initial: {
    opacity: 0,
    y: 0,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.23, 1, 0.32, 1],
    },
  },
  exit: {
    opacity: 0,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.23, 1, 0.32, 1],
    },
  },
};

export function PageTransition({ children }: PageTransitionProps) {
  const { stopLoading } = useLoading();
  const isMobile = useMediaQuery("(max-width: 768px)");

  // When the component mounts, stop loading immediately
  useEffect(() => {
    stopLoading();
    return () => {};
  }, [stopLoading]);

  // On mobile, render without any animations
  if (isMobile) {
    return <div>{children}</div>;
  }

  // On desktop, render with full page transition animations
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
      onAnimationComplete={() => stopLoading()}
      layout="position"
    >
      {children}
    </motion.div>
  );
}