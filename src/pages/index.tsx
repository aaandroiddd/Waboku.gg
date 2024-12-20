import React, { useState } from "react";
import Head from "next/head";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Star } from "lucide-react";
import Link from "next/link";

// Mock data for featured listings
const featuredListings = [
  {
    id: 1,
    cardName: "Blue-Eyes White Dragon",
    game: "Yu-Gi-Oh",
    condition: "Near Mint",
    price: 149.99,
    location: "New York, NY",
    seller: "CardMaster",
    rating: 4.8,
  },
  {
    id: 2,
    cardName: "Charizard VMAX",
    game: "Pokémon",
    condition: "Excellent",
    price: 299.99,
    location: "Los Angeles, CA",
    seller: "PokéCollector",
    rating: 4.9,
  },
  {
    id: 3,
    cardName: "Monkey D. Luffy",
    game: "One Piece",
    condition: "Mint",
    price: 89.99,
    location: "Miami, FL",
    seller: "OnePieceTrader",
    rating: 4.7,
  },
];

// US States for location filter
const usStates = [
  { value: "all", label: "All Locations" },
  { value: "ny", label: "New York" },
  { value: "ca", label: "California" },
  { value: "fl", label: "Florida" },
  { value: "tx", label: "Texas" },
];

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState("all");

  return (
    <>
      <Head>
        <title>Waboku.gg - Local Trading Card Game Marketplace</title>
        <meta
          name="description"
          content="Buy, sell, and trade TCG cards locally with confidence"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="bg-background min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          {/* Hero Section */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-blue-400/10 to-blue-600/10" />
            <div className="relative container mx-auto px-4 py-16 md:py-24">
              <div className="text-center max-w-3xl mx-auto">
                <h1 className="text-4xl md:text-6xl font-bold mb-4">
                  Your Local TCG Marketplace
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground mb-8">
                  Buy, sell, and trade cards with collectors in your area
                </p>

                {/* CTA Buttons */}
                <div className="flex justify-center gap-4 mb-12">
                  <Link href="/auth/sign-up">
                    <Button size="lg" className="bg-sky-400 hover:bg-sky-500">
                      Get Started
                    </Button>
                  </Link>
                  <Link href="/auth/sign-in">
                    <Button size="lg" variant="outline">
                      Sign In
                    </Button>
                  </Link>
                </div>

                {/* Search Section */}
                <div className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <Input
                      type="text"
                      placeholder="Search for cards..."
                      className="pl-10 h-12"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Select value={selectedState} onValueChange={setSelectedState}>
                    <SelectTrigger className="w-full md:w-[200px] h-12">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {usStates.map((state) => (
                        <SelectItem key={state.value} value={state.value}>
                          {state.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button className="h-12 px-8" size="lg">
                    Search
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Featured Listings Section */}
          <section className="container mx-auto px-4 py-12">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold">Featured Listings</h2>
              <Link href="/auth/sign-in">
                <Button variant="outline">View All</Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredListings.map((listing) => (
                <Card
                  key={listing.id}
                  className="overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg mb-2">
                          {listing.cardName}
                        </h3>
                        <Badge variant="secondary" className="mb-2">
                          {listing.game}
                        </Badge>
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <MapPin className="w-4 h-4" />
                          <span>{listing.location}</span>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="bg-green-500/10 text-green-500 border-green-500/20"
                      >
                        {listing.condition}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">
                          Seller: {listing.seller}
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="font-medium">{listing.rating}</span>
                        </div>
                      </div>
                      <div className="text-2xl font-bold">${listing.price}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Membership Section */}
          <section className="container mx-auto px-4 py-12">
            <h2 className="text-2xl font-bold text-center mb-8">
              Choose Your Plan
            </h2>
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <Card className="p-6">
                <h3 className="text-xl font-bold mb-4">Free Account</h3>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    Up to 2 active listings
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    Basic search features
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    Message other users
                  </li>
                </ul>
                <Link href="/auth/sign-up">
                  <Button className="w-full" variant="outline">
                    Get Started
                  </Button>
                </Link>
              </Card>
              <Card className="p-6 relative overflow-hidden border-sky-400">
                <div className="absolute top-0 right-0 bg-sky-400 text-white px-4 py-1 rounded-bl">
                  Popular
                </div>
                <h3 className="text-xl font-bold mb-4">Premium Account</h3>
                <div className="text-2xl font-bold mb-4">
                  $5
                  <span className="text-base font-normal text-muted-foreground">
                    /month
                  </span>
                </div>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    Unlimited active listings
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    Priority support
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    Advanced search filters
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    Featured listings
                  </li>
                </ul>
                <Link href="/auth/sign-up">
                  <Button className="w-full bg-sky-400 hover:bg-sky-500">
                    Start Premium
                  </Button>
                </Link>
              </Card>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}