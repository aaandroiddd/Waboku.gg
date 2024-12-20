import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Heart, Star, AlertCircle } from "lucide-react";

// Mock data interfaces
interface Listing {
  id: number;
  title: string;
  price: string;
  condition: string;
  game: string;
  inquiries?: number;
  status?: string;
  buyer?: string;
  date?: string;
}

interface Message {
  id: number;
  sender: string;
  listing: string;
  preview: string;
  date: string;
  unread: boolean;
}

export default function Dashboard() {
  // Mock data for active listings
  const activeListings: Listing[] = [
    {
      id: 1,
      title: "Charizard Holo 1st Edition",
      price: "$1000",
      condition: "Near Mint",
      game: "Pokémon",
      inquiries: 5,
    },
    {
      id: 2,
      title: "Blue-Eyes White Dragon",
      price: "$500",
      condition: "Excellent",
      game: "Yu-Gi-Oh",
      inquiries: 3,
    },
    {
      id: 3,
      title: "Monkey D. Luffy Leader",
      price: "$50",
      condition: "Mint",
      game: "One Piece",
      inquiries: 1,
    },
  ];

  // Mock data for previous listings
  const previousListings: Listing[] = [
    {
      id: 4,
      title: "Dark Magician",
      price: "$300",
      condition: "Good",
      game: "Yu-Gi-Oh",
      status: "Sold",
      buyer: "JohnDoe",
      date: "2024-01-15",
    },
  ];

  // Mock data for purchases
  const purchases: Listing[] = [
    {
      id: 5,
      title: "Pikachu Illustrator",
      price: "$200",
      condition: "Excellent",
      game: "Pokémon",
      status: "Delivered",
      date: "2024-01-10",
    },
  ];

  // Mock data for messages
  const messages: Message[] = [
    {
      id: 1,
      sender: "CardCollector123",
      listing: "Charizard Holo 1st Edition",
      preview: "Is this still available? I'm interested in...",
      date: "2024-01-20",
      unread: true,
    },
  ];

  // Mock data for favorites
  const favorites: Listing[] = [
    {
      id: 6,
      title: "Ancient Dragon",
      price: "$750",
      condition: "Near Mint",
      game: "Yu-Gi-Oh",
    },
  ];

  const getConditionColor = (condition: string) => {
    const colors: { [key: string]: string } = {
      "Mint": "bg-green-500",
      "Near Mint": "bg-emerald-500",
      "Excellent": "bg-blue-500",
      "Good": "bg-yellow-500",
      "Poor": "bg-red-500",
    };
    return colors[condition] || "bg-gray-500";
  };

  const ListingCard = ({ listing }: { listing: Listing }) => (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl">{listing.title}</CardTitle>
          <Badge variant="outline">{listing.game}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-2xl font-bold text-primary">{listing.price}</p>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${getConditionColor(listing.condition)}`} />
            <span className="text-sm text-muted-foreground">{listing.condition}</span>
          </div>
          {listing.inquiries && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageCircle size={16} />
              <span>{listing.inquiries} inquiries</span>
            </div>
          )}
          {listing.buyer && (
            <div className="text-sm text-muted-foreground">
              <p>Sold to: {listing.buyer}</p>
              <p>Date: {listing.date}</p>
            </div>
          )}
          <div className="flex space-x-2 mt-4">
            {!listing.status && (
              <>
                <Button variant="outline" size="sm">Edit</Button>
                <Button variant="outline" size="sm">Mark as Sold</Button>
                <Button variant="destructive" size="sm">Delete</Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const MessageCard = ({ message }: { message: Message }) => (
    <Card className={`hover:shadow-lg transition-shadow ${message.unread ? 'border-primary' : ''}`}>
      <CardContent className="pt-6">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold">{message.sender}</h3>
          <Badge variant="outline">{message.date}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-2">Re: {message.listing}</p>
        <p className="text-sm">{message.preview}</p>
        <div className="flex justify-end mt-4">
          <Button size="sm">View Conversation</Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Button>+ New Listing</Button>
        </div>

        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active">Active Listings</TabsTrigger>
            <TabsTrigger value="previous">Previous Listings & Purchases</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="favorites">Favorites</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {activeListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="previous" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Previous Sales</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {previousListings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-4">Your Purchases</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {purchases.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="messages" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {messages.map((message) => (
                <MessageCard key={message.id} message={message} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="favorites" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {favorites.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}