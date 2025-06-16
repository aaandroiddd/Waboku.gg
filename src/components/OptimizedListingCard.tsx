import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GameCategoryBadge } from '@/components/GameCategoryBadge';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Listing } from '@/types/database';
import { formatPrice } from '@/lib/price';
import { UserNameLink } from './UserNameLink';
import { StripeSellerBadge } from './StripeSellerBadge';
import { memo, useEffect, useState, useRef } from 'react';
import { useLocation } from '@/hooks/useLocation';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthRedirect } from '@/contexts/AuthRedirectContext';
import { useRouter } from 'next/router';
import { cn } from '@/lib/utils';
import { loadStripe } from '@stripe/stripe-js';
import { toast } from 'sonner';
import { useStripeSellerStatus } from '@/hooks/useStripeSellerStatus';
import { useFavoriteGroups } from '@/hooks/useFavoriteGroups';
import { AddToGroupDialog } from './AddToGroupDialog';
import { getListingUrl } from '@/lib/listing-slug';
import { motion, useReducedMotion, useInView } from 'framer-motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';

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
  onAddToGroup?: (listingId: string, groupId: string) => Promise<void>;
  onRemoveFromFavorites?: (listingId: string) => Promise<void>;
  getConditionColor: (condition: string) => { base: string; hover: string };
  distance?: number;
}

// Optimized animation variants based on device capabilities
const createCardVariants = (isMobile: boolean, prefersReducedMotion: boolean) => {
  if (prefersReducedMotion) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.2 } },
      hover: {}
    };
  }

  if (isMobile) {
    return {
      hidden: { opacity: 0 },
      visible: { 
        opacity: 1,
        transition: { duration: 0.3, ease: "easeOut" }
      },
      hover: {
        scale: 1.01,
        transition: { duration: 0.15, ease: "easeOut" }
      }
    };
  }

  return {
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
};

const createImageVariants = (isMobile: boolean, prefersReducedMotion: boolean) => {
  if (prefersReducedMotion || isMobile) {
    return { hover: {} };
  }

  return {
    hover: {
      scale: 1.05,
      transition: {
        duration: 0.3,
        ease: "easeInOut"
      }
    }
  };
};

const createButtonVariants = (isMobile: boolean, prefersReducedMotion: boolean) => {
  if (prefersReducedMotion) {
    return { hover: {}, tap: {} };
  }

  return {
    hover: {
      scale: isMobile ? 1.05 : 1.1,
      transition: {
        duration: 0.15,
        ease: "easeInOut"
      }
    },
    tap: {
      scale: 0.95
    }
  };
};

// Optimized Motion wrapper that respects user preferences
const OptimizedMotion = ({ 
  children, 
  variants, 
  className,
  style,
  ...props 
}: any) => {
  const prefersReducedMotion = useReducedMotion();
  
  if (prefersReducedMotion) {
    return <div className={className} style={style}>{children}</div>;
  }
  
  return (
    <motion.div
      className={className}
      style={{ 
        willChange: "transform, opacity",
        ...style 
      }}
      variants={variants}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// Optimized BuyNow Button Component
const BuyNowButton = memo(({ listing, className }: { listing: Listing; className?: string }) => {
  const { user } = useAuth();
  const router = useRouter();
  const { hasStripeAccount, isLoading } = useStripeSellerStatus(listing.userId);
  const { saveRedirectState } = useAuthRedirect();

  const handleBuyNow = async () => {
    if (!user) {
      toast.error('Please sign in to make a purchase');
      saveRedirectState('buy_now', { listingId: listing.id });
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

  const isDisabled = isLoading ? true : !hasStripeAccount;
  const buttonText = isDisabled ? "Seller Not Verified" : "Buy Now";

  return (
    <Button
      onClick={handleBuyNow}
      disabled={isDisabled}
      className={cn(
        "w-full", 
        isDisabled 
          ? "bg-gray-500 hover:bg-gray-500 cursor-not-allowed" 
          : "bg-green-600 hover:bg-green-700 text-white", 
        className
      )}
      title={isDisabled ? "This seller hasn't set up their payment account yet" : ""}
    >
      {buttonText}
    </Button>
  );
});

BuyNowButton.displayName = 'BuyNowButton';

export const OptimizedListingCard = memo(({ 
  listing, 
  isFavorite, 
  onFavoriteClick, 
  onAddToGroup, 
  onRemoveFromFavorites, 
  getConditionColor,
  distance: propDistance
}: ListingCardProps) => {
  const { location } = useLocation({ autoRequest: false });
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(propDistance || null);
  const [isCheckingExpiration, setIsCheckingExpiration] = useState(false);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const { groups, addToGroup, createAndAddToGroup } = useFavoriteGroups();
  const { user } = useAuth();
  
  // Device and preference detection
  const isMobile = useMediaQuery("(max-width: 768px)");
  const prefersReducedMotion = useReducedMotion();
  
  // Intersection observer for lazy loading
  const cardRef = useRef(null);
  const isInView = useInView(cardRef, { 
    once: true, 
    threshold: 0.1,
    margin: "50px 0px"
  });

  // Memoize animation variants
  const cardVariants = createCardVariants(isMobile, prefersReducedMotion);
  const imageVariants = createImageVariants(isMobile, prefersReducedMotion);
  const buttonVariants = createButtonVariants(isMobile, prefersReducedMotion);

  // Optimized distance calculation
  useEffect(() => {
    if (propDistance) {
      setCalculatedDistance(propDistance);
      return;
    }

    if (location?.latitude && location?.longitude && listing?.location?.latitude && listing?.location?.longitude) {
      // Use requestIdleCallback for non-critical distance calculation
      const calculateDistanceAsync = () => {
        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          listing.location.latitude,
          listing.location.longitude
        );
        setCalculatedDistance(distance);
      };

      if ('requestIdleCallback' in window) {
        requestIdleCallback(calculateDistanceAsync);
      } else {
        setTimeout(calculateDistanceAsync, 0);
      }
    } else {
      setCalculatedDistance(null);
    }
  }, [location, listing, propDistance]);

  // Optimized expiration check with session storage
  useEffect(() => {
    if (listing.status !== 'active' || isCheckingExpiration) return;
    
    const checkedListingsKey = 'checkedListingExpirations';
    const checkedListings = sessionStorage.getItem(checkedListingsKey) || '';
    const checkedListingsArray = checkedListings.split(',').filter(Boolean);
    
    if (checkedListingsArray.includes(listing.id)) {
      return;
    }
    
    const isListingDetailPage = typeof window !== 'undefined' && 
      window.location.pathname.includes('/listings/') && 
      window.location.pathname.split('/').length > 2;
    
    if (!isListingDetailPage) {
      checkedListingsArray.push(listing.id);
      sessionStorage.setItem(checkedListingsKey, checkedListingsArray.join(','));
      return;
    }
    
    const now = new Date();
    const expiresAt = listing.expiresAt instanceof Date 
      ? listing.expiresAt 
      : new Date(listing.expiresAt);
      
    if (now > expiresAt) {
      let isMounted = true;
      
      const triggerBackgroundCheck = async () => {
        if (!isMounted) return;
        
        setIsCheckingExpiration(true);
        try {
          checkedListingsArray.push(listing.id);
          sessionStorage.setItem(checkedListingsKey, checkedListingsArray.join(','));
          
          // Use requestIdleCallback for background API call
          const makeApiCall = () => {
            fetch('/api/listings/check-expiration', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ listingId: listing.id }),
            }).catch(err => {
              console.error('Background expiration check failed:', err);
            });
          };

          if ('requestIdleCallback' in window) {
            requestIdleCallback(makeApiCall);
          } else {
            setTimeout(makeApiCall, 0);
          }
        } catch (error) {
          console.error('Error triggering background expiration check:', error);
        } finally {
          if (isMounted) {
            setIsCheckingExpiration(false);
          }
        }
      };
      
      triggerBackgroundCheck();
      
      return () => {
        isMounted = false;
      };
    } else {
      checkedListingsArray.push(listing.id);
      sessionStorage.setItem(checkedListingsKey, checkedListingsArray.join(','));
    }
  }, [listing.id, listing.expiresAt, listing.status]);

  // Optimized group handlers
  const handleAddToGroup = async (listingId: string, groupId: string) => {
    if (onAddToGroup) {
      return onAddToGroup(listingId, groupId);
    }
    return addToGroup(listingId, groupId);
  };

  const handleCreateAndAddToGroup = async (listingId: string, groupName: string) => {
    return createAndAddToGroup(listingId, groupName);
  };

  // Don't render until in view for better performance
  if (!isInView) {
    return (
      <div 
        ref={cardRef} 
        className="h-[420px] bg-muted/20 rounded-lg animate-pulse"
        style={{ minHeight: '420px' }}
      />
    );
  }

  return (
    <OptimizedMotion
      ref={cardRef}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      layout={!isMobile && !prefersReducedMotion}
    >
      <AddToGroupDialog
        isOpen={showGroupDialog}
        onClose={() => setShowGroupDialog(false)}
        listing={listing}
        groups={groups}
        onAddToGroup={handleAddToGroup}
        onCreateAndAddToGroup={handleCreateAndAddToGroup}
      />
      
      <Card className="relative overflow-hidden group h-full">
        <Link href={getListingUrl(listing)}>
          <CardContent className="p-3 h-full flex flex-col" style={{ minHeight: '420px' }}>
            <div className="aspect-square bg-muted rounded-lg mb-4 relative overflow-hidden flex-shrink-0">
              {/* Price Badge */}
              <OptimizedMotion 
                className="absolute bottom-2 right-2 z-10"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <span className="px-3 py-1 bg-black/75 text-white rounded-md font-semibold text-sm sm:text-base">
                  {listing.offersOnly ? "Offers Only" : formatPrice(listing.price)}
                </span>
              </OptimizedMotion>

              {/* Top Bar with Favorite and Status Badges */}
              <div className="absolute top-0 left-0 right-0 p-2 z-20">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 flex-wrap">
                    <OptimizedMotion
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
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          
                          if (isFavorite) {
                            onFavoriteClick(e, listing);
                          } else if (user) {
                            setShowGroupDialog(true);
                          } else {
                            onFavoriteClick(e, listing);
                          }
                        }}
                      >
                        <Heart 
                          className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`}
                          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        />
                      </Button>
                    </OptimizedMotion>
                    
                    {/* Status Badges */}
                    {listing.status === 'archived' && (
                      <OptimizedMotion 
                        className="flex-shrink-0"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                      >
                        <span className="px-2 py-1 bg-red-500/90 text-white rounded-md font-semibold flex items-center gap-1 text-xs sm:text-sm whitespace-nowrap">
                          <svg viewBox="0 0 24 24" className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Archived</span>
                        </span>
                      </OptimizedMotion>
                    )}
                    
                    {listing.status === 'sold' && (
                      <OptimizedMotion 
                        className="flex-shrink-0"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                      >
                        <span className="px-2 py-1 bg-amber-500/90 text-white rounded-md font-semibold flex items-center gap-1 text-xs sm:text-sm whitespace-nowrap">
                          <svg viewBox="0 0 24 24" className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Sold</span>
                        </span>
                      </OptimizedMotion>
                    )}
                    
                    {listing.needsReview && listing.status === 'active' && (
                      <OptimizedMotion 
                        className="flex-shrink-0"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                      >
                        <span className="px-2 py-1 bg-amber-500/90 text-white rounded-md font-semibold flex items-center gap-1 text-xs sm:text-sm whitespace-nowrap">
                          <svg viewBox="0 0 24 24" className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span>Under Review</span>
                        </span>
                      </OptimizedMotion>
                    )}
                    
                    {listing.isGraded && (
                      <OptimizedMotion 
                        className="flex-shrink-0"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                      >
                        <span className="px-2 py-1 bg-blue-500/90 text-white rounded-md font-semibold flex items-center gap-1 text-xs sm:text-sm whitespace-nowrap">
                          <svg viewBox="0 0 24 24" className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                            <path d="M2 17L12 22L22 17" />
                            <path d="M2 12L12 17L22 12" />
                          </svg>
                          <span className="hidden sm:inline">{listing.gradingCompany}</span>
                          <span className="font-bold">{listing.gradeLevel}</span>
                        </span>
                      </OptimizedMotion>
                    )}

                    {/* Final Sale Badge */}
                    {listing.finalSale && listing.status === 'active' && (
                      <OptimizedMotion 
                        className="flex-shrink-0"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                      >
                        <span className="px-2 py-1 bg-orange-500/90 text-white rounded-md font-semibold flex items-center gap-1 text-xs sm:text-sm whitespace-nowrap">
                          <svg viewBox="0 0 24 24" className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" strokeWidth="2">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <span>Final Sale</span>
                        </span>
                      </OptimizedMotion>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Optimized Image Loading */}
              {listing.imageUrls && listing.imageUrls.length > 0 ? (
                <OptimizedMotion 
                  className="relative w-full h-full bg-muted/50"
                  variants={imageVariants}
                >
                  {(() => {
                    const coverIndex = typeof listing.coverImageIndex === 'number' ? listing.coverImageIndex : 0;
                    const safeIndex = Array.isArray(listing.imageUrls) && listing.imageUrls.length > 0 
                      ? Math.min(coverIndex, listing.imageUrls.length - 1) 
                      : 0;
                    const imageUrl = Array.isArray(listing.imageUrls) && 
                                    listing.imageUrls.length > 0 ? 
                                    listing.imageUrls[safeIndex] : 
                                    '/images/rect.png';
                    
                    return (
                      <Image
                        src={imageUrl}
                        alt={listing.title}
                        className="rounded-lg object-cover"
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                        priority={false}
                        quality={isMobile ? 70 : 80}
                        loading="lazy"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/images/rect.png';
                        }}
                      />
                    );
                  })()}
                </OptimizedMotion>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-secondary">
                  <span className="text-muted-foreground">No image</span>
                </div>
              )}
            </div>
            
            {/* Card Content */}
            <OptimizedMotion 
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
                <OptimizedMotion whileHover={{ scale: prefersReducedMotion ? 1 : 1.05 }}>
                  {listing.game && (
                    <GameCategoryBadge 
                      game={listing.game} 
                      variant="outline" 
                      className="text-xs font-medium shadow-sm"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </OptimizedMotion>
                
                <OptimizedMotion whileHover={{ scale: prefersReducedMotion ? 1 : 1.05 }}>
                  <Badge className={`${getConditionColor(listing.condition).base} ${getConditionColor(listing.condition).hover} shadow-sm font-medium`}>
                    {listing.condition}
                  </Badge>
                </OptimizedMotion>
                
                <OptimizedMotion whileHover={{ scale: prefersReducedMotion ? 1 : 1.05 }}>
                  <StripeSellerBadge userId={listing.userId} className="text-xs" />
                </OptimizedMotion>
                
                {listing.isGraded && (
                  <OptimizedMotion 
                    className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded-full shadow-sm font-medium"
                    whileHover={{ scale: prefersReducedMotion ? 1 : 1.05 }}
                  >
                    {listing.gradingCompany} {listing.gradeLevel}
                  </OptimizedMotion>
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
                        calculatedDistance <= 5 && !prefersReducedMotion && 'animate-pulse'
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
            </OptimizedMotion>
          </CardContent>
        </Link>
      </Card>
    </OptimizedMotion>
  );
});

OptimizedListingCard.displayName = 'OptimizedListingCard';