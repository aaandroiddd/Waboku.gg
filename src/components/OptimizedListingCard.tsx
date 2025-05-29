import { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { generateListingUrl } from '@/lib/listing-slug';
import Link from 'next/link';
import Image from 'next/image';
import { optimizedGet, databaseCache } from '@/lib/database-query-optimizer';

interface ListingCardProps {
  id: string;
  title: string;
  price: number;
  imageUrl?: string;
  condition?: string;
  sellerId: string;
  game?: string;
  createdAt: number;
  showSellerInfo?: boolean;
}

const OptimizedListingCard: React.FC<ListingCardProps> = ({
  id,
  title,
  price,
  imageUrl,
  condition,
  sellerId,
  game,
  createdAt,
  showSellerInfo = false
}) => {
  const [sellerName, setSellerName] = useState<string>('');
  const [sellerRating, setSellerRating] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(showSellerInfo);
  
  // Format price
  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(price);
  
  // Format date
  const formattedDate = new Date(createdAt).toLocaleDateString();
  
  // Load seller info only if needed and with optimized query
  useEffect(() => {
    if (showSellerInfo) {
      const loadSellerInfo = async () => {
        try {
          // Use optimized query with caching
          const sellerData = await databaseCache.getOrFetch(`/users/profiles/${sellerId}`, async () => {
            const snapshot = await optimizedGet(`/users/profiles/${sellerId}`);
            return snapshot.exists() ? snapshot.val() : null;
          });
          
          if (sellerData) {
            setSellerName(sellerData.displayName || 'Unknown Seller');
            
            // Load rating only if needed
            if (sellerData.hasRatings) {
              const ratingsData = await databaseCache.getOrFetch(`/users/ratings/${sellerId}`, async () => {
                const snapshot = await optimizedGet(`/users/ratings/${sellerId}`);
                return snapshot.exists() ? snapshot.val() : null;
              });
              
              if (ratingsData) {
                // Calculate average rating
                const ratings = Object.values(ratingsData) as number[];
                const avgRating = ratings.reduce((sum: number, rating: any) => sum + rating.value, 0) / ratings.length;
                setSellerRating(avgRating);
              }
            }
          }
        } catch (error) {
          console.error('Error loading seller info:', error);
        } finally {
          setIsLoading(false);
        }
      };
      
      loadSellerInfo();
    }
  }, [sellerId, showSellerInfo]);
  
  return (
    <Card className="h-full flex flex-col overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative aspect-square overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <span className="text-muted-foreground">No Image</span>
          </div>
        )}
      </div>
      
      <CardContent className="flex-grow p-4">
        <h3 className="font-semibold text-lg line-clamp-2">{title}</h3>
        
        <div className="mt-2 flex justify-between items-center">
          <span className="text-lg font-bold">{formattedPrice}</span>
          {condition && (
            <Badge variant="outline">{condition}</Badge>
          )}
        </div>
        
        {game && (
          <div className="mt-2">
            <Badge variant="secondary">{game}</Badge>
          </div>
        )}
        
        {showSellerInfo && (
          <div className="mt-3 text-sm">
            {isLoading ? (
              <div className="h-5 w-24 bg-muted animate-pulse rounded"></div>
            ) : (
              <div className="flex items-center">
                <span>Seller: {sellerName}</span>
                {sellerRating !== null && (
                  <div className="ml-2 flex items-center">
                    <span className="text-yellow-500">★</span>
                    <span className="ml-1">{sellerRating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              Listed on {formattedDate}
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="p-4 pt-0">
        <Link href={generateListingUrl(title, game || 'other', id)} className="w-full">
          <Button variant="default" className="w-full">
            View Details
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
};

export default OptimizedListingCard;