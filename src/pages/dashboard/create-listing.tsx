import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import dynamic from 'next/dynamic';
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useListings } from "@/hooks/useListings";
import { Progress } from "@/components/ui/progress";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const CreateListingPage = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { createListing } = useListings();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    condition: "",
    game: "",
    images: [] as File[],
  });

  const [errors, setErrors] = useState<{
    title?: string;
    price?: string;
    condition?: string;
    game?: string;
    images?: string;
  }>({});

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!formData.title.trim()) {
      newErrors.title = "Card name is required";
    } else if (formData.title.length < 3) {
      newErrors.title = "Card name must be at least 3 characters";
    }

    if (!formData.price) {
      newErrors.price = "Price is required";
    } else if (isNaN(parseFloat(formData.price)) || parseFloat(formData.price) <= 0) {
      newErrors.price = "Please enter a valid price";
    }

    if (!formData.condition) {
      newErrors.condition = "Condition is required";
    }

    if (!formData.game) {
      newErrors.game = "Game type is required";
    }

    if (formData.images.length === 0) {
      newErrors.images = "At least one image is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const invalidFiles = files.filter(
      file => !ALLOWED_FILE_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE
    );

    if (invalidFiles.length > 0) {
      setErrors(prev => ({
        ...prev,
        images: "Some files were rejected. Images must be JPG, PNG or WebP and under 5MB"
      }));
      return;
    }

    setFormData({ ...formData, images: files });
    setErrors(prev => ({ ...prev, images: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please check the form for errors",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to create a listing",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      console.log('Submitting form with data:', {
        ...formData,
        imageCount: formData.images.length,
        imageTypes: formData.images.map(img => img.type),
        imageSizes: formData.images.map(img => img.size),
      });

      // Prepare the data with proper type conversion
      const listingData = {
        ...formData,
        price: formData.price.trim(), // Ensure no whitespace
        onUploadProgress: (progress: number) => {
          console.log('Upload progress:', progress);
          setUploadProgress(Math.round(progress));
        }
      };

      const newListing = await createListing(listingData);
      
      if (!newListing) {
        throw new Error("Failed to create listing");
      }

      toast({
        title: "Success!",
        description: "Your card listing has been published successfully.",
      });

      // Redirect to dashboard with success parameter
      router.push("/dashboard?status=listing-created");
    } catch (error: any) {
      console.error('Error creating listing:', error);
      toast({
        title: "Error creating listing",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
      setErrors(prev => ({
        ...prev,
        submit: error.message || "Failed to create listing"
      }));
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/sign-in");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Create New Listing</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Card Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Card Name *</Label>
                <Input
                  id="title"
                  required
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="e.g., Blue-Eyes White Dragon"
                  className={errors.title ? "border-red-500" : ""}
                />
                {errors.title && (
                  <p className="text-sm text-red-500">{errors.title}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Describe the card's condition, edition, and any other relevant details"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price *</Label>
                  <Input
                    id="price"
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                    placeholder="0.00"
                    className={errors.price ? "border-red-500" : ""}
                  />
                  {errors.price && (
                    <p className="text-sm text-red-500">{errors.price}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="game">Game *</Label>
                  <Select
                    value={formData.game}
                    onValueChange={(value) =>
                      setFormData({ ...formData, game: value })
                    }
                  >
                    <SelectTrigger className={errors.game ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select game" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yugioh">Yu-Gi-Oh!</SelectItem>
                      <SelectItem value="pokemon">Pokémon</SelectItem>
                      <SelectItem value="mtg">Magic: The Gathering</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.game && (
                    <p className="text-sm text-red-500">{errors.game}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="condition">Condition *</Label>
                <Select
                  value={formData.condition}
                  onValueChange={(value) =>
                    setFormData({ ...formData, condition: value })
                  }
                >
                  <SelectTrigger className={errors.condition ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mint">Mint</SelectItem>
                    <SelectItem value="near-mint">Near Mint</SelectItem>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="light-played">Light Played</SelectItem>
                    <SelectItem value="played">Played</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                  </SelectContent>
                </Select>
                {errors.condition && (
                  <p className="text-sm text-red-500">{errors.condition}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="images">Card Images *</Label>
                <Input
                  id="images"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleImageChange}
                  className={errors.images ? "border-red-500" : ""}
                />
                <p className="text-sm text-muted-foreground">
                  Upload clear images of the front and back of the card (JPG, PNG or WebP, max 5MB each)
                </p>
                {errors.images && (
                  <p className="text-sm text-red-500">{errors.images}</p>
                )}
                {formData.images.length > 0 && (
                  <p className="text-sm text-green-600">
                    {formData.images.length} image(s) selected
                  </p>
                )}
              </div>

              {isSubmitting && uploadProgress > 0 && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="w-full" />
                  <p className="text-sm text-center">Uploading images... {Math.round(uploadProgress)}%</p>
                </div>
              )}

              <Alert>
                <AlertDescription>
                  Fields marked with * are required. Make sure to provide clear images and accurate details for your listing.
                </AlertDescription>
              </Alert>

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create Listing"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default dynamic(() => Promise.resolve(CreateListingPage), {
  ssr: false
});