import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export function FirebaseDatabaseRulesFixer() {
  const [isFixing, setIsFixing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const fixDatabaseRules = async () => {
    setIsFixing(true);
    setResult(null);

    try {
      const adminSecret = localStorage.getItem('adminSecret') || localStorage.getItem('admin_secret') || process.env.NEXT_PUBLIC_ADMIN_SECRET || '';
      
      console.log('Fixing database rules...');
      
      const response = await fetch('/api/admin/update-database-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret
        }
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Database rules fixed successfully');
        setResult({
          success: true,
          message: data.message || 'Database rules fixed successfully'
        });
      } else {
        console.error('Failed to fix database rules:', data.error);
        setResult({
          success: false,
          message: data.error || 'Failed to fix database rules'
        });
      }
    } catch (error) {
      console.error('Error fixing database rules:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Fix Database Rules</CardTitle>
        <CardDescription>
          Fix issues with special characters in Firebase database rules
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Alert variant="warning" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Database Rules Issue</AlertTitle>
            <AlertDescription>
              Your database rules contain special characters that need to be fixed. 
              This commonly happens with the <code>.info/connected</code> path.
            </AlertDescription>
          </Alert>

          <Button
            onClick={fixDatabaseRules}
            disabled={isFixing}
            className="w-full"
          >
            {isFixing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fixing Database Rules...
              </>
            ) : (
              'Fix Database Rules'
            )}
          </Button>

          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              {result.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertTitle>{result.success ? 'Success' : 'Error'}</AlertTitle>
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-start text-sm text-muted-foreground">
        <p>
          This tool fixes issues with special characters in database rules by properly formatting the <code>.info/connected</code> path
          and other problematic sections.
        </p>
      </CardFooter>
    </Card>
  );
}