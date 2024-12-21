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
import dynamic from 'next/dynamic';

import { Listing } from '@/types/database';

const DashboardComponent = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { listings, loading: listingsLoading, error: listingsError, deleteListing } = useListings();
  
  const activeListings = listings.filter(listing => listing.status === 'active');
  const previousListings = listings.filter(listing => listing.status !== 'active');
  
  const loading = authLoading || listingsLoading;
  const { user, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { listings: allListings, loading: listingsLoading, error: listingsError, deleteListing } = useListings();
  
  const activeListings = allListings.filter(listing => listing.status === 'active');
  const previousListings = allListings.filter(listing => listing.status !== 'active');
  const [purchases, setPurchases] = useState<Purchase[]>([
    {
      id: '1',
      cardName: 'Blue-Eyes White Dragon',
      game: 'Yu-Gi-Oh',
      condition: 'Near Mint',
      price: 29.99,
      inquiries: 3,
      createdAt: '2024-01-15'
    },
    {
      id: '2',
      cardName: 'Charizard',
      game: 'Pokémon',
      condition: 'Lightly Played',
      price: 149.99,
      inquiries: 5,
      createdAt: '2024-01-14'
    }
  ]);

  const [previousListings, setPreviousListings] = useState<Listing[]>([
    {
      id: '3',
      cardName: 'Dark Magician',
      game: 'Yu-Gi-Oh',
      condition: 'Excellent',
      price: 19.99,
      inquiries: 2,
      createdAt: '2023-12-20'
    }
  ]);

  const [purchases, setPurchases] = useState<Purchase[]>([
    {
      id: '1',
      cardName: 'Black Lotus',
      seller: 'CardMaster123',
      condition: 'Good',
      price: 299.99,
      purchaseDate: '2024-01-10'
    }
  ]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (!loading) {
          if (!user) {
            await router.replace('/auth/sign-in');
          }
        }
      } catch (err) {
        console.error('Authentication error:', err);
        setError('Failed to authenticate. Please try again.');
      }
    };

    checkAuth();
  }, [user, loading, router]);

  const getConditionColor = (condition: string) => {
    switch (condition.toLowerCase()) {
      case 'near mint':
        return 'bg-green-100 text-green-800';
      case 'lightly played':
        return 'bg-yellow-100 text-yellow-800';
      case 'good':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleEditListing = (listingId: string) => {
    router.push('/dashboard/edit-listing/' + listingId);
  };

  const handleDeleteListing = (listingId: string) => {
    setActiveListings(activeListings.filter(listing => listing.id !== listingId));
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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-600">{error}</p>
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
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    <Star className="h-5 w-5 text-yellow-400 fill-current" />
                    <span className="ml-1 font-semibold">4.8</span>
                  </div>
                  <span className="text-sm text-muted-foreground">(24 reviews)</span>
                </div>
              </div>
              <div className="mt-4">
                <Badge variant="secondary">Verified Seller</Badge>
                <Badge variant="secondary" className="ml-2">Premium Member</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Section */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active Listings</TabsTrigger>
          <TabsTrigger value="previous">Previous Listings & Purchases</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeListings.map((listing) => (
              <Card key={listing.id}>
                <CardHeader>
                  <CardTitle>{listing.cardName}</CardTitle>
                  <CardDescription>{listing.game}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Badge className={getConditionColor(listing.condition)}>
                        {listing.condition}
                      </Badge>
                      <span className="font-bold">${listing.price}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <span>{listing.inquiries} inquiries</span>
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
                    <CardTitle>{listing.cardName}</CardTitle>
                    <CardDescription>{listing.game}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Badge className={getConditionColor(listing.condition)}>
                          {listing.condition}
                        </Badge>
                        <span className="font-bold">${listing.price}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Sold on {new Date(listing.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Your Purchases</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {purchases.map((purchase) => (
                <Card key={purchase.id}>
                  <CardHeader>
                    <CardTitle>{purchase.cardName}</CardTitle>
                    <CardDescription>Purchased from {purchase.seller}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Badge className={getConditionColor(purchase.condition)}>
                          {purchase.condition}
                        </Badge>
                        <span className="font-bold">${purchase.price}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Purchased on {new Date(purchase.purchaseDate).toLocaleDateString()}
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

export default dynamic(() => Promise.resolve(DashboardComponent), {
  ssr: false
});