import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { PageTransition } from "@/components/PageTransition";
import Header from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Filter, MapPin, Calendar } from "lucide-react";
import { GameCategoryBadge } from "@/components/GameCategoryBadge";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { GAME_NAME_MAPPING } from "@/lib/game-mappings";
import { StateSelect } from "@/components/StateSelect";
import { useWantedPosts, WantedPost } from "@/hooks/useWantedPosts";

export default function BrowseWantedPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { game } = router.query;
  const [selectedState, setSelectedState] = useState<string | null>(null);
  
  // Use our custom hook to fetch wanted posts
  const { posts: wantedPosts, isLoading, error } = useWantedPosts({
    game: game as string | undefined,
    state: selectedState || undefined
  });

  const handleCreateWanted = () => {
    if (!user) {
      router.push("/auth/sign-in?redirect=/wanted/create");
      return;
    }
    router.push({
      pathname: "/wanted/create",
      query: game ? { game } : {},
    });
  };

  // Get the display name for the game category
  const getGameDisplayName = () => {
    if (!game) return "All Categories";
    
    for (const [key, values] of Object.entries(GAME_NAME_MAPPING)) {
      if (key === game || values.includes(game as string)) {
        return values[0].charAt(0).toUpperCase() + values[0].slice(1);
      }
    }
    
    return game as string;
  };

  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any>(null);

  const handleMigratePosts = async () => {
    try {
      setIsMigrating(true);
      const response = await fetch('/api/wanted/migrate-posts');
      const result = await response.json();
      console.log('Migration result:', result);
      setMigrationResult(result);
      
      // Refresh the page after migration
      if (result.migratedCount > 0) {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      console.error('Error migrating posts:', error);
      setMigrationResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <PageTransition>
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                {game ? `${getGameDisplayName()} Wanted Posts` : "All Wanted Posts"}
              </h1>
              <p className="text-muted-foreground">
                Browse cards and accessories that other collectors are looking for
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {error && (
                <Button 
                  onClick={handleMigratePosts}
                  variant="outline"
                  disabled={isMigrating}
                  className="flex items-center gap-2"
                >
                  {isMigrating ? 'Migrating...' : 'Fix Data Structure'}
                </Button>
              )}
              <Button 
                onClick={handleCreateWanted}
                className="flex items-center gap-2"
              >
                <PlusCircle className="h-4 w-4" />
                Create Wanted Post
              </Button>
            </div>
          </div>
          
          {migrationResult && (
            <div className={`p-4 mb-6 rounded-lg ${migrationResult.error ? 'bg-destructive/10' : 'bg-green-100 dark:bg-green-900/20'}`}>
              <h3 className="font-medium mb-1">
                {migrationResult.error ? 'Migration Error' : 'Migration Complete'}
              </h3>
              <p className="text-sm">
                {migrationResult.error 
                  ? `Error: ${migrationResult.error}` 
                  : `Successfully migrated ${migrationResult.migratedCount} posts. ${migrationResult.migratedCount > 0 ? 'Refreshing page...' : ''}`
                }
              </p>
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-6 mb-8">
            <div className="w-full md:w-64 flex-shrink-0">
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-medium mb-4 flex items-center">
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Location</label>
                      <StateSelect 
                        value={selectedState || ""}
                        onChange={(value) => setSelectedState(value)}
                        placeholder="Select state"
                        className="w-full"
                      />
                    </div>
                    
                    {/* Additional filters can be added here */}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex-1">
              <Tabs defaultValue="recent" className="w-full">
                <div className="flex justify-between items-center mb-4">
                  <TabsList>
                    <TabsTrigger value="recent">Most Recent</TabsTrigger>
                    <TabsTrigger value="nearby">Nearby</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="recent" className="mt-0">
                  {isLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-32 w-full" />
                      ))}
                    </div>
                  ) : wantedPosts.length > 0 ? (
                    <div className="space-y-4">
                      {wantedPosts.map((post) => (
                        <WantedPostCard key={post.id} post={post} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-muted/30 rounded-lg">
                      <h3 className="text-xl font-medium mb-2">No wanted posts found</h3>
                      <p className="text-muted-foreground mb-6">
                        Be the first to create a wanted post for {game ? getGameDisplayName() : "this category"}
                      </p>
                      <Button onClick={handleCreateWanted}>
                        Create Wanted Post
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="nearby" className="mt-0">
                  {isLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-32 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-muted/30 rounded-lg">
                      <h3 className="text-xl font-medium mb-2">Location-based results</h3>
                      <p className="text-muted-foreground mb-6">
                        Enable location services to see wanted posts near you
                      </p>
                      <Button variant="outline">
                        Enable Location
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </PageTransition>
  );
}

// Component for wanted post cards
function WantedPostCard({ post }: { post: WantedPost }) {
  const router = useRouter();
  
  const handleClick = () => {
    router.push(`/wanted/${post.id}`);
  };
  
  const handleContactClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/wanted/${post.id}?action=contact`);
  };
  
  // Format condition for display
  const formatCondition = (condition: string) => {
    return condition
      .replace('_', ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };
  
  return (
    <Card 
      className="hover:bg-accent/5 transition-colors cursor-pointer"
      onClick={handleClick}
    >
      <CardContent className="p-6">
        <div className="flex justify-between">
          <div>
            <h3 className="text-lg font-medium mb-1">{post.title}</h3>
            <p className="text-sm text-muted-foreground mb-3">{post.description}</p>
            
            <div className="flex flex-wrap gap-2 mb-3">
              <GameCategoryBadge game={post.game} />
              {post.condition && post.condition !== 'any' && (
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                  {formatCondition(post.condition)}
                </span>
              )}
            </div>
            
            <div className="flex items-center text-sm text-muted-foreground">
              <MapPin className="h-3 w-3 mr-1" />
              <span className="mr-3">{post.location}</span>
              <Calendar className="h-3 w-3 mr-1" />
              <span>{new Date(post.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          
          <div className="text-right">
            <div className="font-medium">
              {post.priceRange 
                ? `$${post.priceRange.min} - $${post.priceRange.max}` 
                : "Price Negotiable"
              }
            </div>
            <Button 
              size="sm" 
              className="mt-2"
              onClick={handleContactClick}
            >
              Contact
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}