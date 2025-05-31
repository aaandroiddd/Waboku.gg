import React from 'react';
import { motion, MotionProps } from 'framer-motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';

// Optimized motion component that disables animations on mobile devices
export function OptimizedMotion({
  children,
  className,
  style,
  ...props
}: React.PropsWithChildren<MotionProps & { className?: string }>) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  
  // On mobile, render a simple div without any animations
  if (isMobile) {
    return (
      <div
        className={className}
        style={style}
        onClick={props.onClick}
      >
        {children}
      </div>
    );
  }
  
  // On desktop, render with full motion capabilities
  return (
    <motion.div
      {...props}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// Optimized motion button that disables animations on mobile
export function OptimizedMotionButton({
  children,
  className,
  style,
  ...props
}: React.PropsWithChildren<MotionProps & { className?: string }>) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  
  // On mobile, render a simple button without any animations
  if (isMobile) {
    return (
      <button
        className={className}
        style={style}
        onClick={props.onClick}
      >
        {children}
      </button>
    );
  }
  
  // On desktop, render with full motion capabilities
  return (
    <motion.button
      {...props}
      className={className}
      style={style}
    >
      {children}
    </motion.button>
  );
}