import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { VerificationStatus } from '@/components/VerificationStatus';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Star, Edit2, Trash2, MessageCircle, Share2, ExternalLink } from "lucide-react";
import { useListings } from '@/hooks/useListings';
import { useProfile } from '@/hooks/useProfile';
import { Listing } from '@/types/database';

const DashboardComponent = () => {
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
  const { listings, loading: listingsLoading, error: listingsError, refreshListings, updateListingStatus } = useListings({ userId: user?.uid });
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
  
  const sortedListings = [...(listings || [])].sort((a, b) => {
    const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
    const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
    return dateB.getTime() - dateA.getTime();
  });
  
  const activeListings = sortedListings.filter(listing => listing.status === 'active');
  const previousListings = sortedListings.filter(listing => listing.status !== 'active');

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

  const handleDeleteListing = async (listingId: string) => {
    try {
      await updateListingStatus(listingId, 'inactive');
      toast({
        title: "Listing deactivated",
        description: "The listing has been moved to your previous listings.",
        duration: 3000,
      });
    } catch (err: any) {
      console.error('Error deactivating listing:', err);
      toast({
        title: "Error",
        description: err.message || "Failed to deactivate listing",
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
      {/* User Profile Section */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'User avatar'} />
              <AvatarFallback>{user.email ? user.email.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="group cursor-pointer max-w-full" onClick={() => router.push(`/profile/${user.uid}`)}>
                    <div className="relative">
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold hover:text-primary transition-colors truncate">
                          {user.displayName || profile?.username || 'User'}
                        </h2>
                      </div>
                      <p className="text-muted-foreground hover:text-primary transition-colors truncate max-w-[300px]">
                        {user.email}
                      </p>
                      <div className="absolute invisible group-hover:visible bg-popover text-popover-foreground px-3 py-2 rounded-md text-sm -bottom-2 left-1/2 transform -translate-x-1/2 translate-y-full whitespace-nowrap shadow-md">
                        Click to view your profile
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Section */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active Listings</TabsTrigger>
          <TabsTrigger value="previous">Previous Listings</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
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
                        Delete
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
        </TabsContent>

        <TabsContent value="previous" className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Previous Listings</h3>
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