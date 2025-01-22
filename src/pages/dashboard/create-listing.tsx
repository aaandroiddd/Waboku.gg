import { useState, useEffect } from "react";
import { useCardSearch } from "@/hooks/useCardSearch";
import { useRouter } from "next/router";
import dynamic from 'next/dynamic';
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useListings } from "@/hooks/useListings";
import { useProfile } from "@/hooks/useProfile";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { LocationInput } from "@/components/LocationInput";
import { validateTextContent } from "@/util/string";
import CardSearchInput from "@/components/CardSearchInput";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 1000;
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const GAME_MAPPING: { [key: string]: string } = {
  'Pokemon TCG': 'pokemon',
  'One Piece TCG': 'onepiece',
  'Dragon Ball Fusion': 'dbs',
};

const CreateListingPage = () => {
  const { results, isLoading, searchCards } = useCardSearch();
  const [searchOpen, setSearchOpen] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { createListing } = useListings();
  const { profile } = useProfile(user?.uid);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    game: "",
    condition: "",
    images: [] as File[],
    coverImageIndex: 0,
    city: "",
    state: "",
    isGraded: false,
    gradeLevel: undefined as number | undefined,
    gradingCompany: undefined as string | undefined,
    cardReference: null as { id: string; name: string; set?: string; game: string } | null,
  });
  const [searchQuery, setSearchQuery] = useState("");

  const [errors, setErrors] = useState<{
    title?: string;
    description?: string;
    price?: string;
    game?: string;
    images?: string;
    location?: string;
  }>({});

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!formData.city || !formData.state) {
      newErrors.location = "Location is required";
    }

    // Validate title
    const titleValidation = validateTextContent(formData.title, MAX_TITLE_LENGTH);
    if (!titleValidation.isValid) {
      newErrors.title = titleValidation.error;
    }

    // Validate description if provided
    if (formData.description.trim()) {
      const descriptionValidation = validateTextContent(formData.description, MAX_DESCRIPTION_LENGTH);
      if (!descriptionValidation.isValid) {
        newErrors.description = descriptionValidation.error;
      }
    }

    if (!formData.price) {
      newErrors.price = "Price is required";
    } else if (isNaN(parseFloat(formData.price)) || parseFloat(formData.price) <= 0) {
      newErrors.price = "Please enter a valid price";
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
    const newFiles = Array.from(e.target.files || []);
    const invalidFiles = newFiles.filter(
      file => !ALLOWED_FILE_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE
    );

    if (invalidFiles.length > 0) {
      setErrors(prev => ({
        ...prev,
        images: "Some files were rejected. Images must be JPG, PNG or WebP and under 5MB"
      }));
      return;
    }

    // Append new files to existing ones
    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...newFiles]
    }));
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

  // Initialize location from profile
  useEffect(() => {
    if (profile && profile.city && profile.state) {
      setFormData(prev => ({
        ...prev,
        city: profile.city || '',
        state: profile.state || ''
      }));
    }
  }, [profile]);

  if (loading || !user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex justify-center items-center">
          <h1 className="text-3xl font-bold">Create New Listing</h1>
        </div>

        <Card className="transition-all duration-300 hover:shadow-lg">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-6">
                <div className="space-y-2">
                  <CardSearchInput
                    onCardSelect={(card) => {
                      const gameType = card.type === 'pokemon' ? 'pokemon' :
                                     card.type === 'mtg' ? 'mtg' :
                                     card.type === 'onepiece' ? 'onepiece' : 'other';
                      
                      setFormData(prev => ({
                        ...prev,
                        cardReference: {
                          id: card.id,
                          name: card.name,
                          set: card.type === 'pokemon' ? card.set.name :
                               card.type === 'mtg' ? card.set_name :
                               card.set_name,
                          game: gameType
                        },
                        game: gameType
                      }));
                    }}
                  />
                </div>
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
                    maxLength={MAX_TITLE_LENGTH}
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Mint Condition Blue-Eyes White Dragon - 1st Edition"
                    className={errors.title ? "border-red-500" : ""}
                  />
                  <div className="flex justify-between text-sm">
                    {errors.title ? (
                      <p className="text-red-500">{errors.title}</p>
                    ) : (
                      <p className="text-muted-foreground">
                        {formData.title.length}/{MAX_TITLE_LENGTH} characters
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Provide detailed information about your card"
                    className={`min-h-[120px] ${errors.description ? "border-red-500" : ""}`}
                  />
                  <div className="flex justify-between text-sm">
                    {errors.description ? (
                      <p className="text-red-500">{errors.description}</p>
                    ) : (
                      <p className="text-muted-foreground">
                        {formData.description.length}/{MAX_DESCRIPTION_LENGTH} characters
                      </p>
                    )}
                  </div>
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
                    <Label htmlFor="game">Category *</Label>
                    <Select
                      value={formData.game}
                      onValueChange={(value) => {
                        if (value === 'accessories') {
                          // Clear grading data when switching to accessories
                          const { gradeLevel, gradingCompany, isGraded, ...rest } = formData;
                          setFormData({ ...rest, game: value });
                        } else {
                          setFormData({ ...formData, game: value });
                        }
                      }}
                    >
                      <SelectTrigger className={errors.game ? "border-red-500" : ""}>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dbs">Dragon Ball Super Card Game</SelectItem>
                        <SelectItem value="digimon">Digimon</SelectItem>
                        <SelectItem value="lorcana">Disney Lorcana</SelectItem>
                        <SelectItem value="flesh-and-blood">Flesh and Blood</SelectItem>
                        <SelectItem value="mtg">Magic: The Gathering</SelectItem>
                        <SelectItem value="onepiece">One Piece Card Game</SelectItem>
                        <SelectItem value="pokemon">Pokemon</SelectItem>
                        <SelectItem value="star-wars">Star Wars: Unlimited</SelectItem>
                        <SelectItem value="union-arena">Union Arena</SelectItem>
                        <SelectItem value="universus">Universus</SelectItem>
                        <SelectItem value="vanguard">Vanguard</SelectItem>
                        <SelectItem value="weiss">Weiss Schwarz</SelectItem>
                        <SelectItem value="yugioh">Yu-Gi-Oh!</SelectItem>
                        <SelectItem value="accessories">Accessories</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.game && <p className="text-sm text-red-500">{errors.game}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="condition">Condition *</Label>
                  <Select
                    value={formData.condition}
                    onValueChange={(value) => setFormData({ ...formData, condition: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mint">Mint</SelectItem>
                      <SelectItem value="near_mint">Near Mint</SelectItem>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="light_played">Light Played</SelectItem>
                      <SelectItem value="played">Played</SelectItem>
                      <SelectItem value="poor">Poor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.game !== 'accessories' && (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="isGraded">Graded Card</Label>
                      <Switch
                        id="isGraded"
                        checked={formData.isGraded}
                        onCheckedChange={(checked) => {
                          if (!checked) {
                            // Remove grading fields when unchecking
                            const { gradeLevel, gradingCompany, ...rest } = formData;
                            setFormData({
                              ...rest,
                              isGraded: false
                            });
                          } else {
                            setFormData({
                              ...formData,
                              isGraded: true
                            });
                          }
                        }}
                      />
                    </div>

                    {formData.isGraded && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="gradeLevel">Grade Level</Label>
                          <Select
                            value={formData.gradeLevel?.toString()}
                            onValueChange={(value) => setFormData({ ...formData, gradeLevel: parseFloat(value) })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select grade" />
                            </SelectTrigger>
                            <SelectContent>
                              {[10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5].map((grade) => (
                                <SelectItem key={grade} value={grade.toString()}>
                                  {grade.toFixed(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="gradingCompany">Grading Company</Label>
                          <Select
                            value={formData.gradingCompany}
                            onValueChange={(value) => setFormData({ ...formData, gradingCompany: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select company" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PSA">PSA</SelectItem>
                              <SelectItem value="BGS">BGS</SelectItem>
                              <SelectItem value="CGC">CGC</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <LocationInput
                  onLocationSelect={(city, state) => {
                    setFormData(prev => ({ ...prev, city, state }));
                    setErrors(prev => ({ ...prev, location: undefined }));
                  }}
                  initialCity={formData.city}
                  initialState={formData.state}
                  error={errors.location}
                />

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
                    <div className="space-y-4">
                      <p className="text-sm text-green-600">
                        {formData.images.length} image(s) selected
                      </p>
                      <div className="grid grid-cols-4 gap-4">
                        {Array.from(formData.images).map((file, index) => (
                          <div 
                            key={index}
                            className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all
                              ${index === formData.coverImageIndex ? 'border-primary' : 'border-gray-200 hover:border-gray-300'}`}
                          >
                            <img
                              src={URL.createObjectURL(file)}
                              alt={`Preview ${index + 1}`}
                              className="w-full h-full object-cover"
                              onClick={() => setFormData(prev => ({ ...prev, coverImageIndex: index }))}
                            />
                            {index === formData.coverImageIndex && (
                              <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                                Cover
                              </div>
                            )}
                            <button
                              type="button"
                              className="absolute top-2 left-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                const newImages = [...formData.images];
                                newImages.splice(index, 1);
                                let newCoverIndex = formData.coverImageIndex;
                                if (index === formData.coverImageIndex) {
                                  newCoverIndex = Math.min(newImages.length - 1, 0);
                                } else if (index < formData.coverImageIndex) {
                                  newCoverIndex = Math.max(0, formData.coverImageIndex - 1);
                                }
                                setFormData(prev => ({
                                  ...prev,
                                  images: newImages,
                                  coverImageIndex: newCoverIndex
                                }));
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {isSubmitting && uploadProgress > 0 && (
                  <div className="space-y-2">
                    <Progress value={uploadProgress} className="w-full" />
                    <p className="text-sm text-center">Uploading images... {Math.round(uploadProgress)}%</p>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                
                <Button
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create Listing'}
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