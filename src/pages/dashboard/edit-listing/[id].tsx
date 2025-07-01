import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { validateTextContent } from "@/util/string";
import { useAuth } from '@/contexts/AuthContext';
import { useListings } from '@/hooks/useListings';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InfoIcon } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { MobileSelect } from '@/components/ui/mobile-select';
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from '@/components/ui/use-toast';
import { doc, getDoc } from 'firebase/firestore';
import { Listing } from '@/types/database';
import { LocationInput } from "@/components/LocationInput";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { useAccount } from "@/contexts/AccountContext";

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
    cardName: '',
    offersOnly: false,
    finalSale: false,
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

    if (!formData.city) {
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

    // Only validate price if not in "offers only" mode
    if (!formData.offersOnly) {
      if (!formData.price) {
        newErrors.price = "Price is required";
      } else if (isNaN(parseFloat(formData.price)) || parseFloat(formData.price) <= 0) {
        newErrors.price = "Please enter a valid price";
      }
    }

    if (!formData.game) {
      newErrors.game = "Game type is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    const fetchListing = async () => {
      if (!id || !user) {
        console.log('Missing ID or user, cannot fetch listing');
        setLoading(false);
        return;
      }

      try {
        console.log('Fetching listing with ID:', id);
        
        // Validate ID format before querying
        if (typeof id !== 'string' || id.trim() === '') {
          throw new Error('Invalid listing ID format');
        }
        
        // Get Firebase services with error handling
        const { db } = await import('@/lib/firebase').then(module => module.getFirebaseServices());
        if (!db) {
          throw new Error('Database not initialized');
        }
        
        const listingRef = doc(db, 'listings', id as string);
        console.log('Listing reference created for path:', `listings/${id}`);
        
        const listingDoc = await getDoc(listingRef);
        console.log('Listing document fetch result - exists:', listingDoc.exists());
        
        if (!listingDoc.exists()) {
          console.error('Listing document does not exist for ID:', id);
          toast({
            title: 'Error',
            description: 'Listing not found',
            variant: 'destructive',
          });
          router.push('/dashboard');
          return;
        }

        const listingData = listingDoc.data();
        if (!listingData) {
          throw new Error('Listing data is empty');
        }
        
        console.log('Raw listing data keys:', Object.keys(listingData));
        
        // Check if the current user owns this listing
        if (listingData.userId !== user.uid) {
          console.error('User does not own this listing. Listing user:', listingData.userId, 'Current user:', user.uid);
          toast({
            title: 'Error',
            description: 'You do not have permission to edit this listing',
            variant: 'destructive',
          });
          router.push('/dashboard');
          return;
        }

        // Helper function to safely convert timestamps
        const convertTimestamp = (timestamp: any): Date => {
          try {
            if (!timestamp) return new Date();
            
            // Handle Firestore timestamp objects
            if (timestamp && typeof timestamp.toDate === 'function') {
              return timestamp.toDate();
            }
            
            // Handle JavaScript Date objects
            if (timestamp instanceof Date) {
              return timestamp;
            }
            
            // Handle numeric timestamps (milliseconds since epoch)
            if (typeof timestamp === 'number') {
              return new Date(timestamp);
            }
            
            // Handle string timestamps
            if (typeof timestamp === 'string') {
              return new Date(timestamp);
            }
            
            // Default fallback
            return new Date();
          } catch (error) {
            console.error('Error converting timestamp:', error, timestamp);
            return new Date();
          }
        };

        // Safely convert Firestore timestamps to Date objects
        const createdAt = convertTimestamp(listingData.createdAt);
        const expiresAt = convertTimestamp(listingData.expiresAt);
        const updatedAt = convertTimestamp(listingData.updatedAt);
        
        // Process numeric values with better error handling
        const price = typeof listingData.price === 'number' 
          ? listingData.price 
          : (listingData.price ? parseFloat(String(listingData.price)) : 0);
          
        const quantity = typeof listingData.quantity === 'number' 
          ? listingData.quantity 
          : (listingData.quantity ? parseInt(String(listingData.quantity), 10) : 1);
          
        const gradeLevel = listingData.gradeLevel 
          ? (typeof listingData.gradeLevel === 'number' 
              ? listingData.gradeLevel 
              : parseFloat(String(listingData.gradeLevel)))
          : undefined;
          
        console.log('Processed numeric values - price:', price, 'quantity:', quantity, 'gradeLevel:', gradeLevel);

        // Create a proper listing object with the ID
        const listing = {
          id: listingDoc.id,
          ...listingData,
          createdAt,
          expiresAt,
          updatedAt,
          price,
          quantity,
          gradeLevel,
          // Ensure arrays are properly handled
          imageUrls: Array.isArray(listingData.imageUrls) ? listingData.imageUrls : [],
          // Ensure boolean values are properly typed
          isGraded: Boolean(listingData.isGraded),
          // Ensure numeric index is properly typed
          coverImageIndex: typeof listingData.coverImageIndex === 'number' ? listingData.coverImageIndex : 0,
        } as Listing;

        console.log('Processed listing object ID:', listing.id);
        setListing(listing);
        
        // Set form data with proper type handling and fallbacks
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
          cardName: listing.cardName || '',
          offersOnly: Boolean(listing.offersOnly),
          finalSale: Boolean(listing.finalSale),
        });
        
        console.log('Form data initialized successfully');
      } catch (error) {
        console.error('Error fetching listing:', error);
        // Provide more detailed error message based on the error type
        let errorMessage = 'Failed to fetch listing details';
        
        if (error instanceof Error) {
          console.error('Error details:', error.message);
          if (error.message.includes('permission-denied') || error.message.includes('Permission')) {
            errorMessage = 'You do not have permission to access this listing';
          } else if (error.message.includes('not-found') || error.message.includes('exist')) {
            errorMessage = 'Listing could not be found';
          } else if (error.message.includes('network') || error.message.includes('connection')) {
            errorMessage = 'Network error. Please check your connection and try again';
          } else if (error.message.includes('Database not initialized')) {
            errorMessage = 'Database connection error. Please try again later';
          }
        }
        
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        
        // Redirect to dashboard on error
        router.push('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [id, user, router, toast]);

  // Use the useListings hook at the component level
  const { updateListing } = useListings();

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
      const updateData = {
        title: formData.title,
        description: formData.description,
        price: formData.offersOnly ? 0 : parseFloat(formData.price),
        condition: formData.condition,
        game: formData.game,
        city: formData.city,
        state: formData.state,
        isGraded: formData.isGraded,
        quantity: formData.quantity,
        coverImageIndex: formData.coverImageIndex,
        cardName: formData.cardName,
        offersOnly: formData.offersOnly,
        finalSale: formData.finalSale,
      };
      
      console.log("Updating listing with cover image index:", formData.coverImageIndex);

      // Only include grading info if isGraded is true
      if (formData.isGraded) {
        Object.assign(updateData, {
          gradeLevel: formData.gradeLevel,
          gradingCompany: formData.gradingCompany,
        });
      }

      // Use the updateListing function from the hook
      await updateListing(id as string, updateData);

      toast({
        title: 'Success',
        description: 'Listing updated successfully',
      });
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Error updating listing:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update listing',
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
                  <Label htmlFor="cardName">Card Name</Label>
                  <Input
                    id="cardName"
                    value={formData.cardName}
                    onChange={(e) => setFormData({ ...formData, cardName: e.target.value })}
                    placeholder="Enter card name (optional)"
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
                  {/* Use the account context to check if user is premium */}
                  {useAccount().accountTier === 'premium' ? (
                    <MarkdownEditor
                      value={formData.description}
                      onChange={(value) => setFormData({ ...formData, description: value })}
                      maxLength={MAX_DESCRIPTION_LENGTH}
                      error={errors.description}
                    />
                  ) : (
                    <>
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
                    </>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="price">Price {!formData.offersOnly && '*'}</Label>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="offersOnly" 
                          checked={formData.offersOnly}
                          onCheckedChange={(checked) => {
                            if (typeof checked === 'boolean') {
                              setFormData(prev => ({ 
                                ...prev, 
                                offersOnly: checked,
                                // Clear price if offers only is checked
                                price: checked ? "" : prev.price
                              }));
                              // Clear price error if offers only is checked
                              if (checked) {
                                setErrors(prev => ({ ...prev, price: undefined }));
                              }
                            }
                          }}
                        />
                        <label
                          htmlFor="offersOnly"
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          Offers Only
                        </label>
                      </div>
                    </div>
                    <Input
                      id="price"
                      required={!formData.offersOnly}
                      disabled={formData.offersOnly}
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder={formData.offersOnly ? "Accepting offers only" : "0.00"}
                      className={errors.price ? "border-red-500" : ""}
                    />
                    {errors.price && <p className="text-sm text-red-500">{errors.price}</p>}
                    {formData.offersOnly && (
                      <p className="text-xs text-muted-foreground">
                        Buyers will be able to make offers, but won't be able to purchase directly.
                      </p>
                    )}
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
                    <MobileSelect
                      value={formData.game}
                      onValueChange={(value) => setFormData({ ...formData, game: value })}
                      placeholder="Select game"
                      className={errors.game ? "border-red-500" : ""}
                      options={[
                        { value: "accessories", label: "Accessories" },
                        { value: "dbs", label: "Dragon Ball Super Card Game" },
                        { value: "digimon", label: "Digimon" },
                        { value: "lorcana", label: "Disney Lorcana" },
                        { value: "flesh-and-blood", label: "Flesh and Blood" },
                        { value: "mtg", label: "Magic: The Gathering" },
                        { value: "onepiece", label: "One Piece Card Game" },
                        { value: "pokemon", label: "Pokemon" },
                        { value: "star-wars", label: "Star Wars: Unlimited" },
                        { value: "union-arena", label: "Union Arena" },
                        { value: "universus", label: "Universus" },
                        { value: "vanguard", label: "Vanguard" },
                        { value: "weiss", label: "Weiss Schwarz" },
                        { value: "yugioh", label: "Yu-Gi-Oh!" },
                        { value: "other", label: "Other" }
                      ]}
                    />
                    {errors.game && <p className="text-sm text-red-500">{errors.game}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="condition">Condition *</Label>
                  <MobileSelect
                    value={formData.condition}
                    onValueChange={(value) => setFormData({ ...formData, condition: value })}
                    placeholder="Select condition"
                    options={[
                      { value: "mint", label: "Mint" },
                      { value: "near mint", label: "Near Mint" },
                      { value: "excellent", label: "Excellent" },
                      { value: "good", label: "Good" },
                      { value: "light played", label: "Light Played" },
                      { value: "played", label: "Played" },
                      { value: "poor", label: "Poor" }
                    ]}
                  />
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
                        <MobileSelect
                          value={formData.gradeLevel?.toString() || ""}
                          onValueChange={(value) => setFormData({ ...formData, gradeLevel: parseFloat(value) })}
                          placeholder="Select grade"
                          options={[10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5].map((grade) => ({
                            value: grade.toString(),
                            label: grade.toFixed(1)
                          }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="gradingCompany">Grading Company</Label>
                        <MobileSelect
                          value={formData.gradingCompany || ""}
                          onValueChange={(value) => setFormData({ ...formData, gradingCompany: value })}
                          placeholder="Select company"
                          options={[
                            { value: "PSA", label: "PSA" },
                            { value: "BGS", label: "BGS" },
                            { value: "CGC", label: "CGC" },
                            { value: "other", label: "Other" }
                          ]}
                        />
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
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="finalSale" 
                      checked={formData.finalSale}
                      onCheckedChange={(checked) => {
                        if (typeof checked === 'boolean') {
                          setFormData(prev => ({ ...prev, finalSale: checked }));
                        }
                      }}
                    />
                    <div className="space-y-1">
                      <label
                        htmlFor="finalSale"
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        Final Sale
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Mark this item as final sale (no returns or refunds accepted)
                      </p>
                    </div>
                  </div>
                </div>

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
                  
                  <Alert variant="primary" className="bg-amber-100 dark:bg-amber-800/40 midnight:bg-amber-800/30 text-amber-800 dark:text-amber-100 midnight:text-amber-50 border-amber-300 dark:border-amber-700 midnight:border-amber-700">
                    <InfoIcon className="h-4 w-4" />
                    <AlertTitle>Cover Photo Update</AlertTitle>
                    <AlertDescription>
                      Please note that it will take a few moments for the system to update the cover photo if a new one is selected. The changes will be visible after processing is complete.
                    </AlertDescription>
                  </Alert>

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