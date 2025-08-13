import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { useListings } from '@/hooks/useListings';
import { useProfile } from '@/hooks/useProfile';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { FileSpreadsheet, Upload, AlertTriangle, Info, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { LocationInput } from '@/components/LocationInput';
import { MultiImageUpload } from '@/components/MultiImageUpload';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import * as XLSX from 'xlsx';

// Define the structure of a listing from the spreadsheet
interface BulkListingItem {
  id: string; // Generated unique ID
  title: string;
  description: string;
  price: string;
  game: string;
  condition: string;
  cardName?: string;
  quantity?: string;
  isGraded?: boolean;
  gradeLevel?: number;
  gradingCompany?: string;
  images?: File[];
  coverImageIndex?: number;
  city?: string;
  state?: string;
  status: 'pending' | 'ready' | 'error' | 'uploaded';
  error?: string;
}

// Template structure for download
const TEMPLATE_HEADERS = [
  'Title*', 
  'Description', 
  'Price*', 
  'Game Category*', 
  'Condition*', 
  'Card Name', 
  'Quantity', 
  'Is Graded (true/false)', 
  'Grade Level (1-10)', 
  'Grading Company'
];

// Sample data for the template
const TEMPLATE_SAMPLE_DATA = [
  [
    'Charizard Holo 1st Edition', 
    'Near mint condition Charizard from Base Set', 
    '1000.00', 
    'pokemon', 
    'near_mint', 
    'Charizard', 
    '1', 
    'false', 
    '', 
    ''
  ],
  [
    'Liliana of the Veil Foil', 
    'Modern Horizons 2 version in excellent condition', 
    '45.50', 
    'mtg', 
    'excellent', 
    'Liliana of the Veil', 
    '1', 
    'false', 
    '', 
    ''
  ],
  [
    'Disney Lorcana TCG Ursula Foil', 
    'Mint condition Disney Lorcana card', 
    '69.99', 
    'lorcana', 
    'mint', 
    'Ursula', 
    '1', 
    'false', 
    '', 
    ''
  ],
  [
    'Flesh and Blood TCG Alpha Booster Box', 
    'Sealed Alpha booster box', 
    '3627.00', 
    'flesh-and-blood', 
    'mint', 
    '', 
    '1', 
    'false', 
    '', 
    ''
  ]
];

// Game categories mapping
const GAME_CATEGORIES = {
  'dbs': 'Dragon Ball Super Card Game',
  'digimon': 'Digimon',
  'lorcana': 'Disney Lorcana',
  'flesh-and-blood': 'Flesh and Blood',
  'gundam': 'Gundam',
  'mtg': 'Magic: The Gathering',
  'onepiece': 'One Piece Card Game',
  'pokemon': 'Pokemon',
  'star-wars': 'Star Wars: Unlimited',
  'union-arena': 'Union Arena',
  'universus': 'Universus',
  'vanguard': 'Vanguard',
  'weiss': 'Weiss Schwarz',
  'yugioh': 'Yu-Gi-Oh!',
  'accessories': 'Accessories',
  'other': 'Other'
};

// Condition mapping
const CONDITION_MAPPING = {
  'mint': 'Mint',
  'near_mint': 'Near Mint',
  'excellent': 'Excellent',
  'good': 'Good',
  'light_played': 'Light Played',
  'played': 'Played',
  'poor': 'Poor'
};

// Instructions row for the template
const TEMPLATE_INSTRUCTIONS = [
  [
    '--- INSTRUCTIONS ---',
    'Please follow these guidelines when filling out the template',
    '',
    '--- VALID GAME CATEGORIES ---',
    `Valid options: ${Object.keys(GAME_CATEGORIES).join(', ')}`,
    '--- VALID CONDITIONS ---',
    `Valid options: ${Object.keys(CONDITION_MAPPING).join(', ')}`,
    '',
    '',
    ''
  ]
];

export default function BulkListingPage() {
  const { user } = useAuth();
  const { isPremium, isLoading: premiumLoading } = usePremiumStatus();
  const { createListing } = useListings();
  const { profile } = useProfile(user?.uid);
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [bulkListings, setBulkListings] = useState<BulkListingItem[]>([]);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(-1);
  const [overallProgress, setOverallProgress] = useState(0);
  const [showImageUploadDialog, setShowImageUploadDialog] = useState(false);
  const [currentEditingListingId, setCurrentEditingListingId] = useState<string | null>(null);
  const [removeConfirmListingId, setRemoveConfirmListingId] = useState<string | null>(null);

  useEffect(() => {
    if (!premiumLoading && !isPremium) {
      toast.error('Bulk listing is only available for premium users');
      router.push('/dashboard/create-listing');
    }
  }, [isPremium, premiumLoading, router]);

  // Generate template for download
  const generateTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS, 
      ...TEMPLATE_INSTRUCTIONS,
      ...TEMPLATE_SAMPLE_DATA
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bulk Listing Template");
    
    // Add column widths
    const wscols = TEMPLATE_HEADERS.map(() => ({ wch: 25 }));
    worksheet['!cols'] = wscols;
    
    // Generate file
    XLSX.writeFile(workbook, "bulk_listing_template.xlsx");
  };

  // Handle file upload and parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        // Validate and transform data
        const listings: BulkListingItem[] = jsonData.map((row: any, index) => {
          // Generate a unique ID for each listing
          const id = `bulk-${Date.now()}-${index}`;
          
          // Basic validation
          const errors = [];
          if (!row['Title*']) errors.push('Title is required');
          if (!row['Price*']) errors.push('Price is required');
          if (!row['Game Category*']) errors.push('Game category is required');
          if (!row['Condition*']) errors.push('Condition is required');
          
          // Check if game category is valid
          const gameCategory = row['Game Category*']?.toLowerCase();
          if (gameCategory && !Object.keys(GAME_CATEGORIES).includes(gameCategory)) {
            errors.push(`Invalid game category: ${gameCategory}. Valid options: ${Object.keys(GAME_CATEGORIES).join(', ')}`);
          }
          
          // Check if condition is valid
          const condition = row['Condition*']?.toLowerCase();
          if (condition && !Object.keys(CONDITION_MAPPING).includes(condition)) {
            errors.push(`Invalid condition: ${condition}. Valid options: ${Object.keys(CONDITION_MAPPING).join(', ')}`);
          }
          
          // Parse isGraded
          let isGraded = false;
          if (row['Is Graded (true/false)']) {
            const gradedValue = String(row['Is Graded (true/false)']).toLowerCase();
            isGraded = gradedValue === 'true' || gradedValue === 'yes' || gradedValue === '1';
          }
          
          // Parse grade level
          let gradeLevel: number | undefined = undefined;
          if (isGraded && row['Grade Level (1-10)']) {
            const level = parseFloat(row['Grade Level (1-10)']);
            if (!isNaN(level) && level >= 1 && level <= 10) {
              gradeLevel = level;
            } else {
              errors.push('Grade level must be between 1 and 10');
            }
          }
          
          return {
            id,
            title: row['Title*'] || '',
            description: row['Description'] || '',
            price: row['Price*'] ? String(row['Price*']) : '',
            game: row['Game Category*'] || '',
            condition: row['Condition*'] || '',
            cardName: row['Card Name'] || '',
            quantity: row['Quantity'] ? String(row['Quantity']) : '',
            isGraded,
            gradeLevel,
            gradingCompany: row['Grading Company'] || '',
            status: errors.length > 0 ? 'error' : 'pending',
            error: errors.length > 0 ? errors.join(', ') : undefined
          };
        });
        
        setBulkListings(listings);
        
        toast.success(`${listings.length} listings loaded for review.`);
      } catch (error) {
        console.error('Error parsing Excel file:', error);
        toast.error('Could not parse the Excel file. Please ensure it follows the template format.');
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  // Handle images confirmation from the multi-image upload dialog
  const handleImagesConfirm = (images: File[], coverImageIndex: number = 0) => {
    if (!currentEditingListingId) return;
    
    // Update the listing with the images and cover image index
    setBulkListings(prev => prev.map(listing => {
      if (listing.id === currentEditingListingId) {
        return {
          ...listing,
          images: images,
          coverImageIndex: coverImageIndex,
          status: images.length > 0 ? 'ready' : 'pending'
        };
      }
      return listing;
    }));
    
    // Close the dialog
    setShowImageUploadDialog(false);
    setCurrentEditingListingId(null);
    
    // Show toast
    if (images.length > 0) {
      toast.success(`${images.length} image${images.length > 1 ? 's' : ''} added to listing.`);
    }
  };

  // Submit all listings
  const submitAllListings = async () => {
    // Check if all listings have images
    const missingImages = bulkListings.filter(listing => !listing.images || listing.images.length === 0);
    if (missingImages.length > 0) {
      toast.error(`${missingImages.length} listings are missing images. Please add images to all listings.`);
      return;
    }
    
    // Check if location has been set
    const hasLocation = bulkListings.length > 0 && bulkListings[0].city && bulkListings[0].state;
    if (!hasLocation) {
      toast.error('Please set a location for your listings before submitting.');
      return;
    }
    
    // Check for any listings with errors
    const errorListings = bulkListings.filter(listing => listing.status === 'error');
    if (errorListings.length > 0) {
      toast.error(`${errorListings.length} listings have errors. Please fix them before submitting.`);
      return;
    }
    
    setIsSubmitting(true);
    setUploadProgress(0);
    setCurrentUploadIndex(0);
    
    // Process listings one by one
    for (let i = 0; i < bulkListings.length; i++) {
      setCurrentUploadIndex(i);
      const listing = bulkListings[i];
      
      try {
        // Update status to uploading
        setBulkListings(prev => prev.map((item, idx) => 
          idx === i ? { ...item, status: 'uploaded' } : item
        ));
        
        // Create the listing
        await createListing({
          title: listing.title,
          description: listing.description,
          price: listing.price,
          game: listing.game,
          condition: listing.condition,
          cardName: listing.cardName,
          quantity: listing.quantity,
          isGraded: listing.isGraded,
          gradeLevel: listing.gradeLevel,
          gradingCompany: listing.gradingCompany,
          images: listing.images || [],
          coverImageIndex: listing.coverImageIndex || 0,
          city: listing.city || "",
          state: listing.state || "",
          termsAccepted: true,
          onUploadProgress: (progress: number) => {
            setUploadProgress(progress);
          }
        });
        
        // Update overall progress
        setOverallProgress(Math.round(((i + 1) / bulkListings.length) * 100));
        
      } catch (error: any) {
        console.error('Error creating listing:', error);
        
        // Update listing status to error
        setBulkListings(prev => prev.map((item, idx) => 
          idx === i ? { ...item, status: 'error', error: error.message || "Failed to create listing" } : item
        ));
        
        toast.error(`Failed to create listing "${listing.title}": ${error.message || "Unknown error"}`);
      }
    }
    
    setIsSubmitting(false);
    
    // Check if all listings were successful
    const failedListings = bulkListings.filter(listing => listing.status === 'error');
    
    if (failedListings.length === 0) {
      toast.success(`All ${bulkListings.length} listings were created successfully.`);
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push("/dashboard?status=bulk-listings-created");
      }, 2000);
    } else {
      toast.error(`${bulkListings.length - failedListings.length} listings created, ${failedListings.length} failed.`);
    }
  };

  // Remove a listing from the list
  const removeListing = (listingId: string) => {
    setBulkListings(prev => prev.filter(listing => listing.id !== listingId));
  };

  // Handle remove listing with mobile-friendly confirmation
  const handleRemoveListing = (listing: BulkListingItem) => {
    if (isMobile) {
      // Use native HTML confirm for mobile
      const confirmed = window.confirm(
        `Are you sure you want to remove "${listing.title}" from your bulk creation? This action cannot be undone and you'll lose all the information entered for this listing.`
      );
      if (confirmed) {
        removeListing(listing.id);
      }
    } else {
      // Use AlertDialog for desktop
      setRemoveConfirmListingId(listing.id);
    }
  };

  if (premiumLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!isPremium) {
    return null; // Will redirect in useEffect
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Bulk Listing</h1>
            <p className="text-muted-foreground">Create multiple listings at once using Excel</p>
          </div>
          <Badge variant="secondary" className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
            Premium Feature
          </Badge>
        </div>

        <div className="space-y-6">
          {/* Step 1: Download Template */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Step 1: Download Template
              </CardTitle>
              <CardDescription>
                Download our Excel template to get started with bulk listing. Fill in your listing details following the provided format.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={generateTemplate}
                className="flex items-center gap-2"
                variant="outline"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Download Template
              </Button>
            </CardContent>
          </Card>

          {/* Step 2: Upload Filled Template */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Step 2: Upload Your Listings
              </CardTitle>
              <CardDescription>
                Upload your completed Excel file. We'll validate the data and show you a preview.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="bulk-upload"
                />
                <label htmlFor="bulk-upload" className="cursor-pointer">
                  <div className="space-y-2">
                    <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-medium">
                      Click to upload or drag and drop
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Excel files only (.xlsx, .xls)
                    </p>
                  </div>
                </label>
              </div>
              
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                <Info className="w-4 h-4 inline-block mr-2" />
                Make sure your spreadsheet follows the template format. Each row will become a separate listing.
              </div>

              <Alert className="bg-yellow-500/10 border-yellow-500 text-yellow-700 dark:text-yellow-500">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Important</AlertTitle>
                <AlertDescription>
                  Each game category has specific valid options (e.g., 'pokemon', 'mtg', 'lorcana', 'flesh-and-blood'). The template includes examples and instructions for all valid options.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Step 3: Review and Add Images */}
          {bulkListings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Step 3: Review Listings & Add Images
                </CardTitle>
                <CardDescription>
                  Review your listings below and add images for each one. All listings must have at least one image.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Location Input for all listings */}
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Set Location for All Listings</h4>
                  <LocationInput
                    onLocationSelect={(city, state) => {
                      // Update all listings with the same location
                      setBulkListings(prev => prev.map(listing => ({
                        ...listing,
                        city,
                        state
                      })));
                    }}
                    initialCity={bulkListings[0]?.city || profile?.city || ""}
                    initialState={bulkListings[0]?.state || profile?.state || ""}
                  />
                </div>

                {/* Listings Table */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Condition</TableHead>
                        <TableHead>Images</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bulkListings.map((listing, index) => (
                        <TableRow key={listing.id}>
                          <TableCell className="font-medium max-w-[200px] truncate">
                            {listing.title}
                          </TableCell>
                          <TableCell>${listing.price}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {GAME_CATEGORIES[listing.game] || listing.game}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {CONDITION_MAPPING[listing.condition] || listing.condition}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {listing.images && listing.images.length > 0 ? (
                                <Badge variant="default" className="bg-green-500">
                                  {listing.images.length} image{listing.images.length > 1 ? 's' : ''}
                                </Badge>
                              ) : (
                                <Badge variant="destructive">
                                  No images
                                </Badge>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setCurrentEditingListingId(listing.id);
                                  setShowImageUploadDialog(true);
                                }}
                              >
                                <ImageIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            {listing.status === 'error' ? (
                              <Badge variant="destructive">Error</Badge>
                            ) : listing.status === 'ready' ? (
                              <Badge variant="default" className="bg-green-500">Ready</Badge>
                            ) : listing.status === 'uploaded' ? (
                              <Badge variant="default" className="bg-blue-500">Uploaded</Badge>
                            ) : (
                              <Badge variant="secondary">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {isMobile ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRemoveListing(listing)}
                              >
                                Remove
                              </Button>
                            ) : (
                              <AlertDialog open={removeConfirmListingId === listing.id} onOpenChange={(open) => !open && setRemoveConfirmListingId(null)}>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleRemoveListing(listing)}
                                  >
                                    Remove
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove Listing</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to remove "{listing.title}" from your bulk creation? This action cannot be undone and you'll lose all the information entered for this listing.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => {
                                        removeListing(listing.id);
                                        setRemoveConfirmListingId(null);
                                      }}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Error Details */}
                {bulkListings.some(listing => listing.status === 'error') && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-red-600">Listings with Errors:</h4>
                    {bulkListings
                      .filter(listing => listing.status === 'error')
                      .map(listing => (
                        <div key={listing.id} className="bg-red-50 dark:bg-red-950 p-3 rounded-lg">
                          <p className="font-medium">{listing.title}</p>
                          <p className="text-sm text-red-600 dark:text-red-400">{listing.error}</p>
                        </div>
                      ))}
                  </div>
                )}

                {/* Submit All Button */}
                <div className="flex justify-between items-center pt-6 border-t">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      onClick={() => router.push('/dashboard/create-listing')}
                      disabled={isSubmitting}
                    >
                      Switch to Single Listing
                    </Button>
                    <div className="text-sm text-muted-foreground">
                      {bulkListings.length} listing{bulkListings.length > 1 ? 's' : ''} ready to upload
                    </div>
                  </div>
                  <Button
                    onClick={submitAllListings}
                    disabled={
                      isSubmitting || 
                      bulkListings.length === 0 ||
                      bulkListings.some(listing => !listing.images || listing.images.length === 0) ||
                      bulkListings.some(listing => listing.status === 'error')
                    }
                    className="flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Creating Listings...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Create All Listings
                      </>
                    )}
                  </Button>
                </div>

                {/* Progress during upload */}
                {isSubmitting && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Overall Progress</span>
                      <span>{overallProgress}%</span>
                    </div>
                    <Progress value={overallProgress} className="w-full" />
                    {currentUploadIndex >= 0 && (
                      <p className="text-sm text-center">
                        Uploading listing {currentUploadIndex + 1} of {bulkListings.length}...
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Multi-Image Upload Dialog */}
        {showImageUploadDialog && (
          <MultiImageUpload
            open={showImageUploadDialog}
            onOpenChange={(open) => {
              setShowImageUploadDialog(open);
              if (!open) {
                setCurrentEditingListingId(null);
              }
            }}
            onImagesConfirm={handleImagesConfirm}
            existingImages={
              currentEditingListingId 
                ? bulkListings.find(l => l.id === currentEditingListingId)?.images || []
                : []
            }
            maxImages={10}
          />
        )}
      </div>
    </DashboardLayout>
  );
}