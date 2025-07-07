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

export default function ScrollIndicator({ 
  className, 
  delay = 3000, 
  hideAfterScroll = 100 
}: ScrollIndicatorProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let scrollTimeout: NodeJS.Timeout;
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

        // Clear previous scroll timeout
        if (scrollTimeout) {
          clearTimeout(scrollTimeout);
        }

        // Hide indicator immediately when scrolling
        setIsVisible(false);

        // Check if user has scrolled enough to consider them engaged
        if (window.scrollY > hideAfterScroll) {
          setHasScrolled(true);
          isScrolling = false;
          return;
        }

        // If user hasn't scrolled much, show indicator again after they stop scrolling
        if (!hasScrolled) {
          scrollTimeout = setTimeout(() => {
            setIsVisible(true);
          }, 2000); // Show again after 2 seconds of no scrolling
        }
        
        isScrolling = false;
      });
    };

    const showIndicator = () => {
      // Only show if user hasn't scrolled significantly
      if (window.scrollY <= hideAfterScroll && !hasScrolled) {
        setIsVisible(true);
        console.log('ScrollIndicator: Showing indicator');
      }
    };

    // Initial delay before showing indicator
    timeoutId = setTimeout(showIndicator, delay);

    // Listen for scroll events with passive option for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (scrollTimeout) clearTimeout(scrollTimeout);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [delay, hideAfterScroll, hasScrolled]);

  const handleClick = () => {
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
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ 
            opacity: 0, 
            y: 20,
            scale: 0.8
          }}
          animate={{ 
            opacity: 1, 
            y: 0,
            scale: 1
          }}
          exit={{ 
            opacity: 0, 
            y: 20,
            scale: 0.8
          }}
          transition={{
            duration: 0.6,
            ease: [0.25, 0.46, 0.45, 0.94], // Custom easing for smooth entrance
            scale: {
              type: "spring",
              stiffness: 300,
              damping: 20
            }
          }}
          className={cn(
            "fixed left-1/2 cursor-pointer touch-manipulation",
            // Mobile positioning - higher z-index and better bottom positioning
            "bottom-4 sm:bottom-6 md:bottom-8",
            "z-[9999]", // Very high z-index to ensure visibility
            // Add padding for mobile safe areas
            "pb-safe",
            className
          )}
          style={{ x: '-50%' }}
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
            scale: 1.1,
            transition: { duration: 0.2 }
          }}
          whileTap={{ 
            scale: 0.95,
            transition: { duration: 0.1 }
          }}
        >
          {/* Outer glow effect */}
          <motion.div 
            className="absolute inset-0 bg-primary/20 rounded-full blur-lg"
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.1, 1]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          
          {/* Main button */}
          <motion.div 
            className="relative bg-primary text-primary-foreground rounded-full p-3 sm:p-3 md:p-4 shadow-lg min-h-[48px] min-w-[48px] flex items-center justify-center"
            animate={{
              y: [0, -8, 0]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            whileHover={{
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
            }}
          >
            <motion.div
              animate={{
                rotate: [0, 5, -5, 0]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <ChevronDown size={24} className="sm:w-6 sm:h-6" />
            </motion.div>
          </motion.div>
          
          {/* Tooltip - Hidden on mobile, shown on hover for desktop */}
          <motion.div 
            className="absolute bottom-full left-1/2 mb-2 pointer-events-none hidden sm:block"
            style={{ x: '-50%' }}
            initial={{ opacity: 0, y: 10 }}
            whileHover={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="bg-background/90 backdrop-blur-sm text-foreground text-sm px-3 py-1 rounded-md shadow-lg whitespace-nowrap border">
              Scroll to view listings
            </div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-background/90" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}