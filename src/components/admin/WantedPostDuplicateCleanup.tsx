import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Trash2, CheckCircle, XCircle } from 'lucide-react';

interface CleanupResult {
  success: boolean;
  duplicatesFound: number;
  postsDeleted: number;
  rootPostsDeleted: number;
  errors: Array<{
    success: boolean;
    path: string;
    error?: string;
  }>;
  duplicates: Array<{
    kept: string;
    removed: string;
    title: string;
  }>;
  message: string;
}

export default function WantedPostDuplicateCleanup() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCleanup = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/wanted/cleanup-duplicates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || data.message || 'Cleanup failed');
      }
    } catch (err) {
      console.error('Error during cleanup:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Wanted Posts Duplicate Cleanup
        </CardTitle>
        <CardDescription>
          Remove duplicate wanted posts that exist in both the new (wantedPosts) and old (wanted/posts) database paths.
          This tool will keep posts with WANT IDs and remove the old duplicates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleCleanup} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cleaning up duplicates...
            </>
          ) : (
            <>
              <Trash2 className="mr-2 h-4 w-4" />
              Clean Up Duplicate Posts
            </>
          )}
        </Button>

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Error:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-4">
            <Alert variant={result.success ? "default" : "destructive"}>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Cleanup Results:</strong> {result.message}
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Duplicates Found</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{result.duplicatesFound}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Posts Deleted</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{result.postsDeleted}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Root Posts Deleted</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{result.rootPostsDeleted}</div>
                </CardContent>
              </Card>
            </div>

            {result.duplicates.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Processed Duplicates</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {result.duplicates.map((duplicate, index) => (
                      <div key={index} className="text-sm border rounded p-2">
                        <div className="font-medium truncate">{duplicate.title}</div>
                        <div className="text-green-600 text-xs">✓ Kept: {duplicate.kept}</div>
                        <div className="text-red-600 text-xs">✗ Removed: {duplicate.removed}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {result.errors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-red-600">Errors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {result.errors.map((error, index) => (
                      <div key={index} className="text-sm text-red-600 border border-red-200 rounded p-2">
                        <div className="font-medium">{error.path}</div>
                        <div className="text-xs">{error.error}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}