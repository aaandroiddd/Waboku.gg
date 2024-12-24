import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getFirestore, doc, getDoc, collection, addDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { app } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import Image from 'next/image';
import { ArrowLeft, Calendar, Heart, MapPin, MessageCircle, User, ZoomIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
  return colors[condition.toLowerCase()] || 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20';
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
    async function fetchListing() {
      if (!id) return;

      try {
        const db = getFirestore(app);
        const listingDoc = await getDoc(doc(db, 'listings', id as string));

        if (!listingDoc.exists()) {
          setError('Listing not found');
          return;
        }

        const data = listingDoc.data() as Omit<Listing, 'id'>;
        setListing({
          id: listingDoc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        });

        // Check if the listing is favorited by the current user
        if (user) {
          const favoritesRef = collection(db, 'favorites');
          const q = query(
            favoritesRef,
            where('userId', '==', user.uid),
            where('listingId', '==', id)
          );
          const querySnapshot = await getDocs(q);
          setIsFavorited(!querySnapshot.empty);
        }
      } catch (err) {
        console.error('Error fetching listing:', err);
        setError('Failed to load listing');
      } finally {
        setLoading(false);
      }
    }

    fetchListing();
  }, [id, user]);

  const handleImageClick = (index: number) => {
    setCurrentImageIndex(index);
    setIsZoomDialogOpen(true);
  };

  const handleFavoriteToggle = async () => {
    if (!user) {
      toast.error('Please sign in to save favorites');
      return;
    }

    if (!listing) return;

    const db = getFirestore(app);
    const favoritesRef = collection(db, 'favorites');

    try {
      if (isFavorited) {
        // Remove from favorites
        const q = query(
          favoritesRef,
          where('userId', '==', user.uid),
          where('listingId', '==', listing.id)
        );
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
          deleteDoc(doc.ref);
        });
        setIsFavorited(false);
        toast.success('Removed from favorites');
      } else {
        // Add to favorites
        await addDoc(favoritesRef, {
          userId: user.uid,
          listingId: listing.id,
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

    // Navigate to messages page with the listing context
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

      <Card className="max-w-6xl mx-auto">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column - Details */}
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold mb-4">{listing.title}</h1>
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
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  className="flex items-center space-x-2"
                  onClick={() => router.push(`/profile/${listing.userId}`)}
                >
                  <User className="h-4 w-4" />
                  <span>{listing.username}</span>
                </Button>
                <div className="flex items-center text-muted-foreground">
                  <MapPin className="h-4 w-4 mr-1" />
                  <span>{listing.city}, {listing.state}</span>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold mb-2">Description</h2>
                <p className="text-muted-foreground whitespace-pre-wrap">{listing.description}</p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 mr-2" />
                  Listed on {listing.createdAt.toLocaleDateString()}
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFavoriteToggle}
                    className={isFavorited ? "text-red-500" : ""}
                  >
                    <Heart className={`h-4 w-4 mr-2 ${isFavorited ? "fill-current" : ""}`} />
                    {isFavorited ? "Saved" : "Save"}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleMessage}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Message
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Column - Images and Price */}
            <div className="space-y-6">
              <Carousel className="w-full">
                <CarouselContent>
                  {listing.imageUrls.map((url, index) => (
                    <CarouselItem key={index}>
                      <div className="relative aspect-[4/3] w-full group cursor-pointer" onClick={() => handleImageClick(index)}>
                        <Image
                          src={url}
                          alt={`${listing.title} - Image ${index + 1}`}
                          fill
                          className="object-contain rounded-lg"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          priority={index === 0}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = '/images/rect.png';
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-lg">
                          <ZoomIn className="w-8 h-8 text-white" />
                        </div>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
              </Carousel>

              <div className="text-center">
                <div className="text-4xl font-bold">
                  ${typeof listing.price === 'number' ? listing.price.toFixed(2) : listing.price}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Zoom Dialog */}
      <Dialog open={isZoomDialogOpen} onOpenChange={setIsZoomDialogOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0">
          <div className="relative w-full h-[90vh]">
            <Carousel className="w-full h-full">
              <CarouselContent className="h-full">
                {listing.imageUrls.map((url, index) => (
                  <CarouselItem key={index} className="h-full flex items-center justify-center p-4">
                    <div className="relative max-w-full max-h-full" style={{ width: '100%', height: '100%' }}>
                      <img
                        src={url}
                        alt={`${listing.title} - Image ${index + 1}`}
                        className="max-w-full max-h-[85vh] object-contain mx-auto"
                        loading="eager"
                      />
                    </div>
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