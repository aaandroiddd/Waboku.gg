import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Footer } from '@/components/Footer';
import { WantedPostsDebugger } from '@/components/dashboard/WantedPostsDebugger';

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
  const [userId, setUserId] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('');

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
          'x-admin-secret': adminSecret,
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

  const handleUpdateUserTier = async () => {
    if (!userId || !selectedTier) {
      setApiResponse({ error: 'User ID and tier are required' });
      setResponseDialog(true);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/update-user-tier', {
        method: 'POST',
        headers: {
          'x-admin-secret': adminSecret,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          tier: selectedTier
        })
      });
      
      const data = await response.json();
      setApiResponse(data);
      setResponseDialog(true);
      
      if (response.ok) {
        // Clear form on success
        setUserId('');
        setSelectedTier('');
      }
    } catch (error) {
      setApiResponse({ error: 'Failed to update user tier' });
      setResponseDialog(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto p-8 flex-grow">
        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
          <Alert className="mb-6">
            <AlertDescription>
              ⚠️ These operations can modify or delete data. Use with caution.
            </AlertDescription>
          </Alert>

          {/* User Tier Management Section */}
          <Card className="p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">User Tier Management</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="userId">User ID</Label>
                <Input
                  id="userId"
                  placeholder="Enter Firebase User ID"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tier">Account Tier</Label>
                <Select value={selectedTier} onValueChange={setSelectedTier}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleUpdateUserTier}
                disabled={loading || !userId || !selectedTier}
                className="w-full"
              >
                {loading ? 'Updating...' : 'Update User Tier'}
              </Button>
            </div>
          </Card>
          
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
          
          {/* Wanted Posts Debugger Section */}
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Wanted Posts Debugging Tools</h2>
            <WantedPostsDebugger />
          </div>

          <Dialog open={responseDialog} onOpenChange={setResponseDialog}>
            <DialogContent className="max-w-[600px]">
              <DialogHeader>
                <DialogTitle>API Response</DialogTitle>
                <DialogDescription>
                  Response details from the API operation
                </DialogDescription>
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
      <Footer />
    </div>
  );
}