import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Dashboard() {
  // Mock data for active listings
  const mockListings = [
    {
      id: 1,
      title: "Charizard Holo 1st Edition",
      price: "$1000",
      condition: "Near Mint",
      game: "Pokémon",
    },
    {
      id: 2,
      title: "Blue-Eyes White Dragon",
      price: "$500",
      condition: "Excellent",
      game: "Yu-Gi-Oh",
    },
    {
      id: 3,
      title: "Monkey D. Luffy Leader",
      price: "$50",
      condition: "Mint",
      game: "One Piece",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Active Listings</h1>
          <Button>+ New Listing</Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {mockListings.map((listing) => (
            <Card key={listing.id}>
              <CardHeader>
                <CardTitle className="text-xl">{listing.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-primary">
                    {listing.price}
                  </p>
                  <div className="text-sm text-muted-foreground">
                    <p>Condition: {listing.condition}</p>
                    <p>Game: {listing.game}</p>
                  </div>
                  <div className="flex space-x-2 mt-4">
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm">
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}