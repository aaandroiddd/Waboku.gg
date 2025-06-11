import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useFavorites, FavoriteListing } from '@/hooks/useFavorites';
import { FavoritesSearchBar } from '@/components/FavoritesSearchBar';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { FavoriteListingCard } from '@/components/FavoriteListingCard';
import { getConditionColor } from '@/lib/utils';
import { Listing } from '@/types/database';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function FavoritesPage() {
  const { 
    favorites: allFavorites,
    isLoading, 
    refresh, 
    initialized, 
    toggleFavorite, 
    isFavorite
  } = useFavorites();
  
  // Local filter state - same approach as dashboard
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [gameFilter, setGameFilter] = useState<string>('all');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  
  // Force refresh when the component mounts
  useEffect(() => {
    if (initialized) {
      refresh();
    }
  }, [initialized, refresh]);
  
  // Apply filters to favorites - same logic as dashboard
  const filteredFavorites = useMemo(() => {
    let result = [...allFavorites];
    
    // Filter by game - same logic as dashboard
    if (gameFilter !== 'all') {
      result = result.filter(listing => {
        if (!listing.game) return false;
        
        const listingGame = listing.game.toLowerCase();
        
        // Use the same game matching logic as dashboard
        return (
          listingGame === gameFilter.toLowerCase() ||
          (gameFilter === 'mtg' && listingGame.includes('magic')) ||
          (gameFilter === 'yugioh' && (
            listingGame.includes('yu-gi-oh') || 
            listingGame.includes('yugioh')
          )) ||
          (gameFilter === 'pokemon' && listingGame.includes('pokemon')) ||
          (gameFilter === 'onepiece' && listingGame.includes('one piece')) ||
          (gameFilter === 'lorcana' && listingGame.includes('lorcana')) ||
          (gameFilter === 'dbs' && (
            listingGame.includes('dragon ball') || 
            listingGame.includes('dbs')
          )) ||
          (gameFilter === 'flesh-and-blood' && listingGame.includes('flesh')) ||
          (gameFilter === 'star-wars' && listingGame.includes('star wars')) ||
          (gameFilter === 'digimon' && listingGame.includes('digimon'))
        );
      });
    }
    
    // Filter by search query - same logic as dashboard
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      result = result.filter(listing => 
        (listing.title && listing.title.toLowerCase().includes(searchLower)) ||
        (listing.description && listing.description.toLowerCase().includes(searchLower))
      );
    }
    
    // Filter by price range
    if (minPrice) {
      const min = parseFloat(minPrice);
      if (!isNaN(min)) {
        result = result.filter(listing => listing.price >= min);
      }
    }
    
    if (maxPrice) {
      const max = parseFloat(maxPrice);
      if (!isNaN(max)) {
        result = result.filter(listing => listing.price <= max);
      }
    }
    
    return result;
  }, [allFavorites, gameFilter, searchQuery, minPrice, maxPrice]);
  
  // Handle favorite toggle
  const handleFavoriteToggle = useCallback((e: React.MouseEvent, listing: Listing) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(listing);
  }, [toggleFavorite]);
  
  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setGameFilter('all');
    setMinPrice('');
    setMaxPrice('');
  }, []);
  
  // Render listings grid
  const renderListings = useCallback(() => {
    if (isLoading) {
      return (
        <motion.div 
          className="animate-pulse space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="h-4 bg-secondary rounded w-3/4" />
          <div className="h-4 bg-secondary rounded w-1/2" />
        </motion.div>
      );
    }
    
    if (filteredFavorites.length === 0) {
      return (
        <motion.div 
          className="text-center py-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <h3 className="text-lg font-semibold mb-2">No favorites found</h3>
          <p className="text-muted-foreground mb-4">
            {allFavorites.length > 0 
              ? 'No favorites match your current filters. Try adjusting your search criteria.'
              : 'When viewing a listing, click the favorites button to add it to this page.'}
          </p>
          <Button asChild>
            <Link href="/listings">Browse Listings</Link>
          </Button>
        </motion.div>
      );
    }
    
    return (
      <motion.div 
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {filteredFavorites.map((listing) => (
          <FavoriteListingCard
            key={listing.id}
            listing={listing}
            isFavorite={isFavorite(listing.id)}
            onFavoriteClick={handleFavoriteToggle}
            getConditionColor={getConditionColor}
          />
        ))}
      </motion.div>
    );
  }, [filteredFavorites, allFavorites, isLoading, isFavorite, handleFavoriteToggle]);

  return (
    <RouteGuard requireAuth>
      <DashboardLayout>
        <motion.div 
          className="container mx-auto p-6"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">My Favorites</h1>
              <p className="text-muted-foreground">
                Browse and filter your favorite listings ({filteredFavorites.length} of {allFavorites.length})
              </p>
            </div>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Favorites</CardTitle>
              <CardDescription>
                Browse and filter your favorite listings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FavoritesSearchBar
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                gameFilter={gameFilter}
                onGameFilterChange={setGameFilter}
                minPrice={minPrice}
                onMinPriceChange={setMinPrice}
                maxPrice={maxPrice}
                onMaxPriceChange={setMaxPrice}
                onClearFilters={handleClearFilters}
              />
              
              <Separator />
              
              <AnimatePresence mode="wait">
                {renderListings()}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </DashboardLayout>
    </RouteGuard>
  );
}