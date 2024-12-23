import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';

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

      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl font-bold">{listing.title}</CardTitle>
              <div className="flex gap-2 mt-2">
                <Badge variant="secondary">{listing.game}</Badge>
                <Badge className={getConditionColor(listing.condition)}>{listing.condition}</Badge>
                {listing.isGraded && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
                    {listing.gradingCompany} {listing.gradeLevel}
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-2xl font-bold">
              ${typeof listing.price === 'number' ? listing.price.toFixed(2) : listing.price}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Carousel className="w-full max-w-xl mx-auto mb-6">
            <CarouselContent>
              {listing.imageUrls.map((url, index) => (
                <CarouselItem key={index}>
                  <div className="relative aspect-[4/3] w-full">
                    <Image
                      src={url}
                      alt={`${listing.title} - Image ${index + 1}`}
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      priority={index === 0}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/images/rect.png'; // Fallback image
                      }}
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>

          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Description</h3>
            <p className="text-muted-foreground whitespace-pre-wrap">{listing.description}</p>
          </div>

          <div className="mt-6 text-sm text-muted-foreground">
            Listed on {listing.createdAt.toLocaleDateString()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}