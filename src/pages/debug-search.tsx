import { useState, useEffect } from 'react';
import { useTrendingSearches } from '@/hooks/useTrendingSearches';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { database } from '@/lib/firebase';
import { ref, get } from 'firebase/database';

export default function DebugSearchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [apiResult, setApiResult] = useState<any>(null);
  const [directResult, setDirectResult] = useState<any>(null);
  const [trendingSearches, setTrendingSearches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { recordSearch } = useTrendingSearches();

  // Function to test the API endpoint
  const testApiEndpoint = async () => {
    if (!searchTerm.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/search/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ searchTerm: searchTerm.trim() }),
      });
      
      const data = await response.json();
      setApiResult(data);
    } catch (error) {
      console.error('Error testing API endpoint:', error);
      setApiResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  // Function to test direct database write
  const testDirectWrite = async () => {
    if (!searchTerm.trim()) return;
    
    setLoading(true);
    try {
      await recordSearch(searchTerm.trim());
      setDirectResult({ success: true, message: 'Search term recorded via hook' });
    } catch (error) {
      console.error('Error recording search directly:', error);
      setDirectResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch trending searches
  const fetchTrendingSearches = async () => {
    setLoading(true);
    try {
      if (!database) {
        throw new Error('Database not initialized');
      }
      
      const searchTermsRef = ref(database, 'searchTerms');
      const snapshot = await get(searchTermsRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const searches = Object.entries(data).map(([key, value]: [string, any]) => ({
          key,
          ...value
        }));
        
        // Sort by lastUpdated (most recent first)
        searches.sort((a, b) => b.lastUpdated - a.lastUpdated);
        
        setTrendingSearches(searches);
      } else {
        setTrendingSearches([]);
      }
    } catch (error) {
      console.error('Error fetching trending searches:', error);
      setTrendingSearches([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch trending searches on mount
  useEffect(() => {
    fetchTrendingSearches();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Debug Search Recording</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Test Search Recording</h2>
        <div className="flex gap-2 mb-4">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Enter search term"
            className="max-w-md"
          />
          <Button onClick={testApiEndpoint} disabled={loading}>
            Test API
          </Button>
          <Button onClick={testDirectWrite} disabled={loading}>
            Test Direct
          </Button>
          <Button onClick={fetchTrendingSearches} disabled={loading}>
            Refresh
          </Button>
        </div>
        
        {apiResult && (
          <div className="mb-4">
            <h3 className="font-semibold">API Result:</h3>
            <pre className="bg-muted p-2 rounded overflow-auto max-h-40">
              {JSON.stringify(apiResult, null, 2)}
            </pre>
          </div>
        )}
        
        {directResult && (
          <div className="mb-4">
            <h3 className="font-semibold">Direct Write Result:</h3>
            <pre className="bg-muted p-2 rounded overflow-auto max-h-40">
              {JSON.stringify(directResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
      
      <div>
        <h2 className="text-xl font-semibold mb-2">Trending Searches</h2>
        {trendingSearches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trendingSearches.map((search) => (
              <div key={search.key} className="border p-3 rounded">
                <div className="font-medium">{search.term}</div>
                <div className="text-sm text-muted-foreground">Count: {search.count}</div>
                <div className="text-xs text-muted-foreground">
                  Last updated: {new Date(search.lastUpdated).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No trending searches found.</p>
        )}
      </div>
    </div>
  );
}