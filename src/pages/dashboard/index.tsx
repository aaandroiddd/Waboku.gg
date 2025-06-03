import dynamic from 'next/dynamic';
import type { NextPage } from 'next';
import { useEffect, useState, useCallback } from 'react';
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
import { AdvancedTools } from "@/components/dashboard/AdvancedTools";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ProfileName } from "@/components/ProfileName";
import { Star, Edit2, Trash2, MessageCircle, Share2, ExternalLink, AlertCircle, RefreshCw } from "lucide-react";
import { ListingTimer } from "@/components/ListingTimer";
import { ListingList } from "@/components/ListingList";
import { DeleteListingDialog } from "@/components/DeleteListingDialog";
import { ListingsSearchBar } from "@/components/ListingsSearchBar";
import { WantedPostsSection } from "@/components/dashboard/WantedPostsSection";
import { WantedPostsDebugger } from "@/components/dashboard/WantedPostsDebugger";
import { useOptimizedListings } from '@/hooks/useOptimizedListings';
import { useProfile } from '@/hooks/useProfile';
import { useListingVisibility } from '@/hooks/useListingVisibility';
import { Listing } from '@/types/database';
import { ContentLoader } from '@/components/ContentLoader';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyStateCard } from '@/components/EmptyStateCard';
import { ArchivedListings } from '@/components/ArchivedListings';
import { FirebaseConnectionHandler } from '@/components/FirebaseConnectionHandler';
import { useLoading } from '@/hooks/useLoading';
import { ViewCounter } from '@/components/ViewCounter';
import { useDashboardListingsCache } from '@/hooks/useDashboardCache';
import { getListingUrl, getProfileUrl } from '@/lib/listing-slug';

const DashboardComponent = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'date' | 'price' | 'title'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [gameFilter, setGameFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [refreshLoading, setRefreshLoading] = useState<boolean>(false);
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    listingId: string;
    mode: 'deactivate' | 'permanent';
  }>({
    isOpen: false,
    listingId: '',
    mode: 'deactivate'
  });
  
  // Get cached dashboard data
  const { user, loading: authLoading } = useAuth();
  const { 
    cachedListings,
    saveListingsToCache,
    clearListingsCache
  } = useDashboardListingsCache({ 
    userId: user?.uid 
  });

  const { toast } = useToast();
  const router = useRouter();
  const { tab = 'active', new: newListingId } = router.query;
  const [error, setError] = useState<string | null>(null);
  
  // Always fetch fresh data, but use cache for immediate display
  const { listings: fetchedListings, setListings, loading: listingsLoading, error: listingsError, refreshListings, updateListingStatus, permanentlyDeleteListing } = useOptimizedListings({ 
    userId: user?.uid,
    showOnlyActive: false,
    skipInitialFetch: false // Always fetch fresh data
  });
  
  // Use fetched listings as the primary source, with cached listings as fallback only during loading
  const allListings = fetchedListings.length > 0 ? fetchedListings : (listingsLoading && cachedListings ? cachedListings : fetchedListings);
  
  // Update cache when new listings are fetched
  useEffect(() => {
    if (fetchedListings && fetchedListings.length >= 0 && user) { // Changed to >= 0 to cache even empty arrays
      saveListingsToCache(fetchedListings);
    }
  }, [fetchedListings, user, saveListingsToCache]);
  
  const { profile, loading: profileLoading } = useProfile(user?.uid || null);
  
  // Use the listing visibility hook to properly filter active listings
  const { visibleListings: properlyFilteredActiveListings } = useListingVisibility(
    allListings.filter(listing => listing.status === 'active')
  );
  
  const { isLoading: loadingState } = useLoading();
  // Ensure loading state is true until all data is properly loaded
  const loading = authLoading || listingsLoading || profileLoading || loadingState;

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
                })(),
                // Clear archive-related fields
                originalCreatedAt: null,
                previousStatus: null,
                previousExpiresAt: null
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
      refreshListings();
      
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

  const handleShare = (listingId: string) => {
    // Find the listing to get its details for the new URL format
    const listing = allListings.find(l => l.id === listingId);
    let url: string;
    
    if (listing) {
      // Use the new URL format
      const listingUrl = getListingUrl(listing);
      url = `${window.location.origin}${listingUrl}`;
    } else {
      // Fallback to old format if listing not found
      url = `${window.location.origin}/listings/${listingId}`;
    }
    
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
    // Find the listing to get its details for the new URL format
    const listing = allListings.find(l => l.id === listingId);
    
    if (listing) {
      // Use the new URL format
      const listingUrl = getListingUrl(listing);
      router.push(listingUrl);
    } else {
      // Fallback to old format if listing not found
      router.push(`/listings/${listingId}`);
    }
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
  
  // Track previous auth state to detect login events
  const [prevAuthState, setPrevAuthState] = useState<{
    isLoggedIn: boolean;
    userId: string | null;
  }>({
    isLoggedIn: false,
    userId: null
  });
  
  // Force refresh listings when the component mounts or when the user logs in
  useEffect(() => {
    // Check if this is a new login (user changed from null to a value)
    const isNewLogin = user && (!prevAuthState.isLoggedIn || prevAuthState.userId !== user.uid);
    
    // Update previous auth state
    if (user !== null && (user?.uid !== prevAuthState.userId || !prevAuthState.isLoggedIn)) {
      setPrevAuthState({
        isLoggedIn: true,
        userId: user.uid
      });
    } else if (user === null && prevAuthState.isLoggedIn) {
      setPrevAuthState({
        isLoggedIn: false,
        userId: null
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
        
        // If this is a new login, log it and force a refresh
        if (isNewLogin) {
          console.log('User logged in, clearing listings cache and forcing refresh');
          
          // Clear dashboard cache as well
          clearListingsCache();
          
          // Small delay to ensure auth is fully established
          setTimeout(() => {
            refreshListings();
          }, 500);
        } else {
          console.log('Cleared listings cache on dashboard mount');
          refreshListings();
        }
      } catch (cacheError) {
        console.error('Error clearing listings cache:', cacheError);
      }
    }
  }, [user, prevAuthState.isLoggedIn, prevAuthState.userId, clearListingsCache, refreshListings]);
  
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
      // Enhanced debugging for the first listing
      const sampleListing = allListings[0];
      
      // Parse dates for better debugging
      let parsedCreatedAt = "unknown";
      let parsedExpiresAt = "unknown";
      
      try {
        if (sampleListing.createdAt instanceof Date) {
          parsedCreatedAt = sampleListing.createdAt.toISOString();
        } else if (typeof sampleListing.createdAt === 'object' && sampleListing.createdAt) {
          if ('toDate' in sampleListing.createdAt && typeof sampleListing.createdAt.toDate === 'function') {
            parsedCreatedAt = sampleListing.createdAt.toDate().toISOString();
          } else if ('seconds' in sampleListing.createdAt) {
            parsedCreatedAt = new Date(sampleListing.createdAt.seconds * 1000).toISOString();
          } else if ('_seconds' in sampleListing.createdAt) {
            parsedCreatedAt = new Date(sampleListing.createdAt._seconds * 1000).toISOString();
          }
        }
      } catch (e) {
        parsedCreatedAt = `Error parsing: ${e.message}`;
      }
      
      try {
        if (sampleListing.expiresAt instanceof Date) {
          parsedExpiresAt = sampleListing.expiresAt.toISOString();
        } else if (typeof sampleListing.expiresAt === 'object' && sampleListing.expiresAt) {
          if ('toDate' in sampleListing.expiresAt && typeof sampleListing.expiresAt.toDate === 'function') {
            parsedExpiresAt = sampleListing.expiresAt.toDate().toISOString();
          } else if ('seconds' in sampleListing.expiresAt) {
            parsedExpiresAt = new Date(sampleListing.expiresAt.seconds * 1000).toISOString();
          } else if ('_seconds' in sampleListing.expiresAt) {
            parsedExpiresAt = new Date(sampleListing.expiresAt._seconds * 1000).toISOString();
          }
        }
      } catch (e) {
        parsedExpiresAt = `Error parsing: ${e.message}`;
      }
      
      // Calculate if the listing should be expired
      const now = new Date();
      const tierDuration = (sampleListing.accountTier === 'premium' ? 720 : 48) * 60 * 60 * 1000;
      let isExpiredByCalculation = false;
      
      try {
        const createdAtDate = new Date(parsedCreatedAt);
        const calculatedExpiry = new Date(createdAtDate.getTime() + tierDuration);
        isExpiredByCalculation = now > calculatedExpiry;
      } catch (e) {
        console.error('Error calculating expiration:', e);
      }
      
      console.log('Dashboard - Sample listing:', {
        id: sampleListing.id,
        title: sampleListing.title,
        status: sampleListing.status,
        createdAt: {
          raw: sampleListing.createdAt,
          parsed: parsedCreatedAt
        },
        expiresAt: {
          raw: sampleListing.expiresAt,
          parsed: parsedExpiresAt
        },
        accountTier: sampleListing.accountTier,
        tierDuration: `${tierDuration / (60 * 60 * 1000)} hours`,
        currentTime: now.toISOString(),
        isExpiredByCalculation,
        game: sampleListing.game
      });
    }
  }, [allListings, properlyFilteredActiveListings, activeListings, gameFilter, sortBy, sortOrder, searchQuery]);
  // Filter for archived listings specifically - ensure we're explicitly checking for 'archived' status
  const archivedListings = allListings.filter(listing => listing.status === 'archived');

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
        const now = new Date();
        setListings(prevListings => 
          prevListings.map(listing => 
            listing.id === listingId 
              ? { 
                  ...listing, 
                  status: 'archived',
                  archivedAt: now,
                  // Store the original status and expiration for potential restoration
                  previousStatus: listing.status,
                  previousExpiresAt: listing.expiresAt,
                  // Set a 7-day expiration for archived listings
                  expiresAt: (() => {
                    const archiveExpiration = new Date(now);
                    archiveExpiration.setDate(archiveExpiration.getDate() + 7);
                    return archiveExpiration;
                  })()
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
  
  // Function to handle manual refresh of listings
  const handleRefreshListings = useCallback(async () => {
    try {
      setRefreshLoading(true);
      toast({
        title: "Refreshing listings...",
        description: "Getting the latest data from Firebase",
        duration: 2000,
      });
      
      await refreshListings();
      
      toast({
        title: "Listings refreshed",
        description: "Your listings have been updated with the latest data",
        duration: 3000,
      });
    } catch (err: any) {
      console.error('Error refreshing listings:', err);
      toast({
        title: "Error",
        description: err.message || "Failed to refresh listings",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setRefreshLoading(false);
    }
  }, [refreshListings, toast]);
  
  // Auto-refresh listings every 5 minutes
  useEffect(() => {
    if (!user) return;
    
    const autoRefreshInterval = setInterval(() => {
      console.log('Auto-refreshing listings...');
      refreshListings().catch(err => {
        console.error('Error during auto-refresh:', err);
      });
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => clearInterval(autoRefreshInterval);
  }, [user, refreshListings]);

  // No need to show DashboardLoadingScreen here as it's already handled in DashboardLayout for the main dashboard page
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <LoadingAnimation size="60" color="var(--theme-primary, #000)" />
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
      
      {/* Show a simplified message if there are no active listings but there are listings in total */}
      {allListings.length > 0 && properlyFilteredActiveListings.length === 0 && (
        <div className="mb-6">
          <Alert variant="warning" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Active Listings Visible</AlertTitle>
            <AlertDescription>
              You have {allListings.length} total listings, but none are currently showing as active. 
              This could be due to expired listings or listings set to "offers only".
              Try refreshing your listings or creating a new listing.
            </AlertDescription>
          </Alert>
          
          <div className="flex justify-end">
            <Button 
              variant="outline" 
              onClick={handleRefreshListings} 
              disabled={refreshLoading}
              className="mr-2"
            >
              {refreshLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Listings
                </>
              )}
            </Button>
            
            <Button onClick={() => router.push('/dashboard/create-listing')}>
              Create New Listing
            </Button>
          </div>
        </div>
      )}
      

      
      {/* Dashboard Header */}
      <div className="mb-8">
        <div className="flex items-start gap-8">
          {/* Use the new ProfileAvatar component for consistent avatar display */}
          <ProfileAvatar user={user} size="xl" />
          <div className="flex-1 pt-2">
            <div className="group cursor-pointer" onClick={() => router.push(getProfileUrl({ uid: user.uid, username: profile?.username }))}>
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
        <TabsList className="w-full flex flex-wrap">
          <TabsTrigger value="active" className="flex-1 min-w-[150px]">Active Listings ({activeListings.length})</TabsTrigger>
          <TabsTrigger value="previous" className="flex-1 min-w-[150px]">Archived Listings ({archivedListings.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <div className="flex flex-col gap-4 mb-4">
            {/* View Mode Controls and Filtering/Sorting Controls - All aligned in one row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* View Mode Controls */}
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                className="h-9 w-[60px]"
                onClick={() => setViewMode('grid')}
              >
                Grid
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                className="h-9 w-[60px]"
                onClick={() => setViewMode('list')}
              >
                List
              </Button>
              
              {/* Date/Price/Title Sorting */}
              <select
                className="border rounded-md px-2 py-1 bg-background text-foreground h-9 w-[80px]"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'price' | 'title')}
              >
                <option value="date">Date</option>
                <option value="price">Price</option>
                <option value="title">Title</option>
              </select>
              
              {/* Ascending/Descending Button */}
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </Button>
              
              {/* Game Categories Filter - On same line for desktop, below for mobile */}
              <div className="hidden md:block md:w-[300px]">
                <Select value={gameFilter} onValueChange={setGameFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Games" />
                  </SelectTrigger>
                  <SelectContent className="min-w-[300px]">
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
              </div>
              
              {/* Refresh button moved to the right on the same row */}
              <div className="flex-1 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-9"
                  onClick={handleRefreshListings}
                  disabled={refreshLoading}
                  title="Refresh listings"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
            
            {/* Game Categories Filter - Only visible on mobile */}
            <div className="md:hidden w-full">
              <Select value={gameFilter} onValueChange={setGameFilter}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="All Games" />
                </SelectTrigger>
                <SelectContent className="min-w-[300px]">
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
            </div>
            
            {/* Search Bar - Full width on mobile */}
            <div className="w-full">
              <ListingsSearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                onSearch={() => {}} // Empty function since we're handling search directly
                placeholder="Search your listings..."
              />
            </div>
          </div>
          
          {refreshLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <LoadingAnimation size="80" color="currentColor" className="text-primary" />
              <p className="mt-4 text-muted-foreground">Refreshing your listings...</p>
            </div>
          ) : viewMode === 'list' ? (
            <ListingList
              listings={activeListings}
              onEdit={handleEditListing}
              onDelete={handleDeleteListing}
              onMessage={handleMessage}
              onView={handleViewListing}
              onShare={handleShare}
            />
          ) : activeListings.length === 0 ? (
            <Card className="p-6 text-center">
              <h3 className="text-lg font-medium mb-2">No active listings</h3>
              <p className="text-muted-foreground mb-4">
                Active listings are cards or items you're currently selling. They'll appear here for other users to find and purchase.
              </p>
              <p className="text-sm text-muted-foreground">
                To create a new listing, click the "Create Listing" button in the sidebar.
              </p>
            </Card>
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
          {refreshLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <LoadingAnimation size="80" color="currentColor" className="text-primary" />
              <p className="mt-4 text-muted-foreground">Refreshing your archived listings...</p>
            </div>
          ) : (
            <ArchivedListings
              listings={archivedListings}
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
          )}
        </TabsContent>
      </Tabs>
      
      {/* Advanced Tools Section */}
      <AdvancedTools />
      </FirebaseConnectionHandler>
    </DashboardLayout>
  );
};

// Use dynamic import with ssr disabled
export default dynamic(() => Promise.resolve(DashboardComponent), {
  ssr: false
});