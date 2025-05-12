import React from 'react';
import { motion, MotionProps } from 'framer-motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';

// Optimized motion component that applies performance enhancements for mobile devices
export function OptimizedMotion({
  children,
  className,
  style,
  ...props
}: React.PropsWithChildren<MotionProps & { className?: string }>) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const isOlderDevice = useMediaQuery("(max-width: 480px)");
  
  // Apply performance optimizations for mobile devices
  const optimizedStyle = {
    willChange: isMobile ? "transform, opacity" : "auto",
    backfaceVisibility: isMobile ? "hidden" : "visible",
    WebkitBackfaceVisibility: isMobile ? "hidden" : "visible",
    transform: isMobile ? "translateZ(0)" : "none",
    // For older devices, simplify animations even further
    ...(isOlderDevice && {
      transition: {
        duration: 0.15,
        ease: "linear"
      }
    }),
    ...style
  };
  
  // Add framer-motion-div class for global CSS optimizations
  const optimizedClassName = `${className || ''} ${isMobile ? 'framer-motion-div' : ''}`.trim();
  
  return (
    <motion.div
      {...props}
      className={optimizedClassName}
      style={optimizedStyle}
    >
      {children}
    </motion.div>
  );
}

// Optimized motion button for better touch interactions on mobile
export function OptimizedMotionButton({
  children,
  className,
  style,
  ...props
}: React.PropsWithChildren<MotionProps & { className?: string }>) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  
  // Apply performance optimizations for mobile devices
  const optimizedStyle = {
    willChange: isMobile ? "transform" : "auto",
    backfaceVisibility: isMobile ? "hidden" : "visible",
    WebkitBackfaceVisibility: isMobile ? "hidden" : "visible",
    transform: isMobile ? "translateZ(0)" : "none",
    // Increase touch target size on mobile
    padding: isMobile ? "0.5rem" : undefined,
    ...style
  };
  
  // Add framer-motion-div class for global CSS optimizations
  const optimizedClassName = `${className || ''} ${isMobile ? 'framer-motion-div' : ''}`.trim();
  
  return (
    <motion.button
      {...props}
      className={optimizedClassName}
      style={optimizedStyle}
    >
      {children}
    </motion.button>
  );
}