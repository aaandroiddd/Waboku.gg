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
import debounce from 'lodash/debounce';
import { motion, AnimatePresence } from 'framer-motion';

// ... (keep all the interfaces and type definitions)

export default function CardSearchInput({ 
  onCardSelect, 
  onSearch,
  placeholder = "Search for Pokémon, Magic, or One Piece cards...",
  className = ""
}: CardSearchInputProps) {
  const [open, setOpen] = useState(false);
  // ... (keep all the state definitions and functions until the return statement)

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
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </motion.div>
          </motion.div>
        </PopoverTrigger>
        <AnimatePresence>
          {searchQuery && showSuggestions && (
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
                          const imageUrl = getCardImage(card);
                          
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
                                {imageUrl && (
                                  <motion.img
                                    src={imageUrl}
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