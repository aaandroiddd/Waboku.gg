import React, { useState, useEffect, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MobileSelectOption {
  value: string;
  label: string;
}

interface MobileSelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  options: MobileSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function MobileSelect({ 
  value = "", 
  onValueChange, 
  options, 
  placeholder = "Select option",
  className = "",
  disabled = false
}: MobileSelectProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [internalValue, setInternalValue] = useState(value);
  const selectRef = useRef<HTMLSelectElement>(null);

  // Detect mobile device and screen size
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window === "undefined") return false;
      
      // Enhanced defensive check for navigator and userAgent
      let userAgent = '';
      try {
        if (typeof navigator !== 'undefined' && navigator && typeof navigator.userAgent === 'string') {
          userAgent = navigator.userAgent;
        }
      } catch (error) {
        console.warn('Error accessing navigator.userAgent:', error);
        userAgent = '';
      }
      
      const isMobileUserAgent = userAgent.length > 0 && /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(userAgent);
      
      // Check screen size with defensive programming
      let isSmallScreen = false;
      try {
        if (typeof window !== 'undefined' && window && typeof window.innerWidth === 'number') {
          isSmallScreen = window.innerWidth <= 768;
        }
      } catch (error) {
        console.warn('Error accessing window.innerWidth:', error);
        isSmallScreen = false;
      }
      
      // Check touch capability with defensive programming
      let isTouchDevice = false;
      try {
        if (typeof window !== 'undefined' && window) {
          isTouchDevice = ('ontouchstart' in window) || (typeof navigator !== 'undefined' && navigator && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 0);
        }
      } catch (error) {
        console.warn('Error checking touch capability:', error);
        isTouchDevice = false;
      }
      
      const result = isMobileUserAgent || (isSmallScreen && isTouchDevice);
      
      // Debug logging
      console.log('MobileSelect detection:', {
        userAgent,
        isMobileUserAgent,
        isSmallScreen,
        isTouchDevice,
        windowWidth: typeof window !== 'undefined' && window ? window.innerWidth : 'undefined',
        result
      });
      
      return result;
    };

    setIsMobile(checkMobile());
    
    // Listen for resize events with defensive programming
    const handleResize = () => {
      try {
        setIsMobile(checkMobile());
      } catch (error) {
        console.warn('Error in resize handler:', error);
      }
    };
    
    if (typeof window !== 'undefined' && window && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', handleResize);
      window.addEventListener('orientationchange', handleResize);
      
      return () => {
        if (typeof window !== 'undefined' && window && typeof window.removeEventListener === 'function') {
          window.removeEventListener('resize', handleResize);
          window.removeEventListener('orientationchange', handleResize);
        }
      };
    }
  }, []);

  // Sync internal value with prop value
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Find the selected option object
  const selectedOption = options.find((option) => option.value === internalValue);

  // Handle value changes for native select
  const handleNativeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const newValue = e.target.value;
    setInternalValue(newValue);
    
    // Call the parent's onChange handler
    if (onValueChange) {
      onValueChange(newValue);
    }
  };

  // Handle value changes for custom select
  const handleCustomChange = (newValue: string) => {
    setInternalValue(newValue);
    
    // Call the parent's onChange handler
    if (onValueChange) {
      onValueChange(newValue);
    }
  };

  // Handle focus events to prevent glitches
  const handleFocus = (e: React.FocusEvent<HTMLSelectElement>) => {
    e.stopPropagation();
  };

  // Handle click events to prevent glitches
  const handleClick = (e: React.MouseEvent<HTMLSelectElement>) => {
    e.stopPropagation();
  };

  if (isMobile) {
    // Use native select for mobile devices
    return (
      <div className="relative w-full">
        <select
          ref={selectRef}
          className={`block w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer text-foreground disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
          value={internalValue}
          onChange={handleNativeChange}
          onFocus={handleFocus}
          onClick={handleClick}
          disabled={disabled}
          style={{
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            backgroundSize: '16px',
            paddingRight: '40px',
            minWidth: 0,
            touchAction: 'manipulation',
            marginBottom: 0
          }}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Use custom Select for desktop
  return (
    <Select value={internalValue} onValueChange={handleCustomChange} disabled={disabled}>
      <SelectTrigger className={`h-10 w-full ${className}`}>
        <SelectValue placeholder={placeholder}>
          {selectedOption?.label || placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[300px] z-[200]">
        <ScrollArea className="h-[300px]">
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="cursor-pointer"
            >
              {option.label}
            </SelectItem>
          ))}
        </ScrollArea>
      </SelectContent>
    </Select>
  );
}