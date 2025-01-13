import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Listing } from '@/types/database';
import { formatPrice } from '@/lib/price';
import { motion } from 'framer-motion';
import { UserNameLink } from './UserNameLink';
import { memo } from 'react';

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

export const ListingCard = memo(({ listing, isFavorite, onFavoriteClick, getConditionColor }: ListingCardProps) => {
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
          <CardContent className="p-4">
            <div className="aspect-square bg-muted rounded-lg mb-4 relative overflow-hidden">
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
              <div className="absolute top-0 left-0 right-0 p-2 flex items-start justify-between gap-2 z-20">
                <div className="flex items-start gap-2">
                  <motion.div
                    variants={buttonVariants}
                    whileHover="hover"
                    whileTap="tap"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => onFavoriteClick(e, listing)}
                      className={`
                        bg-black/50 hover:bg-black/75 transition-colors duration-200 rounded-full
                        ${isFavorite ? 'text-red-500 hover:text-red-600' : 'text-white hover:text-red-500'}
                      `}
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
                      <span className="px-2 py-1 bg-blue-500/90 text-white rounded-md font-semibold flex items-center gap-1 text-xs sm:text-sm">
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
              
              {listing.imageUrls && listing.imageUrls.length > 0 ? (
                <motion.div 
                  className="relative w-full h-full"
                  variants={imageVariants}
                >
                  <Image
                    src={listing.imageUrls[0]}
                    alt={listing.title}
                    className="rounded-lg"
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    priority={false}
                    quality={75}
                    placeholder="blur"
                    blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDABQODxIPDRQSEBIXFRQdHx4dHRsdHR4dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR3/2wBDAR0XFyAeIRshIRshHRsdIR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR3/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAb/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                    style={{ objectFit: 'cover' }}
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
                <motion.span 
                  className="text-xs px-2 py-0.5 bg-secondary rounded-full"
                  whileHover={{ scale: 1.05 }}
                >
                  {listing.game}
                </motion.span>
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
              <p className="text-xs text-muted-foreground">{listing.city}, {listing.state}</p>
            </motion.div>
          </CardContent>
        </Link>
      </Card>
    </motion.div>
  );
});

ListingCard.displayName = 'ListingCard';