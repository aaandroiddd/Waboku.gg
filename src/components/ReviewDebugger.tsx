import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function ReviewDebugger() {
  const { user } = useAuth();
  const [sellerId, setSellerId] = useState('');
  const [buyerId, setBuyerId] = useState(user?.uid || '');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('This is a test review for debugging purposes.');
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [createResults, setCreateResults] = useState<any>(null);

  // Test review paths
  const testReviewPaths = async () => {
    if (!sellerId) {
      toast.error('Seller ID is required');
      return;
    }

    setLoading(true);
    setTestResults(null);

    try {
      const response = await fetch(`/api/debug/test-review-path?sellerId=${sellerId}`);
      const data = await response.json();

      if (response.ok) {
        setTestResults(data.results);
        toast.success('Review paths tested successfully');
      } else {
        toast.error(data.message || 'Failed to test review paths');
      }
    } catch (error) {
      console.error('Error testing review paths:', error);
      toast.error('An error occurred while testing review paths');
    } finally {
      setLoading(false);
    }
  };

  // Create test review
  const createTestReview = async () => {
    if (!sellerId || !buyerId) {
      toast.error('Seller ID and Buyer ID are required');
      return;
    }

    setLoading(true);
    setCreateResults(null);

    try {
      const response = await fetch('/api/debug/create-test-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sellerId,
          buyerId,
          rating: parseInt(rating.toString()),
          comment,
          title: 'Test Review'
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setCreateResults(data);
        toast.success('Test review created successfully');
      } else {
        toast.error(data.message || 'Failed to create test review');
      }
    } catch (error) {
      console.error('Error creating test review:', error);
      toast.error('An error occurred while creating test review');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Review System Debugger</CardTitle>
          <CardDescription>
            Test and debug the review system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sellerId">Seller ID</Label>
              <Input
                id="sellerId"
                value={sellerId}
                onChange={(e) => setSellerId(e.target.value)}
                placeholder="Enter seller ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyerId">Buyer ID (your ID)</Label>
              <Input
                id="buyerId"
                value={buyerId}
                onChange={(e) => setBuyerId(e.target.value)}
                placeholder="Enter buyer ID"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rating">Rating (1-5)</Label>
            <Input
              id="rating"
              type="number"
              min="1"
              max="5"
              value={rating}
              onChange={(e) => setRating(parseInt(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comment">Review Comment</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Enter review comment"
              rows={3}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={testReviewPaths}
            disabled={loading || !sellerId}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              'Test Review Paths'
            )}
          </Button>
          <Button
            onClick={createTestReview}
            disabled={loading || !sellerId || !buyerId}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Test Review'
            )}
          </Button>
        </CardFooter>
      </Card>

      {testResults && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              Review paths test results for seller ID: {sellerId}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-md overflow-auto text-xs">
              {JSON.stringify(testResults, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {createResults && (
        <Card>
          <CardHeader>
            <CardTitle>Create Test Review Results</CardTitle>
            <CardDescription>
              Test review created with ID: {createResults.reviewId}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-md overflow-auto text-xs">
              {JSON.stringify(createResults, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}