import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { MobileSelect } from '@/components/ui/mobile-select';
import { LocationInput } from '@/components/LocationInput';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useListings } from '@/hooks/useListings';
import { useProfile } from '@/hooks/useProfile';
import { useAccount } from '@/contexts/AccountContext';
import { ArrowLeft, ArrowRight, Check, Upload } from 'lucide-react';
import { validateTextContent } from '@/util/string';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface FormData {
  // Part 1
  title: string;
  price: string;
  offersOnly: boolean;
  quantity: string;
  cardName: string;
  
  // Part 2
  description: string;
  game: string;
  condition: string;
  language: string;
  isGraded: boolean;
  gradeLevel?: number;
  gradingCompany?: string;
  finalSale: boolean;
  
  // Part 3
  city: string;
  state: string;
  shippingCost: string;
  
  // Part 4
  images: File[];
  coverImageIndex: number;
  termsAccepted: boolean;
}

export const CreateListingWizard = () => {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const { createListing } = useListings();
  const { profile } = useProfile(user?.uid);
  const { accountTier } = useAccount();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [formData, setFormData] = useState<FormData>({
    // Part 1
    title: '',
    price: '',
    offersOnly: false,
    quantity: '',
    cardName: '',
    
    // Part 2
    description: '',
    game: '',
    condition: '',
    language: 'English',
    isGraded: false,
    finalSale: false,
    
    // Part 3
    city: '',
    state: '',
    shippingCost: '',
    
    // Part 4
    images: [],
    coverImageIndex: 0,
    termsAccepted: false,
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    switch (step) {
      case 1:
        // Validate title
        const titleValidation = validateTextContent(formData.title, MAX_TITLE_LENGTH);
        if (!titleValidation.isValid) {
          newErrors.title = titleValidation.error;
        }
        
        // Validate price (only if not offers only)
        if (!formData.offersOnly) {
          if (!formData.price) {
            newErrors.price = "Price is required";
          } else if (isNaN(parseFloat(formData.price)) || parseFloat(formData.price) <= 0) {
            newErrors.price = "Please enter a valid price";
          }
        }
        break;
        
      case 2:
        // Validate description (minimum 20 characters)
        if (formData.description.trim().length < 20) {
          newErrors.description = "Description must be at least 20 characters";
        } else {
          const descriptionValidation = validateTextContent(formData.description, MAX_DESCRIPTION_LENGTH);
          if (!descriptionValidation.isValid) {
            newErrors.description = descriptionValidation.error;
          }
        }
        
        if (!formData.game) {
          newErrors.game = "Category is required";
        }
        
        if (!formData.condition) {
          newErrors.condition = "Condition is required";
        }
        break;
        
      case 3:
        if (!formData.city) {
          newErrors.location = "Location is required";
        }
        break;
        
      case 4:
        if (formData.images.length === 0) {
          newErrors.images = "At least one image is required";
        }
        
        if (!formData.termsAccepted) {
          newErrors.terms = "You must accept the terms to create a listing";
        }
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
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

    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...newFiles]
    }));
    setErrors(prev => ({ ...prev, images: '' }));
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) {
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

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Listing Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Mint Condition Blue-Eyes White Dragon - 1st Edition"
                maxLength={MAX_TITLE_LENGTH}
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="price">Price *</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="offersOnly" 
                      checked={formData.offersOnly}
                      onCheckedChange={(checked) => {
                        if (typeof checked === 'boolean') {
                          setFormData(prev => ({ 
                            ...prev, 
                            offersOnly: checked,
                            price: checked ? "" : prev.price
                          }));
                          if (checked) {
                            setErrors(prev => ({ ...prev, price: '' }));
                          }
                        }
                      }}
                    />
                    <label htmlFor="offersOnly" className="text-sm font-medium leading-none cursor-pointer">
                      Offers Only
                    </label>
                  </div>
                </div>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  placeholder={formData.offersOnly ? "Accepting offers only" : "0.00"}
                  disabled={formData.offersOnly}
                  className={errors.price ? "border-red-500" : ""}
                />
                {errors.price && <p className="text-sm text-red-500">{errors.price}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity (if applicable)</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                  placeholder="Enter quantity"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cardName">Card Name (if applicable)</Label>
              <Input
                id="cardName"
                value={formData.cardName}
                onChange={(e) => setFormData(prev => ({ ...prev, cardName: e.target.value }))}
                placeholder="Enter card name"
              />
            </div>

            {accountTier === 'premium' && (
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Looking for bulk listing?{' '}
                  <Link href="/dashboard/create-listing?tab=bulk" className="text-primary hover:underline">
                    Switch to bulk listing
                  </Link>
                </p>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="description">Description * (minimum 20 characters)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Provide detailed information about your card"
                className={`min-h-[120px] ${errors.description ? "border-red-500" : ""}`}
                maxLength={MAX_DESCRIPTION_LENGTH}
              />
              <div className="flex justify-between text-sm">
                {errors.description ? (
                  <p className="text-red-500">{errors.description}</p>
                ) : (
                  <p className="text-muted-foreground">
                    {formData.description.length}/{MAX_DESCRIPTION_LENGTH} characters
                    {accountTier === 'premium' && ' (Markdown supported for Premium users)'}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="game">Category *</Label>
              <MobileSelect
                value={formData.game}
                onValueChange={(value) => {
                  if (value === 'accessories') {
                    setFormData(prev => ({ ...prev, game: value, isGraded: false, gradeLevel: undefined, gradingCompany: undefined }));
                  } else {
                    setFormData(prev => ({ ...prev, game: value }));
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="condition">Condition *</Label>
                <MobileSelect
                  value={formData.condition}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, condition: value }))}
                  placeholder="Select condition"
                  className={errors.condition ? "border-red-500" : ""}
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
                {errors.condition && <p className="text-sm text-red-500">{errors.condition}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Language *</Label>
                <MobileSelect
                  value={formData.language}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, language: value }))}
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
                  <Checkbox 
                    id="isGraded" 
                    checked={formData.isGraded}
                    onCheckedChange={(checked) => {
                      if (typeof checked === 'boolean') {
                        setFormData(prev => ({ 
                          ...prev, 
                          isGraded: checked,
                          gradeLevel: checked ? prev.gradeLevel : undefined,
                          gradingCompany: checked ? prev.gradingCompany : undefined
                        }));
                      }
                    }}
                  />
                  <Label htmlFor="isGraded">Graded Card</Label>
                </div>

                {formData.isGraded && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="gradeLevel">Grade Level</Label>
                      <MobileSelect
                        value={formData.gradeLevel?.toString() || ""}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, gradeLevel: parseFloat(value) }))}
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
                        onValueChange={(value) => setFormData(prev => ({ ...prev, gradingCompany: value }))}
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
                <Label htmlFor="finalSale">Final Sale (if applicable)</Label>
                <p className="text-xs text-muted-foreground">
                  Mark this item as final sale (no returns or refunds accepted)
                </p>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <LocationInput
                onLocationSelect={(city, state) => {
                  setFormData(prev => ({ ...prev, city, state }));
                  setErrors(prev => ({ ...prev, location: '' }));
                }}
                initialCity={formData.city}
                initialState={formData.state}
                error={errors.location}
              />
              <p className="text-xs text-muted-foreground">
                Provide option for manual search to help buyers find local trades
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shippingCost">Shipping Cost (free by default)</Label>
              <Input
                id="shippingCost"
                type="number"
                min="0"
                step="0.01"
                value={formData.shippingCost}
                onChange={(e) => setFormData(prev => ({ ...prev, shippingCost: e.target.value }))}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Optional shipping cost that will be added to the total price for buyers. Leave empty for free shipping or buyer-arranged pickup.
              </p>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="images">Upload your photos</Label>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                <Input
                  id="images"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleImageChange}
                  className="hidden"
                />
                <label htmlFor="images" className="cursor-pointer">
                  <div className="space-y-2">
                    <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <Upload className="w-6 h-6" />
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
              <p className="text-xs text-muted-foreground">
                Upload clear photos of your card. A timestamp is required for verification. Maximum 10 images allowed.
              </p>
              {errors.images && <p className="text-sm text-red-500">{errors.images}</p>}
            </div>

            {formData.images.length > 0 && (
              <div className="space-y-4">
                <p className="text-sm text-green-600">
                  {formData.images.length} image(s) selected
                </p>
                <div className="grid grid-cols-4 gap-4">
                  {formData.images.map((file, index) => (
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
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="terms" 
                  checked={formData.termsAccepted}
                  onCheckedChange={(checked) => {
                    if (typeof checked === 'boolean') {
                      setFormData(prev => ({ ...prev, termsAccepted: checked }));
                      if (checked) {
                        setErrors(prev => ({ ...prev, terms: '' }));
                      }
                    }
                  }}
                />
                <label htmlFor="terms" className="text-sm font-medium leading-none">
                  I confirm that I own or have the rights to use these images and agree to the{" "}
                  <Link href="/terms-of-use" className="text-primary hover:underline">
                    Terms of Use
                  </Link>
                </label>
              </div>
              {errors.terms && <p className="text-sm text-red-500">{errors.terms}</p>}
            </div>

            {/* Review Section */}
            <div className="mt-8 p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-4">Review Your Listing</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Title:</strong> {formData.title}</p>
                <p><strong>Price:</strong> {formData.offersOnly ? 'Offers Only' : `$${formData.price}`}</p>
                <p><strong>Category:</strong> {formData.game}</p>
                <p><strong>Condition:</strong> {formData.condition}</p>
                <p><strong>Location:</strong> {formData.city}, {formData.state}</p>
                <p><strong>Images:</strong> {formData.images.length} uploaded</p>
              </div>
            </div>

            {isSubmitting && uploadProgress > 0 && (
              <div className="space-y-2">
                <Progress value={uploadProgress} className="w-full" />
                <p className="text-sm text-center">Uploading images... {Math.round(uploadProgress)}%</p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return 'Basic Information';
      case 2: return 'Details & Condition';
      case 3: return 'Location & Shipping';
      case 4: return 'Images & Review';
      default: return '';
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Create New Listing</h1>
        <div className="text-sm text-muted-foreground">
          <Link href="/dashboard/settings" className="text-primary hover:underline">
            Switch to classic form
          </Link>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Step {currentStep} of 4</span>
          <span>{Math.round((currentStep / 4) * 100)}% Complete</span>
        </div>
        <Progress value={(currentStep / 4) * 100} className="w-full" />
      </div>

      {/* Step Indicator */}
      <div className="flex justify-between items-center">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step < currentStep ? 'bg-primary text-primary-foreground' :
              step === currentStep ? 'bg-primary/20 text-primary border-2 border-primary' :
              'bg-muted text-muted-foreground'
            }`}>
              {step < currentStep ? <Check className="w-4 h-4" /> : step}
            </div>
            {step < 4 && (
              <div className={`w-16 h-0.5 mx-2 ${
                step < currentStep ? 'bg-primary' : 'bg-muted'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>{getStepTitle()}</CardTitle>
        </CardHeader>
        <CardContent>
          {renderStep()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 1}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>
        
        {currentStep < 4 ? (
          <Button onClick={handleNext}>
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Listing'}
          </Button>
        )}
      </div>
    </div>
  );
};