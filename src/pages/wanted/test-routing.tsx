import { useState } from 'react';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Header from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function TestRoutingPage() {
  const router = useRouter();
  const [testUrl, setTestUrl] = useState('/wanted/pokemon/need-absol-cards-599756');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testUrlParsing = async () => {
    setLoading(true);
    try {
      // Test slug parsing
      const slugResponse = await fetch(`/api/wanted/test-slug-parsing?slug=need-absol-cards-599756`);
      const slugData = await slugResponse.json();

      // Test database contents
      const dbResponse = await fetch('/api/wanted/test-resolve?shortId=599756');
      const dbData = await dbResponse.json();

      // Test resolve API
      const resolveResponse = await fetch('/api/wanted/resolve-short-id?shortId=599756');
      const resolveData = await resolveResponse.json();

      setResults({
        slugParsing: slugData,
        database: dbData,
        resolve: resolveData
      });
    } catch (error) {
      console.error('Error testing:', error);
      setResults({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const createTestPost = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/wanted/create-test-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      setResults({ testPostCreated: data });
    } catch (error) {
      console.error('Error creating test post:', error);
      setResults({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const createSpecificTestPost = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/wanted/create-specific-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shortId: '599756' }),
      });
      const data = await response.json();
      setResults({ specificTestPostCreated: data });
    } catch (error) {
      console.error('Error creating specific test post:', error);
      setResults({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const navigateToUrl = () => {
    router.push(testUrl);
  };

  return (
    <div>
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Wanted Posts Routing Test</h1>
          
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Test URL Navigation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Test URL:</label>
                  <Input
                    value={testUrl}
                    onChange={(e) => setTestUrl(e.target.value)}
                    placeholder="/wanted/pokemon/need-absol-cards-599756"
                  />
                </div>
                <Button onClick={navigateToUrl}>Navigate to URL</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Test Functions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4 flex-wrap">
                  <Button onClick={testUrlParsing} disabled={loading}>
                    Test URL Parsing & Database
                  </Button>
                  <Button onClick={createTestPost} disabled={loading}>
                    Create Test Post
                  </Button>
                  <Button onClick={createSpecificTestPost} disabled={loading}>
                    Create Post with ID 599756
                  </Button>
                </div>
              </CardContent>
            </Card>

            {results && (
              <Card>
                <CardHeader>
                  <CardTitle>Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-4 rounded-md overflow-auto text-sm">
                    {JSON.stringify(results, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}