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

interface ReviewCardProps {
  review: Review;
  showSellerResponse?: boolean;
  allowHelpful?: boolean;
}

export function ReviewCard({ review, showSellerResponse = true, allowHelpful = true }: ReviewCardProps) {
  const { user } = useAuth();
  const { markReviewAsHelpful } = useReviews();
  const [reviewerName, setReviewerName] = useState<string | null>(null);
  const [reviewerAvatar, setReviewerAvatar] = useState<string | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState<boolean>(false);
  const [helpfulCount, setHelpfulCount] = useState<number>(review.helpfulCount || 0);
  const [isMarkingHelpful, setIsMarkingHelpful] = useState<boolean>(false);
  
  // Fetch reviewer information when component mounts
  useEffect(() => {
    let isMounted = true;
    
    const fetchReviewerInfo = async () => {
      if (!review.reviewerId || isLoadingUser) return;
      
      setIsLoadingUser(true);
      try {
        const { db } = getFirebaseServices();
        
        const userDoc = await getDoc(doc(db, 'users', review.reviewerId));
        if (userDoc.exists() && isMounted) {
          const userData = userDoc.data();
          const name = userData.displayName || userData.username || 'Anonymous User';
          setReviewerName(name);
          setReviewerAvatar(userData.photoURL || null);
        }
      } catch (error) {
        console.error('Error fetching reviewer information:', error);
      } finally {
        if (isMounted) {
          setIsLoadingUser(false);
        }
      }
    };
    
    fetchReviewerInfo();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [review.reviewerId, isLoadingUser]);
  
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
      </div>
    );
  };

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <Avatar className="h-10 w-10">
            {reviewerAvatar ? (
              <AvatarImage src={reviewerAvatar} alt={reviewerName || 'Reviewer'} />
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
                    fallbackName={reviewerName || 'Anonymous User'} 
                  />
                  {review.isVerifiedPurchase && (
                    <span className="ml-2 text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded-full">
                      Verified Purchase
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {renderStars(review.rating)}
                  <span className="text-sm text-muted-foreground">
                    {format(review.createdAt, 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
            </div>
            
            {review.title && (
              <h4 className="font-semibold mt-3">{review.title}</h4>
            )}
            
            <p className="mt-2 text-sm">{review.comment}</p>
            
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
                    {format(review.sellerResponse.createdAt, 'MMM d, yyyy')}
                  </span>
                </div>
                <p className="mt-2 text-sm">{review.sellerResponse.comment}</p>
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