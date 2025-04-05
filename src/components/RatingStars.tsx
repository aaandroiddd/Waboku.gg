import { Star } from 'lucide-react';

interface RatingStarsProps {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
  showEmpty?: boolean;
  className?: string;
}

export function RatingStars({ 
  rating, 
  size = 'md', 
  showEmpty = true,
  className = ''
}: RatingStarsProps) {
  // Determine star size based on the size prop
  const starSize = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }[size];
  
  // Calculate the number of full and empty stars
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  return (
    <div className={`flex items-center ${className}`}>
      {/* Full stars */}
      {[...Array(fullStars)].map((_, i) => (
        <Star
          key={`full-${i}`}
          className={`${starSize} text-yellow-500 fill-yellow-500`}
        />
      ))}
      
      {/* Half star */}
      {hasHalfStar && (
        <div className="relative">
          <Star className={`${starSize} text-yellow-500 fill-yellow-500`} />
          <div className="absolute inset-0 overflow-hidden w-1/2">
            <Star className={`${starSize} text-gray-300`} />
          </div>
        </div>
      )}
      
      {/* Empty stars */}
      {showEmpty && [...Array(emptyStars)].map((_, i) => (
        <Star
          key={`empty-${i}`}
          className={`${starSize} text-gray-300`}
        />
      ))}
    </div>
  );
}