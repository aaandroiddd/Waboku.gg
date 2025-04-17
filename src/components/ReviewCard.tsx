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
  const { toggleReviewHelpful } = useReviews();
  const [helpfulCount, setHelpfulCount] = useState<number>(review.helpfulCount || 0);
  const [isMarkingHelpful, setIsMarkingHelpful] = useState<boolean>(false);
  const [hasMarkedHelpful, setHasMarkedHelpful] = useState<boolean>(false);
  
  // Use the useUserData hook instead of manual fetching
  const { userData, loading: isLoadingUser } = useUserData(review.reviewerId);
  const reviewerName = userData?.username || 'Anonymous User';
  const reviewerAvatar = userData?.avatarUrl || null;
  
  // Check if the current user has already marked this review as helpful
  useEffect(() => {
    if (!user) return;
    
    const checkHelpfulStatus = async () => {
      try {
        const { db } = getFirebaseServices();
        const helpfulRef = doc(db, 'reviews', review.id, 'helpfulUsers', user.uid);
        const helpfulDoc = await getDoc(helpfulRef);
        setHasMarkedHelpful(helpfulDoc.exists());
      } catch (error) {
        console.error('Error checking helpful status:', error);
      }
    };
    
    checkHelpfulStatus();
  }, [user, review.id]);
  
  const handleToggleHelpful = async () => {
    if (!user || isMarkingHelpful) return;
    
    // Don't allow marking your own review as helpful
    if (user.uid === review.reviewerId || user.uid === review.sellerId) {
      return;
    }
    
    setIsMarkingHelpful(true);
    try {
      console.log('ReviewCard: Toggling helpful status for review:', review.id);
      const result = await toggleReviewHelpful(review.id);
      console.log('ReviewCard: Toggle result:', result);
      
      if (result !== null) {
        setHelpfulCount(result.helpfulCount);
        setHasMarkedHelpful(result.isMarked);
        console.log('ReviewCard: Updated state:', { 
          helpfulCount: result.helpfulCount, 
          isMarked: result.isMarked 
        });
      } else {
        console.error('ReviewCard: Received null result from toggleReviewHelpful');
      }
    } catch (error) {
      console.error('ReviewCard: Error toggling helpful status:', error);
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
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 w-full">
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
              
              {allowHelpful && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-muted-foreground hover:text-foreground flex-shrink-0"
                  onClick={handleToggleHelpful}
                  disabled={isMarkingHelpful || !user || (user && (user.uid === review.reviewerId || user.uid === review.sellerId))}
                >
                  <ThumbsUp className={`h-4 w-4 mr-1 ${hasMarkedHelpful ? 'fill-current' : ''}`} />
                  Helpful ({helpfulCount})
                </Button>
              )}
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
                <p className="mt-2 text-sm whitespace-pre-line">
                  {review.sellerResponse.comment || review.sellerResponse.content || 'No response content'}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      

    </Card>
  );
}