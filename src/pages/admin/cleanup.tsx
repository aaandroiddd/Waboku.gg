import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Footer } from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CleanupResult {
  message: string;
  processedListings?: number;
  deletedListings?: number;
  deletedFiles?: number;
  errors?: string[];
  success?: boolean;
}

export default function CleanupPage() {
  const [adminSecret, setAdminSecret] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleListingsCleanup = async () => {
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
        throw new Error(data.message || 'Failed to perform listings cleanup');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStorageCleanup = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/cleanup/storage-cleanup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminSecret}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to perform storage cleanup');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto p-8 max-w-2xl flex-grow">
        <h1 className="text-3xl font-bold mb-8">Admin Cleanup Tools</h1>
        
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

            <Tabs defaultValue="listings" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="listings">Listings Cleanup</TabsTrigger>
                <TabsTrigger value="storage">Storage Cleanup</TabsTrigger>
              </TabsList>
              <TabsContent value="listings" className="mt-4">
                <Button 
                  onClick={handleListingsCleanup} 
                  disabled={isLoading || !adminSecret}
                  className="w-full"
                >
                  {isLoading ? 'Cleaning up listings...' : 'Clean Inactive Listings'}
                </Button>
              </TabsContent>
              <TabsContent value="storage" className="mt-4">
                <Button 
                  onClick={handleStorageCleanup} 
                  disabled={isLoading || !adminSecret}
                  className="w-full"
                >
                  {isLoading ? 'Cleaning up storage...' : 'Clean Old Storage Files'}
                </Button>
              </TabsContent>
            </Tabs>
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
                    <p><strong>Status:</strong> {result.message || (result.success ? 'Success' : 'Failed')}</p>
                    {result.processedListings !== undefined && (
                      <p><strong>Processed Listings:</strong> {result.processedListings}</p>
                    )}
                    {result.deletedListings !== undefined && (
                      <p><strong>Deleted Listings:</strong> {result.deletedListings}</p>
                    )}
                    {result.deletedFiles !== undefined && (
                      <p><strong>Deleted Files:</strong> {result.deletedFiles}</p>
                    )}
                    {result.errors && result.errors.length > 0 && (
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
      <Footer />
    </div>
  );
}