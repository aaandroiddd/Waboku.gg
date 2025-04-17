import { Review } from '@/types/review';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Star, ThumbsUp, MessageSquare } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { UserNameLink } from '@/components/UserNameLink';
import { useReviews } from '@/hooks/useReviews';
import { useAuth } from '@/contexts/AuthContext';
import { useUserData } from '@/hooks/useUserData';

interface ReviewCardProps {
  review: Review;
  showSellerResponse?: boolean;
  allowHelpful?: boolean;
}

export function ReviewCard({ review, showSellerResponse = true, allowHelpful = true }: ReviewCardProps) {
  const { user } = useAuth();
  const { markReviewAsHelpful } = useReviews();
  const [helpfulCount, setHelpfulCount] = useState<number>(review.helpfulCount || 0);
  const [isMarkingHelpful, setIsMarkingHelpful] = useState<boolean>(false);
  
  // Use the useUserData hook instead of manual fetching
  const { userData, loading: isLoadingUser } = useUserData(review.reviewerId);
  const reviewerName = userData?.username || 'Anonymous User';
  const reviewerAvatar = userData?.avatarUrl || null;
  
  console.log('ReviewCard rendering for review:', review.id, 'with reviewer:', review.reviewerId);
  console.log('Reviewer data:', { name: reviewerName, avatar: reviewerAvatar, loading: isLoadingUser });
  console.log('Review content:', { 
    rating: review.rating,
    comment: review.comment?.substring(0, 50) + (review.comment?.length > 50 ? '...' : '') || 'No comment',
    hasComment: !!review.comment,
    commentLength: review.comment?.length || 0
  });
  
  const handleMarkHelpful = async () => {
    if (!user || isMarkingHelpful) return;
    
    // Don't allow marking your own review as helpful
    if (user.uid === review.reviewerId || user.uid === review.sellerId) {
      return;
    }
    
    setIsMarkingHelpful(true);
    try {
      const newCount = await markReviewAsHelpful(review.id);
      if (newCount !== null) {
        setHelpfulCount(newCount);
      }
    } finally {
      setIsMarkingHelpful(false);
    }
  };
  
  // Generate star rating display
  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i < rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'
            }`}
          />
        ))}
        <span className="ml-1 text-sm font-medium">{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <Avatar className="h-10 w-10">
            {reviewerAvatar ? (
              <AvatarImage src={reviewerAvatar} alt={reviewerName} />
            ) : (
              <AvatarFallback>
                {reviewerName ? reviewerName.charAt(0).toUpperCase() : 'U'}
              </AvatarFallback>
            )}
          </Avatar>
          
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="font-medium">
                  <UserNameLink 
                    userId={review.reviewerId} 
                    initialUsername={reviewerName}
                  />
                  {review.isVerifiedPurchase && (
                    <span className="ml-2 text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded-full">
                      Verified Purchase
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {renderStars(review.rating)}
                  <span className="text-sm text-muted-foreground ml-2">
                    {review.createdAt && typeof review.createdAt !== 'undefined' 
                      ? format(new Date(review.createdAt instanceof Date ? review.createdAt : review.createdAt.toDate ? review.createdAt.toDate() : review.createdAt), 'MMM d, yyyy')
                      : 'Unknown date'}
                  </span>
                </div>
              </div>
            </div>
            
            {review.title && (
              <h4 className="font-semibold mt-3">{review.title}</h4>
            )}
            
            <p className="mt-2 text-sm whitespace-pre-line">{review.comment || 'No comment provided'}</p>
            
            {/* Review Images */}
            {review.images && review.images.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {review.images.map((image, index) => (
                  <div key={index} className="relative h-20 w-20 rounded-md overflow-hidden">
                    <img 
                      src={image} 
                      alt={`Review image ${index + 1}`} 
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
            
            {/* Seller Response */}
            {showSellerResponse && review.sellerResponse && (
              <div className="mt-4 bg-muted p-3 rounded-md">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <span className="font-medium">Seller Response</span>
                  <span className="text-xs text-muted-foreground">
                    {review.sellerResponse.createdAt && typeof review.sellerResponse.createdAt !== 'undefined' 
                      ? format(new Date(review.sellerResponse.createdAt instanceof Date ? review.sellerResponse.createdAt : review.sellerResponse.createdAt.toDate ? review.sellerResponse.createdAt.toDate() : review.sellerResponse.createdAt), 'MMM d, yyyy')
                      : 'Unknown date'}
                  </span>
                </div>
                <p className="mt-2 text-sm whitespace-pre-line">{review.sellerResponse.comment}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      
      {allowHelpful && (
        <CardFooter className="pt-0 pb-4">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-muted-foreground hover:text-foreground"
            onClick={handleMarkHelpful}
            disabled={isMarkingHelpful || !user || user.uid === review.reviewerId || user.uid === review.sellerId}
          >
            <ThumbsUp className="h-4 w-4 mr-1" />
            Helpful {helpfulCount > 0 && `(${helpfulCount})`}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}