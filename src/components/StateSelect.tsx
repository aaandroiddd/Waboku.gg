import React, { useState, useEffect, useRef } from "react";

const US_STATES = [
  { code: "all", name: "All locations" },
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

interface StateSelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
}

export function StateSelect({ value = "all", onValueChange }: StateSelectProps) {
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
        className="block w-full h-12 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer text-foreground"
        value={internalValue}
        onChange={handleNativeChange}
        onFocus={handleFocus}
        onClick={handleClick}
        style={{
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          backgroundSize: '16px',
          paddingRight: '40px',
          minWidth: 0,
          touchAction: 'manipulation'
        }}
      >
        {US_STATES.map((state) => (
          <option key={state.code} value={state.code.toLowerCase()}>
            {state.name}
          </option>
        ))}
      </select>
    </div>
  );
}