import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Edit2, Trash2, MessageCircle } from "lucide-react";
import { useListings } from '@/hooks/useListings';
import { Listing } from '@/types/database';

const DashboardPage = () => {
  const { tab = 'active', new: newListingId } = useRouter().query;
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { listings, loading: listingsLoading, error: listingsError, deleteListing, refreshListings } = useListings();
  
  const loading = authLoading || listingsLoading;

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
  }, [listingsError, user]);
  
  const sortedListings = [...listings].sort((a, b) => {
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

  const getConditionColor = (condition: string) => {
    switch (condition.toLowerCase()) {
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
      await deleteListing(listingId);
    } catch (err) {
      console.error('Error deleting listing:', err);
    }
  };

  const handleMessage = (listingId: string) => {
    router.push('/dashboard/messages?listing=' + listingId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || listingsError) {
    return (
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
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      {/* User Profile Section */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={user.photoURL || ''} />
              <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{user.displayName || 'User'}</h2>
                  <p className="text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <div className="mt-4">
                <Badge variant="secondary">Verified Seller</Badge>
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
              <Card key={listing.id}>
                <CardHeader>
                  <CardTitle>{listing.title}</CardTitle>
                  <CardDescription>{listing.game}</CardDescription>
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
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditListing(listing.id)}
                      >
                        <Edit2 className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => handleDeleteListing(listing.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMessage(listing.id)}
                      >
                        <MessageCircle className="h-4 w-4 mr-1" />
                        Messages
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
                <Card key={listing.id}>
                  <CardHeader>
                    <CardTitle>{listing.title}</CardTitle>
                    <CardDescription>{listing.game}</CardDescription>
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

export default DashboardPage;