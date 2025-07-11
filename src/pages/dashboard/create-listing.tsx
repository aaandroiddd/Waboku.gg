import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
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
import { MobileSelect } from "@/components/ui/mobile-select";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useListings } from "@/hooks/useListings";
import { useProfile } from "@/hooks/useProfile";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { HelpCircle, AlertCircle, Info } from "lucide-react";
import { LocationInput } from "@/components/LocationInput";
import { validateTextContent } from "@/util/string";
import CardSearchInput from "@/components/CardSearchInput";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { useAccount } from "@/contexts/AccountContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RouteGuard } from "@/components/RouteGuard";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;
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
  const { createListing, checkActiveListingCount } = useListings();
  const { profile } = useProfile(user?.uid);
  const { accountTier, features } = useAccount();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stripeConnectStatus, setStripeConnectStatus] = useState<'none' | 'pending' | 'active' | 'error'>('none');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeListingCount, setActiveListingCount] = useState<number | null>(null);

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
    cardName: "",
    quantity: "" as string,
    termsAccepted: false,
    offersOnly: false,
    finalSale: false,
    language: "English",
  });
  const [searchQuery, setSearchQuery] = useState("");

  const [errors, setErrors] = useState<{
    title?: string;
    description?: string;
    price?: string;
    game?: string;
    images?: string;
    location?: string;
    terms?: string;
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

    if (formData.images.length === 0) {
      newErrors.images = "At least one image is required";
    }

    if (!formData.termsAccepted) {
      newErrors.terms = "You must accept the terms to create a listing";
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
      // Prepare listing data with special handling for "offers only" mode
      const listingData = {
        ...formData,
        // If offers only is checked, set price to 0 and add offersOnly flag
        price: formData.offersOnly ? "0" : formData.price.trim(),
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
      // Don't redirect here - let RouteGuard handle it with proper redirect state
      return;
    }
  }, [user, loading, router]);

  // Check Stripe Connect status
  useEffect(() => {
    if (!user) return;

    const checkStripeConnectStatus = async () => {
      try {
        // Get the auth token
        const token = await user.getIdToken(true);
        
        const response = await fetch('/api/stripe/connect/account-status', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
        });

        if (!response.ok) {
          throw new Error('Failed to check account status');
        }

        const data = await response.json();
        setStripeConnectStatus(data.status);
      } catch (error) {
        console.error('Error checking Stripe Connect status:', error);
        setStripeConnectStatus('error');
      }
    };

    checkStripeConnectStatus();
  }, [user]);

  // Check active listing count for free users
  useEffect(() => {
    if (!user || accountTier !== 'free') return;

    const fetchActiveListingCount = async () => {
      try {
        const count = await checkActiveListingCount();
        setActiveListingCount(count);
      } catch (error) {
        console.error('Error checking active listing count:', error);
        setActiveListingCount(0);
      }
    };

    fetchActiveListingCount();
  }, [user, accountTier, checkActiveListingCount]);

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

  // Check if form has unsaved changes
  const checkForUnsavedChanges = useCallback(() => {
    const hasContent = 
      formData.title.trim() !== "" ||
      formData.description.trim() !== "" ||
      formData.price.trim() !== "" ||
      formData.game !== "" ||
      formData.condition !== "" ||
      formData.cardName.trim() !== "" ||
      formData.quantity.trim() !== "" ||
      formData.images.length > 0 ||
      formData.isGraded ||
      formData.offersOnly ||
      formData.finalSale ||
      formData.language !== "English";
    
    setHasUnsavedChanges(hasContent);
    return hasContent;
  }, [formData]);

  // Monitor form changes
  useEffect(() => {
    checkForUnsavedChanges();
  }, [checkForUnsavedChanges]);

  // Handle browser navigation/refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && !isSubmitting) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, isSubmitting]);

  // Handle Next.js router navigation
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      if (hasUnsavedChanges && !isSubmitting) {
        const confirmLeave = window.confirm('You have unsaved changes. Are you sure you want to leave?');
        if (!confirmLeave) {
          router.events.emit('routeChangeError');
          throw 'Route change aborted by user';
        }
      }
    };

    router.events.on('routeChangeStart', handleRouteChange);
    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [router, hasUnsavedChanges, isSubmitting]);

  // Handle relist functionality - pre-fill form with data from URL parameters
  useEffect(() => {
    console.log('Relist useEffect triggered:', {
      isReady: router.isReady,
      query: router.query,
      relist: router.query.relist
    });

    if (router.isReady && router.query.relist === 'true') {
      const {
        title,
        price,
        game,
        condition,
        description,
        isGraded,
        gradeLevel,
        gradingCompany,
        finalSale,
        language
      } = router.query;

      console.log('Pre-filling form with relist data:', {
        title,
        price,
        game,
        condition,
        description,
        isGraded,
        gradeLevel,
        gradingCompany,
        finalSale,
        language
      });

      // Pre-fill the form with the relist data
      const newFormData = {
        ...formData,
        title: (title as string) || '',
        price: (price as string) || '',
        game: (game as string) || '',
        condition: (condition as string) || '',
        description: (description as string) || '',
        isGraded: isGraded === 'true',
        gradeLevel: gradeLevel ? parseFloat(gradeLevel as string) : undefined,
        gradingCompany: (gradingCompany as string) || undefined,
        finalSale: finalSale === 'true',
        language: (language as string) || 'English'
      };

      console.log('Setting form data to:', newFormData);
      setFormData(newFormData);

      // Show a toast to inform the user
      toast({
        title: "Listing Pre-filled",
        description: "Your listing has been pre-filled with information from your refunded order. You can modify any details before creating the new listing.",
      });

      // Clean up the URL to remove the relist parameters without affecting the form
      // Use a longer delay to ensure form data is set first
      setTimeout(() => {
        const cleanUrl = router.asPath.split('?')[0];
        console.log('Cleaning URL from', router.asPath, 'to', cleanUrl);
        router.replace(cleanUrl, undefined, { shallow: true });
      }, 1000);
    }
  }, [router.isReady, router.query, toast]);

  if (loading || !user) {
    return null;
  }

  return (
    <RouteGuard requireAuth={true}>
      <DashboardLayout>
        <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Create New Listing</h1>
          {accountTier === 'premium' && (
            <Button 
              variant="outline" 
              onClick={() => router.push('/dashboard/bulk-listing')}
              className="flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h1" />
                <path d="M17 3h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1" />
                <path d="M8 21h8" />
                <path d="M12 3v18" />
                <path d="M3 9h2" />
                <path d="M19 9h2" />
                <path d="M3 6h2" />
                <path d="M19 6h2" />
                <path d="M3 12h18" />
              </svg>
              Bulk Listing
            </Button>
          )}
        </div>
        
        {/* Only show Stripe Connect notice if status is confirmed as not active */}
        {stripeConnectStatus !== 'none' && stripeConnectStatus !== 'active' && (
          <Alert variant="warning" className="bg-yellow-500/10 border-yellow-500 text-yellow-700 dark:text-yellow-500">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Stripe Connect Not Set Up</AlertTitle>
            <AlertDescription>
              <p className="mb-2">You can create listings without Stripe Connect, but you won't be able to receive direct payments through our platform. You'll need to communicate with buyers manually to arrange payment.</p>
              <p className="mb-2">For a better selling experience with secure payments directly to your account, we recommend setting up Stripe Connect.</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2 bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/50"
                onClick={() => router.push('/dashboard/connect-account')}
              >
                Set Up Stripe Connect
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Show listing limit information for free users */}
        {accountTier === 'free' && activeListingCount !== null && (
          <Alert className={`${activeListingCount >= features.maxActiveListings ? 'bg-red-500/10 border-red-500 text-red-700 dark:text-red-500' : 'bg-blue-500/10 border-blue-500 text-blue-700 dark:text-blue-500'}`}>
            <Info className="h-4 w-4" />
            <AlertTitle>
              {activeListingCount >= features.maxActiveListings ? 'Listing Limit Reached' : 'Free Account Listing Limit'}
            </AlertTitle>
            <AlertDescription>
              <p className="mb-2">
                You currently have <strong>{activeListingCount}</strong> of <strong>{features.maxActiveListings}</strong> active listings.
              </p>
              {activeListingCount >= features.maxActiveListings ? (
                <div>
                  <p className="mb-2">You've reached your free account limit. To create more listings, you can:</p>
                  <ul className="list-disc list-inside mb-3 space-y-1">
                    <li>Delete or archive an existing listing</li>
                    <li>Upgrade to Premium for unlimited listings</li>
                  </ul>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/50"
                      onClick={() => router.push('/dashboard')}
                    >
                      Manage Listings
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="bg-green-500/20 hover:bg-green-500/30 border-green-500/50"
                      onClick={() => router.push('/dashboard/account-status')}
                    >
                      Upgrade to Premium
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="mb-2">Upgrade to Premium for unlimited listings and additional features!</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-green-500/20 hover:bg-green-500/30 border-green-500/50"
                    onClick={() => router.push('/dashboard/account-status')}
                  >
                    Learn About Premium
                  </Button>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Card className="transition-all duration-300 hover:shadow-lg">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cardName">Card Name</Label>
                    <Input
                      id="cardName"
                      value={formData.cardName}
                      onChange={(e) => setFormData({ ...formData, cardName: e.target.value })}
                      placeholder="Enter card name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="0"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      placeholder="Enter quantity (optional)"
                    />
                  </div>
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
                  {accountTier === 'premium' ? (
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

                <div className="grid grid-cols-2 gap-4">
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
                    <Label htmlFor="game">Category *</Label>
                    <MobileSelect
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
                      placeholder="Select category"
                      className={errors.game ? "border-red-500" : ""}
                      options={[
                        { value: "dbs", label: "Dragon Ball Super Card Game" },
                        { value: "digimon", label: "Digimon" },
                        { value: "lorcana", label: "Disney Lorcana" },
                        { value: "flesh-and-blood", label: "Flesh and Blood" },
                        { value: "gundam", label: "Gundam" },
                        { value: "mtg", label: "Magic: The Gathering" },
                        { value: "onepiece", label: "One Piece Card Game" },
                        { value: "pokemon", label: "Pokemon" },
                        { value: "star-wars", label: "Star Wars: Unlimited" },
                        { value: "union-arena", label: "Union Arena" },
                        { value: "universus", label: "Universus" },
                        { value: "vanguard", label: "Vanguard" },
                        { value: "weiss", label: "Weiss Schwarz" },
                        { value: "yugioh", label: "Yu-Gi-Oh!" },
                        { value: "accessories", label: "Accessories" },
                        { value: "other", label: "Other" }
                      ]}
                    />
                    {errors.game && <p className="text-sm text-red-500">{errors.game}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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

                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <MobileSelect
                      value={formData.language}
                      onValueChange={(value) => setFormData({ ...formData, language: value })}
                      placeholder="Select language"
                      options={[
                        { value: "English", label: "English" },
                        { value: "Japanese", label: "Japanese" },
                        { value: "Spanish", label: "Spanish" },
                        { value: "Chinese", label: "Chinese" },
                        { value: "French", label: "French" },
                        { value: "German", label: "German" }
                      ]}
                    />
                  </div>
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
                  <div className="space-y-4">
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
                    <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 inline-block mr-2">
                        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                      </svg>
                      Note: Images will be displayed in the listing in the order they are uploaded
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="terms" 
                        required
                        onCheckedChange={(checked) => {
                          if (typeof checked === 'boolean') {
                            setFormData(prev => ({ ...prev, termsAccepted: checked }))
                          }
                        }}
                      />
                      <label
                        htmlFor="terms"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        I confirm that I own or have the rights to use these images and agree to the{" "}
                        <Link href="/terms-of-use" className="text-primary hover:underline">
                          Terms of Use
                        </Link>
                      </label>
                    </div>
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
                  disabled={isSubmitting || (accountTier === 'free' && activeListingCount !== null && activeListingCount >= features.maxActiveListings)}
                >
                  {isSubmitting ? 'Creating...' : 
                   (accountTier === 'free' && activeListingCount !== null && activeListingCount >= features.maxActiveListings) ? 'Listing Limit Reached' : 
                   'Create Listing'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
    </RouteGuard>
  );
};

export default dynamic(() => Promise.resolve(CreateListingPage), {
  ssr: false
});