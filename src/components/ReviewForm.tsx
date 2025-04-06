import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Star, Loader2 } from 'lucide-react';
import { useReviews } from '@/hooks/useReviews';
import { toast } from 'sonner';

interface ReviewFormProps {
  orderId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ReviewForm({ orderId, onSuccess, onCancel }: ReviewFormProps) {
  const { submitReview, loading } = useReviews();
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [title, setTitle] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [images, setImages] = useState<string[]>([]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }
    
    if (!comment.trim()) {
      toast.error('Please enter a review comment');
      return;
    }
    
    try {
      console.log('Submitting review with data:', { orderId, rating, commentLength: comment.length, title });
      const reviewId = await submitReview(orderId, rating, comment, title, []);
      
      console.log('Review submission result:', reviewId);
      
      if (reviewId) {
        toast.success('Review submitted successfully');
        if (onSuccess) {
          onSuccess();
        }
      } else {
        console.error('Review submission failed: No reviewId returned');
        toast.error('Failed to submit review. Please try again.');
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      toast.error('An error occurred while submitting your review. Please try again.');
    }
  };
  
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Write a Review</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rating">Rating</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="focus:outline-none"
                  onMouseEnter={() => setHoverRating(value)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(value)}
                >
                  <Star
                    className={`h-8 w-8 cursor-pointer ${
                      (hoverRating || rating) >= value
                        ? 'text-yellow-500 fill-yellow-500'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {rating === 1 && 'Poor - Major issues with this product/seller'}
              {rating === 2 && 'Fair - Below average experience'}
              {rating === 3 && 'Average - Met basic expectations'}
              {rating === 4 && 'Good - Better than expected'}
              {rating === 5 && 'Excellent - Outstanding experience'}
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="title">Review Title (Optional)</Label>
            <Input
              id="title"
              placeholder="Summarize your experience"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="comment">Review</Label>
            <Textarea
              id="comment"
              placeholder="Share your experience with this product and seller"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
              required
            />
            <p className="text-xs text-muted-foreground">
              Your review helps other buyers make informed decisions
            </p>
          </div>
          

        </CardContent>
        <CardFooter className="flex justify-between">
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={loading || rating === 0 || !comment.trim()}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Review
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}