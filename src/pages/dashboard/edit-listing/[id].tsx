import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { validateTextContent } from "@/util/string";
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from "@/components/ui/switch";
import { useToast } from '@/components/ui/use-toast';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { LocationInput } from "@/components/LocationInput";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 1000;

const EditListingPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState<Listing | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    condition: '',
    game: '',
    city: '',
    state: '',
    isGraded: false,
    gradeLevel: undefined as number | undefined,
    gradingCompany: undefined as string | undefined,
    quantity: 1,
    imageUrls: [] as string[],
    coverImageIndex: 0,
  });

  const [errors, setErrors] = useState<{
    title?: string;
    description?: string;
    price?: string;
    game?: string;
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    const fetchListing = async () => {
      if (!id || !user) return;

      try {
        console.log('Fetching listing with ID:', id);
        const listingDoc = await getDoc(doc(db, 'listings', id as string));
        
        if (!listingDoc.exists()) {
          console.error('Listing document does not exist');
          toast({
            title: 'Error',
            description: 'Listing not found',
            variant: 'destructive',
          });
          router.push('/dashboard');
          return;
        }

        const listingData = listingDoc.data();
        console.log('Raw listing data:', listingData);
        
        // Check if the current user owns this listing
        if (listingData.userId !== user.uid) {
          console.error('User does not own this listing');
          toast({
            title: 'Error',
            description: 'You do not have permission to edit this listing',
            variant: 'destructive',
          });
          router.push('/dashboard');
          return;
        }

        // Safely convert Firestore timestamps to Date objects
        let createdAt = new Date();
        let expiresAt = new Date();
        
        try {
          // Check if createdAt exists and is a Firestore timestamp
          if (listingData.createdAt && typeof listingData.createdAt.toDate === 'function') {
            createdAt = listingData.createdAt.toDate();
          } else if (listingData.createdAt) {
            // Handle if it's already a Date or a timestamp number
            createdAt = new Date(listingData.createdAt);
          }
          
          // Check if expiresAt exists and is a Firestore timestamp
          if (listingData.expiresAt && typeof listingData.expiresAt.toDate === 'function') {
            expiresAt = listingData.expiresAt.toDate();
          } else if (listingData.expiresAt) {
            // Handle if it's already a Date or a timestamp number
            expiresAt = new Date(listingData.expiresAt);
          }
        } catch (timestampError) {
          console.error('Error converting timestamps:', timestampError);
          // Use current date as fallback
        }

        // Create a proper listing object with the ID
        const listing = {
          id: listingDoc.id,
          ...listingData,
          createdAt,
          expiresAt,
          // Ensure numeric values are properly typed
          price: typeof listingData.price === 'number' ? listingData.price : parseFloat(listingData.price) || 0,
          quantity: typeof listingData.quantity === 'number' ? listingData.quantity : parseInt(listingData.quantity) || 1,
          gradeLevel: listingData.gradeLevel ? parseFloat(listingData.gradeLevel) : undefined,
        } as Listing;

        console.log('Processed listing object:', listing);
        setListing(listing);
        
        setFormData({
          title: listing.title || '',
          description: listing.description || '',
          price: listing.price.toString(),
          condition: listing.condition || '',
          game: listing.game || '',
          city: listing.city || '',
          state: listing.state || '',
          isGraded: Boolean(listing.isGraded),
          gradeLevel: listing.gradeLevel,
          gradingCompany: listing.gradingCompany,
          quantity: listing.quantity || 1,
          imageUrls: Array.isArray(listing.imageUrls) ? listing.imageUrls : [],
          coverImageIndex: typeof listing.coverImageIndex === 'number' ? listing.coverImageIndex : 0,
        });
      } catch (error) {
        console.error('Error fetching listing:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch listing details',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [id, user, router, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !user) return;

    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please check the form for errors",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const listingRef = doc(db, 'listings', id as string);
      const updateData = {
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        condition: formData.condition,
        game: formData.game,
        city: formData.city,
        state: formData.state,
        isGraded: formData.isGraded,
        quantity: formData.quantity,
        coverImageIndex: formData.coverImageIndex,
        updatedAt: new Date(),
      };

      // Only include grading info if isGraded is true
      if (formData.isGraded) {
        Object.assign(updateData, {
          gradeLevel: formData.gradeLevel,
          gradingCompany: formData.gradingCompany,
        });
      }

      await updateDoc(listingRef, updateData);

      toast({
        title: 'Success',
        description: 'Listing updated successfully',
      });
      router.push('/dashboard');
    } catch (error) {
      console.error('Error updating listing:', error);
      toast({
        title: 'Error',
        description: 'Failed to update listing',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!listing) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <p>Listing not found</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Edit Listing</h1>
        </div>

        <Card className="transition-all duration-300 hover:shadow-lg">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
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

                <div className="grid grid-cols-3 gap-4">
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
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                      className="w-full"
                    />
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
                        <SelectItem value="accessories">Accessories</SelectItem>
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

                <LocationInput
                  onLocationSelect={(city, state) => {
                    setFormData(prev => ({ ...prev, city, state }));
                    setErrors(prev => ({ ...prev, location: undefined }));
                  }}
                  initialCity={formData.city}
                  initialState={formData.state}
                  error={errors.location}
                />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Listing Images</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Click on an image to set it as the cover photo</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  {formData.imageUrls.length > 0 && (
                    <div className="grid grid-cols-4 gap-4">
                      {formData.imageUrls.map((url, index) => (
                        <div 
                          key={index}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all
                            ${index === formData.coverImageIndex ? 'border-primary' : 'border-gray-200 hover:border-gray-300'}`}
                          onClick={() => {
                            setFormData(prev => ({ ...prev, coverImageIndex: index }));
                          }}
                        >
                          <img
                            src={url}
                            alt={`Image ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {index === formData.coverImageIndex && (
                            <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                              Cover
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default dynamic(() => Promise.resolve(EditListingPage), {
  ssr: false
});