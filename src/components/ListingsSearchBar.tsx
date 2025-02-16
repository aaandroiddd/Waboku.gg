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
      </div>
      <div className="w-[200px]">
        <StateSelect value={state} onValueChange={onStateChange} />
      </div>
      <Button type="submit" className="h-12">
        <Search className="h-4 w-4 mr-2" />
        Search
      </Button>
    </form>
  );

  return (
    <div className={className}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-12 w-12">
            <Search className="h-4 w-4" />
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