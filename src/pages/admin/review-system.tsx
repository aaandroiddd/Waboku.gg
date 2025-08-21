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
  const [metrics, setMetrics] = useState<any>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

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

  const fetchMetrics = async () => {
    setMetricsError(null);
    setMetrics(null);
    setMetricsLoading(true);
    try {
      const resp = await fetch('/api/admin/reviews/metrics', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminSecret}`,
          'x-admin-secret': adminSecret,
        },
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to fetch metrics');
      }
      setMetrics(data);
    } catch (err: any) {
      console.error('Error fetching metrics:', err);
      setMetricsError(err?.message || 'Failed to fetch metrics');
    } finally {
      setMetricsLoading(false);
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
              
              <Separator />

              <div className="space-y-4">
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium">Reminder Metrics</h3>
                    <p className="text-sm text-muted-foreground">Snapshot of review reminder activity and eligibility.</p>
                  </div>
                  <Button onClick={fetchMetrics} disabled={metricsLoading || !adminSecret}>
                    {metricsLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Fetch Metrics'
                    )}
                  </Button>
                </div>

                {metricsError && (
                  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
                    {metricsError}
                  </div>
                )}

                {metrics && metrics.success && (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Window</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm">Last {metrics.windowDays} days</div>
                        <div className="text-xs text-muted-foreground mt-1">Generated {new Date(metrics.generatedAt).toLocaleString()}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Completed Orders Scanned</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{metrics.scanned}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Within 90 Days</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{metrics.totals.within90Days}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Reviews Submitted</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{metrics.totals.reviewSubmitted}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Pending Reviews</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{metrics.totals.pendingReview}</div>
                        <div className="text-xs text-muted-foreground mt-1">Exclusions: {metrics.totals.excludedForIssues}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Reminders Sent</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm">3-day: <span className="font-semibold">{metrics.sent.d3}</span></div>
                        <div className="text-sm">10-day: <span className="font-semibold">{metrics.sent.d10}</span></div>
                        <div className="text-sm">30-day: <span className="font-semibold">{metrics.sent.d30}</span></div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Currently Eligible</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm">3-day: <span className="font-semibold">{metrics.eligible.d3}</span></div>
                        <div className="text-sm">10-day: <span className="font-semibold">{metrics.eligible.d10}</span></div>
                        <div className="text-sm">30-day: <span className="font-semibold">{metrics.eligible.d30}</span></div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>

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