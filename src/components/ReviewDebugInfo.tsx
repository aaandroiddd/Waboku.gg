import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';

interface ReviewDebugInfoProps {
  userId: string;
}

export function ReviewDebugInfo({ userId }: ReviewDebugInfoProps) {
  const [loading, setLoading] = useState(false);
  const [reviewData, setReviewData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchReviewDebugInfo = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch reviews as reviewer (reviews written)
      const reviewerResponse = await fetch(`/api/reviews/get-user-reviews?userId=${userId}&role=reviewer`);
      const reviewerData = await reviewerResponse.json();
      
      // Fetch reviews as seller (reviews received)
      const sellerResponse = await fetch(`/api/reviews/get-user-reviews?userId=${userId}&role=seller`);
      const sellerData = await sellerResponse.json();
      
      // Fetch raw reviews from debug endpoint
      const inspectResponse = await fetch(`/api/debug/inspect-user-reviews?userId=${userId}`);
      const inspectData = await inspectResponse.json();
      
      setReviewData({
        userId,
        asReviewer: {
          success: reviewerData.success,
          total: reviewerData.total || 0,
          reviews: reviewerData.reviews || [],
          message: reviewerData.message
        },
        asSeller: {
          success: sellerData.success,
          total: sellerData.total || 0,
          reviews: sellerData.reviews || [],
          message: sellerData.message
        },
        rawReviews: inspectData.reviews || [],
        rawTotal: inspectData.total || 0
      });
    } catch (err) {
      console.error('Error fetching review debug info:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch review debug info');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg">Review System Debug</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This tool helps diagnose issues with the review system for user ID: <code className="bg-muted px-1 py-0.5 rounded">{userId}</code>
          </p>
          
          <Button 
            onClick={fetchReviewDebugInfo} 
            disabled={loading}
            variant="outline"
            size="sm"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fetching...
              </>
            ) : (
              'Fetch Review Debug Info'
            )}
          </Button>
          
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              Error: {error}
            </div>
          )}
          
          {reviewData && (
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-medium">Summary:</h3>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li>Reviews written (as reviewer): {reviewData.asReviewer.total}</li>
                  <li>Reviews received (as seller): {reviewData.asSeller.total}</li>
                  <li>Raw reviews in database: {reviewData.rawTotal}</li>
                </ul>
              </div>
              
              <Separator />
              
              {reviewData.asReviewer.reviews.length > 0 && (
                <div>
                  <h3 className="font-medium">Reviews Written Sample:</h3>
                  <div className="bg-muted p-2 rounded mt-2 overflow-x-auto">
                    <pre className="text-xs">
                      {JSON.stringify(reviewData.asReviewer.reviews[0], null, 2)}
                    </pre>
                  </div>
                </div>
              )}
              
              {reviewData.asSeller.reviews.length > 0 && (
                <div>
                  <h3 className="font-medium">Reviews Received Sample:</h3>
                  <div className="bg-muted p-2 rounded mt-2 overflow-x-auto">
                    <pre className="text-xs">
                      {JSON.stringify(reviewData.asSeller.reviews[0], null, 2)}
                    </pre>
                  </div>
                </div>
              )}
              
              {reviewData.rawReviews.length > 0 && (
                <div>
                  <h3 className="font-medium">Raw Reviews in Database:</h3>
                  <div className="bg-muted p-2 rounded mt-2 overflow-x-auto">
                    <pre className="text-xs">
                      {JSON.stringify(reviewData.rawReviews.slice(0, 2), null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}