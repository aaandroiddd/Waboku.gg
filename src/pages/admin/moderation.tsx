import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Footer } from '@/components/Footer';
import { GlobalLoading } from '@/components/GlobalLoading';
import { Listing } from '@/types/database';
import Image from 'next/image';
import { formatPrice } from '@/lib/price';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface ApiResponse {
  success?: boolean;
  error?: string;
  message?: string;
  [key: string]: any;
}

export default function ModerationDashboard() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminSecret, setAdminSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [responseDialog, setResponseDialog] = useState(false);
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [viewImageDialog, setViewImageDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, action: 'approve' | 'reject', listingId: string}>({isOpen: false, action: 'approve', listingId: ''});

  useEffect(() => {
    const secret = localStorage.getItem('admin_secret');
    if (secret) {
      setAdminSecret(secret);
      verifyAdmin(secret);
    } else {
      // If no admin secret is found, we'll check if user is a moderator in the other useEffect
      // Only set pageLoading to false if we're not going to verify admin
      if (!user) {
        setPageLoading(false);
      }
    }
  }, []);

  const verifyAdmin = async (secret: string) => {
    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${secret}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setIsAuthorized(true);
        localStorage.setItem('admin_secret', secret);
        fetchListingsForModeration(secret);
      } else {
        setIsAuthorized(false);
        localStorage.removeItem('admin_secret');
      }
    } catch (error) {
      console.error('Error verifying admin:', error);
      setIsAuthorized(false);
    } finally {
      setPageLoading(false);
    }
  };
  
  // Check if user is a moderator
  const { user, getIdToken } = useAuth();
  
  useEffect(() => {
    const checkModeratorStatus = async () => {
      if (!user) return;
      
      try {
        // Get the auth token
        const token = await user.getIdToken(true);
        
        // Try to fetch listings using moderator authentication
        const response = await fetch('/api/admin/moderation/get-listings?filter=pending', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          setIsAuthorized(true);
          const data = await response.json();
          setListings(data.listings || []);
        }
      } catch (error) {
        console.error('Error checking moderator status:', error);
      } finally {
        setPageLoading(false);
      }
    };
    
    if (user) {
      checkModeratorStatus();
    }
  }, [user]);

  const fetchListingsForModeration = async (secret: string, filterType: string = 'pending') => {
    setListingsLoading(true);
    try {
      const response = await fetch(`/api/admin/moderation/get-listings?filter=${filterType}`, {
        method: 'GET',
        headers: {
          'x-admin-secret': secret,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch listings');
      }
      
      const data = await response.json();
      setListings(data.listings || []);
    } catch (error) {
      console.error('Error fetching listings for moderation:', error);
      toast.error('Failed to fetch listings for moderation');
    } finally {
      setListingsLoading(false);
    }
  };

  const handleApproveReject = async (
    listingId: string, 
    action: 'approve' | 'reject', 
    notes: string = '', 
    rejectionReason: string = ''
  ) => {
    setLoading(true);
    try {
      // Try to use admin secret if available
      let headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (adminSecret) {
        headers['x-admin-secret'] = adminSecret;
      } else if (user) {
        // Use Firebase auth token for moderator authentication
        const token = await user.getIdToken(true);
        headers['Authorization'] = `Bearer ${token}`;
        // Add moderator ID if available
        headers['moderatorId'] = user.uid;
      } else {
        throw new Error('No authentication method available');
      }
      
      console.log(`Sending ${action} request for listing ${listingId}`);
      
      const response = await fetch('/api/admin/moderation/update-listing', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          listingId,
          action,
          notes,
          rejectionReason
        })
      });
      
      console.log(`Response status: ${response.status}`);
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update listing');
      }
      
      // Remove the listing from the list
      setListings(prev => prev.filter(listing => listing.id !== listingId));
      
      // Refresh the current tab's listings
      const currentTab = document.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute('data-value');
      if (currentTab && (currentTab === 'pending' || currentTab === 'approved' || currentTab === 'rejected')) {
        if (adminSecret) {
          fetchListingsForModeration(adminSecret, currentTab);
        } else if (user) {
          // Use Firebase auth token for moderator authentication
          try {
            setListingsLoading(true);
            const token = await user.getIdToken(true);
            const response = await fetch(`/api/admin/moderation/get-listings?filter=${currentTab}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (!response.ok) {
              throw new Error('Failed to fetch listings');
            }
            
            const data = await response.json();
            setListings(data.listings || []);
          } catch (error) {
            console.error(`Error refreshing ${currentTab} listings:`, error);
            toast.error(`Failed to refresh listings`);
          } finally {
            setListingsLoading(false);
          }
        }
      }
      
      toast.success(`Listing ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
    } catch (error) {
      console.error(`Error ${action}ing listing:`, error);
      toast.error(`Failed to ${action} listing`);
    } finally {
      setLoading(false);
      setConfirmDialog({isOpen: false, action: 'approve', listingId: ''});
    }
  };

  const viewListing = (listing: Listing) => {
    setSelectedListing(listing);
    setResponseDialog(true);
  };

  const viewImage = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setViewImageDialog(true);
  };

  // Handle redirect if not authorized
  useEffect(() => {
    if (!pageLoading && !isAuthorized) {
      router.push('/admin/login');
    }
  }, [pageLoading, isAuthorized, router]);

  // Show loading animation while the page is initializing
  if (pageLoading) {
    return <GlobalLoading message="Loading moderation dashboard..." />;
  }

  if (!isAuthorized) {
    return <GlobalLoading message="Redirecting to login page..." />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto p-8 flex-grow">
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Content Moderation Dashboard</h1>
            <Button 
              variant="outline" 
              onClick={() => router.push('/admin')}
            >
              Back to Admin
            </Button>
          </div>
          
          <Alert className="mb-6">
            <AlertDescription>
              Review listings that have been flagged for moderation. Approve or reject listings based on content guidelines.
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="pending" className="space-y-4" onValueChange={async (value) => {
            if (value === 'approved' || value === 'rejected' || value === 'pending') {
              if (adminSecret) {
                fetchListingsForModeration(adminSecret, value);
              } else if (user) {
                // Use Firebase auth token for moderator authentication
                try {
                  setListingsLoading(true);
                  const token = await user.getIdToken(true);
                  const response = await fetch(`/api/admin/moderation/get-listings?filter=${value}`, {
                    method: 'GET',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json'
                    }
                  });
                  
                  if (!response.ok) {
                    throw new Error('Failed to fetch listings');
                  }
                  
                  const data = await response.json();
                  setListings(data.listings || []);
                } catch (error) {
                  console.error(`Error fetching ${value} listings:`, error);
                  toast.error(`Failed to fetch ${value} listings`);
                } finally {
                  setListingsLoading(false);
                }
              }
            } else if (value === 'reports') {
              // Fetch reports
              try {
                setListingsLoading(true);
                
                // Try to use admin secret if available
                let headers: Record<string, string> = {
                  'Content-Type': 'application/json'
                };
                
                if (adminSecret) {
                  headers['x-admin-secret'] = adminSecret;
                } else if (user) {
                  // Use Firebase auth token for moderator authentication
                  const token = await user.getIdToken(true);
                  headers['Authorization'] = `Bearer ${token}`;
                }
                
                const response = await fetch('/api/admin/moderation/get-reports?filter=pending', {
                  method: 'GET',
                  headers
                });
                
                if (!response.ok) {
                  throw new Error('Failed to fetch reports');
                }
                
                const data = await response.json();
                setListings(data.reports || []);
              } catch (error) {
                console.error('Error fetching reports:', error);
                toast.error('Failed to fetch reports');
              } finally {
                setListingsLoading(false);
              }
            }
          }}>
            <TabsList>
              <TabsTrigger value="pending" data-value="pending">Pending Review</TabsTrigger>
              <TabsTrigger value="approved" data-value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected" data-value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="reports" data-value="reports">Reports</TabsTrigger>
              <TabsTrigger value="info" data-value="info">Guidelines</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4">
              {listingsLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">Loading listings...</span>
                </div>
              ) : listings.length === 0 ? (
                <div className="text-center py-12 bg-muted rounded-lg">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-xl font-medium mb-2">No Listings Need Review</h3>
                  <p className="text-muted-foreground">All listings have been moderated. Check back later.</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {listings.map((listing) => (
                    <Card key={listing.id} className="overflow-hidden hover:shadow-md transition-shadow">
                      <div className="aspect-video relative bg-muted">
                        {listing.imageUrls && listing.imageUrls.length > 0 ? (
                          <Image
                            src={listing.imageUrls[0]}
                            alt={listing.title}
                            fill
                            className="object-cover"
                            onClick={() => viewImage(listing.imageUrls[0])}
                            style={{ cursor: 'pointer' }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-muted-foreground">No image</span>
                          </div>
                        )}
                        <div className="absolute top-2 right-2">
                          <Badge variant="destructive" className="font-medium">
                            Needs Review
                          </Badge>
                        </div>
                        {listing.reviewReason && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2 text-xs text-white">
                            <span className="font-semibold">Reason:</span> {listing.reviewReason}
                            {listing.reviewCategory && (
                              <span className="ml-1 px-1.5 py-0.5 bg-gray-700 rounded text-xs">
                                {listing.reviewCategory}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg truncate">{listing.title}</CardTitle>
                        <CardDescription>
                          <div className="flex justify-between">
                            <span>By {listing.username}</span>
                            <span className="font-medium">{formatPrice(listing.price)}</span>
                          </div>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <div className="flex flex-wrap gap-2 mb-2">
                          <Badge variant="outline">{listing.game}</Badge>
                          <Badge variant="outline">{listing.condition}</Badge>
                          {listing.isGraded && (
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                              {listing.gradingCompany} {listing.gradeLevel}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {listing.description || 'No description provided'}
                        </p>
                      </CardContent>
                      <CardFooter className="pt-2">
                        <div className="flex justify-between w-full gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="flex-1"
                            onClick={() => viewListing(listing)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Details
                          </Button>
                          <Button 
                            variant="default" 
                            size="sm"
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            onClick={() => setConfirmDialog({isOpen: true, action: 'approve', listingId: listing.id})}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            className="flex-1"
                            onClick={() => setConfirmDialog({isOpen: true, action: 'reject', listingId: listing.id})}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="approved" className="space-y-4">
              {listingsLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">Loading approved listings...</span>
                </div>
              ) : listings.length === 0 ? (
                <div className="text-center py-12 bg-muted rounded-lg">
                  <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
                  <h3 className="text-xl font-medium mb-2">No Approved Listings Found</h3>
                  <p className="text-muted-foreground">There are no recently approved listings to display.</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {listings.map((listing) => (
                    <Card key={listing.id} className="overflow-hidden hover:shadow-md transition-shadow">
                      <div className="aspect-video relative bg-muted">
                        {listing.imageUrls && listing.imageUrls.length > 0 ? (
                          <Image
                            src={listing.imageUrls[0]}
                            alt={listing.title}
                            fill
                            className="object-cover"
                            onClick={() => viewImage(listing.imageUrls[0])}
                            style={{ cursor: 'pointer' }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-muted-foreground">No image</span>
                          </div>
                        )}
                        <div className="absolute top-2 right-2">
                          <Badge variant="success" className="font-medium bg-green-600 hover:bg-green-700">
                            Approved
                          </Badge>
                        </div>
                        {listing.moderatedAt && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2 text-xs text-white">
                            <span className="font-semibold">Approved:</span> {new Date(listing.moderatedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg truncate">{listing.title}</CardTitle>
                        <CardDescription>
                          <div className="flex justify-between">
                            <span>By {listing.username}</span>
                            <span className="font-medium">{formatPrice(listing.price)}</span>
                          </div>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <div className="flex flex-wrap gap-2 mb-2">
                          <Badge variant="outline">{listing.game}</Badge>
                          <Badge variant="outline">{listing.condition}</Badge>
                          {listing.isGraded && (
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                              {listing.gradingCompany} {listing.gradeLevel}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {listing.description || 'No description provided'}
                        </p>
                        {listing.moderationDetails?.notes && (
                          <div className="mt-2 p-2 bg-green-100 dark:bg-green-950/60 rounded text-xs border border-green-200 dark:border-green-600 text-green-900 dark:text-green-100">
                            <span className="font-semibold">Moderator Notes:</span> {listing.moderationDetails.notes}
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="pt-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="w-full"
                          onClick={() => viewListing(listing)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="rejected" className="space-y-4">
              {listingsLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">Loading rejected listings...</span>
                </div>
              ) : listings.length === 0 ? (
                <div className="text-center py-12 bg-muted rounded-lg">
                  <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
                  <h3 className="text-xl font-medium mb-2">No Rejected Listings Found</h3>
                  <p className="text-muted-foreground">There are no recently rejected listings to display.</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {listings.map((listing) => (
                    <Card key={listing.id} className="overflow-hidden hover:shadow-md transition-shadow">
                      <div className="aspect-video relative bg-muted">
                        {listing.imageUrls && listing.imageUrls.length > 0 ? (
                          <Image
                            src={listing.imageUrls[0]}
                            alt={listing.title}
                            fill
                            className="object-cover"
                            onClick={() => viewImage(listing.imageUrls[0])}
                            style={{ cursor: 'pointer' }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-muted-foreground">No image</span>
                          </div>
                        )}
                        <div className="absolute top-2 right-2">
                          <Badge variant="destructive" className="font-medium">
                            Rejected
                          </Badge>
                        </div>
                        {listing.moderatedAt && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2 text-xs text-white">
                            <span className="font-semibold">Rejected:</span> {new Date(listing.moderatedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg truncate">{listing.title}</CardTitle>
                        <CardDescription>
                          <div className="flex justify-between">
                            <span>By {listing.username}</span>
                            <span className="font-medium">{formatPrice(listing.price)}</span>
                          </div>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <div className="flex flex-wrap gap-2 mb-2">
                          <Badge variant="outline">{listing.game}</Badge>
                          <Badge variant="outline">{listing.condition}</Badge>
                          {listing.isGraded && (
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                              {listing.gradingCompany} {listing.gradeLevel}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {listing.description || 'No description provided'}
                        </p>
                        {listing.moderationDetails?.rejectionReason && (
                          <div className="mt-2 p-2 bg-red-100 dark:bg-red-950/60 rounded text-xs border border-red-200 dark:border-red-600 text-red-900 dark:text-red-100">
                            <span className="font-semibold">Rejection Reason:</span> {listing.moderationDetails.rejectionReason}
                          </div>
                        )}
                        {listing.moderationDetails?.notes && (
                          <div className="mt-2 p-2 bg-amber-100 dark:bg-amber-950/60 rounded text-xs border border-amber-200 dark:border-amber-600 text-amber-900 dark:text-amber-100">
                            <span className="font-semibold">Moderator Notes:</span> {listing.moderationDetails.notes}
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="pt-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="w-full"
                          onClick={() => viewListing(listing)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="reports" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>User Reports</CardTitle>
                  <CardDescription>
                    Review and take action on listings reported by users
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {listingsLoading ? (
                    <div className="flex justify-center items-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="ml-2">Loading reported listings...</span>
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <div className="p-4 bg-muted">
                        <h3 className="text-lg font-medium">Reported Listings</h3>
                        <p className="text-sm text-muted-foreground">
                          These listings have been reported by users for potential violations.
                        </p>
                      </div>
                      <div className="divide-y">
                        {listings.length === 0 ? (
                          <div className="p-6 text-center">
                            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                            <h3 className="text-xl font-medium mb-2">No Reports Found</h3>
                            <p className="text-muted-foreground">There are no reported listings to review at this time.</p>
                          </div>
                        ) : (
                          listings.map((listing) => (
                            <div key={listing.id} className="p-4 hover:bg-muted/50">
                              <div className="flex flex-col md:flex-row gap-4">
                                <div className="w-full md:w-1/4">
                                  {listing.imageUrls && listing.imageUrls.length > 0 ? (
                                    <div className="relative aspect-square rounded-md overflow-hidden">
                                      <Image
                                        src={listing.imageUrls[0]}
                                        alt={listing.title}
                                        fill
                                        className="object-cover cursor-pointer"
                                        onClick={() => viewImage(listing.imageUrls[0])}
                                      />
                                    </div>
                                  ) : (
                                    <div className="aspect-square bg-muted rounded-md flex items-center justify-center">
                                      <span className="text-muted-foreground">No image</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <h4 className="font-medium">{listing.title}</h4>
                                      <p className="text-sm text-muted-foreground">By {listing.username}</p>
                                    </div>
                                    <Badge variant="destructive">Reported</Badge>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                                    <div>
                                      <span className="text-xs text-muted-foreground">Price:</span>
                                      <p className="font-medium">{formatPrice(listing.price)}</p>
                                    </div>
                                    <div>
                                      <span className="text-xs text-muted-foreground">Condition:</span>
                                      <p>{listing.condition}</p>
                                    </div>
                                    <div>
                                      <span className="text-xs text-muted-foreground">Game:</span>
                                      <p>{listing.game}</p>
                                    </div>
                                    <div>
                                      <span className="text-xs text-muted-foreground">Location:</span>
                                      <p>{listing.city}, {listing.state}</p>
                                    </div>
                                  </div>
                                  
                                  <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-md mb-3 border border-red-200 dark:border-red-800">
                                    <h5 className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">Report Details</h5>
                                    <div className="text-xs text-red-700 dark:text-red-400">
                                      <p><span className="font-medium">Reason:</span> {listing.reportReason || "Not specified"}</p>
                                      <p><span className="font-medium">Description:</span> {listing.reportDescription || "No description provided"}</p>
                                      <p><span className="font-medium">Reported by:</span> User ID: {listing.reportedBy || "Unknown"}</p>
                                      <p><span className="font-medium">Date:</span> {listing.reportedAt ? new Date(listing.reportedAt).toLocaleString() : "Unknown"}</p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex flex-wrap gap-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => viewListing(listing)}
                                    >
                                      <Eye className="h-4 w-4 mr-1" />
                                      View Details
                                    </Button>
                                    <Button 
                                      variant="default" 
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700"
                                      onClick={() => setConfirmDialog({isOpen: true, action: 'approve', listingId: listing.id})}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      Dismiss Report
                                    </Button>
                                    <Button 
                                      variant="destructive" 
                                      size="sm"
                                      onClick={() => setConfirmDialog({isOpen: true, action: 'reject', listingId: listing.id})}
                                    >
                                      <XCircle className="h-4 w-4 mr-1" />
                                      Remove Listing
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="info">
              <Card>
                <CardHeader>
                  <CardTitle>Content Moderation Guidelines</CardTitle>
                  <CardDescription>
                    Follow these guidelines when reviewing listings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" />
                      Reasons for Flagging
                    </h3>
                    <ul className="list-disc pl-6 space-y-1 text-sm">
                      <li>Automated content filtering detected potentially inappropriate content</li>
                      <li>Image content analysis flagged potentially problematic images</li>
                      <li>User has a low trust level or is new to the platform</li>
                      <li>Pricing anomaly detection (price significantly above or below market value)</li>
                      <li>Manual flagging by administrators</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center">
                      <XCircle className="h-4 w-4 mr-2 text-red-500" />
                      Rejection Criteria
                    </h3>
                    <ul className="list-disc pl-6 space-y-1 text-sm">
                      <li>Counterfeit or fake items</li>
                      <li>Inappropriate, offensive, or adult content in images or description</li>
                      <li>Misleading information about the product</li>
                      <li>Violation of platform terms of service</li>
                      <li>Attempt to circumvent platform fees or policies</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center">
                      <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                      Approval Guidelines
                    </h3>
                    <ul className="list-disc pl-6 space-y-1 text-sm">
                      <li>Listing meets all platform guidelines</li>
                      <li>Images clearly show the product being sold</li>
                      <li>Description accurately represents the item</li>
                      <li>Pricing is reasonable for the item condition and rarity</li>
                      <li>User has provided all required information</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* View Listing Dialog */}
          <Dialog open={responseDialog} onOpenChange={setResponseDialog}>
            <DialogContent className="max-w-[800px]">
              <DialogHeader>
                <DialogTitle>Listing Details</DialogTitle>
                <DialogDescription>
                  Review complete listing information
                </DialogDescription>
              </DialogHeader>
              
              {selectedListing && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold mb-2">Images</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedListing.imageUrls && selectedListing.imageUrls.map((url, index) => (
                        <div 
                          key={index} 
                          className="aspect-square relative bg-muted rounded-md overflow-hidden cursor-pointer"
                          onClick={() => viewImage(url)}
                        >
                          <Image
                            src={url}
                            alt={`Image ${index + 1}`}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-1">Title</h3>
                      <p>{selectedListing.title}</p>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-1">Description</h3>
                      <ScrollArea className="h-[100px] rounded-md border p-2">
                        <p className="text-sm">{selectedListing.description || 'No description provided'}</p>
                      </ScrollArea>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="font-semibold mb-1">Price</h3>
                        <p>{formatPrice(selectedListing.price)}</p>
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">Game</h3>
                        <p>{selectedListing.game}</p>
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">Condition</h3>
                        <p>{selectedListing.condition}</p>
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">Location</h3>
                        <p>{selectedListing.city}, {selectedListing.state}</p>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-1">Seller Information</h3>
                      <p>Username: {selectedListing.username}</p>
                      <p>User ID: {selectedListing.userId}</p>
                    </div>
                    
                    {selectedListing.reviewReason && (
                      <div className="mt-4 p-3 bg-amber-100 dark:bg-amber-950/60 rounded-md border border-amber-200 dark:border-amber-600 text-amber-900 dark:text-amber-100">
                        <h3 className="font-semibold mb-1 flex items-center">
                          <AlertTriangle className="h-4 w-4 mr-2 text-amber-600 dark:text-amber-300" />
                          Review Reason
                        </h3>
                        <p className="text-sm">{selectedListing.reviewReason}</p>
                      </div>
                    )}
                    
                    {selectedListing.moderationStatus && (
                      <div className={`mt-4 p-3 rounded-md border ${
                        selectedListing.moderationStatus === 'approved' 
                          ? 'bg-green-100 dark:bg-green-950/60 border-green-200 dark:border-green-600 text-green-900 dark:text-green-100' 
                          : 'bg-red-100 dark:bg-red-950/60 border-red-200 dark:border-red-600 text-red-900 dark:text-red-100'
                      }`}>
                        <h3 className="font-semibold mb-1 flex items-center">
                          {selectedListing.moderationStatus === 'approved' ? (
                            <CheckCircle className="h-4 w-4 mr-2 text-green-600 dark:text-green-300" />
                          ) : (
                            <XCircle className="h-4 w-4 mr-2 text-red-600 dark:text-red-300" />
                          )}
                          Moderation Status: {selectedListing.moderationStatus.charAt(0).toUpperCase() + selectedListing.moderationStatus.slice(1)}
                        </h3>
                        {selectedListing.moderatedAt && (
                          <p className="text-sm mb-1">Date: {new Date(selectedListing.moderatedAt).toLocaleString()}</p>
                        )}
                        {selectedListing.moderationDetails?.moderatorId && (
                          <p className="text-sm mb-1">Moderated by: {selectedListing.moderationDetails.moderatorId === 'system' ? 'Administrator' : 'Moderator'}</p>
                        )}
                        {selectedListing.moderationDetails?.notes && (
                          <p className="text-sm mb-1">Notes: {selectedListing.moderationDetails.notes}</p>
                        )}
                        {selectedListing.moderationDetails?.rejectionReason && (
                          <p className="text-sm">Rejection Reason: {selectedListing.moderationDetails.rejectionReason}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <DialogFooter className="flex justify-between">
                {selectedListing && !selectedListing.moderationStatus ? (
                  <>
                    <Button 
                      variant="destructive" 
                      onClick={() => {
                        setResponseDialog(false);
                        if (selectedListing) {
                          setConfirmDialog({isOpen: true, action: 'reject', listingId: selectedListing.id});
                        }
                      }}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                    <Button 
                      variant="default" 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        setResponseDialog(false);
                        if (selectedListing) {
                          setConfirmDialog({isOpen: true, action: 'approve', listingId: selectedListing.id});
                        }
                      }}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                  </>
                ) : (
                  <Button 
                    variant="outline" 
                    onClick={() => setResponseDialog(false)}
                    className="ml-auto"
                  >
                    Close
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* View Image Dialog */}
          <Dialog open={viewImageDialog} onOpenChange={setViewImageDialog}>
            <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden">
              <div className="relative w-full h-[80vh]">
                {selectedImage && (
                  <Image
                    src={selectedImage}
                    alt="Enlarged image"
                    fill
                    className="object-contain"
                  />
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Confirm Dialog */}
          <Dialog open={confirmDialog.isOpen} onOpenChange={(open) => setConfirmDialog({...confirmDialog, isOpen: open})}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {confirmDialog.action === 'approve' ? 'Approve Listing' : 'Reject Listing'}
                </DialogTitle>
                <DialogDescription>
                  {confirmDialog.action === 'approve' 
                    ? 'This listing will be made visible to all users.'
                    : 'This listing will be rejected and the seller will be notified.'}
                </DialogDescription>
              </DialogHeader>
              
              {/* Additional fields based on action */}
              <div className="space-y-4 py-4">
                {/* Moderator notes field for both actions */}
                <div className="space-y-2">
                  <label htmlFor="moderatorNotes" className="text-sm font-medium">
                    Moderator Notes (optional)
                  </label>
                  <textarea
                    id="moderatorNotes"
                    className="w-full min-h-[80px] p-2 border rounded-md"
                    placeholder="Add any notes about this decision (internal use only)"
                  />
                </div>
                
                {/* Rejection reason field only for reject action */}
                {confirmDialog.action === 'reject' && (
                  <div className="space-y-2">
                    <label htmlFor="rejectionReason" className="text-sm font-medium">
                      Rejection Reason
                    </label>
                    <select
                      id="rejectionReason"
                      className="w-full p-2 border rounded-md"
                      defaultValue=""
                    >
                      <option value="" disabled>Select a reason</option>
                      <option value="counterfeit">Counterfeit or fake item</option>
                      <option value="inappropriate">Inappropriate content</option>
                      <option value="misleading">Misleading information</option>
                      <option value="tos-violation">Terms of service violation</option>
                      <option value="pricing">Unreasonable pricing</option>
                      <option value="other">Other (specify in notes)</option>
                    </select>
                  </div>
                )}
              </div>
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setConfirmDialog({...confirmDialog, isOpen: false})}
                >
                  Cancel
                </Button>
                <Button 
                  variant={confirmDialog.action === 'approve' ? 'default' : 'destructive'}
                  className={confirmDialog.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                  onClick={() => {
                    // Get values from form fields
                    const notes = (document.getElementById('moderatorNotes') as HTMLTextAreaElement)?.value || '';
                    const rejectionReason = confirmDialog.action === 'reject' 
                      ? (document.getElementById('rejectionReason') as HTMLSelectElement)?.value 
                      : '';
                    
                    // Pass these values to the API
                    handleApproveReject(
                      confirmDialog.listingId, 
                      confirmDialog.action, 
                      notes, 
                      rejectionReason
                    );
                  }}
                  disabled={loading}
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {confirmDialog.action === 'approve' ? 'Approve' : 'Reject'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Card>
      </div>
      <Footer />
    </div>
  );
}