import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { ArrowLeft, Calendar } from 'lucide-react';

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
      } catch (err) {
        console.error('Error fetching listing:', err);
        setError('Failed to load listing');
      } finally {
        setLoading(false);
      }
    }

    fetchListing();
  }, [id]);

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

              <div>
                <h2 className="text-lg font-semibold mb-2">Description</h2>
                <p className="text-muted-foreground whitespace-pre-wrap">{listing.description}</p>
              </div>

              <Separator />

              <div className="flex items-center text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 mr-2" />
                Listed on {listing.createdAt.toLocaleDateString()}
              </div>
            </div>

            {/* Right Column - Images and Price */}
            <div className="space-y-6">
              <Carousel className="w-full">
                <CarouselContent>
                  {listing.imageUrls.map((url, index) => (
                    <CarouselItem key={index}>
                      <div className="relative aspect-[4/3] w-full">
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
    </div>
  );
}