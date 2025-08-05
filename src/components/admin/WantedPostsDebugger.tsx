import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Database, Trash2, Eye, AlertTriangle } from 'lucide-react';

interface DatabasePath {
  path: string;
  count: number;
  posts: any[];
  error?: string;
}

export function WantedPostsDebugger() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{
    databasePaths: DatabasePath[];
    cacheInfo: {
      sessionStorageKeys: string[];
      apiCacheStatus: string;
    };
    totalPosts: number;
  } | null>(null);

  const checkAllSources = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/wanted/debug-all-sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Error checking sources:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearAllCaches = async () => {
    setIsLoading(true);
    try {
      // Clear browser caches
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
          if (key.startsWith('wantedPosts_')) {
            sessionStorage.removeItem(key);
            sessionStorage.removeItem(`${key}_timestamp`);
          }
        });
      }

      // Clear server-side caches if any
      await fetch('/api/wanted/clear-cache', {
        method: 'POST',
      });

      // Refresh the check
      await checkAllSources();
    } catch (error) {
      console.error('Error clearing caches:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteFromPath = async (path: string) => {
    if (!confirm(`Are you sure you want to delete all posts from path: ${path}?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/wanted/delete-from-path', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path }),
      });

      const data = await response.json();
      if (data.success) {
        alert(`Successfully deleted ${data.deletedCount} posts from ${path}`);
        await checkAllSources();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error deleting from path:', error);
      alert('Error deleting posts');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Wanted Posts Debugger
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={checkAllSources} 
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            {isLoading ? 'Checking...' : 'Check All Sources'}
          </Button>
          <Button 
            onClick={clearAllCaches} 
            disabled={isLoading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Clear All Caches
          </Button>
        </div>

        {results && (
          <div className="space-y-4">
            <Separator />
            
            <div>
              <h3 className="text-lg font-semibold mb-2">Database Paths</h3>
              <div className="space-y-2">
                {results.databasePaths.map((pathInfo, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-2 py-1 rounded text-sm">
                        {pathInfo.path}
                      </code>
                      <Badge variant={pathInfo.count > 0 ? "default" : "secondary"}>
                        {pathInfo.count} posts
                      </Badge>
                      {pathInfo.error && (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Error
                        </Badge>
                      )}
                    </div>
                    {pathInfo.count > 0 && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteFromPath(pathInfo.path)}
                        disabled={isLoading}
                        className="flex items-center gap-1"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete All
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-lg font-semibold mb-2">Cache Information</h3>
              <div className="space-y-2">
                <div className="p-3 border rounded">
                  <h4 className="font-medium">SessionStorage Keys:</h4>
                  <div className="mt-1">
                    {results.cacheInfo.sessionStorageKeys.length > 0 ? (
                      <div className="space-y-1">
                        {results.cacheInfo.sessionStorageKeys.map((key, index) => (
                          <code key={index} className="block bg-muted px-2 py-1 rounded text-sm">
                            {key}
                          </code>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No cached keys found</span>
                    )}
                  </div>
                </div>
                <div className="p-3 border rounded">
                  <h4 className="font-medium">API Cache Status:</h4>
                  <span className="text-sm text-muted-foreground">
                    {results.cacheInfo.apiCacheStatus}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="p-3 bg-muted rounded">
              <h3 className="font-semibold">Summary</h3>
              <p className="text-sm text-muted-foreground">
                Total posts found across all sources: <strong>{results.totalPosts}</strong>
              </p>
              {results.totalPosts > 0 && (
                <p className="text-sm text-amber-600 mt-1">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  Posts are still present in the database or cache
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}