import dynamic from 'next/dynamic';
import type { NextPage } from 'next';
import { useCallback, useEffect, useState } from 'react';
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { ListingVisibilityFixer } from "@/components/ListingVisibilityFixer";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ProfileName } from "@/components/ProfileName";
import { Star, Edit2, Trash2, MessageCircle, Share2, ExternalLink, AlertCircle } from "lucide-react";
import { ListingTimer } from "@/components/ListingTimer";
import { ListingList } from "@/components/ListingList";
import { DeleteListingDialog } from "@/components/DeleteListingDialog";
import { ListingsSearchBar } from "@/components/ListingsSearchBar";
import { WantedPostsSection } from "@/components/dashboard/WantedPostsSection";
import { WantedPostsDebugger } from "@/components/dashboard/WantedPostsDebugger";
import { useListings } from '@/hooks/useListings';
import { useProfile } from '@/hooks/useProfile';
import { useListingVisibility } from '@/hooks/useListingVisibility';
import { Listing } from '@/types/database';
import { ContentLoader } from '@/components/ContentLoader';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyStateCard } from '@/components/EmptyStateCard';
import { ArchivedListings } from '@/components/ArchivedListings';
import { FirebaseConnectionHandler } from '@/components/FirebaseConnectionHandler';
import { useLoading } from '@/hooks/useLoading';
import { ViewCounter } from '@/components/ViewCounter';
import { DashboardLoadingScreen } from '@/components/dashboard/DashboardLoadingScreen';
import { useDashboardCache } from '@/hooks/useDashboardCache';

const DashboardComponent = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'date' | 'price' | 'title'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [gameFilter, setGameFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showDashboard, setShowDashboard] = useState<boolean>(false);
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
      
      // Update local state to immediately reflect the change
      // This ensures the listing moves from archived to active tab without requiring a refresh
      setListings(prevListings => 
        prevListings.map(listing => 
          listing.id === listingId 
            ? { 
                ...listing, 
                status: 'active',
                archivedAt: null,
                // Set new creation date and expiration based on account tier
                createdAt: new Date(),
                expiresAt: (() => {
                  const now = new Date();
                  const tierDuration = (profile?.tier === 'premium' ? 720 : 48);
                  const expirationTime = new Date(now);
                  expirationTime.setHours(expirationTime.getHours() + tierDuration);
                  return expirationTime;
                })()
              } 
            : listing
        )
      );
      
      // Clear any cached listings data to ensure fresh data
      if (user) {
        try {
          // Create cache keys for the user's listings
          const userListingsCacheKey = `listings_${user.uid}_all_none`;
          const activeListingsCacheKey = `listings_${user.uid}_active_none`;
          
          // Clear from localStorage to ensure fresh data
          localStorage.removeItem(userListingsCacheKey);
          localStorage.removeItem(activeListingsCacheKey);
          
          console.log('Cleared listings cache after restoring');
        } catch (cacheError) {
          console.error('Error clearing listings cache:', cacheError);
        }
      }
      
      // Refresh listings to ensure server data is up to date
      enhancedRefreshListings();
      
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
  const [loadingMessage, setLoadingMessage] = useState<string>("Loading dashboard...");
  
  // Use regular hooks for data fetching
  const { listings: allListings, setListings, loading: listingsLoading, error: listingsError, refreshListings, updateListingStatus, permanentlyDeleteListing } = useListings({ 
    userId: user?.uid,
    showOnlyActive: false
  });
  const { profile, loading: profileLoading } = useProfile(user?.uid || null);
  
  // Create a wrapper for the dashboard cache
  const [dashboardCache, setDashboardCache] = useState<{
    listings: typeof allListings;
    profile: typeof profile;
    timestamp: number;
  } | null>(null);
  
  // Cache loading states
  const [listingsCacheLoading, setListingsCacheLoading] = useState(true);
  const [profileCacheLoading, setProfileCacheLoading] = useState(true);
  const [listingsCacheError, setListingsCacheError] = useState<Error | null>(null);
  const [profileCacheError, setProfileCacheError] = useState<Error | null>(null);
  
  // Function to save dashboard data to cache
  const saveDashboardToCache = useCallback(() => {
    if (!user) return;
    
    try {
      const cacheData = {
        listings: allListings,
        profile: profile,
        timestamp: Date.now()
      };
      
      const cacheKey = `dashboard_cache_${user.uid}`;
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log('Dashboard data saved to cache');
    } catch (err) {
      console.error('Error saving dashboard to cache:', err);
    }
  }, [user, allListings, profile]);
  
  // Function to load dashboard data from cache
  const loadDashboardFromCache = useCallback(() => {
    if (!user) return null;
    
    try {
      const cacheKey = `dashboard_cache_${user.uid}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      if (!cachedData) return null;
      
      const parsedData = JSON.parse(cachedData);
      
      // Check if cache is valid (less than 5 minutes old)
      const now = Date.now();
      const cacheAge = now - parsedData.timestamp;
      const cacheValidityPeriod = 5 * 60 * 1000; // 5 minutes
      
      if (cacheAge > cacheValidityPeriod) {
        console.log('Dashboard cache expired');
        return null;
      }
      
      console.log('Using dashboard data from cache');
      return parsedData;
    } catch (err) {
      console.error('Error loading dashboard from cache:', err);
      return null;
    }
  }, [user]);
  
  // Function to refresh all dashboard data
  const refreshCachedListings = async () => {
    setLoadingMessage("Refreshing your listings...");
    try {
      await refreshListings();
      saveDashboardToCache();
    } catch (err) {
      console.error('Error refreshing listings:', err);
      setListingsCacheError(err instanceof Error ? err : new Error('Failed to refresh listings'));
    }
  };
  
  const refreshCachedProfile = async () => {
    setLoadingMessage("Refreshing your profile...");
    try {
      // Profile is already refreshed by the useProfile hook
      saveDashboardToCache();
    } catch (err) {
      console.error('Error refreshing profile:', err);
      setProfileCacheError(err instanceof Error ? err : new Error('Failed to refresh profile'));
    }
  };
  
  // Use the listing visibility hook to properly filter active listings
  const { visibleListings: properlyFilteredActiveListings, isLoading: visibilityLoading } = useListingVisibility(
    allListings.filter(listing => listing.status === 'active')
  );
  
  const { isLoading: loadingState } = useLoading();
  const loading = authLoading || listingsLoading || profileLoading || visibilityLoading || listingsCacheLoading || profileCacheLoading;
  
  // Effect to handle cache loading and saving
  useEffect(() => {
    if (!user) return;
    
    const handleCacheLoading = async () => {
      try {
        setListingsCacheLoading(true);
        setProfileCacheLoading(true);
        
        // Try to load from cache first
        const cachedData = loadDashboardFromCache();
        
        if (cachedData) {
          // Cache is valid, we can use it
          setListingsCacheLoading(false);
          setProfileCacheLoading(false);
        } else {
          // No valid cache, wait for data to load
          if (!listingsLoading && !profileLoading) {
            // Data is loaded, save to cache
            saveDashboardToCache();
            setListingsCacheLoading(false);
            setProfileCacheLoading(false);
          }
        }
      } catch (err) {
        console.error('Error handling cache:', err);
        setListingsCacheLoading(false);
        setProfileCacheLoading(false);
      }
    };
    
    handleCacheLoading();
  }, [user, listingsLoading, profileLoading, loadDashboardFromCache, saveDashboardToCache]);
  
  // Enhance the refreshListings function with cache handling
  const enhancedRefreshListings = async () => {
    setLoadingMessage("Refreshing your data...");
    try {
      await refreshListings();
      saveDashboardToCache();
    } catch (err) {
      console.error('Error refreshing data:', err);
    }
  };

  const handleShare = (listingId: string) => {
    const url = `${window.location.origin}/listings/${listingId}`;
    
    // Try to use the Clipboard API with fallback
    try {
      navigator.clipboard.writeText(url).then(() => {
        toast({
          title: "Link copied!",
          description: "The listing URL has been copied to your clipboard.",
          duration: 3000,
        });
      }).catch(err => {
        console.error("Clipboard write failed:", err);
        // Fallback: Create a temporary input element
        fallbackCopyToClipboard(url);
      });
    } catch (err) {
      console.error("Clipboard API error:", err);
      // Fallback: Create a temporary input element
      fallbackCopyToClipboard(url);
    }
  };
  
  // Fallback method for copying to clipboard
  const fallbackCopyToClipboard = (text: string) => {
    try {
      // Create temporary input element
      const textArea = document.createElement("textarea");
      textArea.value = text;
      
      // Make the textarea out of viewport
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      
      // Select and copy
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        toast({
          title: "Link copied!",
          description: "The listing URL has been copied to your clipboard.",
          duration: 3000,
        });
      } else {
        toast({
          title: "Copy failed",
          description: "Please manually copy this URL: " + text,
          duration: 5000,
        });
      }
    } catch (err) {
      console.error("Fallback clipboard method failed:", err);
      toast({
        title: "Copy failed",
        description: "Please manually copy this URL: " + text,
        duration: 5000,
      });
    }
  };

  const handleViewListing = (listingId: string) => {
    router.push(`/listings/${listingId}`);
  };

  // Add a retry mechanism for initial data loading
  useEffect(() => {
    if (listingsError && (
      listingsError.includes('permission-denied') || 
      listingsError.includes('insufficient permissions')
    )) {
      // Wait for 2 seconds and try to refresh listings
      const timer = setTimeout(() => {
        if (user) {  // Only refresh if we have a user
          enhancedRefreshListings();
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [listingsError, user, enhancedRefreshListings]);
  
  // Initial data loading when the component mounts
  useEffect(() => {
    if (user) {
      // Load data from our cache system
      console.log('Loading dashboard data for user:', user.uid);
      
      // Set loading messages for better UX
      const loadSequence = async () => {
        setLoadingMessage("Loading your dashboard...");
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setLoadingMessage("Fetching your listings...");
        await new Promise(resolve => setTimeout(resolve, 300));
        
        setLoadingMessage("Loading premium features...");
        await new Promise(resolve => setTimeout(resolve, 400));
        
        // Refresh all data
        await enhancedRefreshListings();
      };
      
      loadSequence();
    }
  }, [user, enhancedRefreshListings]);
  
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
    // Improved game filtering with case-insensitive matching
    const matchesGameFilter = gameFilter === 'all' || 
      (listing.game && listing.game.toLowerCase() === gameFilter.toLowerCase()) ||
      (listing.game && gameFilter === 'mtg' && listing.game.toLowerCase().includes('magic')) ||
      (listing.game && gameFilter === 'yugioh' && (
        listing.game.toLowerCase().includes('yu-gi-oh') || 
        listing.game.toLowerCase().includes('yugioh')
      )) ||
      (listing.game && gameFilter === 'pokemon' && listing.game.toLowerCase().includes('pokemon')) ||
      (listing.game && gameFilter === 'onepiece' && listing.game.toLowerCase().includes('one piece')) ||
      (listing.game && gameFilter === 'lorcana' && listing.game.toLowerCase().includes('lorcana')) ||
      (listing.game && gameFilter === 'dbs' && (
        listing.game.toLowerCase().includes('dragon ball') || 
        listing.game.toLowerCase().includes('dbs')
      )) ||
      (listing.game && gameFilter === 'flesh-and-blood' && listing.game.toLowerCase().includes('flesh')) ||
      (listing.game && gameFilter === 'star-wars' && listing.game.toLowerCase().includes('star wars')) ||
      (listing.game && gameFilter === 'digimon' && listing.game.toLowerCase().includes('digimon'));
    
    // Improved search with case-insensitive matching
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = searchQuery === '' || 
      (listing.title && listing.title.toLowerCase().includes(searchLower)) ||
      (listing.description && listing.description.toLowerCase().includes(searchLower));
    
    return matchesGameFilter && matchesSearch;
  });

  // First filter active listings properly, then apply sorting and filtering
  const filteredActiveListings = properlyFilteredActiveListings.filter(listing => {
    // Improved game filtering with case-insensitive matching
    const matchesGameFilter = gameFilter === 'all' || 
      (listing.game && listing.game.toLowerCase() === gameFilter.toLowerCase()) ||
      (listing.game && gameFilter === 'mtg' && listing.game.toLowerCase().includes('magic')) ||
      (listing.game && gameFilter === 'yugioh' && (
        listing.game.toLowerCase().includes('yu-gi-oh') || 
        listing.game.toLowerCase().includes('yugioh')
      )) ||
      (listing.game && gameFilter === 'pokemon' && listing.game.toLowerCase().includes('pokemon')) ||
      (listing.game && gameFilter === 'onepiece' && listing.game.toLowerCase().includes('one piece')) ||
      (listing.game && gameFilter === 'lorcana' && listing.game.toLowerCase().includes('lorcana')) ||
      (listing.game && gameFilter === 'dbs' && (
        listing.game.toLowerCase().includes('dragon ball') || 
        listing.game.toLowerCase().includes('dbs')
      )) ||
      (listing.game && gameFilter === 'flesh-and-blood' && listing.game.toLowerCase().includes('flesh')) ||
      (listing.game && gameFilter === 'star-wars' && listing.game.toLowerCase().includes('star wars')) ||
      (listing.game && gameFilter === 'digimon' && listing.game.toLowerCase().includes('digimon'));
    
    // Improved search with case-insensitive matching
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = searchQuery === '' || 
      (listing.title && listing.title.toLowerCase().includes(searchLower)) ||
      (listing.description && listing.description.toLowerCase().includes(searchLower));
    
    return matchesGameFilter && matchesSearch;
  });

  // Then sort the filtered active listings
  const activeListings = [...filteredActiveListings].sort((a, b) => {
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
  
  // Debug logging for active listings
  useEffect(() => {
    console.log('Dashboard - All listings count:', allListings.length);
    console.log('Dashboard - Active listings count:', allListings.filter(l => l.status === 'active').length);
    console.log('Dashboard - Properly filtered active listings count:', properlyFilteredActiveListings.length);
    console.log('Dashboard - Filtered and sorted active listings count:', activeListings.length);
    console.log('Dashboard - Current filters:', {
      gameFilter,
      sortBy,
      sortOrder,
      searchQuery
    });
    
    // Log the first few listings for debugging
    if (allListings.length > 0) {
      console.log('Dashboard - Sample listing:', {
        id: allListings[0].id,
        title: allListings[0].title,
        status: allListings[0].status,
        createdAt: allListings[0].createdAt,
        expiresAt: allListings[0].expiresAt,
        game: allListings[0].game
      });
    }
  }, [allListings, properlyFilteredActiveListings, activeListings, gameFilter, sortBy, sortOrder, searchQuery]);
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
        
        // Update local state to immediately reflect the change
        // This ensures the listing moves from active to archived tab without requiring a refresh
        setListings(prevListings => 
          prevListings.map(listing => 
            listing.id === listingId 
              ? { 
                  ...listing, 
                  status: 'archived',
                  archivedAt: new Date(),
                } 
              : listing
          )
        );
        
        toast({
          title: "Listing archived",
          description: "The listing has been moved to your archived listings.",
          duration: 3000,
        });
      }
      
      // Clear any cached listings data to ensure fresh data
      if (user) {
        try {
          // Create cache keys for the user's listings
          const userListingsCacheKey = `listings_${user.uid}_all_none`;
          const activeListingsCacheKey = `listings_${user.uid}_active_none`;
          
          // Clear from localStorage to ensure fresh data
          localStorage.removeItem(userListingsCacheKey);
          localStorage.removeItem(activeListingsCacheKey);
          
          console.log('Cleared listings cache after archiving/deleting');
        } catch (cacheError) {
          console.error('Error clearing listings cache:', cacheError);
        }
      }
      
      // Refresh listings after successful deletion
      enhancedRefreshListings();
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

  // Effect to handle loading completion
  useEffect(() => {
    if (!loading && !showDashboard) {
      // Add a small delay to ensure all data is processed
      const timer = setTimeout(() => {
        setShowDashboard(true);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [loading, showDashboard]);
  
  // Handle loading with full-screen animation
  if (loading || !showDashboard) {
    return (
      <DashboardLayout>
        <DashboardLoadingScreen 
          isLoading={loading} 
          onLoadComplete={() => setShowDashboard(true)}
          message={loadingMessage}
        />
        <div className="opacity-0">
          {/* Preload content in hidden div to improve perceived performance */}
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || listingsCacheError || profileCacheError) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
            <p className="text-gray-600">{error || listingsCacheError?.message || profileCacheError?.message}</p>
            <div className="flex gap-4 justify-center mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  // Try to refresh the data
                  enhancedRefreshListings();
                }}
              >
                Try Again
              </Button>
              <Button
                onClick={() => router.push('/auth/sign-in')}
              >
                Return to Sign In
              </Button>
            </div>
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
      <FirebaseConnectionHandler>
        <DeleteListingDialog
          isOpen={dialogState.isOpen}
          onClose={() => setDialogState({ ...dialogState, isOpen: false })}
          onConfirm={() => {
            handleDeleteListing(dialogState.listingId, dialogState.mode);
            setDialogState({ ...dialogState, isOpen: false });
          }}
          mode={dialogState.mode}
        />
      
      {/* Show the listing visibility fixer if there are no active listings but there are listings in total */}
      {allListings.length > 0 && properlyFilteredActiveListings.length === 0 && (
        <div className="mb-6">
          <Alert variant="warning" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Active Listings Visible</AlertTitle>
            <AlertDescription>
              You have {allListings.length} total listings, but none are currently showing as active. 
              This could be due to expired listings, caching issues, or visibility problems.
              Use the tools below to diagnose and fix the issue.
            </AlertDescription>
          </Alert>
          
          <div className="p-4 border rounded-lg bg-card">
            <h3 className="text-lg font-medium mb-4">Listing Visibility Troubleshooter</h3>
            <ListingVisibilityFixer 
              onRefresh={refreshListings} 
              isLoading={loadingState} 
            />
          </div>
        </div>
      )}
      
      {/* Dashboard Header */}
      <div className="mb-8">
        <div className="flex items-start gap-8">
          {/* Use the new ProfileAvatar component for consistent avatar display */}
          <ProfileAvatar user={user} size="xl" />
          <div className="flex-1 pt-2">
            <div className="group cursor-pointer" onClick={() => router.push(`/profile/${user.uid}`)}>
              <h1 className="text-3xl font-bold tracking-tight hover:text-primary transition-colors">
                {/* Use the new ProfileName component for consistent name display */}
                <ProfileName user={user} />
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
                      {profile?.tier === 'premium' && (
                        <div className="flex justify-end mt-1">
                          <ViewCounter viewCount={listing.viewCount || 0} />
                        </div>
                      )}
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
          <ArchivedListings
            listings={previousListings}
            accountTier={profile?.tier || 'free'}
            onRestore={handleRestoreListing}
            onDelete={(listingId) => {
              setDialogState({
                isOpen: true,
                listingId,
                mode: 'permanent'
              });
            }}
            onView={handleViewListing}
          />
        </TabsContent>
      </Tabs>
      </FirebaseConnectionHandler>
    </DashboardLayout>
  );
};

// Use dynamic import with ssr disabled
export default dynamic(() => Promise.resolve(DashboardComponent), {
  ssr: false
});