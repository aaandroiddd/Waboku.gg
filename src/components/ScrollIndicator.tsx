'use client';

import React, { useState, useEffect } from 'react';
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

    const handleScroll = () => {
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
        return;
      }

      // If user hasn't scrolled much, show indicator again after they stop scrolling
      if (!hasScrolled) {
        scrollTimeout = setTimeout(() => {
          setIsVisible(true);
        }, 2000); // Show again after 2 seconds of no scrolling
      }
    };

    const showIndicator = () => {
      // Only show if user hasn't scrolled significantly
      if (window.scrollY <= hideAfterScroll && !hasScrolled) {
        setIsVisible(true);
      }
    };

    // Initial delay before showing indicator
    timeoutId = setTimeout(showIndicator, delay);

    // Listen for scroll events
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

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50",
        "transition-all duration-500 ease-in-out",
        "animate-bounce cursor-pointer",
        "hover:scale-110 active:scale-95",
        className
      )}
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
    >
      {/* Outer glow effect */}
      <div className="absolute inset-0 bg-primary/20 rounded-full blur-lg animate-pulse" />
      
      {/* Main button */}
      <div className="relative bg-primary text-primary-foreground rounded-full p-3 shadow-lg hover:shadow-xl transition-shadow duration-300">
        <ChevronDown 
          size={24} 
          className="animate-pulse"
        />
      </div>
      
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="bg-background/90 backdrop-blur-sm text-foreground text-sm px-3 py-1 rounded-md shadow-lg whitespace-nowrap border">
          Scroll to view listings
        </div>
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-background/90" />
      </div>
    </div>
  );
}