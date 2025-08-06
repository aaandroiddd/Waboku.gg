import React, { useState, useEffect, useRef } from "react";

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
  const [internalValue, setInternalValue] = useState(value);
  const selectRef = useRef<HTMLSelectElement>(null);

  // Sync internal value with prop value
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

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

  // Handle focus events to prevent glitches
  const handleFocus = (e: React.FocusEvent<HTMLSelectElement>) => {
    e.stopPropagation();
  };

  // Handle click events to prevent glitches
  const handleClick = (e: React.MouseEvent<HTMLSelectElement>) => {
    e.stopPropagation();
  };

  // Always use native select for all devices
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
          minWidth: '120px',
          width: '100%',
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