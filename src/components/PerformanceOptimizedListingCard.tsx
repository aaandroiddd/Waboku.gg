import React, { memo, useMemo, useCallback, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, MapPin, Clock, Eye } from 'lucide-react';
import { Listing } from '@/types/database';
import { useRouter } from 'next/router';
import { usePerformanceOptimization, useIntersectionObserver } from '@/hooks/usePerformanceOptimization';
import { generateListingSlug } from '@/lib/listing-slug';
import { formatPrice } from '@/lib/price';
import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';

interface PerformanceOptimizedListingCardProps {
  listing: Listing;
  onFavoriteToggle?: (listingId: string, isFavorited: boolean) => void;
  isFavorited?: boolean;
  showDistance?: boolean;
  priority?: boolean;
  lazy?: boolean;
}

const PerformanceOptimizedListingCard = memo<PerformanceOptimizedListingCardProps>(({
  listing,
  onFavoriteToggle,
  isFavorited = false,
  showDistance = false,
  priority = false,
  lazy = true
}) => {
  const router = useRouter();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(!lazy);

  // Use performance optimization hook
  const { measureRender, debounce } = usePerformanceOptimization({
    componentName: 'PerformanceOptimizedListingCard',
    trackRenders: true
  });

  // Use intersection observer for lazy loading
  const cardRef = useIntersectionObserver(
    useCallback((isIntersecting: boolean) => {
      if (isIntersecting && !isVisible) {
        setIsVisible(true);
      }
    }, [isVisible]),
    {
      threshold: 0.1,
      rootMargin: '100px'
    }
  );

  // Memoize expensive calculations
  const memoizedData = useMemo(() => {
    const slug = generateListingSlug(listing);
    const formattedPrice = formatPrice(listing.price);
    const timeAgo = formatDistanceToNow(new Date(listing.createdAt), { addSuffix: true });
    const coverImage = listing.imageUrls?.[listing.coverImageIndex || 0] || listing.imageUrls?.[0];
    
    return {
      slug,
      formattedPrice,
      timeAgo,
      coverImage
    };
  }, [listing.id, listing.price, listing.createdAt, listing.imageUrls, listing.coverImageIndex]);

  // Debounced navigation to prevent rapid clicks
  const debouncedNavigate = useCallback(
    debounce(() => {
      measureRender(() => {
        router.push(`/listings/${memoizedData.slug}`);
      });
    }, 300),
    [router, memoizedData.slug, measureRender]
  );

  // Debounced favorite toggle
  const debouncedFavoriteToggle = useCallback(
    debounce((e: React.MouseEvent) => {
      e.stopPropagation();
      if (onFavoriteToggle) {
        onFavoriteToggle(listing.id, !isFavorited);
      }
    }, 300),
    [onFavoriteToggle, listing.id, isFavorited]
  );

  // Handle image load
  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  // Don't render anything if not visible and lazy loading is enabled
  if (lazy && !isVisible) {
    return (
      <div 
        ref={cardRef}
        className="h-80 w-full bg-muted/20 rounded-lg animate-pulse"
        style={{ minHeight: '320px' }}
      />
    );
  }

  return (
    <Card 
      ref={cardRef}
      className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] will-change-transform"
      onClick={debouncedNavigate}
    >
      <CardContent className="p-0">
        {/* Image Container */}
        <div className="relative aspect-square overflow-hidden rounded-t-lg bg-muted/20">
          {memoizedData.coverImage && isVisible && (
            <Image
              src={memoizedData.coverImage}
              alt={listing.title}
              fill
              className={`object-cover transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={handleImageLoad}
              priority={priority}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              quality={75}
            />
          )}
          
          {/* Loading placeholder */}
          {!imageLoaded && (
            <div className="absolute inset-0 bg-muted/20 animate-pulse flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Favorite Button */}
          {onFavoriteToggle && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-8 w-8 p-0 bg-background/80 backdrop-blur-sm hover:bg-background/90"
              onClick={debouncedFavoriteToggle}
            >
              <Heart 
                className={`h-4 w-4 ${
                  isFavorited ? 'fill-red-500 text-red-500' : 'text-muted-foreground'
                }`} 
              />
            </Button>
          )}

          {/* Status Badge */}
          {listing.status !== 'active' && (
            <Badge 
              variant="secondary" 
              className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm"
            >
              {listing.status}
            </Badge>
          )}

          {/* Graded Badge */}
          {listing.isGraded && listing.gradeLevel && (
            <Badge 
              variant="outline" 
              className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm"
            >
              {listing.gradingCompany} {listing.gradeLevel}
            </Badge>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Title and Price */}
          <div className="space-y-1">
            <h3 className="font-medium text-sm line-clamp-2 leading-tight">
              {listing.title}
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-primary">
                {memoizedData.formattedPrice}
              </span>
              {listing.condition && (
                <Badge variant="outline" className="text-xs">
                  {listing.condition}
                </Badge>
              )}
            </div>
          </div>

          {/* Game Badge */}
          {listing.game && (
            <Badge variant="secondary" className="text-xs">
              {listing.game}
            </Badge>
          )}

          {/* Location and Time */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span className="truncate">
                {listing.city}, {listing.state}
              </span>
              {showDistance && listing.distance !== undefined && (
                <span className="ml-1">
                  ({listing.distance.toFixed(1)} mi)
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{memoizedData.timeAgo}</span>
            </div>
          </div>

          {/* View Count */}
          {listing.viewCount !== undefined && listing.viewCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3 w-3" />
              <span>{listing.viewCount} views</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

PerformanceOptimizedListingCard.displayName = 'PerformanceOptimizedListingCard';

export { PerformanceOptimizedListingCard };