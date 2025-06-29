import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Database, Trash2, AlertTriangle } from "lucide-react";

interface MockListingGeneratorProps {
  adminSecret: string;
}

const AVAILABLE_GAMES = [
  { id: 'pokemon', label: 'Pokemon TCG', description: 'Classic Pokemon cards including Charizard, Pikachu, etc.' },
  { id: 'yugioh', label: 'Yu-Gi-Oh!', description: 'Popular Yu-Gi-Oh cards like Blue-Eyes White Dragon, Dark Magician' },
  { id: 'mtg', label: 'Magic: The Gathering', description: 'Iconic MTG cards including Black Lotus, Lightning Bolt' },
  { id: 'onepiece', label: 'One Piece TCG', description: 'One Piece cards featuring Luffy, Zoro, and other characters' },
  { id: 'dbs', label: 'Dragon Ball Super', description: 'Dragon Ball Super cards with Goku, Vegeta, and more' },
  { id: 'lorcana', label: 'Disney Lorcana', description: 'Disney Lorcana cards with Mickey Mouse, Elsa, and Disney characters' }
];

export function MockListingGenerator({ adminSecret }: MockListingGeneratorProps) {
  const [count, setCount] = useState<number>(10);
  const [selectedGames, setSelectedGames] = useState<string[]>(['pokemon']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [mockListingsCount, setMockListingsCount] = useState<number>(0);
  const { toast } = useToast();

  const handleGameToggle = (gameId: string) => {
    setSelectedGames(prev => {
      if (prev.includes(gameId)) {
        return prev.filter(id => id !== gameId);
      } else {
        return [...prev, gameId];
      }
    });
  };

  const fetchMockListingsCount = async () => {
    try {
      const response = await fetch('/api/admin/get-mock-listings-count', {
        method: 'GET',
        headers: {
          'x-admin-secret': adminSecret
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMockListingsCount(data.count || 0);
      }
    } catch (error) {
      console.error('Error fetching mock listings count:', error);
    }
  };

  const handleGenerate = async () => {
    if (selectedGames.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one game",
        variant: "destructive"
      });
      return;
    }

    if (count < 1 || count > 100) {
      toast({
        title: "Error",
        description: "Count must be between 1 and 100",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    setLastResult(null);

    try {
      const response = await fetch('/api/admin/create-mock-listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret
        },
        body: JSON.stringify({
          count,
          games: selectedGames
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create mock listings');
      }

      setLastResult(data);
      fetchMockListingsCount(); // Update count after generation
      toast({
        title: "Success!",
        description: `Successfully created ${count} mock listings`,
      });

    } catch (error: any) {
      console.error('Error generating mock listings:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to generate mock listings',
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteMockListings = async () => {
    if (mockListingsCount === 0) {
      toast({
        title: "Info",
        description: "No mock listings found to delete",
      });
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch('/api/admin/delete-mock-listings', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete mock listings');
      }

      setMockListingsCount(0);
      setLastResult(null);
      toast({
        title: "Success!",
        description: `Successfully deleted ${data.deletedCount} mock listings`,
      });

    } catch (error: any) {
      console.error('Error deleting mock listings:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to delete mock listings',
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Fetch mock listings count on component mount
  useEffect(() => {
    fetchMockListingsCount();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Mock Listing Generator
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                Mock Listings: {mockListingsCount}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription>
              This tool creates realistic mock listings for testing the pagination system and marketplace functionality. 
              Mock listings include realistic card data, prices, conditions, and locations. All mock listings are tagged with a special identifier.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="count">Number of Listings to Create</Label>
              <Input
                id="count"
                type="number"
                min="1"
                max="100"
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                placeholder="Enter number of listings (1-100)"
              />
              <p className="text-sm text-muted-foreground">
                Maximum 100 listings per generation to prevent database overload
              </p>
            </div>

            <div className="space-y-3">
              <Label>Select Games/Categories</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {AVAILABLE_GAMES.map((game) => (
                  <div key={game.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                    <Checkbox
                      id={game.id}
                      checked={selectedGames.includes(game.id)}
                      onCheckedChange={() => handleGameToggle(game.id)}
                    />
                    <div className="space-y-1">
                      <label
                        htmlFor={game.id}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {game.label}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {game.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Select one or more games. Listings will be randomly distributed across selected games.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || isDeleting || selectedGames.length === 0}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating {count} Mock Listings...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Generate {count} Mock Listings
                  </>
                )}
              </Button>

              <Button
                onClick={handleDeleteMockListings}
                disabled={isGenerating || isDeleting || mockListingsCount === 0}
                variant="destructive"
                className="w-full"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting Mock Listings...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete All Mock Listings ({mockListingsCount})
                  </>
                )}
              </Button>
            </div>

            {mockListingsCount > 0 && (
              <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
                <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <AlertDescription className="text-orange-800 dark:text-orange-200">
                  <strong>Warning:</strong> Deleting mock listings will permanently remove all {mockListingsCount} mock listings from the database. This action cannot be undone.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Generation Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm">
                <strong>Success:</strong> {lastResult.message}
              </p>
              
              {lastResult.listings && lastResult.listings.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Sample Created Listings:</h4>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {lastResult.listings.slice(0, 10).map((listing: any, index: number) => (
                      <div key={listing.id} className="p-2 bg-muted rounded text-sm">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{listing.title}</div>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 text-xs">
                            MOCK
                          </Badge>
                        </div>
                        <div className="text-muted-foreground">
                          {listing.game} • ${listing.price} • {listing.condition}
                        </div>
                      </div>
                    ))}
                    {lastResult.listings.length > 10 && (
                      <p className="text-xs text-muted-foreground">
                        ... and {lastResult.listings.length - 10} more listings
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  You can now test the pagination system on the <a href="/listings" className="text-primary hover:underline">/listings</a> page.
                  Mock listings will appear alongside real listings and can be filtered by game category.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}