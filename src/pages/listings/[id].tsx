import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getFirestore, doc, getDoc, collection, addDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { app, db } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import Image from 'next/image';
import { ArrowLeft, Calendar, Heart, MapPin, MessageCircle, User, ZoomIn, ZoomOut, Minus, Plus, RotateCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

const getConditionColor = (condition: string) => {
  const colors: Record<string, string> = {
    'poor': 'bg-[#e51f1f]/10 text-[#e51f1f] hover:bg-[#e51f1f]/20',
    'played': 'bg-[#e85f2a]/10 text-[#e85f2a] hover:bg-[#e85f2a]/20',
    'light-played': 'bg-[#f2a134]/10 text-[#f2a134] hover:bg-[#f2a134]/20',
    'good': 'bg-[#f2a134]/10 text-[#f2a134] hover:bg-[#f2a134]/20',
    'excellent': 'bg-[#f7e379]/10 text-[#f7e379] hover:bg-[#f7e379]/20',
    'near-mint': 'bg-[#bbdb44]/10 text-[#bbdb44] hover:bg-[#bbdb44]/20',
    'mint': 'bg-[#44ce1b]/10 text-[#44ce1b] hover:bg-[#44ce1b]/20'
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
  const [isFavorited, setIsFavorited] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    let isMounted = true;
    let retryTimeout: NodeJS.Timeout;

    async function fetchListing() {
      if (!id || typeof id !== 'string') {
        console.log('Invalid listing ID:', id);
        return;
      }
      
      if (isMounted) {
        setLoading(true);
        setError(null);
      }

      try {
        console.log('Fetching listing with ID:', id);
        
        // Wait for Firebase to be initialized
        const { db } = await import('@/lib/firebase');
        
        // Add retry mechanism for Firestore query
        let attempts = 0;
        const maxAttempts = 3;
        let listingDoc;
        
        while (attempts < maxAttempts) {
          try {
            // Get a fresh reference to the document
            const listingRef = doc(db, 'listings', id);
            listingDoc = await getDoc(listingRef);
            
            // Verify that the document was actually retrieved
            if (!listingDoc.exists()) {
              throw new Error('Listing not found');
            }
            
            break;
          } catch (retryError: any) {
            attempts++;
            console.error(`Attempt ${attempts} failed:`, {
              error: retryError,
              code: retryError.code,
              message: retryError.message,
              authState: user ? 'logged-in' : 'logged-out'
            });
            
            if (attempts === maxAttempts) {
              // If we've exhausted all attempts, check if it's a permissions error
              if (retryError.code === 'permission-denied') {
                throw new Error('You do not have permission to view this listing.');
              }
              throw retryError;
            }
            
            // Exponential backoff with max 10s
            const delay = Math.min(1000 * Math.pow(2, attempts), 10000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

        if (!listingDoc?.exists()) {
          if (isMounted) {
            setError('Listing not found');
            setLoading(false);
          }
          return;
        }

        const data = listingDoc.data();
        
        // Ensure all required fields are present with default values
        const listingData: Listing = {
          id: listingDoc.id,
          title: data.title || 'Untitled Listing',
          description: data.description || '',
          price: typeof data.price === 'number' ? data.price : 0,
          condition: data.condition || 'unknown',
          game: data.game || 'other',
          imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
          userId: data.userId || '',
          username: data.username || 'Unknown User',
          createdAt: data.createdAt?.toDate() || new Date(),
          status: data.status || 'active',
          isGraded: Boolean(data.isGraded),
          gradeLevel: data.gradeLevel ? Number(data.gradeLevel) : undefined,
          gradingCompany: data.gradingCompany,
          city: data.city || 'Unknown',
          state: data.state || 'Unknown',
          favoriteCount: typeof data.favoriteCount === 'number' ? data.favoriteCount : 0
        };

        if (isMounted) {
          setListing(listingData);
          setLoading(false);
        }

        // Check if the listing is favorited by the current user
        if (user && isMounted) {
          const favoriteRef = doc(db, 'users', user.uid, 'favorites', id as string);
          const favoriteDoc = await getDoc(favoriteRef);
          if (isMounted) {
            setIsFavorited(favoriteDoc.exists());
          }
        }
      } catch (err: any) {
        console.error('Error fetching listing:', err);
        if (isMounted) {
          setError('Failed to load listing. Please try again later.');
          setLoading(false);
        }
      }
    }

    fetchListing();

    return () => {
      isMounted = false;
    };
  }, [id, user]);

  const handleImageClick = (index: number) => {
    setCurrentImageIndex(index);
    setIsZoomDialogOpen(true);
  };

  const handleFavoriteToggle = async () => {
    if (!user) {
      toast.error('Please sign up to save favorites');
      router.push('/auth/sign-up');
      return;
    }

    if (!listing) return;

    const favoriteRef = doc(db, 'users', user.uid, 'favorites', listing.id);
    const listingRef = doc(db, 'listings', listing.id);

    try {
      if (isFavorited) {
        await deleteDoc(favoriteRef);
        setIsFavorited(false);
        toast.success('Removed from favorites');
      } else {
        await setDoc(favoriteRef, {
          listingRef,
          createdAt: new Date()
        });
        setIsFavorited(true);
        toast.success('Added to favorites');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorites');
    }
  };

  const handleMessage = () => {
    if (!user) {
      toast.error('Please sign in to send messages');
      return;
    }

    if (user.uid === listing?.userId) {
      toast.error('You cannot message yourself');
      return;
    }

    router.push(`/dashboard/messages?listingId=${listing?.id}`);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="container mx-auto p-4">
        <Card className="bg-destructive/10">
          <CardContent className="p-6">
            <p className="text-destructive">{error || 'Listing not found'}</p>
            <Button 
              variant="outline" 
              className="mt-4" 
              onClick={() => router.push('/listings')}
            >
              Back to Listings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
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
            {/* Images and Price - Moved to top for mobile */}
            <div className="space-y-4 md:space-y-6 order-1 md:order-2">
              <Carousel className="w-full h-[300px] md:h-[400px] touch-pan-y">
                <CarouselContent>
                  {listing.imageUrls.map((url, index) => (
                    <CarouselItem key={index} className="flex items-center justify-center h-full">
                      <div 
                        className="relative w-full h-full group cursor-pointer flex items-center justify-center p-4" 
                        onClick={() => handleImageClick(index)}
                      >
                        <div className="relative w-full h-full flex items-center justify-center">
                          <div className="relative w-full h-full">
                            <Image
                              src={url}
                              alt={`${listing.title} - Image ${index + 1}`}
                              fill
                              className="object-contain rounded-lg"
                              sizes="(max-width: 768px) 90vw, (max-width: 1200px) 50vw, 33vw"
                              priority={index === 0}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = '/images/rect.png';
                              }}
                            />
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

              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold">
                  ${typeof listing.price === 'number' ? listing.price.toFixed(2) : listing.price}
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-4 md:space-y-6 order-2 md:order-1">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold mb-3">{listing.title}</h1>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-sm">{listing.game}</Badge>
                  <Badge className={`text-sm ${getConditionColor(listing.condition)}`}>
                    {listing.condition}
                  </Badge>
                  {listing.isGraded && (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-500 text-sm">
                      {listing.gradingCompany} {listing.gradeLevel}
                    </Badge>
                  )}
                </div>
              </div>

              <Separator />

              {/* Seller Info */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <Button
                  variant="ghost"
                  className="flex items-center justify-start space-x-2 h-8"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push(`/profile/${listing.userId}`, undefined, { shallow: true });
                  }}
                >
                  <User className="h-4 w-4" />
                  <span>{listing.username}</span>
                </Button>
                <div className="flex items-center text-muted-foreground text-sm">
                  <MapPin className="h-4 w-4 mr-1" />
                  <span>{listing.city}, {listing.state}</span>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold mb-2">Description</h2>
                <p className="text-muted-foreground whitespace-pre-wrap text-sm md:text-base">{listing.description}</p>
              </div>

              <Separator />

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 mr-2" />
                  Listed on {listing.createdAt.toLocaleDateString()}
                </div>
                <div className="flex w-full sm:w-auto space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFavoriteToggle}
                    className={`flex-1 sm:flex-none ${isFavorited ? "text-red-500" : ""}`}
                  >
                    <Heart className={`h-4 w-4 mr-2 ${isFavorited ? "fill-current" : ""}`} />
                    {isFavorited ? "Saved" : "Save"}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleMessage}
                    className="flex-1 sm:flex-none"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Message
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Zoom Dialog */}
      <Dialog open={isZoomDialogOpen} onOpenChange={setIsZoomDialogOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 overflow-hidden">
          <div className="relative w-full h-[90vh] flex items-center justify-center">
            <Carousel className="w-full h-full">
              <CarouselContent className="h-full">
                {listing.imageUrls.map((url, index) => (
                  <CarouselItem key={index} className="h-full flex items-center justify-center">
                    <TransformWrapper
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
                                onClick={() => zoomOut()}
                                className="h-8 w-8"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => zoomIn()}
                                className="h-8 w-8"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => resetTransform()}
                                className="h-8 w-8"
                              >
                                <RotateCw className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </TransformWrapper>
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
  );
}