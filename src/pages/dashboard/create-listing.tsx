import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import dynamic from 'next/dynamic';
import Script from 'next/script';
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { LocationSearch } from "@/components/LocationSearch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useListings } from "@/hooks/useListings";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const CreateListingPage = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [useLocationSearch, setUseLocationSearch] = useState(false);
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
    game: "",
    images: [] as File[],
    city: "",
    state: "",
  });

  const [errors, setErrors] = useState<{
    title?: string;
    price?: string;
    game?: string;
    images?: string;
    city?: string;
    state?: string;
  }>({});

  const validateStep = (step: number) => {
    const newErrors: typeof errors = {};

    switch (step) {
      case 1:
        if (!formData.title.trim()) {
          newErrors.title = "Listing title is required";
        } else if (formData.title.length < 3) {
          newErrors.title = "Title must be at least 3 characters";
        }

        if (!formData.price) {
          newErrors.price = "Price is required";
        } else if (isNaN(parseFloat(formData.price)) || parseFloat(formData.price) <= 0) {
          newErrors.price = "Please enter a valid price";
        }

        if (!formData.game) {
          newErrors.game = "Game type is required";
        }
        break;

      case 2:
        if (!formData.city.trim()) {
          newErrors.city = "City is required";
        }
        if (!formData.state) {
          newErrors.state = "State is required";
        }
        break;

      case 3:
        if (formData.images.length === 0) {
          newErrors.images = "At least one image is required";
        }
        break;
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

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep(3)) {
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
      const listingData = {
        ...formData,
        price: formData.price.trim(),
        onUploadProgress: (progress: number) => {
          setUploadProgress(Math.round(progress));
        }
      };

      const newListing = await createListing(listingData);
      
      if (!newListing) {
        throw new Error("Failed to create listing");
      }

      toast({
        title: "Success!",
        description: "Your listing has been published successfully.",
      });

      router.push("/dashboard?status=listing-created");
    } catch (error: any) {
      console.error('Error creating listing:', error);
      toast({
        title: "Error creating listing",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
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

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Label htmlFor="title">Listing Title *</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Include the card's name, condition, edition, and any other important details</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="title"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Mint Condition Blue-Eyes White Dragon - 1st Edition"
                className={errors.title ? "border-red-500" : ""}
              />
              {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Provide detailed information about your card"
                className="min-h-[120px]"
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
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  className={errors.price ? "border-red-500" : ""}
                />
                {errors.price && <p className="text-sm text-red-500">{errors.price}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="game">Game *</Label>
                <Select
                  value={formData.game}
                  onValueChange={(value) => setFormData({ ...formData, game: value })}
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
                {errors.game && <p className="text-sm text-red-500">{errors.game}</p>}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Label>Location Input Method</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">This location will be used as the meeting point for the transaction</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <Select
                value={useLocationSearch ? "search" : "manual"}
                onValueChange={(value) => {
                  setUseLocationSearch(value === "search");
                  if (value === "manual") {
                    setFormData(prev => ({ ...prev, city: "", state: "" }));
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select input method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual Entry</SelectItem>
                  <SelectItem value="search">Location Search</SelectItem>
                </SelectContent>
              </Select>

              {useLocationSearch ? (
                <>
                  <Script
                    strategy="lazyOnload"
                    src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
                  />
                  <LocationSearch
                    onLocationSelect={({ city, state }) => {
                      setFormData(prev => ({
                        ...prev,
                        city,
                        state
                      }));
                    }}
                  />
                  <div className="text-sm text-muted-foreground">
                    Selected location: {formData.city && formData.state ? `${formData.city}, ${formData.state}` : 'None'}
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      required
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="Enter city"
                      className={errors.city ? "border-red-500" : ""}
                    />
                    {errors.city && <p className="text-sm text-red-500">{errors.city}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state">State *</Label>
                    <Select
                      value={formData.state}
                      onValueChange={(value) => setFormData({ ...formData, state: value })}
                    >
                      <SelectTrigger className={errors.state ? "border-red-500" : ""}>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* US States */}
                        <SelectItem value="AL">Alabama</SelectItem>
                        <SelectItem value="AK">Alaska</SelectItem>
                        <SelectItem value="AZ">Arizona</SelectItem>
                        <SelectItem value="AR">Arkansas</SelectItem>
                        <SelectItem value="CA">California</SelectItem>
                        <SelectItem value="CO">Colorado</SelectItem>
                        <SelectItem value="CT">Connecticut</SelectItem>
                        <SelectItem value="DE">Delaware</SelectItem>
                        <SelectItem value="FL">Florida</SelectItem>
                        <SelectItem value="GA">Georgia</SelectItem>
                        <SelectItem value="HI">Hawaii</SelectItem>
                        <SelectItem value="ID">Idaho</SelectItem>
                        <SelectItem value="IL">Illinois</SelectItem>
                        <SelectItem value="IN">Indiana</SelectItem>
                        <SelectItem value="IA">Iowa</SelectItem>
                        <SelectItem value="KS">Kansas</SelectItem>
                        <SelectItem value="KY">Kentucky</SelectItem>
                        <SelectItem value="LA">Louisiana</SelectItem>
                        <SelectItem value="ME">Maine</SelectItem>
                        <SelectItem value="MD">Maryland</SelectItem>
                        <SelectItem value="MA">Massachusetts</SelectItem>
                        <SelectItem value="MI">Michigan</SelectItem>
                        <SelectItem value="MN">Minnesota</SelectItem>
                        <SelectItem value="MS">Mississippi</SelectItem>
                        <SelectItem value="MO">Missouri</SelectItem>
                        <SelectItem value="MT">Montana</SelectItem>
                        <SelectItem value="NE">Nebraska</SelectItem>
                        <SelectItem value="NV">Nevada</SelectItem>
                        <SelectItem value="NH">New Hampshire</SelectItem>
                        <SelectItem value="NJ">New Jersey</SelectItem>
                        <SelectItem value="NM">New Mexico</SelectItem>
                        <SelectItem value="NY">New York</SelectItem>
                        <SelectItem value="NC">North Carolina</SelectItem>
                        <SelectItem value="ND">North Dakota</SelectItem>
                        <SelectItem value="OH">Ohio</SelectItem>
                        <SelectItem value="OK">Oklahoma</SelectItem>
                        <SelectItem value="OR">Oregon</SelectItem>
                        <SelectItem value="PA">Pennsylvania</SelectItem>
                        <SelectItem value="RI">Rhode Island</SelectItem>
                        <SelectItem value="SC">South Carolina</SelectItem>
                        <SelectItem value="SD">South Dakota</SelectItem>
                        <SelectItem value="TN">Tennessee</SelectItem>
                        <SelectItem value="TX">Texas</SelectItem>
                        <SelectItem value="UT">Utah</SelectItem>
                        <SelectItem value="VT">Vermont</SelectItem>
                        <SelectItem value="VA">Virginia</SelectItem>
                        <SelectItem value="WA">Washington</SelectItem>
                        <SelectItem value="WV">West Virginia</SelectItem>
                        <SelectItem value="WI">Wisconsin</SelectItem>
                        <SelectItem value="WY">Wyoming</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.state && <p className="text-sm text-red-500">{errors.state}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Label htmlFor="images">Card Images *</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Upload clear photos of your card. Include timestamps if needed for verification.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                <Input
                  id="images"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleImageChange}
                  className={`${errors.images ? "border-red-500" : ""} hidden`}
                />
                <label htmlFor="images" className="cursor-pointer">
                  <div className="space-y-2">
                    <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                    </div>
                    <div className="text-sm font-medium">
                      Click to upload or drag and drop
                    </div>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG or WebP (max. 5MB per image)
                    </p>
                  </div>
                </label>
              </div>
              {errors.images && <p className="text-sm text-red-500">{errors.images}</p>}
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
          </div>
        );
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Create New Listing</h1>
        </div>

        <div className="relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / 3) * 100}%` }}
            />
          </div>
          
          <div className="flex justify-between mt-4 mb-8">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`flex flex-col items-center ${
                  step <= currentStep ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${
                    step <= currentStep
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {step}
                </div>
                <span className="text-sm">
                  {step === 1 ? 'Details' : step === 2 ? 'Location' : 'Images'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Card className="transition-all duration-300 hover:shadow-lg">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {renderStepContent()}

              <div className="flex justify-between pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={currentStep === 1 ? () => router.back() : handleBack}
                  disabled={isSubmitting}
                >
                  {currentStep === 1 ? 'Cancel' : 'Back'}
                </Button>
                
                <Button
                  type={currentStep === 3 ? 'submit' : 'button'}
                  onClick={currentStep === 3 ? undefined : handleNext}
                  disabled={isSubmitting}
                >
                  {currentStep === 3
                    ? (isSubmitting ? 'Creating...' : 'Create Listing')
                    : 'Next'}
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