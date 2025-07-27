import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Bug, Database, AlertCircle } from 'lucide-react';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

interface DebugInfo {
  totalReviewsInCollection: number;
  reviewsForUser: number;
  reviewsWithStatus: number;
  reviewsPublished: number;
  sampleReviews: any[];
  reviewStats: any;
  firebaseConnection: boolean;
  error?: string;
}

export function ReviewsDebugger() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

  const runDebug = async () => {
    if (!user) return;

    setLoading(true);
    setDebugInfo(null);

    try {
      const { db } = getFirebaseServices();
      if (!db) {
        throw new Error('Firestore database is not initialized');
      }

      const info: DebugInfo = {
        totalReviewsInCollection: 0,
        reviewsForUser: 0,
        reviewsWithStatus: 0,
        reviewsPublished: 0,
        sampleReviews: [],
        reviewStats: null,
        firebaseConnection: true
      };

      // Check total reviews in collection
      try {
        const allReviewsQuery = query(collection(db, 'reviews'));
        const allReviewsSnapshot = await getDocs(allReviewsQuery);
        info.totalReviewsInCollection = allReviewsSnapshot.size;
        console.log('Total reviews in collection:', info.totalReviewsInCollection);
      } catch (error) {
        console.error('Error getting total reviews:', error);
        info.error = `Error getting total reviews: ${error}`;
      }

      // Check reviews for this user as seller
      try {
        const userReviewsQuery = query(
          collection(db, 'reviews'),
          where('sellerId', '==', user.uid)
        );
        const userReviewsSnapshot = await getDocs(userReviewsQuery);
        info.reviewsForUser = userReviewsSnapshot.size;
        console.log('Reviews for user as seller:', info.reviewsForUser);

        // Get sample reviews
        info.sampleReviews = userReviewsSnapshot.docs.slice(0, 3).map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            sellerId: data.sellerId,
            reviewerId: data.reviewerId,
            rating: data.rating,
            comment: data.comment?.substring(0, 100) || 'No comment',
            status: data.status,
            isPublic: data.isPublic,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || 'No date'
          };
        });
      } catch (error) {
        console.error('Error getting user reviews:', error);
        info.error = `Error getting user reviews: ${error}`;
      }

      // Check reviews with status field
      try {
        const statusReviewsQuery = query(
          collection(db, 'reviews'),
          where('sellerId', '==', user.uid)
        );
        const statusReviewsSnapshot = await getDocs(statusReviewsQuery);
        
        let withStatus = 0;
        let published = 0;
        
        statusReviewsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.status) {
            withStatus++;
            if (data.status === 'published') {
              published++;
            }
          }
        });
        
        info.reviewsWithStatus = withStatus;
        info.reviewsPublished = published;
      } catch (error) {
        console.error('Error checking review status:', error);
        info.error = `Error checking review status: ${error}`;
      }

      // Check review stats
      try {
        const statsRef = doc(db, 'reviewStats', user.uid);
        const statsDoc = await getDoc(statsRef);
        
        if (statsDoc.exists()) {
          info.reviewStats = statsDoc.data();
        } else {
          info.reviewStats = { message: 'No stats document found' };
        }
      } catch (error) {
        console.error('Error getting review stats:', error);
        info.error = `Error getting review stats: ${error}`;
      }

      setDebugInfo(info);
    } catch (error) {
      console.error('Debug error:', error);
      setDebugInfo({
        totalReviewsInCollection: 0,
        reviewsForUser: 0,
        reviewsWithStatus: 0,
        reviewsPublished: 0,
        sampleReviews: [],
        reviewStats: null,
        firebaseConnection: false,
        error: `Debug error: ${error}`
      });
    } finally {
      setLoading(false);
    }
  };

  const testApiEndpoint = async () => {
    if (!user) return;

    try {
      const response = await fetch(`/api/reviews/get-seller-reviews?sellerId=${user.uid}`);
      const data = await response.json();
      console.log('API endpoint response:', data);
      alert(`API Response: ${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      console.error('API test error:', error);
      alert(`API Error: ${error}`);
    }
  };

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Reviews Debugger
          </CardTitle>
          <CardDescription>Debug tool for reviews issues</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Please sign in to use the debugger.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5" />
          Reviews Debugger
        </CardTitle>
        <CardDescription>Debug tool for reviews issues</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={runDebug} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running Debug...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                Run Firestore Debug
              </>
            )}
          </Button>
          
          <Button onClick={testApiEndpoint} variant="outline">
            Test API Endpoint
          </Button>
        </div>

        {debugInfo && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 border rounded">
                <div className="text-sm text-muted-foreground">Total Reviews</div>
                <div className="text-2xl font-bold">{debugInfo.totalReviewsInCollection}</div>
              </div>
              
              <div className="p-3 border rounded">
                <div className="text-sm text-muted-foreground">Your Reviews</div>
                <div className="text-2xl font-bold">{debugInfo.reviewsForUser}</div>
              </div>
              
              <div className="p-3 border rounded">
                <div className="text-sm text-muted-foreground">With Status</div>
                <div className="text-2xl font-bold">{debugInfo.reviewsWithStatus}</div>
              </div>
              
              <div className="p-3 border rounded">
                <div className="text-sm text-muted-foreground">Published</div>
                <div className="text-2xl font-bold">{debugInfo.reviewsPublished}</div>
              </div>
            </div>

            {debugInfo.error && (
              <div className="p-3 border border-red-200 rounded bg-red-50">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Error</span>
                </div>
                <p className="text-red-600 text-sm mt-1">{debugInfo.error}</p>
              </div>
            )}

            <div>
              <h4 className="font-medium mb-2">Review Stats</h4>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                {JSON.stringify(debugInfo.reviewStats, null, 2)}
              </pre>
            </div>

            {debugInfo.sampleReviews.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Sample Reviews</h4>
                <div className="space-y-2">
                  {debugInfo.sampleReviews.map((review, index) => (
                    <div key={index} className="p-2 border rounded text-xs">
                      <div><strong>ID:</strong> {review.id}</div>
                      <div><strong>Rating:</strong> {review.rating}</div>
                      <div><strong>Status:</strong> {review.status || 'undefined'}</div>
                      <div><strong>Public:</strong> {review.isPublic?.toString() || 'undefined'}</div>
                      <div><strong>Comment:</strong> {review.comment}</div>
                      <div><strong>Created:</strong> {review.createdAt}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}