import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CleanupResult {
  message: string;
  processedListings: number;
  deletedListings: number;
  errors: string[];
}

export default function CleanupPage() {
  const [adminSecret, setAdminSecret] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCleanup = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/cleanup-listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminSecret }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to perform cleanup');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Admin Cleanup Tool</h1>
      
      <Card className="p-6 space-y-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="adminSecret" className="block text-sm font-medium mb-2">
              Admin Secret
            </label>
            <Input
              id="adminSecret"
              type="password"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              placeholder="Enter admin secret"
              className="w-full"
            />
          </div>

          <Button 
            onClick={handleCleanup} 
            disabled={isLoading || !adminSecret}
            className="w-full"
          >
            {isLoading ? 'Cleaning up...' : 'Start Cleanup'}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>Status:</strong> {result.message}</p>
                  <p><strong>Processed Listings:</strong> {result.processedListings}</p>
                  <p><strong>Deleted Listings:</strong> {result.deletedListings}</p>
                  {result.errors.length > 0 && (
                    <div>
                      <p className="font-semibold">Errors:</p>
                      <ul className="list-disc pl-5">
                        {result.errors.map((error, index) => (
                          <li key={index} className="text-sm">{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </Card>
    </div>
  );
}