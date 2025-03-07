import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GameCategoryBadge } from '@/components/GameCategoryBadge';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { DistanceIndicator } from './DistanceIndicator';
import { Listing } from '@/types/database';
import { formatPrice } from '@/lib/price';
import { motion } from 'framer-motion';
import { UserNameLink } from './UserNameLink';
import { memo, useEffect, useState } from 'react';
import { useLocation } from '@/hooks/useLocation';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { cn } from '@/lib/utils';
import { loadStripe } from '@stripe/stripe-js';
import { toast } from 'sonner';

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

interface ListingCardProps {
  listing: Listing;
  isFavorite: boolean;
  onFavoriteClick: (e: React.MouseEvent, listing: Listing) => void;
  getConditionColor: (condition: string) => { base: string; hover: string };
}

const cardVariants = {
  hidden: { 
    opacity: 0,
    y: 20,
    scale: 0.95
  },
  visible: { 
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.23, 1, 0.32, 1]
    }
  },
  hover: {
    y: -8,
    scale: 1.02,
    transition: {
      duration: 0.2,
      ease: "easeInOut"
    }
  }
};

const imageVariants = {
  hover: {
    scale: 1.05,
    transition: {
      duration: 0.3,
      ease: "easeInOut"
    }
  }
};

const buttonVariants = {
  hover: {
    scale: 1.1,
    transition: {
      duration: 0.2,
      ease: "easeInOut"
    }
  },
  tap: {
    scale: 0.95
  }
};

interface BuyNowButtonProps {
  listing: Listing;
  className?: string;
}

const BuyNowButton = ({ listing, className }: BuyNowButtonProps) => {
  const { user } = useAuth();
  const router = useRouter();

  const handleBuyNow = async () => {
    if (!user) {
      toast.error('Please sign in to make a purchase');
      router.push('/auth/sign-in');
      return;
    }

    if (user.uid === listing.userId) {
      toast.error('You cannot buy your own listing');
      return;
    }

    try {
      const response = await fetch('/api/stripe/create-buy-now-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listingId: listing.id,
          userId: user.uid,
          email: user.email,
        }),
      });

      const { sessionId } = await response.json();
      
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
      if (!stripe) throw new Error('Failed to load Stripe');

      await stripe.redirectToCheckout({ sessionId });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast.error('Failed to process purchase. Please try again.');
    }
  };

  return (
    <Button
      onClick={handleBuyNow}
      className={cn("w-full bg-green-600 hover:bg-green-700 text-white", className)}
    >
      Buy Now
    </Button>
  );
};

export const ListingCard = memo(({ listing, isFavorite, onFavoriteClick, getConditionColor }: ListingCardProps) => {
  const { location } = useLocation();
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null);

  useEffect(() => {
    if (location?.latitude && location?.longitude && listing?.location?.latitude && listing?.location?.longitude) {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        listing.location.latitude,
        listing.location.longitude
      );
      setCalculatedDistance(distance);
    } else {
      setCalculatedDistance(null);
    }
  }, [location, listing]);

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      layout
    >
      <Card className="relative overflow-hidden group">
        <Link href={`/listings/${listing.id}`}>
          <CardContent className="p-3 h-full flex flex-col">
            <div className="aspect-square bg-muted rounded-lg mb-4 relative overflow-hidden flex-shrink-0">
              {/* Price Badge */}
              <motion.div 
                className="absolute bottom-2 right-2 z-10"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <span className="px-3 py-1 bg-black/75 text-white rounded-md font-semibold text-sm sm:text-base">
                  {formatPrice(listing.price)}
                </span>
              </motion.div>

              {/* Top Bar with Favorite and Graded Badge */}
              <div className="absolute top-0 left-0 right-0 p-2 z-20">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 flex-wrap">
                    <motion.div
                      variants={buttonVariants}
                      whileHover="hover"
                      whileTap="tap"
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        className={`
                          bg-black/50 hover:bg-black/75 transition-colors duration-200 rounded-full
                          ${isFavorite ? 'text-red-500 hover:text-red-600' : 'text-white hover:text-red-500'}
                        `}
                        onClick={(e) => onFavoriteClick(e, listing)}
                      >
                        <Heart 
                          className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`}
                          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        />
                      </Button>
                    </motion.div>
                    
                    {/* Graded Badge */}
                    {listing.isGraded && (
                      <motion.div 
                        className="flex-shrink-0"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                      >
                        <span className="px-2 py-1 bg-blue-500/90 text-white rounded-md font-semibold flex items-center gap-1 text-xs sm:text-sm whitespace-nowrap">
                          <svg 
                            viewBox="0 0 24 24" 
                            className="w-3 h-3 sm:w-4 sm:h-4" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2"
                          >
                            <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                            <path d="M2 17L12 22L22 17" />
                            <path d="M2 12L12 17L22 12" />
                          </svg>
                          <span className="hidden sm:inline">{listing.gradingCompany}</span>
                          <span className="font-bold">{listing.gradeLevel}</span>
                        </span>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
              
              {listing.imageUrls && listing.imageUrls.length > 0 ? (
                <motion.div 
                  className="relative w-full h-full bg-muted/50"
                  variants={imageVariants}
                >
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-br from-muted/80 to-muted animate-pulse" 
                    initial={{ opacity: 1 }}
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 1.5,
                      ease: "easeInOut"
                    }}
                  />
                  <Image
                    src={listing.imageUrls[listing.coverImageIndex ?? 0]}
                    alt={listing.title}
                    className="rounded-lg object-cover"
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    priority={false}
                    quality={80}
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/images/rect.png';
                    }}
                  />
                </motion.div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-secondary">
                  <span className="text-muted-foreground">No image</span>
                </div>
              )}
            </div>
            <motion.div 
              className="space-y-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="font-medium text-base line-clamp-1">{listing.title}</h3>
              <p className="text-sm text-muted-foreground">
                by{" "}
                <UserNameLink userId={listing.userId} initialUsername={listing.username} />
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <motion.div whileHover={{ scale: 1.05 }}>
                  {listing.game && (
                    <GameCategoryBadge 
                      game={listing.game} 
                      variant="secondary" 
                      className="text-xs"
                      onClick={(e) => e.stopPropagation()} // Prevent link navigation when clicking the badge
                    />
                  )}
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }}>
                  <Badge className={`${getConditionColor(listing.condition).base} ${getConditionColor(listing.condition).hover}`}>
                    {listing.condition}
                  </Badge>
                </motion.div>
                {listing.isGraded && (
                  <motion.span 
                    className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full"
                    whileHover={{ scale: 1.05 }}
                  >
                    {listing.gradingCompany} {listing.gradeLevel}
                  </motion.span>
                )}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{listing.city}, {listing.state}</span>
                {calculatedDistance !== null && (
                  <span className={`flex items-center gap-1 font-medium ${
                    calculatedDistance <= 5 
                      ? 'text-green-500 dark:text-green-400'
                      : calculatedDistance <= 20
                      ? 'text-blue-500 dark:text-blue-400'
                      : calculatedDistance <= 50
                      ? 'text-yellow-500 dark:text-yellow-400'
                      : 'text-muted-foreground'
                  }`}>
                    <svg 
                      className={`w-3 h-3 ${
                        calculatedDistance <= 5 && 'animate-pulse'
                      }`} 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {calculatedDistance < 1 
                      ? 'Less than 1 mile!' 
                      : calculatedDistance <= 5 
                      ? `${calculatedDistance.toFixed(1)} mi - Very Close!`
                      : calculatedDistance <= 20
                      ? `${calculatedDistance.toFixed(1)} mi - Nearby`
                      : `${calculatedDistance.toFixed(1)} mi`
                    }
                  </span>
                )}
              </div>
            </motion.div>
          </CardContent>
        </Link>
      </Card>
    </motion.div>
  );
});

ListingCard.displayName = 'ListingCard';