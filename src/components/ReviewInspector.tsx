import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function ReviewInspector() {
  const [reviewId, setReviewId] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [inspectResults, setInspectResults] = useState<any>(null);

  // Inspect review
  const inspectReview = async () => {
    if (!reviewId && !sellerId) {
      toast.error('Either Review ID or Seller ID is required');
      return;
    }

    setLoading(true);
    setInspectResults(null);

    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (reviewId) params.append('reviewId', reviewId);
      if (sellerId) params.append('sellerId', sellerId);
      
      const response = await fetch(`/api/debug/inspect-review?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setInspectResults(data.reviewData);
        toast.success('Review inspection completed');
      } else {
        toast.error(data.message || 'Failed to inspect review');
      }
    } catch (error) {
      console.error('Error inspecting review:', error);
      toast.error('An error occurred while inspecting the review');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Review Inspector</CardTitle>
          <CardDescription>
            Inspect review data directly from the database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reviewId">Review ID (specific review)</Label>
              <Input
                id="reviewId"
                value={reviewId}
                onChange={(e) => setReviewId(e.target.value)}
                placeholder="Enter review ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sellerId">Seller ID (all reviews for seller)</Label>
              <Input
                id="sellerId"
                value={sellerId}
                onChange={(e) => setSellerId(e.target.value)}
                placeholder="Enter seller ID"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={inspectReview}
            disabled={loading || (!reviewId && !sellerId)}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Inspecting...
              </>
            ) : (
              'Inspect Review'
            )}
          </Button>
        </CardFooter>
      </Card>

      {inspectResults && (
        <Card>
          <CardHeader>
            <CardTitle>Inspection Results</CardTitle>
            <CardDescription>
              {reviewId ? `Review ID: ${reviewId}` : `Reviews for Seller ID: ${sellerId}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-md overflow-auto text-xs">
              {JSON.stringify(inspectResults, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}