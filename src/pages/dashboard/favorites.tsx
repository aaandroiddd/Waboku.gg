import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFavorites } from '@/hooks/useFavorites';
import { ListingGrid } from '@/components/ListingGrid';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

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
  const { favorites, isLoading, refresh, initialized } = useFavorites();
  
  // Force refresh when the component mounts
  useEffect(() => {
    if (initialized) {
      refresh();
    }
  }, [initialized, refresh]);

  return (
    <RouteGuard requireAuth>
      <DashboardLayout>
        <motion.div 
          className="container mx-auto p-6"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          <Card>
            <CardHeader>
              <CardTitle>My Favorites</CardTitle>
            </CardHeader>
            <CardContent>
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div 
                    className="animate-pulse space-y-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="h-4 bg-secondary rounded w-3/4" />
                    <div className="h-4 bg-secondary rounded w-1/2" />
                  </motion.div>
                ) : favorites.length > 0 ? (
                  <motion.div 
                    className="max-w-[1400px] mx-auto"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <ListingGrid 
                      listings={favorites}
                      loading={isLoading}
                      displayCount={8}
                      hasMore={favorites.length > 8}
                      onLoadMore={() => {}}
                      isFavoritesPage={true}
                    />
                  </motion.div>
                ) : (
                  <motion.div 
                    className="text-center py-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h3 className="text-lg font-semibold mb-2">No favorites yet</h3>
                    <p className="text-muted-foreground mb-4">
                      When viewing a listing, click the favorites button to add it to this page.
                    </p>
                    <Button asChild>
                      <Link href="/listings">Browse Listings</Link>
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </DashboardLayout>
    </RouteGuard>
  );
}