import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export function WantedPostMigrationTool() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{
    migrated: number;
    errors: string[];
    success: boolean;
  } | null>(null);

  const runMigration = async () => {
    setIsRunning(true);
    setResult(null);

    try {
      const response = await fetch('/api/wanted/migrate-to-want-ids', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          migrated: data.migrated,
          errors: data.errors || [],
          success: true,
        });
      } else {
        setResult({
          migrated: 0,
          errors: [data.message || 'Migration failed'],
          success: false,
        });
      }
    } catch (error) {
      console.error('Migration error:', error);
      setResult({
        migrated: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        success: false,
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          Migrate Wanted Posts to WANT IDs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          <p className="mb-2">
            This tool migrates existing wanted posts from Firebase auto-generated IDs to the new WANT + 6-digit format.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Posts with Firebase IDs (like -OKypHOHK1ZMBe2AF54x) will be migrated to WANT format (like WANT123456)</li>
            <li>Existing short ID mappings will be updated to point to the new WANT IDs</li>
            <li>Posts already using WANT format will be skipped</li>
            <li>This operation is irreversible - make sure to backup data first</li>
          </ul>
        </div>

        <Button 
          onClick={runMigration} 
          disabled={isRunning}
          variant="outline"
          className="w-full"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Migrating Posts...
            </>
          ) : (
            'Start Migration'
          )}
        </Button>

        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            <div className="flex items-start gap-2">
              {result.success ? (
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
              )}
              <div className="flex-1">
                <AlertDescription>
                  <div className="font-medium mb-2">
                    {result.success ? 'Migration Completed' : 'Migration Failed'}
                  </div>
                  
                  {result.success && (
                    <div className="mb-2">
                      Successfully migrated <strong>{result.migrated}</strong> posts to WANT ID format.
                    </div>
                  )}
                  
                  {result.errors.length > 0 && (
                    <div>
                      <div className="font-medium mb-1">
                        {result.errors.length === 1 ? 'Error:' : `Errors (${result.errors.length}):`}
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {result.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}