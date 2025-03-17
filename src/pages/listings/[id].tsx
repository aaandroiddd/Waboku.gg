import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { UserNameLink } from '@/components/UserNameLink';
import { StripeSellerBadge } from '@/components/StripeSellerBadge';
import { useRouter } from 'next/router';
import { formatPrice } from '@/lib/price';
import { doc, getDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GameCategoryBadge } from '@/components/GameCategoryBadge';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Chat } from '@/components/Chat';
import { MakeOfferDialog } from '@/components/MakeOfferDialog';
import Image from 'next/image';
import { ArrowLeft, Calendar, Heart, MapPin, MessageCircle, User, ZoomIn, Minus, Plus, RotateCw, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import { toast } from 'sonner';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Footer } from '@/components/Footer';
import dynamic from 'next/dynamic';
import { DistanceIndicator } from '@/components/DistanceIndicator';
import { useLoading } from '@/contexts/LoadingContext';

const getConditionColor = (condition: string) => {
  const colors: Record<string, string> = {
    'poor': 'bg-[#e51f1f]/10 text-[#e51f1f] hover:bg-[#e51f1f]/20',
    'played': 'bg-[#e85f2a]/10 text-[#e85f2a] hover:bg-[#e85f2a]/20',
    'light-played': 'bg-[#f2a134]/10 text-[#f2a134] hover:bg-[#f2a134]/20',
    'good': 'bg-[#f2a134]/10 text-[#f2a134] hover:bg-[#f2a134]/20',
    'excellent': 'bg-[#f7e379]/10 text-[#f7e379] hover:bg-[#f7e379]/20',
    'near-mint': 'bg-[#7bce2a]/10 text-[#7bce2a] hover:bg-[#7bce2a]/20',
    'near mint': 'bg-[#7bce2a]/10 text-[#7bce2a] hover:bg-[#7bce2a]/20',
    'near_mint': 'bg-[#7bce2a]/10 text-[#7bce2a] hover:bg-[#7bce2a]/20',
    'mint': 'bg-[#44ce1b]/10 text-[#44ce1b] hover:bg-[#44ce1b]/20',
    'unknown': 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20'
  };
  return colors[condition?.toLowerCase()] || 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20';
};

export default function ListingPage() {
  const router = useRouter();
  const { id } = router.query;
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isZoomDialogOpen, setIsZoomDialogOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [sellerHasActiveStripeAccount, setSellerHasActiveStripeAccount] = useState(false);

  useEffect(() => {
    if (listing?.coverImageIndex !== undefined) {
      setCurrentImageIndex(listing.coverImageIndex);
    }
  }, [listing?.coverImageIndex]);

  const handleCarouselChange = (api: any) => {
    if (!api) return;
    const index = api.selectedScrollSnap();
    setCurrentImageIndex(index);
  };
  const [isFavorited, setIsFavorited] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isOfferDialogOpen, setIsOfferDialogOpen] = useState(false);
  const { user } = useAuth();

  // Get favorites functionality from the hook
  const { toggleFavorite, isFavorite, initialized } = useFavorites();
  
  // Effect to check if the seller has an active Stripe Connect account
  useEffect(() => {
    if (!listing || !listing.userId) return;
    
    async function checkSellerStripeStatus() {
      try {
        const { db } = getFirebaseServices();
        if (!db) return;
        
        const sellerDoc = await getDoc(doc(db, 'users', listing.userId));
        if (!sellerDoc.exists()) return;
        
        const sellerData = sellerDoc.data();
        // Check if seller has completed Stripe Connect onboarding
        setSellerHasActiveStripeAccount(
          !!sellerData.stripeConnectAccountId && 
          sellerData.stripeConnectStatus === 'active'
        );
      } catch (error) {
        console.error('Error checking seller Stripe status:', error);
        setSellerHasActiveStripeAccount(false);
      }
    }
    
    checkSellerStripeStatus();
  }, [listing]);

  const { startLoading, stopLoading } = useLoading();

  useEffect(() => {
    let isMounted = true;

    async function fetchListing() {
      try {
        if (!id || typeof id !== 'string') {
          throw new Error('Invalid listing ID');
        }

        if (isMounted) {
          setLoading(true);
          setError(null);
          startLoading(); // Start global loading indicator
        }

        const { db } = getFirebaseServices();
        
        if (!db) {
          throw new Error('Database not initialized');
        }

        // First, trigger a background check for listing expiration
        // This happens silently and won't block the UI
        try {
          // Use async/await with proper error handling
          const checkExpiration = async () => {
            try {
              console.log(`[Listing] Checking expiration for listing ${id}`);
              
              // Add timeout to prevent long-running requests
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
              
              try {
                const response = await fetch('/api/listings/check-expiration', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ listingId: id }),
                  signal: controller.signal
                });
                
                // Clear the timeout since the request completed
                clearTimeout(timeoutId);
                
                // Always try to parse the response, regardless of status code
                let result;
                try {
                  result = await response.json();
                } catch (jsonError) {
                  console.log(`[Listing] Could not parse response as JSON:`, jsonError);
                  return; // Exit silently if we can't parse the response
                }
                
                // Log the result for debugging
                console.log(`[Listing] Expiration check response:`, {
                  status: response.status,
                  result
                });
                
                // Check if the API returned an error (even with status 200)
                if (!result.success) {
                  console.log(`[Listing] Expiration check failed:`, result.error || 'Unknown error');
                  return; // Exit silently
                }
                
                // Process successful response
                if (result.status === 'archived') {
                  console.log('[Listing] Listing was archived in background check');
                  // Could refresh the page or show a notification here if needed
                }
              } catch (fetchError) {
                // Clear the timeout in case of error
                clearTimeout(timeoutId);
                
                if (fetchError.name === 'AbortError') {
                  console.log('[Listing] Expiration check request timed out');
                } else {
                  console.error('[Listing] Fetch error during expiration check:', fetchError);
                }
              }
            } catch (err) {
              // Silently log any errors without affecting the user experience
              console.error('[Listing] Background expiration check failed:', err);
            }
          };
          
          // Execute but don't await - let it run in background
          checkExpiration();
        } catch (error) {
          // Ignore any errors in the background check
          console.error('Error triggering background expiration check:', error);
        }

        const listingRef = doc(db, 'listings', id);
        const listingDoc = await getDoc(listingRef);

        if (!listingDoc.exists()) {
          throw new Error('Listing not found');
        }

        const data = listingDoc.data();
        
        if (!data) {
          throw new Error('Listing data is empty');
        }
        
        // Check if the listing is archived
        if (data.status === 'archived' || data.archivedAt) {
          throw new Error('This listing has been archived and is no longer available');
        }
        
        // Safely convert Firestore timestamp to Date with better error handling
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
        
        // Get created timestamp with robust error handling
        const createdAt = convertTimestamp(data.createdAt);
        
        // Process location data safely
        let locationData = undefined;
        if (data.location) {
          try {
            locationData = {
              latitude: typeof data.location.latitude === 'number' ? data.location.latitude : undefined,
              longitude: typeof data.location.longitude === 'number' ? data.location.longitude : undefined
            };
          } catch (error) {
            console.error('Error processing location data:', error);
          }
        }
        
        // Create listing object with careful type handling
        const expiresAt = data.expiresAt ? convertTimestamp(data.expiresAt) : new Date(createdAt.getTime() + (data.isPremium ? 30 : 2) * 24 * 60 * 60 * 1000);
        
        const listingData: Listing = {
          id: listingDoc.id,
          title: data.title || 'Untitled Listing',
          description: data.description || '',
          price: typeof data.price === 'number' ? data.price : 
                 typeof data.price === 'string' ? parseFloat(data.price) : 0,
          condition: data.condition || 'unknown',
          game: data.game || 'other',
          imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
          coverImageIndex: typeof data.coverImageIndex === 'number' ? data.coverImageIndex : 0,
          userId: data.userId || '',
          username: data.username || 'Unknown User',
          createdAt: createdAt,
          // Handle expiresAt field which is required by the Listing type
          expiresAt: expiresAt,
          status: data.status || 'active',
          isGraded: Boolean(data.isGraded),
          gradeLevel: data.gradeLevel ? Number(data.gradeLevel) : undefined,
          gradingCompany: data.gradingCompany,
          city: data.city || 'Unknown',
          state: data.state || 'Unknown',
          favoriteCount: typeof data.favoriteCount === 'number' ? data.favoriteCount : 0,
          quantity: data.quantity ? Number(data.quantity) : undefined,
          cardName: data.cardName || undefined,
          location: locationData,
          // Add sold status fields
          soldTo: data.soldTo || null,
          archivedAt: data.archivedAt ? convertTimestamp(data.archivedAt) : null
        };
        
        // Make expiresAt available to the client-side code
        if (typeof window !== 'undefined') {
          (window as any).listingExpiresAt = expiresAt;
        }

        if (isMounted) {
          setListing(listingData);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching listing:', err);
        if (isMounted) {
          setError(err.message || 'Failed to load listing. Please try again later.');
          setLoading(false);
        }
      }
    }

    fetchListing();

    return () => {
      isMounted = false;
    };
  }, [id, user]);
  
  // Add a separate effect to update the favorite status when the listing or favorites change
  useEffect(() => {
    if (listing && initialized && user) {
      setIsFavorited(isFavorite(listing.id));
    }
  }, [listing, isFavorite, initialized, user]);

  const handleImageClick = (index: number) => {
    setCurrentImageIndex(index);
    setIsZoomDialogOpen(true);
  };

  // We already have the favorites functionality from above
  
  const handleFavoriteToggle = (e: React.MouseEvent) => {
    // Prevent any default form submission or event propagation
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      toast.error('Please sign up to save favorites');
      router.push('/auth/sign-up');
      return;
    }

    if (!listing) return;
    
    try {
      // Use the improved toggleFavorite function from our hook
      toggleFavorite(listing, e);
      
      // Update local state based on the result - this will be updated by the optimistic UI update
      setIsFavorited(!isFavorited);
      
      // Toast messages are handled inside the toggleFavorite function
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorites');
    }
  };

  const handleBuyNow = async () => {
    if (!user) {
      toast.error('Please sign in to make a purchase');
      router.push('/auth/sign-in');
      return;
    }

    if (user.uid === listing?.userId) {
      toast.error('You cannot buy your own listing');
      return;
    }

    try {
      // Make sure we have the user's email
      if (!user.email) {
        toast.error('Your account email is missing. Please update your profile.');
        return;
      }

      // Use the Connect API endpoint with proper parameters
      const response = await fetch('/api/stripe/connect/create-buy-now-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listingId: listing?.id,
          userId: user.uid,
          email: user.email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle specific error codes
        if (errorData.code === 'seller_not_connected') {
          // If the current user is the seller, offer to set up Stripe Connect
          if (user.uid === listing?.userId) {
            toast.error('You need to set up your Stripe Connect account to receive payments', {
              action: {
                label: 'Set Up Now',
                onClick: () => router.push('/dashboard/connect-account')
              },
              duration: 5000
            });
          } else {
            toast.error('The seller has not set up their payment account yet. Please try another listing or contact the seller.');
          }
          return;
        } else if (errorData.code === 'seller_not_active') {
          // If the current user is the seller, offer to complete Stripe Connect setup
          if (user.uid === listing?.userId) {
            toast.error('Your Stripe Connect account setup is incomplete', {
              action: {
                label: 'Complete Setup',
                onClick: () => router.push('/dashboard/connect-account')
              },
              duration: 5000
            });
          } else {
            toast.error('The seller\'s payment account is not fully set up yet. Please try another listing or contact the seller.');
          }
          return;
        }
        
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { sessionId } = await response.json();
      
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
      if (!stripe) throw new Error('Failed to load Stripe');

      const { error } = await stripe.redirectToCheckout({ sessionId });
      
      if (error) {
        console.error('Stripe checkout error:', error);
        toast.error(error.message);
      }
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      toast.error(error.message || 'Failed to process purchase. Please try again.');
    }
  };

  const handleMessage = () => {
    if (!user) {
      toast.error('Please sign up to send messages');
      router.push('/auth/sign-up');
      return;
    }

    if (user.uid === listing?.userId) {
      toast.error('You cannot message yourself');
      return;
    }

    setIsChatOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="container mx-auto p-4 flex-1">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-64 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !listing) {
    const isArchived = error?.includes('archived');
    const isExpired = error?.includes('expired');
    return (
      <div className="min-h-screen flex flex-col">
        <div className="container mx-auto p-4 flex-1">
          <Card className="bg-muted">
            <CardContent className="p-6 text-center">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold mb-2">
                  {isArchived || isExpired ? 'Listing No Longer Available' : 'Listing Not Found'}
                </h2>
                <p className="text-muted-foreground">
                  {isArchived || isExpired ? 
                    'This listing has been sold or is no longer available.' : 
                    'We couldn\'t find the listing you\'re looking for.'}
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => router.push('/listings')}
              >
                Browse Available Listings
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  const handleMakeOffer = () => {
    if (!user) {
      toast.error('Please sign in to make an offer');
      router.push('/auth/sign-in');
      return;
    }

    if (user.uid === listing?.userId) {
      toast.error('You cannot make an offer on your own listing');
      return;
    }

    setIsOfferDialogOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto p-4 flex-1">
        <Button 
          variant="ghost" 
          className="mb-4" 
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card className="max-w-6xl mx-auto bg-black/[0.2] dark:bg-black/40 backdrop-blur-md border-muted">
          <CardContent className="p-4 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
              {/* Mobile title - only visible on small screens */}
              <div className="md:hidden space-y-4 mb-4">
                <div>
                  <h1 className="text-2xl font-bold mb-3">{listing.title}</h1>
                  <div className="flex flex-wrap gap-2">
                    {listing.game && (
                      <GameCategoryBadge game={listing.game} variant="secondary" className="text-sm" />
                    )}
                    <Badge className={`text-sm ${getConditionColor(listing.condition)}`}>
                      {listing.condition}
                    </Badge>
                    {listing.isGraded && (
                      <Badge variant="outline" className="bg-blue-500 text-white text-sm flex items-center gap-1">
                        <svg 
                          viewBox="0 0 24 24" 
                          className="w-4 h-4" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2"
                        >
                          <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                          <path d="M2 17L12 22L22 17" />
                          <path d="M2 12L12 17L22 12" />
                        </svg>
                        {listing.gradingCompany} {listing.gradeLevel}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4 md:space-y-6 order-1 md:order-2">
                <div className="relative">
                  <Carousel 
                    className="w-full h-[300px] md:h-[400px] touch-pan-y"
                    onSelect={handleCarouselChange}
                    defaultIndex={listing.coverImageIndex || 0}
                    index={currentImageIndex}
                  >
                    <div className="absolute top-4 right-4 z-10">
                      <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                        {currentImageIndex + 1} of {listing.imageUrls.length}
                      </Badge>
                    </div>
                    <CarouselContent>
                      {listing.imageUrls.map((url, index) => (
                        <CarouselItem key={index} className="flex items-center justify-center h-full">
                          <div 
                            className="relative w-full h-full group cursor-pointer flex items-center justify-center p-4" 
                            onClick={() => handleImageClick(index)}
                          >
                            <div className="relative w-full h-full flex items-center justify-center">
                              <div className="relative w-full h-full">
                                <div className="relative w-full h-full">
                                  <div className="absolute inset-0 rounded-lg animate-pulse bg-gradient-to-r from-gray-200/20 via-gray-100/20 to-gray-200/20 dark:from-gray-800/20 dark:via-gray-700/20 dark:to-gray-800/20 bg-[length:200%_100%]" />
                                  <Image
                                    src={url}
                                    alt={`${listing.title} - Image ${index + 1}`}
                                    fill
                                    className="object-contain rounded-lg"
                                    sizes="(max-width: 640px) 90vw, (max-width: 768px) 70vw, (max-width: 1024px) 50vw, 600px"
                                    priority={index === 0}
                                    loading={index === 0 ? "eager" : "lazy"}
                                    quality={85}
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = '/images/rect.png';
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-lg">
                                <ZoomIn className="w-8 h-8 text-white" />
                              </div>
                            </div>
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="hidden md:flex -left-4" />
                    <CarouselNext className="hidden md:flex -right-4" />
                  </Carousel>
                </div>

                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold">
                    {formatPrice(listing.price)}
                  </div>
                </div>
              </div>

              <div className="space-y-4 md:space-y-6 order-2 md:order-1">
                {/* Sold/Unavailable Banner */}
                {(listing.soldTo || listing.archivedAt) && (
                  <div className="bg-red-500/90 text-white p-3 rounded-md mb-4 shadow-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="font-semibold">
                          {listing.soldTo ? "This item has been sold" : "This listing is no longer available"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Desktop title - hidden on mobile */}
                <div className="hidden md:block">
                  <h1 className="text-3xl font-bold mb-3">{listing.title}</h1>
                  <div className="flex flex-wrap gap-2">
                    {listing.game && (
                      <GameCategoryBadge game={listing.game} variant="secondary" className="text-sm" />
                    )}
                    <Badge className={`text-sm ${getConditionColor(listing.condition)}`}>
                      {listing.condition}
                    </Badge>
                    {listing.isGraded && (
                      <Badge variant="outline" className="bg-blue-500 text-white text-sm flex items-center gap-1">
                        <svg 
                          viewBox="0 0 24 24" 
                          className="w-4 h-4" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2"
                        >
                          <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                          <path d="M2 17L12 22L22 17" />
                          <path d="M2 12L12 17L22 12" />
                        </svg>
                        {listing.gradingCompany} {listing.gradeLevel}
                      </Badge>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      className="flex items-center justify-start space-x-2 h-8"
                    >
                      <User className="h-4 w-4" />
                      <UserNameLink userId={listing.userId} initialUsername={listing.username} />
                    </Button>
                    <StripeSellerBadge userId={listing.userId} />
                  </div>
                  <div className="flex items-center text-muted-foreground text-sm">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span>{listing.city}, {listing.state}</span>
                    {listing.location?.latitude && listing.location?.longitude && (
                      <DistanceIndicator 
                        targetLat={listing.location.latitude} 
                        targetLon={listing.location.longitude} 
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {listing.cardName && (
                    <div>
                      <h2 className="text-lg font-semibold mb-2">Card Name</h2>
                      <p className="text-muted-foreground text-sm md:text-base">{listing.cardName}</p>
                    </div>
                  )}
                  
                  <div>
                    <h2 className="text-lg font-semibold mb-2">Description</h2>
                    {/* Dynamically import MarkdownContent to avoid SSR issues */}
                    {(() => {
                      const MarkdownContent = dynamic(() => import('@/components/MarkdownContent').then(mod => mod.MarkdownContent), {
                        ssr: false,
                        loading: () => <p className="text-muted-foreground whitespace-pre-wrap text-sm md:text-base overflow-hidden break-words">{listing.description}</p>
                      });
                      
                      return <div className="max-w-full overflow-hidden">
                        <MarkdownContent content={listing.description} className="text-muted-foreground text-sm md:text-base" />
                      </div>;
                    })()}
                  </div>

                  {listing.quantity && parseInt(listing.quantity) > 0 && (
                    <div>
                      <h2 className="text-lg font-semibold mb-2">Quantity Available</h2>
                      <p className="text-muted-foreground text-sm md:text-base">{listing.quantity}</p>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-2" />
                    Listed on {listing.createdAt.toLocaleDateString()}
                  </div>
                </div>
                
                {/* Action buttons section - reorganized for better layout */}
                <div className="flex flex-col gap-3">
                  {/* Save and Message buttons - always on top */}
                  <div className="flex gap-2 w-full">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleFavoriteToggle(e);
                      }}
                      className={`flex-1 ${isFavorited ? "text-red-500" : ""}`}
                      type="button"
                      disabled={listing.soldTo || listing.archivedAt}
                    >
                      <Heart className={`h-4 w-4 mr-2 ${isFavorited ? "fill-current" : ""}`} />
                      {isFavorited ? "Saved" : "Save"}
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleMessage}
                      className="flex-1"
                      disabled={listing.soldTo || listing.archivedAt}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Message
                    </Button>
                  </div>
                  
                  {/* Buy Now and Make Offer buttons */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    {listing.soldTo || listing.archivedAt ? (
                      <Button
                        variant="outline"
                        size="lg"
                        className="flex-1 bg-gray-200 text-gray-500 hover:bg-gray-200 cursor-not-allowed"
                        disabled={true}
                      >
                        No Longer Available
                      </Button>
                    ) : sellerHasActiveStripeAccount ? (
                      <Button
                        variant="default"
                        size="lg"
                        onClick={handleBuyNow}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        disabled={user?.uid === listing.userId}
                      >
                        Buy Now - {formatPrice(listing.price)}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="lg"
                        className="flex-1 bg-gray-200 text-gray-500 hover:bg-gray-200 cursor-not-allowed"
                        disabled={true}
                        title="Seller has not set up payment processing yet"
                      >
                        Buy Now Unavailable
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={handleMakeOffer}
                      className="flex-1 border-blue-500 text-blue-500 hover:bg-blue-500/10"
                      disabled={user?.uid === listing.userId || listing.soldTo || listing.archivedAt}
                    >
                      Make Offer
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog open={isZoomDialogOpen} onOpenChange={setIsZoomDialogOpen}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 overflow-hidden">
            <DialogTitle className="sr-only">Image Viewer</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-20 bg-background/80 backdrop-blur-sm hover:bg-background/90"
              onClick={() => setIsZoomDialogOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="relative w-full h-[90vh] flex items-center justify-center">
              <Carousel 
                className="w-full h-full"
                onSelect={handleCarouselChange}
                defaultIndex={listing.coverImageIndex || 0}
                index={currentImageIndex}
              >
                <div className="absolute top-4 left-4 z-20">
                  <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                    {currentImageIndex + 1} of {listing.imageUrls.length}
                  </Badge>
                </div>
                <CarouselContent className="h-full">
                  {listing.imageUrls.map((url, index) => (
                    <CarouselItem key={`carousel-item-${index}`} className="h-full flex items-center justify-center">
                      {index === currentImageIndex && (
                        <TransformWrapper
                          key={`transform-wrapper-${currentImageIndex}-${index}`}
                          initialScale={1}
                          minScale={0.5}
                          maxScale={4}
                          centerOnInit={true}
                          alignmentAnimation={{ sizeX: 0, sizeY: 0 }}
                          limitToBounds={true}
                          centerZoomedOut={true}
                          doubleClick={{ mode: "reset" }}
                          initialPositionX={0}
                          initialPositionY={0}
                          panning={{ disabled: false }}
                        >
                          {({ zoomIn, zoomOut, resetTransform }) => (
                            <>
                              <TransformComponent 
                                wrapperClass="!w-full !h-full !flex !items-center !justify-center" 
                                contentClass="!w-full !h-full !flex !items-center !justify-center"
                              >
                                <div className="relative w-full h-full flex items-center justify-center p-4">
                                  <img
                                    src={url}
                                    alt={`${listing.title} - Image ${index + 1}`}
                                    className="max-w-full max-h-[80vh] w-auto h-auto object-contain"
                                    loading="eager"
                                  />
                                </div>
                              </TransformComponent>
                              <div 
                                className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 bg-background/90 rounded-lg p-2 backdrop-blur-sm shadow-lg"
                              >
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      zoomOut();
                                    }}
                                    className="h-8 w-8"
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      zoomIn();
                                    }}
                                    className="h-8 w-8"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      resetTransform();
                                    }}
                                    className="h-8 w-8"
                                  >
                                    <RotateCw className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </TransformWrapper>
                      )}
                      {index !== currentImageIndex && (
                        <div className="relative w-full h-full flex items-center justify-center p-4">
                          <img
                            src={url}
                            alt={`${listing.title} - Image ${index + 1}`}
                            className="max-w-full max-h-[80vh] w-auto h-auto object-contain"
                            loading="lazy"
                          />
                        </div>
                      )}
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="left-4" />
                <CarouselNext className="right-4" />
              </Carousel>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Footer />

      <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
        <DialogContent className="max-w-md p-0">
          <DialogTitle className="sr-only">Chat with {listing?.username}</DialogTitle>
          {listing && (
            <Chat
              receiverId={listing.userId}
              listingId={listing.id}
              listingTitle={listing.title}
              onClose={() => setIsChatOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {listing && (
        <MakeOfferDialog
          open={isOfferDialogOpen}
          onOpenChange={setIsOfferDialogOpen}
          listingId={listing.id}
          sellerId={listing.userId}
          listingTitle={listing.title}
          listingPrice={listing.price}
          listingImageUrl={listing.imageUrls[0] || ''}
        />
      )}
    </div>
  );
}