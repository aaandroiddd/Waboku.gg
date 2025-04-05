import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useReviews } from '@/hooks/useReviews';
import { toast } from 'sonner';

interface SellerResponseFormProps {
  reviewId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function SellerResponseForm({ reviewId, onSuccess, onCancel }: SellerResponseFormProps) {
  const { respondToReview, loading } = useReviews();
  const [comment, setComment] = useState<string>('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!comment.trim()) {
      toast.error('Please enter a response');
      return;
    }
    
    const success = await respondToReview(reviewId, comment);
    
    if (success) {
      if (onSuccess) {
        onSuccess();
      }
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
          disabled={loading}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={loading || !comment.trim()}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit Response
        </Button>
      </div>
    </form>
  );
}