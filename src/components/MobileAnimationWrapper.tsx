import React from 'react';
import { motion, MotionProps } from 'framer-motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface MobileAnimationWrapperProps extends MotionProps {
  children: React.ReactNode;
  className?: string;
  fallbackElement?: keyof JSX.IntrinsicElements;
  preserveLayout?: boolean;
}

/**
 * Wrapper component that conditionally applies Framer Motion animations
 * - On mobile: renders a simple div (or specified fallback element) without animations
 * - On desktop: renders motion.div with full animations
 * - Preserves the motion background animation on all devices
 */
export function MobileAnimationWrapper({
  children,
  className,
  fallbackElement = 'div',
  preserveLayout = false,
  ...motionProps
}: MobileAnimationWrapperProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  
  // On mobile, render a simple element without animations
  if (isMobile) {
    const FallbackElement = fallbackElement as any;
    return (
      <FallbackElement 
        className={className}
        style={motionProps.style}
        onClick={motionProps.onClick}
      >
        {children}
      </FallbackElement>
    );
  }
  
  // On desktop, render with full motion capabilities
  return (
    <motion.div
      className={className}
      {...motionProps}
      layout={preserveLayout ? motionProps.layout : false}
    >
      {children}
    </motion.div>
  );
}

/**
 * Mobile-aware motion button that disables animations on mobile
 */
export function MobileMotionButton({
  children,
  className,
  ...motionProps
}: MobileAnimationWrapperProps & { onClick?: () => void }) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  
  if (isMobile) {
    return (
      <button 
        className={className}
        style={motionProps.style}
        onClick={motionProps.onClick}
      >
        {children}
      </button>
    );
  }
  
  return (
    <motion.button
      className={className}
      {...motionProps}
    >
      {children}
    </motion.button>
  );
}

/**
 * Mobile-aware motion span for text animations
 */
export function MobileMotionSpan({
  children,
  className,
  ...motionProps
}: MobileAnimationWrapperProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  
  if (isMobile) {
    return (
      <span 
        className={className}
        style={motionProps.style}
      >
        {children}
      </span>
    );
  }
  
  return (
    <motion.span
      className={className}
      {...motionProps}
    >
      {children}
    </motion.span>
  );
}