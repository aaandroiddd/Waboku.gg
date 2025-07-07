'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScrollIndicatorProps {
  className?: string;
  delay?: number; // Delay in milliseconds before showing the indicator
  hideAfterScroll?: number; // Hide after scrolling this many pixels
}

const SCROLL_INDICATOR_KEY = 'scroll_indicator_dismissed';

export default function ScrollIndicator({ 
  className, 
  delay = 2000, // Reduced delay for mobile
  hideAfterScroll = 50 // Reduced threshold for mobile
}: ScrollIndicatorProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      console.log('ScrollIndicator: Mobile detection:', mobile, 'Width:', window.innerWidth);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Check if user has previously dismissed the indicator
    const isDismissed = localStorage.getItem(SCROLL_INDICATOR_KEY) === 'true';
    
    if (isDismissed) {
      console.log('ScrollIndicator: Previously dismissed, not showing');
      return;
    }

    let timeoutId: NodeJS.Timeout;
    let isScrolling = false;

    const handleScroll = () => {
      // Debounce scroll events to prevent excessive re-renders
      if (isScrolling) return;
      isScrolling = true;
      
      requestAnimationFrame(() => {
        // Clear the show timeout if user scrolls before delay
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Hide indicator immediately when scrolling
        setIsVisible(false);

        // Check if user has scrolled enough to consider them engaged
        if (window.scrollY > hideAfterScroll) {
          setHasScrolled(true);
          // Remember that user has interacted with the page
          localStorage.setItem(SCROLL_INDICATOR_KEY, 'true');
          console.log('ScrollIndicator: Hidden due to scroll and marked as dismissed');
        }
        
        isScrolling = false;
      });
    };

    const showIndicator = () => {
      // Only show if user hasn't scrolled significantly
      if (window.scrollY <= hideAfterScroll && !hasScrolled) {
        setIsVisible(true);
        console.log('ScrollIndicator: Showing indicator');
        console.log('ScrollIndicator: Mobile:', isMobile);
        console.log('ScrollIndicator: Window dimensions:', window.innerWidth, 'x', window.innerHeight);
        console.log('ScrollIndicator: Scroll position:', window.scrollY);
        console.log('ScrollIndicator: Hide threshold:', hideAfterScroll);
        console.log('ScrollIndicator: Actual delay used:', isMobile ? 0 : delay);
      } else {
        console.log('ScrollIndicator: Not showing - scrollY:', window.scrollY, 'hasScrolled:', hasScrolled);
      }
    };

    // No delay for mobile, use original delay for desktop
    const actualDelay = isMobile ? 0 : delay;
    console.log('ScrollIndicator: Setting timeout with delay:', actualDelay);
    
    // Initial delay before showing indicator
    timeoutId = setTimeout(showIndicator, actualDelay);

    // Listen for scroll events with passive option for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [delay, hideAfterScroll, hasScrolled, isMobile]);

  const handleClick = () => {
    // Remember that user has clicked the indicator
    localStorage.setItem(SCROLL_INDICATOR_KEY, 'true');
    console.log('ScrollIndicator: Clicked and marked as dismissed');

    // Smooth scroll to the listings section
    const listingsSection = document.querySelector('[data-scroll-target="listings"]') || 
                           document.querySelector('.listings-section') ||
                           document.querySelector('#listings');
    
    if (listingsSection) {
      listingsSection.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    } else {
      // Fallback: scroll down by viewport height
      window.scrollBy({
        top: window.innerHeight * 0.8,
        behavior: 'smooth'
      });
    }
    
    setIsVisible(false);
    setHasScrolled(true);
  };

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          key="scroll-indicator"
          initial={{ 
            opacity: 0, 
            y: 10,
            scale: 0.9
          }}
          animate={{ 
            opacity: 1, 
            y: 0,
            scale: 1
          }}
          exit={{ 
            opacity: 0, 
            y: 10,
            scale: 0.9
          }}
          transition={{
            duration: 0.3,
            ease: "easeOut"
          }}
          className={cn(
            "fixed left-1/2 cursor-pointer touch-manipulation",
            // Mobile positioning - higher z-index and better bottom positioning
            "bottom-6 sm:bottom-8 md:bottom-10",
            "z-[9999]", // Very high z-index to ensure visibility
            // Ensure visibility on mobile
            "block",
            // Force visibility and prevent any layout issues
            "!opacity-100 !visible",
            className
          )}
          style={{ 
            transform: 'translateX(-50%)',
            willChange: 'transform, opacity'
          }}
          onClick={handleClick}
          role="button"
          tabIndex={0}
          aria-label="Scroll down to view listings"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClick();
            }
          }}
          whileHover={{ 
            scale: 1.05,
            transition: { duration: 0.2 }
          }}
          whileTap={{ 
            scale: 0.95,
            transition: { duration: 0.1 }
          }}
        >
          {/* Simplified glow effect */}
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-md animate-pulse" />
          
          {/* Main button - simplified */}
          <motion.div 
            className="relative bg-primary text-primary-foreground rounded-full p-3 sm:p-3 md:p-4 shadow-lg min-h-[48px] min-w-[48px] flex items-center justify-center"
            animate={{
              y: [0, -6, 0]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <ChevronDown className="w-6 h-6" />
          </motion.div>
          
          {/* Tooltip - Hidden on mobile, shown on hover for desktop */}
          <div className="absolute bottom-full left-1/2 mb-2 pointer-events-none hidden sm:block opacity-0 hover:opacity-100 transition-opacity duration-200"
               style={{ transform: 'translateX(-50%)' }}>
            <div className="bg-background/90 backdrop-blur-sm text-foreground text-sm px-3 py-1 rounded-md shadow-lg whitespace-nowrap border">
              Scroll to view listings
            </div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-background/90" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}