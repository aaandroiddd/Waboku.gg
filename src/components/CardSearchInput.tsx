import { useState, useCallback, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Search, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { useCardSearch } from '@/hooks/useCardSearch';

interface CardSearchInputProps {
  onCardSelect?: (card: any) => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
  className?: string;
}

interface GroupedCards {
  [key: string]: any[];
}

export default function CardSearchInput({ 
  onCardSelect, 
  onSearch,
  placeholder = "Search for Pokémon, Magic, or One Piece cards...",
  className = ""
}: CardSearchInputProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { results: cards, isLoading, searchCards } = useCardSearch();

  const handleSelect = (card: any) => {
    if (onCardSelect) {
      onCardSelect(card);
    }
    setSearchQuery(card.name);
    setOpen(false);
  };

  const getCardDetails = (card: any) => {
    return {
      name: card.name || 'Unknown Card',
      number: card.number || '???',
      set: card.set?.name || 'Unknown Set',
      series: card.series || null,
      game: card.game || 'Trading Card Game'
    };
  };

  // Only search when there's at least 3 characters
  useEffect(() => {
    if (searchQuery.trim().length >= 3) {
      searchCards(searchQuery);
    } else {
      // Clear results if query is too short
      setOpen(false);
    }
  }, [searchQuery, searchCards]);

  return (
    <motion.div 
      className={`w-full ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <motion.div 
            className="relative w-full"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <Input
              type="text"
              placeholder={placeholder}
              value={searchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                // Only open popover if there's text
                setOpen(!!value.trim());
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && onSearch) {
                  onSearch(searchQuery);
                  setOpen(false);
                }
              }}
              className="pl-10 h-12 w-full transition-shadow duration-200 ease-in-out focus-within:shadow-lg"
            />
            <motion.div 
              className="absolute inset-y-0 left-0 flex items-center pl-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {isLoading && searchQuery.trim() ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </motion.div>
          </motion.div>
        </PopoverTrigger>
        <AnimatePresence>
          {open && searchQuery.trim() && (
            <PopoverContent 
              className="p-0 w-[var(--radix-popover-trigger-width)] max-h-[400px] overflow-auto"
              align="start"
              sideOffset={5}
              asChild
            >
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <Command>
                  <CommandList>
                    {isLoading ? (
                      <motion.div 
                        className="flex items-center justify-center p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="ml-2">Loading suggestions...</span>
                      </motion.div>
                    ) : cards.length === 0 ? (
                      <CommandEmpty>No results found.</CommandEmpty>
                    ) : (
                      <CommandGroup heading="Suggestions">
                        {cards.map((card, index) => {
                          const details = getCardDetails(card);
                          
                          return (
                            <motion.div
                              key={card.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ 
                                duration: 0.3,
                                delay: index * 0.05,
                                ease: "easeOut"
                              }}
                            >
                              <CommandItem
                                onSelect={() => handleSelect(card)}
                                className="flex items-start gap-2 cursor-pointer p-2 hover:bg-accent transition-colors duration-200"
                              >
                                {card.imageUrl && (
                                  <motion.img
                                    src={card.imageUrl}
                                    alt={details.name}
                                    className="w-10 h-14 object-contain flex-shrink-0"
                                    whileHover={{ scale: 1.05 }}
                                    transition={{ duration: 0.2 }}
                                  />
                                )}
                                <div className="flex flex-col min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm truncate">{details.name}</span>
                                    <motion.span 
                                      className="text-xs font-mono bg-primary/10 px-1.5 py-0.5 rounded"
                                      whileHover={{ scale: 1.05 }}
                                      transition={{ duration: 0.2 }}
                                    >
                                      #{details.number}
                                    </motion.span>
                                  </div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <span className="truncate font-medium">{details.set}</span>
                                    {details.series && (
                                      <>
                                        <span>•</span>
                                        <span className="truncate">{details.series}</span>
                                      </>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {details.game}
                                  </div>
                                </div>
                              </CommandItem>
                            </motion.div>
                          );
                        })}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </motion.div>
            </PopoverContent>
          )}
        </AnimatePresence>
      </Popover>
    </motion.div>
  );
}