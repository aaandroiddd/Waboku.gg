import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { PageTransition } from "@/components/PageTransition";
import Header from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useWantedPosts, WantedPostCondition } from "@/hooks/useWantedPosts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { LocationInput } from "@/components/LocationInput";
import { MAIN_GAME_CATEGORIES, OTHER_GAME_CATEGORIES, GAME_MAPPING, OTHER_GAME_MAPPING } from "@/lib/game-mappings";
import CardSearchInput from "@/components/CardSearchInput";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RouteGuard } from "@/components/RouteGuard";
import { generateWantedPostUrl } from "@/lib/wanted-posts-slug";

// Combine all game categories for the dropdown
const ALL_GAME_CATEGORIES = [
  ...MAIN_GAME_CATEGORIES.map(cat => ({ 
    label: cat, 
    value: GAME_MAPPING[cat] 
  })),
  ...OTHER_GAME_CATEGORIES.map(cat => ({ 
    label: cat, 
    value: OTHER_GAME_MAPPING[cat] 
  }))
];

// Card condition options
const CONDITION_OPTIONS = [
  { label: "Any Condition", value: "any" },
  { label: "Near Mint", value: "near_mint" },
  { label: "Lightly Played", value: "lightly_played" },
  { label: "Moderately Played", value: "moderately_played" },
  { label: "Heavily Played", value: "heavily_played" },
  { label: "Damaged", value: "damaged" }
];

export default function CreateWantedPostPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { game } = router.query;
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    game: "",
    cardName: "",
    condition: "any",
    priceMin: "",
    priceMax: "",
    location: "",
    isPriceNegotiable: true,
    detailedDescription: ""
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Set the game category from URL query if available
  useEffect(() => {
    if (router.isReady && game) {
      setFormData(prev => ({
        ...prev,
        game: game as string
      }));
    }
  }, [router.isReady, game]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleCardSelect = (cardName: string) => {
    setFormData(prev => ({
      ...prev,
      cardName,
      title: cardName // Auto-fill title with card name
    }));
  };

  const handleLocationSelect = (location: string) => {
    setFormData(prev => ({
      ...prev,
      location
    }));
  };

  const handleMarkdownChange = (content: string) => {
    setFormData(prev => ({
      ...prev,
      detailedDescription: content
    }));
  };

  // Use our custom hook
  const { createWantedPost } = useWantedPosts();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    // Validate form
    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }
    
    if (!formData.game) {
      setError("Game category is required");
      return;
    }
    
    if (!formData.location) {
      setError("Location is required");
      return;
    }
    
    // Validate price range if not negotiable
    if (!formData.isPriceNegotiable) {
      const min = parseFloat(formData.priceMin);
      const max = parseFloat(formData.priceMax);
      
      if (isNaN(min) || min < 0) {
        setError("Minimum price must be a valid number");
        return;
      }
      
      if (isNaN(max) || max < min) {
        setError("Maximum price must be greater than or equal to minimum price");
        return;
      }
    }
    
    setIsSubmitting(true);
    
    try {
      console.log("Attempting to create wanted post...");
      
      // Prepare the data for submission
      const postData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        game: formData.game,
        cardName: formData.cardName || undefined,
        condition: formData.condition as WantedPostCondition,
        isPriceNegotiable: formData.isPriceNegotiable,
        priceRange: !formData.isPriceNegotiable ? {
          min: parseFloat(formData.priceMin),
          max: parseFloat(formData.priceMax)
        } : undefined,
        location: formData.location,
        detailedDescription: formData.detailedDescription || undefined
      };
      
      console.log("Post data to submit:", postData);
      
      const postId = await createWantedPost(postData);
      console.log("Post created successfully with hook, ID:", postId);

      // Generate the new URL format for the created post
      const newPostUrl = generateWantedPostUrl(
        formData.title.trim(),
        formData.game,
        postId
      );

      // Redirect to the newly created post with success parameter
      router.push(`${newPostUrl}?success=created`);
    } catch (err) {
      console.error("Error creating wanted post:", err);
      if (err instanceof Error) {
        setError(`Failed to create wanted post: ${err.message}`);
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <RouteGuard>
      <PageTransition>
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <Button
              variant="ghost"
              className="mb-6 pl-0"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            
            <h1 className="text-3xl font-bold mb-2">Create Wanted Post</h1>
            <p className="text-muted-foreground mb-8">
              Let the community know what cards or accessories you're looking for
            </p>
            
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleSubmit}>
              <Card>
                <CardHeader>
                  <CardTitle>Post Details</CardTitle>
                  <CardDescription>
                    Provide information about what you're looking for
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="game">Game Category</Label>
                      <div className="relative">
                        <select
                          id="game"
                          value={formData.game}
                          onChange={(e) => handleSelectChange("game", e.target.value)}
                          className="block w-full h-12 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer text-foreground"
                          style={{
                            WebkitAppearance: 'none',
                            MozAppearance: 'none',
                            backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 12px center',
                            backgroundSize: '16px',
                            paddingRight: '40px',
                            minWidth: 0,
                            touchAction: 'manipulation'
                          }}
                          required
                        >
                          <option value="">Select game category</option>
                          {ALL_GAME_CATEGORIES.map((category) => (
                            <option key={category.value} value={category.value}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    {formData.game && (
                      <div>
                        <Label htmlFor="cardName">Card Name (Optional)</Label>
                        <CardSearchInput
                          game={formData.game}
                          onCardSelect={handleCardSelect}
                          placeholder="Search for a specific card"
                          className="w-full"
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          Search for a specific card or leave blank for accessories/other items
                        </p>
                      </div>
                    )}
                    
                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        placeholder="What are you looking for?"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="description">Short Description</Label>
                      <Textarea
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        placeholder="Brief description of what you're looking for"
                        rows={3}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="condition">Preferred Condition</Label>
                      <div className="relative">
                        <select
                          id="condition"
                          value={formData.condition}
                          onChange={(e) => handleSelectChange("condition", e.target.value)}
                          className="block w-full h-12 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer text-foreground"
                          style={{
                            WebkitAppearance: 'none',
                            MozAppearance: 'none',
                            backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 12px center',
                            backgroundSize: '16px',
                            paddingRight: '40px',
                            minWidth: 0,
                            touchAction: 'manipulation'
                          }}
                        >
                          {CONDITION_OPTIONS.map((condition) => (
                            <option key={condition.value} value={condition.value}>
                              {condition.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <Label>Detailed Description (Optional)</Label>
                    <div className="mt-2">
                      <MarkdownEditor
                        value={formData.detailedDescription}
                        onChange={handleMarkdownChange}
                        placeholder="Add any additional details about what you're looking for..."
                      />
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="isPriceNegotiable" className="text-base">Price Negotiable</Label>
                        <p className="text-sm text-muted-foreground">
                          Toggle off to set a specific price range
                        </p>
                      </div>
                      <Switch
                        id="isPriceNegotiable"
                        checked={formData.isPriceNegotiable}
                        onCheckedChange={(checked) => handleSwitchChange("isPriceNegotiable", checked)}
                      />
                    </div>
                    
                    {!formData.isPriceNegotiable && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="priceMin">Minimum Price ($)</Label>
                          <Input
                            id="priceMin"
                            name="priceMin"
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.priceMin}
                            onChange={handleInputChange}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label htmlFor="priceMax">Maximum Price ($)</Label>
                          <Input
                            id="priceMax"
                            name="priceMax"
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.priceMax}
                            onChange={handleInputChange}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <Label htmlFor="location">Your Location</Label>
                      <LocationInput
                        value={formData.location}
                        onChange={handleLocationSelect}
                        placeholder="Enter your city, state, or zip code"
                        className="w-full"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        This helps local collectors find your wanted post
                      </p>
                    </div>
                  </div>
                </CardContent>
                
                <CardFooter className="flex justify-end space-x-4 pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Creating..." : "Create Wanted Post"}
                  </Button>
                </CardFooter>
              </Card>
            </form>
          </div>
        </main>
        <Footer />
      </PageTransition>
    </RouteGuard>
  );
}