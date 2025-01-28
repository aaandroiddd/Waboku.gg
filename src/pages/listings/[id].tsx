import { useEffect, useState } from 'react';
import { UserNameLink } from '@/components/UserNameLink';
import { useRouter } from 'next/router';
import { formatPrice } from '@/lib/price';
import { doc, getDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Chat } from '@/components/Chat';
import Image from 'next/image';
import { ArrowLeft, Calendar, Heart, MapPin, MessageCircle, User, ZoomIn, Minus, Plus, RotateCw, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Footer } from '@/components/Footer';

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
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { user } = useAuth();

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
        }

        const { db } = getFirebaseServices();
        
        if (!db) {
          throw new Error('Database not initialized');
        }

        const listingRef = doc(db, 'listings', id);
        const listingDoc = await getDoc(listingRef);

        if (!listingDoc.exists()) {
          throw new Error('Listing not found');
        }

        const data = listingDoc.data();
        
        // Check if the listing is archived or expired
        if (data.status === 'archived' || data.archivedAt) {
          throw new Error('This listing has been archived and is no longer available');
        }
        
        // Check if the listing has expired based on creation date
        const now = Date.now();
        const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000; // 48 hours in milliseconds
        const createdAt = data.createdAt?.toDate().getTime() || 0;
        
        if (!data.isPremium && (now - createdAt) > FORTY_EIGHT_HOURS) {
          throw new Error('This listing has expired and is no longer available');
        }
        
        const listingData: Listing = {
          id: listingDoc.id,
          title: data.title || 'Untitled Listing',
          description: data.description || '',
          price: data.price ?? 0,
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

        if (user && isMounted) {
          const favoriteRef = doc(db, 'users', user.uid, 'favorites', id);
          const favoriteDoc = await getDoc(favoriteRef);
          if (isMounted) {
            setIsFavorited(favoriteDoc.exists);
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

    const { db } = getFirebaseServices();
    if (!db) {
      toast.error('Failed to update favorites');
      return;
    }
    
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
              <div className="space-y-4 md:space-y-6 order-1 md:order-2">
                <div className="relative">
                  <Carousel 
                    className="w-full h-[300px] md:h-[400px] touch-pan-y"
                    onSelect={(index) => setCurrentImageIndex(index)}
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
                                    className="object-contain rounded-lg opacity-0 transition-opacity duration-300 data-[loaded=true]:opacity-100"
                                    data-loaded="false"
                                    sizes="(max-width: 768px) 90vw, (max-width: 1200px) 50vw, 33vw"
                                    priority={index === 0}
                                    loading={index === 0 ? "eager" : "lazy"}
                                    quality={100}
                                    onLoad={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.dataset.loaded = "true";
                                    }}
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
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold mb-3">{listing.title}</h1>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-sm">{listing.game}</Badge>
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
                  <Button
                    variant="ghost"
                    className="flex items-center justify-start space-x-2 h-8"
                  >
                    <User className="h-4 w-4" />
                    <UserNameLink userId={listing.userId} initialUsername={listing.username} />
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

        <Dialog open={isZoomDialogOpen} onOpenChange={setIsZoomDialogOpen}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 overflow-hidden">
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
                onSelect={(index) => setCurrentImageIndex(index)}
                defaultIndex={currentImageIndex}
              >
                <div className="absolute top-4 left-4 z-20">
                  <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                    {currentImageIndex + 1} of {listing.imageUrls.length}
                  </Badge>
                </div>
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
      <Footer />

      <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
        <DialogContent className="max-w-md p-0">
          <DialogTitle className="sr-only">Chat with {listing?.username}</DialogTitle>
          {listing && (
            <Chat
              receiverId={listing.userId}
              receiverName={listing.username}
              listingId={listing.id}
              listingTitle={listing.title}
              onClose={() => setIsChatOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}