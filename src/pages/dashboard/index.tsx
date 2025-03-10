import dynamic from 'next/dynamic';
import type { NextPage } from 'next';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { VerificationStatus } from '@/components/VerificationStatus';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Star, Edit2, Trash2, MessageCircle, Share2, ExternalLink } from "lucide-react";
import { ListingTimer } from "@/components/ListingTimer";
import { ListingList } from "@/components/ListingList";
import { DeleteListingDialog } from "@/components/DeleteListingDialog";
import { ListingsSearchBar } from "@/components/ListingsSearchBar";
import { WantedPostsSection } from "@/components/dashboard/WantedPostsSection";
import { WantedPostsDebugger } from "@/components/dashboard/WantedPostsDebugger";
import { useListings } from '@/hooks/useListings';
import { useProfile } from '@/hooks/useProfile';
import { Listing } from '@/types/database';

const DashboardComponent = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'date' | 'price' | 'title'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [gameFilter, setGameFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    listingId: string;
    mode: 'deactivate' | 'permanent';
  }>({
    isOpen: false,
    listingId: '',
    mode: 'deactivate'
  });

  const handleRestoreListing = async (listingId: string) => {
    try {
      await updateListingStatus(listingId, 'active');
      toast({
        title: "Listing restored",
        description: "The listing has been moved back to your active listings.",
        duration: 3000,
      });
    } catch (err: any) {
      console.error('Error restoring listing:', err);
      toast({
        title: "Error",
        description: err.message || "Failed to restore listing",
        variant: "destructive",
        duration: 3000,
      });
    }
  };
  const { toast } = useToast();
  const router = useRouter();
  const { tab = 'active', new: newListingId } = router.query;
  const { user, loading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const { listings: allListings, loading: listingsLoading, error: listingsError, refreshListings, updateListingStatus, permanentlyDeleteListing } = useListings({ 
    userId: user?.uid,
    showOnlyActive: false
  });
  const { profile, loading: profileLoading } = useProfile(user?.uid || null);
  
  const loading = authLoading || listingsLoading || profileLoading;

  const handleShare = (listingId: string) => {
    const url = `${window.location.origin}/listings/${listingId}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied!",
      description: "The listing URL has been copied to your clipboard.",
      duration: 3000,
    });
  };

  const handleViewListing = (listingId: string) => {
    router.push(`/listings/${listingId}`);
  };

  // Add a retry mechanism for initial data loading
  useEffect(() => {
    if (listingsError?.includes('permission-denied') || listingsError?.includes('insufficient permissions')) {
      // Wait for 2 seconds and try to refresh listings
      const timer = setTimeout(() => {
        if (user) {  // Only refresh if we have a user
          refreshListings();
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [listingsError, user, refreshListings]);
  
  const sortedListings = [...(allListings || [])].sort((a, b) => {
    if (sortBy === 'date') {
      const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
      const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
      return sortOrder === 'desc' ? dateB.getTime() - dateA.getTime() : dateA.getTime() - dateB.getTime();
    } else if (sortBy === 'price') {
      return sortOrder === 'desc' ? b.price - a.price : a.price - b.price;
    } else {
      return sortOrder === 'desc' 
        ? b.title.localeCompare(a.title)
        : a.title.localeCompare(b.title);
    }
  });
  
  const filteredAndSortedListings = sortedListings.filter(listing => {
    const matchesGameFilter = gameFilter === 'all' || listing.game === gameFilter;
    const matchesSearch = searchQuery === '' || 
      listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      listing.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesGameFilter && matchesSearch;
  });

  const activeListings = filteredAndSortedListings.filter(listing => listing.status === 'active');
  const previousListings = filteredAndSortedListings.filter(listing => listing.status !== 'active');

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/sign-in');
    }
  }, [user, loading, router]);

  const getConditionColor = (condition: string | undefined | null) => {
    // If condition is not a string or is empty, return default color
    if (!condition || typeof condition !== 'string') return 'bg-gray-100 text-gray-800';
    
    // Now we know condition is a string, we can safely use toLowerCase
    const conditionLower = condition.toLowerCase();
    
    switch (conditionLower) {
      case 'mint':
      case 'near-mint':
        return 'bg-green-100 text-green-800';
      case 'excellent':
      case 'light-played':
        return 'bg-yellow-100 text-yellow-800';
      case 'good':
      case 'played':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleEditListing = (listingId: string) => {
    router.push('/dashboard/edit-listing/' + listingId);
  };

  const handleDeleteListing = async (listingId: string, mode: 'deactivate' | 'permanent' = 'deactivate') => {
    try {
      if (mode === 'permanent') {
        await permanentlyDeleteListing(listingId);
        toast({
          title: "Listing deleted",
          description: "The listing has been permanently deleted.",
          duration: 3000,
        });
      } else {
        await updateListingStatus(listingId, 'archived');
        toast({
          title: "Listing archived",
          description: "The listing has been moved to your archived listings.",
          duration: 3000,
        });
      }
      // Refresh listings after successful deletion
      if (refreshListings) {
        refreshListings();
      }
    } catch (err: any) {
      console.error('Error with listing:', err);
      toast({
        title: "Error",
        description: err.message || `Failed to ${mode === 'permanent' ? 'delete' : 'deactivate'} listing`,
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleMessage = (listingId: string) => {
    router.push('/dashboard/messages?listing=' + listingId);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || listingsError) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
            <p className="text-gray-600">{error || listingsError}</p>
            <Button
              className="mt-4"
              onClick={() => router.push('/auth/sign-in')}
            >
              Return to Sign In
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Please sign in</h2>
            <Button
              onClick={() => router.push('/auth/sign-in')}
            >
              Sign In
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DeleteListingDialog
        isOpen={dialogState.isOpen}
        onClose={() => setDialogState({ ...dialogState, isOpen: false })}
        onConfirm={() => {
          handleDeleteListing(dialogState.listingId, dialogState.mode);
          setDialogState({ ...dialogState, isOpen: false });
        }}
        mode={dialogState.mode}
      />
      
      {/* Dashboard Header */}
      <div className="mb-8">
        <div className="flex items-start gap-8">
          <Avatar className="h-20 w-20">
            <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'User avatar'} />
            <AvatarFallback>{user.email ? user.email.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 pt-2">
            <div className="group cursor-pointer" onClick={() => router.push(`/profile/${user.uid}`)}>
              <h1 className="text-3xl font-bold tracking-tight hover:text-primary transition-colors">
                {user.displayName || profile?.username || 'User'}
              </h1>
              <p className="text-muted-foreground hover:text-primary transition-colors truncate max-w-[300px] mt-2">
                {user.email}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Section */}


      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active Listings</TabsTrigger>
          <TabsTrigger value="previous">Archived Listings</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                Grid
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                List
              </Button>
            </div>
            <div className="h-6 w-px bg-border hidden sm:block" /> {/* Separator */}
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <ListingsSearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                onSearch={() => {}} // Empty function since we're handling search directly
                placeholder="Search your listings..."
              />
              <div className="h-6 w-px bg-border hidden sm:block" />
              <Select value={gameFilter} onValueChange={setGameFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Games" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Games</SelectItem>
                  <SelectItem value="dbs">Dragon Ball Super Card Game</SelectItem>
                  <SelectItem value="digimon">Digimon</SelectItem>
                  <SelectItem value="lorcana">Disney Lorcana</SelectItem>
                  <SelectItem value="flesh-and-blood">Flesh and Blood</SelectItem>
                  <SelectItem value="mtg">Magic: The Gathering</SelectItem>
                  <SelectItem value="onepiece">One Piece Card Game</SelectItem>
                  <SelectItem value="pokemon">Pokemon</SelectItem>
                  <SelectItem value="star-wars">Star Wars: Unlimited</SelectItem>
                  <SelectItem value="union-arena">Union Arena</SelectItem>
                  <SelectItem value="universus">Universus</SelectItem>
                  <SelectItem value="vanguard">Vanguard</SelectItem>
                  <SelectItem value="weiss">Weiss Schwarz</SelectItem>
                  <SelectItem value="yugioh">Yu-Gi-Oh!</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <select
                className="border rounded-md px-2 py-1 bg-background text-foreground"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'price' | 'title')}
              >
                <option value="date">Date</option>
                <option value="price">Price</option>
                <option value="title">Title</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </Button>
            </div>
          </div>
          
          {viewMode === 'list' ? (
            <ListingList
              listings={activeListings}
              onEdit={handleEditListing}
              onDelete={handleDeleteListing}
              onMessage={handleMessage}
              onView={handleViewListing}
              onShare={handleShare}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeListings.map((listing) => (
                <Card key={listing.id} className="relative group cursor-pointer hover:shadow-lg transition-shadow">
                  <div 
                    className="absolute inset-0"
                    onClick={() => handleViewListing(listing.id)}
                  ></div>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{listing.title}</CardTitle>
                        <CardDescription>{listing.game}</CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="relative z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShare(listing.id);
                        }}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Badge className={getConditionColor(listing.condition)}>
                          {listing.condition}
                        </Badge>
                        <span className="font-bold">${listing.price.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <span>Listed on {new Date(listing.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="mt-2">
                        <ListingTimer
                          createdAt={listing.createdAt}
                          accountTier={profile?.tier || 'free'}
                          status={listing.status}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2 mt-4 relative z-10">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditListing(listing.id);
                          }}
                        >
                          <Edit2 className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-500 hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteListing(listing.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Archive
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMessage(listing.id);
                          }}
                        >
                          <MessageCircle className="h-4 w-4 mr-1" />
                          Messages
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewListing(listing.id);
                          }}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="previous" className="space-y-6">
          <div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {previousListings.map((listing) => (
                <Card key={listing.id} className="relative group hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{listing.title}</CardTitle>
                        <CardDescription>{listing.game}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Badge className={getConditionColor(listing.condition)}>
                          {listing.condition}
                        </Badge>
                        <span className="font-bold">${listing.price.toFixed(2)}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Listed on {new Date(listing.createdAt).toLocaleDateString()}
                      </div>
                      {/* Timer for archived listings */}
                      <div className="mt-2">
                        <ListingTimer
                          createdAt={listing.createdAt}
                          archivedAt={listing.archivedAt || listing.createdAt}
                          accountTier={profile?.tier || 'free'}
                          status="archived"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => handleRestoreListing(listing.id)}
                        >
                          Restore Listing
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => {
                            setDialogState({
                              isOpen: true,
                              listingId: listing.id,
                              mode: 'permanent'
                            });
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete Permanently
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewListing(listing.id)}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

// Use dynamic import with ssr disabled
export default dynamic(() => Promise.resolve(DashboardComponent), {
  ssr: false
});