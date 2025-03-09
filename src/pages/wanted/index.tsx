import { useState } from "react";
import { useRouter } from "next/router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/PageTransition";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SearchIcon, PlusCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// Define the game mappings directly in this file to avoid circular dependencies
export const MAIN_GAME_MAPPING = {
  "Pokemon": "pokemon",
  "Magic: The Gathering": "mtg",
  "Yu-Gi-Oh!": "yugioh",
  "One Piece": "onepiece",
  "Disney Lorcana": "lorcana",
  "Digimon": "digimon",
} as const;

export const OTHER_GAME_MAPPING = {
  "Dragon Ball Super": "dbs",
  "Flesh and Blood": "flesh-and-blood",
  "Star Wars: Unlimited": "star-wars",
  "Union Arena": "union-arena",
  "Universus": "universus",
  "Vanguard": "vanguard",
  "Weiss Schwarz": "weiss",
  "Accessories": "accessories",
} as const;

export const MAIN_GAME_CATEGORIES = Object.keys(MAIN_GAME_MAPPING);
export const OTHER_GAME_CATEGORIES = Object.keys(OTHER_GAME_MAPPING);

// Game category icons (simplified for now)
const GAME_ICONS: Record<string, string> = {
  "pokemon": "🔴",
  "mtg": "🧙",
  "yugioh": "👑",
  "onepiece": "⚓",
  "lorcana": "✨",
  "digimon": "🦖",
  "dbs": "🔥",
  "flesh-and-blood": "❤️",
  "star-wars": "⭐",
  "union-arena": "🎮",
  "universus": "🌌",
  "vanguard": "🛡️",
  "weiss": "🃏",
  "accessories": "🎒",
};

export default function WantedBoardPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const handleCategoryClick = (category: string) => {
    router.push({
      pathname: "/wanted/create",
      query: { game: category },
    });
  };

  const handleCreateWanted = () => {
    if (!user) {
      router.push("/auth/sign-in?redirect=/wanted/create");
      return;
    }
    router.push("/wanted/create");
  };

  return (
    <PageTransition>
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Wanted Board</h1>
              <p className="text-muted-foreground">
                Post cards or accessories you're looking for that aren't currently available in listings
              </p>
            </div>
            <Button 
              onClick={handleCreateWanted}
              className="flex items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Create Wanted Post
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {/* Main Game Categories */}
            {MAIN_GAME_CATEGORIES.map((category) => {
              const gameKey = MAIN_GAME_MAPPING[category as keyof typeof MAIN_GAME_MAPPING];
              return (
                <Card 
                  key={category}
                  className="hover:bg-accent/10 transition-colors cursor-pointer"
                  onClick={() => handleCategoryClick(gameKey)}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col h-full">
                      <div className="flex items-center mb-4">
                        <div className="text-3xl mr-3">
                          {GAME_ICONS[gameKey] || "🎮"}
                        </div>
                        <h2 className="text-xl font-semibold">{category}</h2>
                      </div>
                      <p className="text-muted-foreground mb-4">
                        Find or post wanted {category} cards and accessories
                      </p>
                      <div className="mt-auto">
                        <Button 
                          variant="outline" 
                          className="w-full flex items-center gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/wanted/browse?game=${gameKey}`);
                          }}
                        >
                          <SearchIcon className="h-4 w-4" />
                          Browse Wanted Posts
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Other Game Categories */}
            {OTHER_GAME_CATEGORIES.map((category) => {
              const gameKey = OTHER_GAME_MAPPING[category as keyof typeof OTHER_GAME_MAPPING];
              return (
                <Card 
                  key={category}
                  className="hover:bg-accent/10 transition-colors cursor-pointer"
                  onClick={() => handleCategoryClick(gameKey)}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col h-full">
                      <div className="flex items-center mb-4">
                        <div className="text-3xl mr-3">
                          {GAME_ICONS[gameKey] || "🎮"}
                        </div>
                        <h2 className="text-xl font-semibold">{category}</h2>
                      </div>
                      <p className="text-muted-foreground mb-4">
                        Find or post wanted {category} cards and accessories
                      </p>
                      <div className="mt-auto">
                        <Button 
                          variant="outline" 
                          className="w-full flex items-center gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/wanted/browse?game=${gameKey}`);
                          }}
                        >
                          <SearchIcon className="h-4 w-4" />
                          Browse Wanted Posts
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />
    </PageTransition>
  );
}