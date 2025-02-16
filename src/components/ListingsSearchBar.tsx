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
import { useState } from "react";
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
          className="w-full h-12"
          autoFocus
        />
        <Button 
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 w-10"
        >
          <Search className="h-5 w-5" />
        </Button>
      </div>
      <div className="w-[200px]">
        <StateSelect value={state} onValueChange={onStateChange} />
      </div>
      <Button type="submit" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10">
        <Search className="h-5 w-5" />
        Search
      </Button>
    </form>
  );

  return (
    <div className={className}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 w-10">
            <Search className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="top" className="w-full p-4">
          <SheetHeader className="mb-4">
            <SheetTitle>Search Listings</SheetTitle>
          </SheetHeader>
          <SearchInput />
        </SheetContent>
      </Sheet>
    </div>
  );
}