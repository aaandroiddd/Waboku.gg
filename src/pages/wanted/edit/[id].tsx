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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { LocationInput } from "@/components/LocationInput";
import { MAIN_GAME_CATEGORIES, OTHER_GAME_CATEGORIES, GAME_MAPPING, OTHER_GAME_MAPPING } from "@/lib/game-mappings";
import CardSearchInput from "@/components/CardSearchInput";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RouteGuard } from "@/components/RouteGuard";
import { useToast } from "@/components/ui/use-toast";

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

export default function EditWantedPostPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const { toast } = useToast();
  const { getWantedPost, updateWantedPost } = useWantedPosts();
  
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
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Load the wanted post data
  useEffect(() => {
    const loadWantedPost = async () => {
      if (router.isReady && id) {
        setIsLoading(true);
        try {
          const postData = await getWantedPost(id as string);
          
          if (!postData) {
            toast({
              title: "Post not found",
              description: "The wanted post you're trying to edit doesn't exist.",
              variant: "destructive",
            });
            router.push("/dashboard");
            return;
          }
          
          // Check if the user owns this post
          if (postData.userId !== user?.uid) {
            toast({
              title: "Unauthorized",
              description: "You don't have permission to edit this post.",
              variant: "destructive",
            });
            router.push("/dashboard");
            return;
          }
          
          // Populate form data
          setFormData({
            title: postData.title,
            description: postData.description || "",
            game: postData.game,
            cardName: postData.cardName || "",
            condition: postData.condition,
            priceMin: postData.priceRange ? postData.priceRange.min.toString() : "",
            priceMax: postData.priceRange ? postData.priceRange.max.toString() : "",
            location: postData.location,
            isPriceNegotiable: postData.isPriceNegotiable,
            detailedDescription: postData.detailedDescription || ""
          });
        } catch (error) {
          console.error("Error loading wanted post:", error);
          toast({
            title: "Error",
            description: "Failed to load the wanted post. Please try again.",
            variant: "destructive",
          });
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadWantedPost();
  }, [router.isReady, id, user, getWantedPost, router, toast]);

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
      cardName
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
      
      // Update the post
      await updateWantedPost(id as string, postData);
      
      // Show success message
      toast({
        title: "Post updated",
        description: "Your wanted post has been successfully updated.",
      });
      
      // Redirect to the post
      router.push(`/wanted/${id}`);
    } catch (err) {
      console.error("Error updating wanted post:", err);
      setError("Failed to update wanted post. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <PageTransition>
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 w-32 bg-muted rounded mb-6"></div>
              <div className="h-10 w-3/4 bg-muted rounded mb-2"></div>
              <div className="h-6 w-1/2 bg-muted rounded mb-8"></div>
              <div className="h-[600px] w-full bg-muted rounded"></div>
            </div>
          </div>
        </main>
        <Footer />
      </PageTransition>
    );
  }

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
            
            <h1 className="text-3xl font-bold mb-2">Edit Wanted Post</h1>
            <p className="text-muted-foreground mb-8">
              Update your wanted post details
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
                    Update information about what you're looking for
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="game">Game Category</Label>
                      <Select
                        value={formData.game}
                        onValueChange={(value) => handleSelectChange("game", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select game category" />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_GAME_CATEGORIES.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {formData.game && (
                      <div>
                        <Label htmlFor="cardName">Card Name (Optional)</Label>
                        <CardSearchInput
                          game={formData.game}
                          onCardSelect={handleCardSelect}
                          placeholder="Search for a specific card"
                          className="w-full"
                          initialValue={formData.cardName}
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
                      <Select
                        value={formData.condition}
                        onValueChange={(value) => handleSelectChange("condition", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                        <SelectContent>
                          {CONDITION_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                    {isSubmitting ? "Saving..." : "Save Changes"}
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