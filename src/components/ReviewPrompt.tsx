import { useState } from 'react';
import { useRouter } from 'next/router';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, X } from 'lucide-react';
import { toast } from 'sonner';

interface ReviewPromptProps {
  orderId: string;
  sellerName: string;
  onDismiss: () => void;
}

export function ReviewPrompt({ orderId, sellerName, onDismiss }: ReviewPromptProps) {
  const router = useRouter();
  const [isDismissing, setIsDismissing] = useState(false);

  const handleLeaveReview = () => {
    router.push(`/dashboard/orders/${orderId}?review=true`);
  };

  const handleDismiss = () => {
    setIsDismissing(true);
    // Store in localStorage that this prompt has been dismissed for this order
    try {
      const dismissedReviews = JSON.parse(localStorage.getItem('dismissedReviewPrompts') || '[]');
      if (!dismissedReviews.includes(orderId)) {
        dismissedReviews.push(orderId);
        localStorage.setItem('dismissedReviewPrompts', JSON.stringify(dismissedReviews));
      }
    } catch (error) {
      console.error('Error storing dismissed review prompt:', error);
    }
    
    onDismiss();
    setIsDismissing(false);
  };

  return (
    <Card className="border-primary/20 shadow-md">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-semibold">Share Your Experience</CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={handleDismiss}
            disabled={isDismissing}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </div>
        <CardDescription>
          Your order has been completed! How was your experience?
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        <p className="text-sm">
          Your review of <span className="font-medium">{sellerName}</span> helps other buyers make informed decisions.
        </p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleDismiss}
          disabled={isDismissing}
        >
          Maybe Later
        </Button>
        <Button 
          variant="default" 
          size="sm" 
          onClick={handleLeaveReview}
          className="gap-1"
        >
          <Star className="h-4 w-4" />
          Leave a Review
        </Button>
      </CardFooter>
    </Card>
  );
}