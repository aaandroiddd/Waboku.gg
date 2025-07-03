import { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Star, Loader2, ArrowLeft } from 'lucide-react';
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
  const [isMobile, setIsMobile] = useState(false);
  
  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
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

  // Mobile Form Component
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-card shadow-sm">
          <button
            onClick={handleCancel}
            className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
            disabled={loading}
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h2 className="text-lg font-semibold text-foreground">Write a Review</h2>
          <div className="w-16" /> {/* Spacer for centering */}
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-4 space-y-6">
            {/* Rating */}
            <div className="space-y-3">
              <Label className="text-base font-medium text-foreground">Rating *</Label>
              <div className="flex justify-center space-x-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="p-2 focus:outline-none"
                    onTouchStart={() => setHoverRating(value)}
                    onTouchEnd={() => setHoverRating(0)}
                    onClick={() => setRating(value)}
                    disabled={loading}
                  >
                    <Star
                      className={`h-10 w-10 ${
                        (hoverRating || rating) >= value
                          ? 'text-yellow-500 fill-yellow-500'
                          : 'text-muted-foreground'
                      }`}
                    />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <p className="text-sm text-center text-muted-foreground mt-2">
                  {rating === 1 && 'Poor - Major issues with this product/seller'}
                  {rating === 2 && 'Fair - Below average experience'}
                  {rating === 3 && 'Average - Met basic expectations'}
                  {rating === 4 && 'Good - Better than expected'}
                  {rating === 5 && 'Excellent - Outstanding experience'}
                </p>
              )}
            </div>
            
            {/* Title */}
            <div className="space-y-3">
              <Label htmlFor="mobile-title" className="text-base font-medium text-foreground">
                Review Title (Optional)
              </Label>
              <Input
                id="mobile-title"
                placeholder="Summarize your experience"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                className="text-base p-4 border-2 border-input focus:border-primary rounded-lg"
                disabled={loading}
              />
            </div>
            
            {/* Comment */}
            <div className="space-y-3">
              <Label htmlFor="mobile-comment" className="text-base font-medium text-foreground">
                Review *
              </Label>
              <Textarea
                id="mobile-comment"
                placeholder="Share your experience with this product and seller"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={6}
                required
                className="text-base p-4 border-2 border-input focus:border-primary rounded-lg resize-none"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Your review helps other buyers make informed decisions
              </p>
            </div>
          </form>
        </div>

        {/* Fixed Bottom Buttons */}
        <div className="border-t border-border bg-card p-4 shadow-lg">
          <div className="flex space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 p-4 text-base"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={loading || rating === 0 || !comment.trim()}
              className="flex-1 p-4 text-base"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Submitting...' : 'Submit Review'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Desktop Form Component (original card design)
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
                  disabled={loading}
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
              disabled={loading}
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
              disabled={loading}
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