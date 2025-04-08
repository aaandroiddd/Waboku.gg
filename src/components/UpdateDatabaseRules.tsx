import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

export function UpdateDatabaseRules() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [adminSecret, setAdminSecret] = useState<string | null>(null);

  // Get admin secret from localStorage on component mount
  useEffect(() => {
    const secret = localStorage.getItem('adminSecret') || localStorage.getItem('admin_secret');
    if (secret) {
      setAdminSecret(secret);
    }
  }, []);

  const updateRules = async () => {
    setIsUpdating(true);
    setResult(null);

    try {
      // Use the admin secret from localStorage if available, otherwise use the environment variable
      const secretToUse = adminSecret || process.env.NEXT_PUBLIC_ADMIN_SECRET || '';
      
      console.log('Updating database rules...');
      
      const response = await fetch('/api/admin/update-database-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': secretToUse
        }
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Database rules updated successfully');
        setResult({
          success: true,
          message: data.message || 'Database rules updated successfully'
        });
      } else {
        console.error('Failed to update database rules:', data.error);
        setResult({
          success: false,
          message: data.error || 'Failed to update database rules'
        });
        
        // If unauthorized, show a more specific error message
        if (response.status === 401) {
          setResult({
            success: false,
            message: 'Unauthorized: Invalid admin secret. Please log in again.'
          });
        }
      }
    } catch (error) {
      console.error('Error updating database rules:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={updateRules}
        disabled={isUpdating}
        className="w-full"
      >
        {isUpdating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Updating Database Rules...
          </>
        ) : (
          'Update Database Rules'
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
  );
}