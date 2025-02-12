import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ApiResponse {
  success?: boolean;
  error?: string;
  message?: string;
  [key: string]: any;
}

export default function AdminDashboard() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminSecret, setAdminSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [responseDialog, setResponseDialog] = useState(false);
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);

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

  const handleApiCall = async (endpoint: string, method: string = 'POST') => {
    setLoading(true);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${adminSecret}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      setApiResponse(data);
      setResponseDialog(true);
    } catch (error) {
      setApiResponse({ error: 'Failed to execute API call' });
      setResponseDialog(true);
    }
    setLoading(false);
  };

  if (!isAuthorized) {
    return (
      <div className="container mx-auto p-8">
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
    );
  }

  const apiEndpoints = [
    {
      name: "Storage Cleanup (60 days)",
      endpoint: "/api/cleanup/storage-cleanup",
      description: "Delete listing images older than 60 days"
    },
    {
      name: "Archive Expired Listings",
      endpoint: "/api/listings/archive-expired",
      description: "Archive listings that have expired"
    },
    {
      name: "Cleanup Archived Listings",
      endpoint: "/api/listings/cleanup-archived",
      description: "Remove old archived listings"
    },
    {
      name: "Set Default Tiers",
      endpoint: "/api/admin/set-default-tiers",
      description: "Initialize default account tiers"
    },
    {
      name: "Cleanup Inactive Listings",
      endpoint: "/api/cleanup-inactive-listings",
      description: "Remove inactive listings"
    }
  ];

  return (
    <div className="container mx-auto p-8">
      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
        <Alert className="mb-6">
          <AlertDescription>
            ⚠️ These operations can modify or delete data. Use with caution.
          </AlertDescription>
        </Alert>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {apiEndpoints.map((api) => (
            <Card key={api.endpoint} className="p-4">
              <h3 className="font-semibold mb-2">{api.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{api.description}</p>
              <Button
                onClick={() => handleApiCall(api.endpoint)}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Processing...' : 'Execute'}
              </Button>
            </Card>
          ))}
        </div>

        <Dialog open={responseDialog} onOpenChange={setResponseDialog}>
          <DialogContent className="max-w-[600px]">
            <DialogHeader>
              <DialogTitle>API Response</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[400px] mt-4">
              <pre className="p-4 bg-muted rounded-lg overflow-x-auto">
                {JSON.stringify(apiResponse, null, 2)}
              </pre>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
}