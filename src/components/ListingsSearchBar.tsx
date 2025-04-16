import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import { StateSelect } from "./StateSelect";

interface ListingsSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (value: string) => void;
  state?: string;
  onStateChange?: (state: string) => void;
  placeholder?: string;
  className?: string;
}

export function ListingsSearchBar({ 
  value, 
  onChange,
  onSearch,
  state,
  onStateChange, 
  placeholder = "Search your listings...",
  className 
}: ListingsSearchBarProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  // Update inputValue when value prop changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onChange(inputValue);
    onSearch(inputValue);
    setOpen(false);
  };

  const SearchInput = () => (
    <form onSubmit={handleSubmit} className="flex gap-4 w-full">
      <div className="relative flex-1">
        <Input
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="w-full h-10"
          autoFocus
        />
        <Button 
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 w-8"
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>
      {/* Only show state select if onStateChange is provided */}
      {onStateChange && (
        <div className="w-full sm:w-[200px]">
          <StateSelect value={state} onValueChange={onStateChange} />
        </div>
      )}
    </form>
  );

  // For dashboard view, we'll use a direct input instead of a sheet trigger
  // This makes the search more accessible on all screen sizes
  return (
    <div className={`w-full ${className || ''}`}>
      <div className="relative w-full">
        <Input
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            onChange(e.target.value); // Update parent state immediately
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSearch(inputValue);
            }
          }}
          className="w-full pr-10"
        />
        <Button 
          type="button"
          onClick={() => onSearch(inputValue)}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
          variant="ghost"
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}