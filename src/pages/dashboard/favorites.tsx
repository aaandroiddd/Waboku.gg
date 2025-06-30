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
import { useRouter } from 'next/router';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';

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
  const router = useRouter();
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

  // Handle adding a listing to favorites from the query parameter
  useEffect(() => {
    const handleAddToFavorites = async () => {
      if (!router.isReady || !initialized) return;
      
      const { add } = router.query;
      if (!add || typeof add !== 'string') return;
      
      try {
        // Check if the listing is already in favorites
        if (isFavorite(add)) {
          toast.success('This listing is already in your favorites!');
          // Clean up the URL
          router.replace('/dashboard/favorites', undefined, { shallow: true });
          return;
        }
        
        // Fetch the listing data
        const { db } = getFirebaseServices();
        if (!db) {
          throw new Error('Database not initialized');
        }
        
        const listingDoc = await getDoc(doc(db, 'listings', add));
        if (!listingDoc.exists()) {
          toast.error('Listing not found or no longer available');
          router.replace('/dashboard/favorites', undefined, { shallow: true });
          return;
        }
        
        const listingData = listingDoc.data();
        
        // Convert the data to a Listing object
        const listing: Listing = {
          id: listingDoc.id,
          title: listingData.title || 'Untitled Listing',
          description: listingData.description || '',
          price: typeof listingData.price === 'number' ? listingData.price : 
                 typeof listingData.price === 'string' ? parseFloat(listingData.price) : 0,
          condition: listingData.condition || 'unknown',
          game: listingData.game || 'other',
          imageUrls: Array.isArray(listingData.imageUrls) ? listingData.imageUrls : [],
          coverImageIndex: typeof listingData.coverImageIndex === 'number' ? listingData.coverImageIndex : 0,
          userId: listingData.userId || '',
          username: listingData.username || 'Unknown User',
          createdAt: listingData.createdAt?.toDate() || new Date(),
          expiresAt: listingData.expiresAt?.toDate() || new Date(),
          status: listingData.status || 'active',
          isGraded: Boolean(listingData.isGraded),
          gradeLevel: listingData.gradeLevel ? Number(listingData.gradeLevel) : undefined,
          gradingCompany: listingData.gradingCompany,
          city: listingData.city || 'Unknown',
          state: listingData.state || 'Unknown',
          favoriteCount: typeof listingData.favoriteCount === 'number' ? listingData.favoriteCount : 0,
          quantity: listingData.quantity ? Number(listingData.quantity) : undefined,
          cardName: listingData.cardName || undefined,
          location: listingData.location,
          soldTo: listingData.soldTo || null,
          archivedAt: listingData.archivedAt?.toDate() || null,
          offersOnly: listingData.offersOnly === true,
          finalSale: listingData.finalSale === true
        };
        
        // Add to favorites
        await toggleFavorite(listing);
        
        // Clean up the URL
        router.replace('/dashboard/favorites', undefined, { shallow: true });
        
      } catch (error) {
        console.error('Error adding listing to favorites:', error);
        toast.error('Failed to add listing to favorites');
        router.replace('/dashboard/favorites', undefined, { shallow: true });
      }
    };
    
    handleAddToFavorites();
  }, [router.isReady, router.query, initialized, isFavorite, toggleFavorite]);
  
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