import React from "react";
import Head from "next/head";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Star,
  Edit2,
  Archive,
  ShoppingCart,
  MapPin,
  Mail,
} from "lucide-react";

// Mock data for demonstration
const mockUser = {
  name: "John Doe",
  email: "john.doe@example.com",
  location: "New York, USA",
  rating: 4.8,
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=John",
};

const mockActiveListings = [
  {
    id: 1,
    cardName: "Blue-Eyes White Dragon",
    game: "Yu-Gi-Oh",
    condition: "Near Mint",
    price: 149.99,
    inquiries: 5,
  },
  {
    id: 2,
    cardName: "Charizard VMAX",
    game: "Pokémon",
    condition: "Excellent",
    price: 299.99,
    inquiries: 8,
  },
];

const mockPreviousListings = [
  {
    id: 1,
    cardName: "Dark Magician",
    game: "Yu-Gi-Oh",
    price: 89.99,
    buyerRating: 5,
    date: "2023-12-15",
  },
];

const mockPurchases = [
  {
    id: 1,
    cardName: "Ancient Mew",
    game: "Pokémon",
    price: 199.99,
    seller: "CardMaster",
    condition: "Mint",
    date: "2023-12-10",
  },
];

export default function Home() {
  return (
    <>
      <Head>
        <title>Waboku.gg Dashboard</title>
        <meta name="description" content="Waboku.gg User Dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="bg-background min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-6">
          {/* User Profile Section */}
          <div className="mb-8">
            <Card className="bg-card">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={mockUser.avatar} />
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-2xl font-bold">{mockUser.name}</h2>
                        <div className="flex items-center gap-2 text-muted-foreground mt-1">
                          <Mail className="w-4 h-4" />
                          <span>{mockUser.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          <span>{mockUser.location}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-secondary p-3 rounded-lg">
                        <Star className="w-5 h-5 text-yellow-500" />
                        <span className="font-semibold">{mockUser.rating}</span>
                        <span className="text-muted-foreground">Rating</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Dashboard Tabs */}
          <Tabs defaultValue="active" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="active">Active Listings</TabsTrigger>
              <TabsTrigger value="previous">Previous Listings & Purchases</TabsTrigger>
            </TabsList>

            {/* Active Listings Tab */}
            <TabsContent value="active">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {mockActiveListings.map((listing) => (
                  <Card key={listing.id}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{listing.cardName}</CardTitle>
                          <Badge variant="secondary" className="mt-2">
                            {listing.game}
                          </Badge>
                        </div>
                        <Badge 
                          variant="outline" 
                          className="bg-green-500/10 text-green-500 border-green-500/20"
                        >
                          {listing.condition}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-2xl font-bold">${listing.price}</span>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{listing.inquiries} inquiries</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button className="flex-1" variant="outline">
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button className="flex-1" variant="outline">
                          <Archive className="w-4 h-4 mr-2" />
                          Mark Sold
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Previous Listings & Purchases Tab */}
            <TabsContent value="previous">
              <div className="grid gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Previous Sales</h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {mockPreviousListings.map((listing) => (
                      <Card key={listing.id}>
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h4 className="font-semibold">{listing.cardName}</h4>
                              <Badge variant="secondary" className="mt-2">
                                {listing.game}
                              </Badge>
                            </div>
                            <span className="text-lg font-bold">${listing.price}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>{listing.date}</span>
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 text-yellow-500" />
                              <span>{listing.buyerRating}</span>
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
                    {mockPurchases.map((purchase) => (
                      <Card key={purchase.id}>
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h4 className="font-semibold">{purchase.cardName}</h4>
                              <Badge variant="secondary" className="mt-2">
                                {purchase.game}
                              </Badge>
                            </div>
                            <span className="text-lg font-bold">${purchase.price}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <div className="flex justify-between mb-1">
                              <span>Seller:</span>
                              <span>{purchase.seller}</span>
                            </div>
                            <div className="flex justify-between mb-1">
                              <span>Condition:</span>
                              <span>{purchase.condition}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Date:</span>
                              <span>{purchase.date}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </>
  );
}