import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useReviews } from '@/hooks/useReviews';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface SellerResponseFormProps {
  reviewId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function SellerResponseForm({ reviewId, onSuccess, onCancel }: SellerResponseFormProps) {
  const { user } = useAuth();
  const { respondToReview, loading } = useReviews();
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // Combined loading state from both local and hook states
  const isLoading = loading || isSubmitting;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('You must be logged in to respond to a review');
      return;
    }
    
    if (!comment.trim()) {
      toast.error('Please enter a response');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      console.log('Submitting response for review:', reviewId);
      const success = await respondToReview(reviewId, comment);
      
      if (success) {
        toast.success('Your response has been submitted successfully');
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast.error('Failed to submit your response. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting response:', error);
      toast.error('An error occurred while submitting your response');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="response">Your Response</Label>
        <Textarea
          id="response"
          placeholder="Write your response to this review"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          required
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">
          Your response will be publicly visible alongside the review
        </p>
      </div>
      
      <div className="flex justify-end gap-2">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isLoading || !comment.trim()}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit Response
        </Button>
      </div>
    </form>
  );
}