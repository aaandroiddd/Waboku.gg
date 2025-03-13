import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import dynamic from 'next/dynamic';
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useListings } from "@/hooks/useListings";
import { useAccount } from "@/contexts/AccountContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, HelpCircle, Upload, FileSpreadsheet, Image as ImageIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LocationInput } from "@/components/LocationInput";
import { MultiImageUpload } from "@/components/MultiImageUpload";
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

const BulkListingPage = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { createListing } = useListings();
  const { accountTier, features } = useAccount();
  const [activeTab, setActiveTab] = useState("upload");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [bulkListings, setBulkListings] = useState<BulkListingItem[]>([]);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(-1);
  const [overallProgress, setOverallProgress] = useState(0);
  const [showImageUploadDialog, setShowImageUploadDialog] = useState(false);
  const [currentEditingListingId, setCurrentEditingListingId] = useState<string | null>(null);

  // Redirect non-premium users
  useEffect(() => {
    if (!loading && user) {
      if (accountTier !== 'premium') {
        toast({
          title: "Premium Feature",
          description: "Bulk listing is only available for premium users.",
          variant: "destructive",
        });
        router.push("/dashboard");
      }
    } else if (!loading && !user) {
      router.push("/auth/sign-in");
    }
  }, [user, loading, accountTier, router, toast]);

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
        setActiveTab("review");
        
        toast({
          title: "File Processed",
          description: `${listings.length} listings loaded for review.`,
        });
      } catch (error) {
        console.error('Error parsing Excel file:', error);
        toast({
          title: "Error Processing File",
          description: "Could not parse the Excel file. Please ensure it follows the template format.",
          variant: "destructive",
        });
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
      toast({
        title: "Images Added",
        description: `${images.length} image${images.length > 1 ? 's' : ''} added to listing.`,
      });
    }
  };

  // Submit all listings
  const submitAllListings = async () => {
    // Check if all listings have images
    const missingImages = bulkListings.filter(listing => !listing.images || listing.images.length === 0);
    if (missingImages.length > 0) {
      toast({
        title: "Missing Images",
        description: `${missingImages.length} listings are missing images. Please add images to all listings.`,
        variant: "destructive",
      });
      return;
    }
    
    // Check for any listings with errors
    const errorListings = bulkListings.filter(listing => listing.status === 'error');
    if (errorListings.length > 0) {
      toast({
        title: "Listings With Errors",
        description: `${errorListings.length} listings have errors. Please fix them before submitting.`,
        variant: "destructive",
      });
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
          coverImageIndex: 0,
          city: listing.city || "", // Use the city from the listing (set by LocationInput)
          state: listing.state || "", // Use the state from the listing (set by LocationInput)
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
        
        toast({
          title: "Error Creating Listing",
          description: `Failed to create listing "${listing.title}": ${error.message || "Unknown error"}`,
          variant: "destructive",
        });
      }
    }
    
    setIsSubmitting(false);
    
    // Check if all listings were successful
    const failedListings = bulkListings.filter(listing => listing.status === 'error');
    
    if (failedListings.length === 0) {
      toast({
        title: "Success!",
        description: `All ${bulkListings.length} listings were created successfully.`,
      });
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push("/dashboard?status=bulk-listings-created");
      }, 2000);
    } else {
      toast({
        title: "Partial Success",
        description: `${bulkListings.length - failedListings.length} listings created, ${failedListings.length} failed.`,
        variant: "warning",
      });
    }
  };

  // Remove a listing from the list
  const removeListing = (listingId: string) => {
    setBulkListings(prev => prev.filter(listing => listing.id !== listingId));
  };

  if (loading || !user || accountTier !== 'premium') {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Bulk Listing Upload</h1>
          <Badge variant="premium" className="bg-gradient-to-r from-amber-500 to-yellow-300 text-black">
            Premium Feature
          </Badge>
        </div>
        
        <Alert>
          <HelpCircle className="h-4 w-4" />
          <AlertTitle>Bulk Listing Instructions</AlertTitle>
          <AlertDescription>
            <p className="mb-2">Upload an Excel spreadsheet with multiple listings, then add images to each listing before submitting.</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mr-2"
              onClick={generateTemplate}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </AlertDescription>
        </Alert>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload Spreadsheet</TabsTrigger>
            <TabsTrigger value="review" disabled={bulkListings.length === 0}>Review & Add Images</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="spreadsheet">Upload Excel Spreadsheet</Label>
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                      <Input
                        id="spreadsheet"
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <label htmlFor="spreadsheet" className="cursor-pointer">
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
                  </div>
                  
                  <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4 inline-block mr-2" />
                    Make sure your spreadsheet follows the template format. Each row will become a separate listing.
                  </div>
                  
                  <div className="text-sm bg-amber-100 dark:bg-amber-800/40 midnight:bg-amber-800/30 text-amber-800 dark:text-amber-100 midnight:text-amber-50 p-3 rounded-lg border-l-2 border-amber-500 dark:border-amber-600 midnight:border-amber-700">
                    <AlertCircle className="w-4 h-4 inline-block mr-2" />
                    <strong>Important:</strong> Each game category has specific valid options (e.g., 'pokemon', 'mtg', 'lorcana', 'flesh-and-blood'). 
                    The template includes examples and instructions for all valid options.
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="review" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">Review Listings</h2>
                    <div className="text-sm text-muted-foreground">
                      {bulkListings.length} listings loaded
                    </div>
                  </div>
                  
                  {isSubmitting && (
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span>Uploading listing {currentUploadIndex + 1} of {bulkListings.length}</span>
                        <span>{overallProgress}% complete</span>
                      </div>
                      <Progress value={overallProgress} className="w-full" />
                      <div className="text-sm text-center">
                        Current listing upload progress: {Math.round(uploadProgress)}%
                      </div>
                    </div>
                  )}
                  
                  {/* Location input for all listings */}
                  <div className="p-6 bg-card rounded-lg border border-border shadow-sm">
                    <h3 className="text-lg font-semibold mb-3 text-primary">Set Location for All Listings</h3>
                    <div className="mb-3 text-sm text-foreground">
                      This location will be applied to all listings in this batch.
                    </div>
                    <div className="bg-amber-100 dark:bg-amber-800/30 midnight:bg-amber-900/20 p-4 rounded-md border border-amber-300 dark:border-amber-700/50 midnight:border-amber-800/40 mb-4">
                      <div className="text-sm text-amber-900 dark:text-amber-100 midnight:text-amber-50">
                        <strong>Important:</strong> Setting a location helps buyers find your cards in their area.
                      </div>
                    </div>
                    <LocationInput 
                      onLocationSelect={(city, state) => {
                        // Update all listings with the selected location
                        setBulkListings(prevListings => 
                          prevListings.map(listing => ({
                            ...listing,
                            city,
                            state
                          }))
                        );
                      }}
                      placeholder="Search for a location to apply to all listings"
                    />
                  </div>
                  
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Game</TableHead>
                          <TableHead>Condition</TableHead>
                          <TableHead>Image</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bulkListings.map((listing) => (
                          <TableRow key={listing.id} className={listing.status === 'error' ? 'bg-red-50/70 dark:bg-red-900/20 midnight:bg-red-900/30 border-l-2 border-red-400 dark:border-red-700' : ''}>
                            <TableCell className="font-medium">{listing.title}</TableCell>
                            <TableCell>${listing.price}</TableCell>
                            <TableCell>{GAME_CATEGORIES[listing.game as keyof typeof GAME_CATEGORIES] || listing.game}</TableCell>
                            <TableCell>{CONDITION_MAPPING[listing.condition as keyof typeof CONDITION_MAPPING] || listing.condition}</TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                {listing.images && listing.images.length > 0 ? (
                                  <div 
                                    className="relative w-12 h-12 cursor-pointer" 
                                    onClick={() => {
                                      // Find the listing index
                                      const index = bulkListings.findIndex(item => item.id === listing.id);
                                      if (index !== -1) {
                                        setCurrentEditingListingId(listing.id);
                                        setShowImageUploadDialog(true);
                                      }
                                    }}
                                  >
                                    <img 
                                      src={URL.createObjectURL(listing.images[0])} 
                                      alt={listing.title} 
                                      className="w-12 h-12 object-cover rounded-md"
                                    />
                                    {listing.images.length > 1 && (
                                      <Badge className="absolute -top-2 -right-2 bg-primary text-xs">
                                        {listing.images.length}
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <div 
                                    className="cursor-pointer flex items-center justify-center w-12 h-12 bg-muted rounded-md hover:bg-muted/80 transition-colors"
                                    onClick={() => {
                                      setCurrentEditingListingId(listing.id);
                                      setShowImageUploadDialog(true);
                                    }}
                                  >
                                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {listing.status === 'error' && (
                                <Badge variant="destructive">Error</Badge>
                              )}
                              {listing.status === 'pending' && (
                                <Badge variant="outline">Pending Image</Badge>
                              )}
                              {listing.status === 'ready' && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 midnight:bg-green-900/30 midnight:text-green-300 midnight:border-green-800/70">
                                  Ready
                                </Badge>
                              )}
                              {listing.status === 'uploaded' && (
                                <Badge variant="default" className="bg-blue-500">Uploaded</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                {listing.image && listing.status !== 'uploaded' && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => {
                                      const input = document.getElementById(`image-${listing.id}`) as HTMLInputElement;
                                      if (input) input.click();
                                    }}
                                    disabled={isSubmitting}
                                  >
                                    Change Image
                                  </Button>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => removeListing(listing.id)}
                                  disabled={isSubmitting}
                                >
                                  Remove
                                </Button>
                              </div>
                              {listing.error && (
                                <div className="text-xs mt-1 p-2 rounded bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300 midnight:bg-red-900/40 midnight:text-red-200 border border-red-200 dark:border-red-800 midnight:border-red-700 shadow-sm">
                                  <span className="font-medium">Error:</span> {listing.error}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  <div className="flex justify-between pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab("upload")}
                      disabled={isSubmitting}
                    >
                      Back to Upload
                    </Button>
                    
                    <Button
                      type="button"
                      onClick={submitAllListings}
                      disabled={isSubmitting || bulkListings.length === 0}
                    >
                      {isSubmitting ? 'Uploading...' : 'Create All Listings'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Multi-image upload dialog */}
      {currentEditingListingId && (
        <MultiImageUpload
          open={showImageUploadDialog}
          onOpenChange={setShowImageUploadDialog}
          onImagesConfirm={handleImagesConfirm}
          existingImages={bulkListings.find(l => l.id === currentEditingListingId)?.images || []}
          maxImages={5}
        />
      )}
    </DashboardLayout>
  );
};

export default dynamic(() => Promise.resolve(BulkListingPage), {
  ssr: false
});