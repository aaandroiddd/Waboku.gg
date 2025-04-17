import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from 'lucide-react';
import { Footer } from '@/components/Footer';

export default function ReviewSystemDebug() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminSecret, setAdminSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('');
  const [reviewData, setReviewData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const secret = localStorage.getItem('admin_secret');
    if (secret) {
      setAdminSecret(secret);
      verifyAdmin(secret);
    }
  }, []);

  const verifyAdmin = async (secret: string) => {
    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${secret}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setIsAuthorized(true);
        localStorage.setItem('admin_secret', secret);
      } else {
        setIsAuthorized(false);
        localStorage.removeItem('admin_secret');
      }
    } catch (error) {
      console.error('Error verifying admin:', error);
      setIsAuthorized(false);
    }
  };

  const fetchReviewDebugInfo = async () => {
    if (!userId) {
      setError('User ID is required');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Fetch reviews as reviewer (reviews written)
      const reviewerResponse = await fetch(`/api/reviews/get-user-reviews?userId=${userId}&role=reviewer`, {
        headers: {
          'x-admin-secret': adminSecret
        }
      });
      const reviewerData = await reviewerResponse.json();
      
      // Fetch reviews as seller (reviews received)
      const sellerResponse = await fetch(`/api/reviews/get-user-reviews?userId=${userId}&role=seller`, {
        headers: {
          'x-admin-secret': adminSecret
        }
      });
      const sellerData = await sellerResponse.json();
      
      // Fetch raw reviews from debug endpoint
      const inspectResponse = await fetch(`/api/debug/inspect-user-reviews?userId=${userId}`, {
        headers: {
          'x-admin-secret': adminSecret
        }
      });
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

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="container mx-auto p-8 flex-grow">
          <Card className="p-6">
            <h1 className="text-2xl font-bold mb-4">Admin Authentication</h1>
            <div className="space-y-4">
              <input
                type="password"
                placeholder="Enter admin secret"
                className="w-full p-2 border rounded"
                onChange={(e) => setAdminSecret(e.target.value)}
              />
              <Button 
                onClick={() => verifyAdmin(adminSecret)}
                disabled={!adminSecret}
              >
                Verify Admin Access
              </Button>
            </div>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto p-8 flex-grow">
        <Card className="p-6">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Review System Debug</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-end gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="userId">User ID</Label>
                  <Input
                    id="userId"
                    placeholder="Enter user ID to inspect"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={fetchReviewDebugInfo} 
                  disabled={loading || !userId}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Fetching...
                    </>
                  ) : (
                    'Fetch Review Data'
                  )}
                </Button>
              </div>
              
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 p-4 rounded">
                  Error: {error}
                </div>
              )}
              
              {reviewData && (
                <div className="space-y-6">
                  <div className="bg-muted p-4 rounded">
                    <h3 className="text-lg font-medium mb-2">Summary</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Reviews written (as reviewer): {reviewData.asReviewer.total}</li>
                      <li>Reviews received (as seller): {reviewData.asSeller.total}</li>
                      <li>Raw reviews in database: {reviewData.rawTotal}</li>
                    </ul>
                  </div>
                  
                  <Separator />
                  
                  {reviewData.asReviewer.reviews.length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium mb-2">Reviews Written Sample</h3>
                      <div className="bg-muted p-4 rounded overflow-x-auto">
                        <pre className="text-xs">
                          {JSON.stringify(reviewData.asReviewer.reviews[0], null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                  
                  {reviewData.asSeller.reviews.length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium mb-2">Reviews Received Sample</h3>
                      <div className="bg-muted p-4 rounded overflow-x-auto">
                        <pre className="text-xs">
                          {JSON.stringify(reviewData.asSeller.reviews[0], null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                  
                  {reviewData.rawReviews.length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium mb-2">Raw Reviews in Database</h3>
                      <div className="bg-muted p-4 rounded overflow-x-auto">
                        <pre className="text-xs">
                          {JSON.stringify(reviewData.rawReviews.slice(0, 2), null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/admin')}
                >
                  Back to Admin Dashboard
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}