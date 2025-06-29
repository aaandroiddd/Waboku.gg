import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus, Database } from "lucide-react";

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
  const [lastResult, setLastResult] = useState<any>(null);
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Mock Listing Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription>
              This tool creates realistic mock listings for testing the pagination system and marketplace functionality. 
              Mock listings include realistic card data, prices, conditions, and locations.
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

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || selectedGames.length === 0}
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
                        <div className="font-medium">{listing.title}</div>
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