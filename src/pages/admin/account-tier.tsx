import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from 'next/router';

export default function AccountTierPage() {
  const [userId, setUserId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [accountTier, setAccountTier] = useState('premium');
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<any>(null);
  const [adminSecret, setAdminSecret] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const storedSecret = localStorage.getItem('adminSecret');
    if (storedSecret) {
      verifyAdminSecret(storedSecret);
    }
  }, []);

  const verifyAdminSecret = async (secret: string) => {
    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secret}`
        }
      });

      if (response.ok) {
        setIsAuthenticated(true);
        localStorage.setItem('adminSecret', secret);
        setAdminSecret(secret);
      } else {
        setIsAuthenticated(false);
        localStorage.removeItem('adminSecret');
        toast({
          title: "Authentication Error",
          description: "Invalid admin secret",
          variant: "destructive",
        });
      }
    } catch (error) {
      setIsAuthenticated(false);
      toast({
        title: "Error",
        description: "Failed to verify admin secret",
        variant: "destructive",
      });
    }
  };

  const handleSearch = async () => {
    if (!searchTerm) return;
    
    setIsSearching(true);
    try {
      const response = await fetch('/api/admin/check-account-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminSecret}`
        },
        body: JSON.stringify({ 
          username: searchTerm.toLowerCase(),
          userId: searchTerm // In case it's a userId
        })
      });

      const data = await response.json();

      if (response.ok) {
        setCurrentStatus(data);
        setUserId(data.userId);
        setAccountTier(data.accountTier || 'free');
        toast({
          title: "Success",
          description: "User account status retrieved successfully",
        });
      } else {
        throw new Error(data.error || 'Failed to fetch account status');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/fix-specific-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminSecret}`
        },
        body: JSON.stringify({ userId, accountTier })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: `Account status updated for user ${userId} to ${accountTier}`,
        });
        // Refresh the current status
        handleSearch();
      } else {
        throw new Error(data.error || 'Failed to update account status');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-8 max-w-2xl">
        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-6">Admin Authentication</h1>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Enter admin secret"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
            />
            <Button 
              onClick={() => verifyAdminSecret(adminSecret)}
              className="w-full"
            >
              Authenticate
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-6">Update Account Status</h1>
        
        <Alert className="mb-6">
          <AlertDescription>
            Search by username or user ID to update a user&apos;s account tier.
          </AlertDescription>
        </Alert>

        <div className="mb-6 space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter username or user ID"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button 
              onClick={handleSearch}
              disabled={isSearching}
            >
              {isSearching ? "Searching..." : "Search"}
            </Button>
          </div>

          {currentStatus && (
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>Username:</strong> {currentStatus.username}</p>
                  <p><strong>User ID:</strong> {currentStatus.userId}</p>
                  <p><strong>Current Tier:</strong> {currentStatus.accountTier || 'free'}</p>
                  {currentStatus.subscription && (
                    <p><strong>Subscription Status:</strong> {currentStatus.subscription.status}</p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="userId" className="text-sm font-medium">
              User ID
            </label>
            <Input
              id="userId"
              placeholder="User ID will be populated after search"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              disabled
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="accountTier" className="text-sm font-medium">
              Account Tier
            </label>
            <Select
              value={accountTier}
              onValueChange={setAccountTier}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="free">Free</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading || !userId}
          >
            {isLoading ? "Updating..." : "Update Account Status"}
          </Button>
        </form>
      </Card>
    </div>
  );
}