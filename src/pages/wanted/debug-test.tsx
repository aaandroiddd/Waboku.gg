import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ref, get } from 'firebase/database';
import { firebaseDatabase as database } from '@/lib/firebase';

export default function WantedPostsDebugTest() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testDirectFetch = async () => {
    setLoading(true);
    setResults(null);

    try {
      console.log('Testing direct Firebase fetch...');
      
      if (!database) {
        setResults({ error: 'Database not initialized' });
        return;
      }

      // Test wantedPosts path
      console.log('Fetching from wantedPosts...');
      const wantedPostsRef = ref(database, 'wantedPosts');
      const snapshot = await get(wantedPostsRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const posts = Object.entries(data).map(([id, post]: [string, any]) => ({
          id,
          title: post.title,
          game: post.game,
          userId: post.userId,
          userName: post.userName,
          createdAt: post.createdAt,
          location: post.location
        }));

        setResults({
          success: true,
          path: 'wantedPosts',
          totalPosts: posts.length,
          posts: posts.slice(0, 5) // Show first 5 posts
        });
      } else {
        setResults({
          error: 'No data found in wantedPosts path'
        });
      }
    } catch (error) {
      console.error('Error testing fetch:', error);
      setResults({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const testAPIFetch = async () => {
    setLoading(true);
    setResults(null);

    try {
      console.log('Testing API fetch...');
      const response = await fetch('/api/wanted/debug-fetch-simple');
      const data = await response.json();
      
      setResults(data);
    } catch (error) {
      console.error('Error testing API fetch:', error);
      setResults({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Wanted Posts Debug Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button onClick={testDirectFetch} disabled={loading}>
              Test Direct Firebase Fetch
            </Button>
            <Button onClick={testAPIFetch} disabled={loading}>
              Test API Fetch
            </Button>
          </div>

          {loading && (
            <div className="text-center py-4">
              <p>Loading...</p>
            </div>
          )}

          {results && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Results:</h3>
              <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-sm">
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}