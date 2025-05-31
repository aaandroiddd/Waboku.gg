import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

export default function MigrateMessageThreadsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runMigration = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/migrate-message-threads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Migration failed');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Migrate Message Threads</CardTitle>
          <CardDescription>
            This tool creates message threads for users who have existing chats but no message threads.
            This is needed for users to see their messages in the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">What this migration does:</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Scans all existing chats in the database</li>
              <li>• Creates message threads for users who don't have them</li>
              <li>• Preserves existing message threads (won't duplicate)</li>
              <li>• Skips chats that users have deleted</li>
              <li>• Enables users to see their messages in the dashboard</li>
            </ul>
          </div>

          <Button 
            onClick={runMigration} 
            disabled={loading}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Running Migration...' : 'Run Migration'}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                <strong>Error:</strong> {error}
              </AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert>
              <AlertDescription>
                <strong>Success:</strong> {result.message}
                <br />
                <strong>Threads Created:</strong> {result.threadsCreated}
              </AlertDescription>
            </Alert>
          )}

          <div className="text-sm text-muted-foreground">
            <p><strong>Note:</strong> This migration is safe to run multiple times. It will only create missing message threads and won't affect existing ones.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}