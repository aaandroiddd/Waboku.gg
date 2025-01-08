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
  state?: string;
  onStateChange?: (state: string) => void;
  placeholder?: string;
  className?: string;
}

export function ListingsSearchBar({ 
  value, 
  onChange,
  state,
  onStateChange, 
  placeholder = "Search your listings...",
  className 
}: ListingsSearchBarProps) {
  const [open, setOpen] = useState(false);

  const SearchInput = () => (
    <div className="flex gap-4 w-full">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
        <Input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-9 w-full h-12"
          autoFocus
        />
      </div>
      <div className="w-[200px]">
        <StateSelect value={state} onValueChange={onStateChange} />
      </div>
    </div>
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