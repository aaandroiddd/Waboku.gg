import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GameCategoryBadge } from '@/components/GameCategoryBadge';
import { Button } from '@/components/ui/button';
import { Heart, FolderPlus } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { DistanceIndicator } from './DistanceIndicator';
import { Listing } from '@/types/database';
import { formatPrice } from '@/lib/price';
import { motion } from 'framer-motion';
import { UserNameLink } from './UserNameLink';
import { StripeSellerBadge } from './StripeSellerBadge';
import { memo, useEffect, useState } from 'react';
import { useLocation } from '@/hooks/useLocation';
import { cn } from '@/lib/utils';

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

interface FavoriteListingCardProps {
  listing: Listing;
  isFavorite: boolean;
  onFavoriteClick: (e: React.MouseEvent, listing: Listing) => void;
  onAddToGroupClick?: (e: React.MouseEvent, listing: Listing) => void;
  getConditionColor: (condition: string) => { base: string; hover: string };
  groupName?: string;
}

// Detect if we're on a mobile device to simplify animations
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

const cardVariants = {
  hidden: isMobile ? { 
    opacity: 0
  } : { 
    opacity: 0,
    y: 20,
    scale: 0.95
  },
  visible: isMobile ? { 
    opacity: 1,
    transition: {
      duration: 0.3
    }
  } : { 
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.23, 1, 0.32, 1]
    }
  },
  hover: isMobile ? {} : {
    y: -8,
    scale: 1.02,
    transition: {
      duration: 0.2,
      ease: "easeInOut"
    }
  }
};

const imageVariants = isMobile ? {} : {
  hover: {
    scale: 1.05,
    transition: {
      duration: 0.3,
      ease: "easeInOut"
    }
  }
};

const buttonVariants = isMobile ? {
  tap: {
    scale: 0.95
  }
} : {
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

export const FavoriteListingCard = memo(({ 
  listing, 
  isFavorite, 
  onFavoriteClick, 
  onAddToGroupClick,
  getConditionColor,
  groupName
}: FavoriteListingCardProps) => {
  const { location } = useLocation({ autoRequest: false });
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

              {/* Top Bar with Favorite and Group Buttons */}
              <div className="absolute top-0 left-0 right-0 p-2 z-20">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 flex-wrap">
                    {/* Favorite Button */}
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
                    
                    {/* Add to Group Button */}
                    {isFavorite && onAddToGroupClick && (
                      <motion.div
                        variants={buttonVariants}
                        whileHover="hover"
                        whileTap="tap"
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          className="bg-black/50 hover:bg-black/75 transition-colors duration-200 rounded-full text-white hover:text-blue-400"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onAddToGroupClick(e, listing);
                          }}
                        >
                          <FolderPlus 
                            className="h-5 w-5"
                            aria-label="Add to group"
                          />
                        </Button>
                      </motion.div>
                    )}
                    
                    {/* Group Badge */}
                    {groupName && (
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
                            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                          </svg>
                          <span>{groupName}</span>
                        </span>
                      </motion.div>
                    )}
                    
                    {/* Archived Badge */}
                    {listing.status === 'archived' && (
                      <motion.div 
                        className="flex-shrink-0"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                      >
                        <span className="px-2 py-1 bg-red-500/90 text-white rounded-md font-semibold flex items-center gap-1 text-xs sm:text-sm whitespace-nowrap">
                          <svg 
                            viewBox="0 0 24 24" 
                            className="w-3 h-3 sm:w-4 sm:h-4" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2"
                          >
                            <path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Archived</span>
                        </span>
                      </motion.div>
                    )}
                    
                    {/* Sold Badge */}
                    {listing.status === 'sold' && (
                      <motion.div 
                        className="flex-shrink-0"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                      >
                        <span className="px-2 py-1 bg-amber-500/90 text-white rounded-md font-semibold flex items-center gap-1 text-xs sm:text-sm whitespace-nowrap">
                          <svg 
                            viewBox="0 0 24 24" 
                            className="w-3 h-3 sm:w-4 sm:h-4" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2"
                          >
                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Sold</span>
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
                  {(() => {
                    // Safely determine the image URL to use
                    const coverIndex = typeof listing.coverImageIndex === 'number' ? listing.coverImageIndex : 0;
                    const imageUrl = Array.isArray(listing.imageUrls) && 
                                    listing.imageUrls.length > 0 && 
                                    listing.imageUrls[coverIndex] ? 
                                    listing.imageUrls[coverIndex] : 
                                    '/images/rect.png';
                    
                    return (
                      <Image
                        src={imageUrl}
                        alt={listing.title}
                        className="rounded-lg object-cover"
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        priority={false}
                        quality={80}
                        loading="lazy"
                        onError={(e) => {
                          console.error(`Image load error for listing ${listing.id}:`, imageUrl);
                          const target = e.target as HTMLImageElement;
                          target.src = '/images/rect.png';
                        }}
                      />
                    );
                  })()}
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
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  by{" "}
                  <UserNameLink userId={listing.userId} initialUsername={listing.username} />
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <motion.div whileHover={{ scale: 1.05 }}>
                  {listing.game && (
                    <GameCategoryBadge 
                      game={listing.game} 
                      variant="outline" 
                      className="text-xs font-medium shadow-sm"
                      onClick={(e) => e.stopPropagation()} // Prevent link navigation when clicking the badge
                    />
                  )}
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }}>
                  <Badge className={`${getConditionColor(listing.condition).base} ${getConditionColor(listing.condition).hover} shadow-sm font-medium`}>
                    {listing.condition}
                  </Badge>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }}>
                  <StripeSellerBadge userId={listing.userId} className="text-xs" />
                </motion.div>
                {listing.isGraded && (
                  <motion.span 
                    className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded-full shadow-sm font-medium"
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

FavoriteListingCard.displayName = 'FavoriteListingCard';