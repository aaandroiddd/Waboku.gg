import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useFavorites, FavoriteFilters, FavoriteListing } from '@/hooks/useFavorites';
import { useFavoriteGroups, FavoriteGroup } from '@/hooks/useFavoriteGroups';
import { FavoritesSearchBar } from '@/components/FavoritesSearchBar';
import { FavoriteGroupsManager } from '@/components/FavoriteGroupsManager';
import { AddToGroupDialog } from '@/components/AddToGroupDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { FolderPlus, Folder } from 'lucide-react';
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
    favorites, 
    allFavorites,
    isLoading, 
    refresh, 
    initialized, 
    toggleFavorite, 
    updateFavoriteGroup,
    isFavorite,
    setFilters,
    filters
  } = useFavorites();
  
  const { 
    groups, 
    isLoading: isLoadingGroups, 
    createGroup, 
    renameGroup, 
    deleteGroup,
    addToGroup,
    removeFromGroup,
    createAndAddToGroup
  } = useFavoriteGroups();
  
  const [selectedTab, setSelectedTab] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [isAddToGroupDialogOpen, setIsAddToGroupDialogOpen] = useState<boolean>(false);
  
  // Force refresh when the component mounts
  useEffect(() => {
    if (initialized) {
      refresh();
    }
  }, [initialized, refresh]);
  
  // Handle search
  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
    setFilters(prev => ({ ...prev, search: value }));
  }, [setFilters]);
  
  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: FavoriteFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, [setFilters]);
  
  // Handle group selection
  const handleGroupChange = useCallback((groupId: string | null) => {
    setFilters(prev => ({ ...prev, groupId }));
  }, [setFilters]);
  
  // Handle favorite toggle
  const handleFavoriteToggle = useCallback((e: React.MouseEvent, listing: Listing) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(listing);
  }, [toggleFavorite]);
  
  // Handle add to group
  const handleAddToGroup = useCallback((e: React.MouseEvent, listing: Listing) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedListing(listing);
    setIsAddToGroupDialogOpen(true);
  }, []);
  
  // Get group name for a listing
  const getGroupName = useCallback((listing: FavoriteListing) => {
    if (!listing.groupId) return undefined;
    const group = groups.find(g => g.id === listing.groupId);
    return group?.name;
  }, [groups]);
  
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
    
    if (favorites.length === 0) {
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
        {favorites.map((listing) => (
          <FavoriteListingCard
            key={listing.id}
            listing={listing}
            isFavorite={isFavorite(listing.id)}
            onFavoriteClick={handleFavoriteToggle}
            onAddToGroupClick={handleAddToGroup}
            getConditionColor={getConditionColor}
            groupName={getGroupName(listing as FavoriteListing)}
          />
        ))}
      </motion.div>
    );
  }, [favorites, allFavorites, isLoading, isFavorite, handleFavoriteToggle, handleAddToGroup, getGroupName]);

  return (
    <RouteGuard requireAuth>
      <DashboardLayout>
        <motion.div 
          className="container mx-auto p-6"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          <Tabs defaultValue="all" value={selectedTab} onValueChange={setSelectedTab}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">My Favorites</h1>
                <p className="text-muted-foreground">
                  Manage and organize your favorite listings
                </p>
              </div>
              <TabsList>
                <TabsTrigger value="all">All Favorites</TabsTrigger>
                <TabsTrigger value="groups">Manage Groups</TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="all" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Favorites</CardTitle>
                  <CardDescription>
                    Browse and filter your favorite listings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FavoritesSearchBar
                    onSearch={handleSearch}
                    onFilterChange={handleFilterChange}
                    onGroupChange={handleGroupChange}
                    groups={groups}
                    selectedGroup={filters.groupId || null}
                  />
                  
                  <Separator />
                  
                  <AnimatePresence mode="wait">
                    {renderListings()}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="groups" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Favorite Groups</CardTitle>
                  <CardDescription>
                    Create and manage groups to organize your favorites
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FavoriteGroupsManager
                    groups={groups}
                    onCreateGroup={createGroup}
                    onRenameGroup={renameGroup}
                    onDeleteGroup={deleteGroup}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
        
        {/* Add to Group Dialog */}
        <AddToGroupDialog
          isOpen={isAddToGroupDialogOpen}
          onClose={() => setIsAddToGroupDialogOpen(false)}
          listing={selectedListing}
          groups={groups}
          onAddToGroup={addToGroup}
          onCreateAndAddToGroup={createAndAddToGroup}
        />
      </DashboardLayout>
    </RouteGuard>
  );
}