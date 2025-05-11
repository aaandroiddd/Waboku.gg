import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Footer } from '@/components/Footer';
import { ListingDebuggerTool } from '@/components/ListingDebuggerTool';
import { ListingVisibilityTroubleshooter } from '@/components/admin/ListingVisibilityTroubleshooter';

export default function ListingDiagnosticsPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminSecret, setAdminSecret] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const secret = localStorage.getItem('admin_secret');
    if (secret) {
      setAdminSecret(secret);
      verifyAdmin(secret);
    }
  }, []);

  const verifyAdmin = async (secret: string) => {
    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${secret}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setIsAuthorized(true);
        localStorage.setItem('admin_secret', secret);
      } else {
        setIsAuthorized(false);
        localStorage.removeItem('admin_secret');
      }
    } catch (error) {
      console.error('Error verifying admin:', error);
      setIsAuthorized(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="container mx-auto p-8 flex-grow">
          <Card className="p-6">
            <h1 className="text-2xl font-bold mb-4">Admin Authentication</h1>
            <div className="space-y-4">
              <input
                type="password"
                placeholder="Enter admin secret"
                className="w-full p-2 border rounded"
                onChange={(e) => setAdminSecret(e.target.value)}
              />
              <Button 
                onClick={() => verifyAdmin(adminSecret)}
                disabled={!adminSecret}
              >
                Verify Admin Access
              </Button>
            </div>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto p-8 flex-grow">
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Listing Visibility Diagnostics</h1>
            <Button variant="outline" onClick={() => router.push('/admin')}>
              Back to Admin Dashboard
            </Button>
          </div>
          
          <Alert className="mb-6">
            <AlertDescription>
              ⚠️ This tool helps diagnose and fix issues with listing visibility in the marketplace.
            </AlertDescription>
          </Alert>
          
          <div className="space-y-8">
            <ListingDebuggerTool />
            
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">User Listing Troubleshooter</h2>
              <p className="text-muted-foreground mb-4">
                This tool is available to admins to diagnose issues with specific user listings.
              </p>
              <ListingVisibilityTroubleshooter />
            </div>
          </div>
        </Card>
      </div>
      <Footer />
    </div>
  );
}