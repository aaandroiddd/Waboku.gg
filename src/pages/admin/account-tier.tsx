import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from 'next/router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoIcon } from 'lucide-react';

export default function AccountTierPage() {
  const [userId, setUserId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [accountTier, setAccountTier] = useState('premium');
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<any>(null);
  const [adminSecret, setAdminSecret] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [fixResult, setFixResult] = useState<any>(null);
  const [specificUserId, setSpecificUserId] = useState('');
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
      const response = await fetch('/api/admin/update-user-tier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminSecret}`
        },
        body: JSON.stringify({ 
          userId, 
          tier: accountTier 
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: `Account status updated for user ${userId} to ${accountTier}`,
        });
        // Refresh the current status
        handleSearch();
      } else {
        throw new Error(data.error || data.details || 'Failed to update account status');
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

  const handleFixSubscriptionTiers = async (userId?: string) => {
    setIsFixing(true);
    setFixResult(null);

    try {
      const response = await fetch('/api/admin/fix-subscription-tiers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Secret': process.env.NEXT_PUBLIC_ADMIN_SECRET || '',
          'Authorization': `Bearer ${adminSecret}`
        },
        body: JSON.stringify(userId ? { userId } : {})
      });

      const data = await response.json();
      setFixResult(data);

      if (response.ok) {
        toast({
          title: "Success",
          description: `Fixed ${data.fixedUsers?.length || 0} users with subscription tier issues`,
        });
      } else {
        throw new Error(data.error || 'Failed to fix subscription tiers');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsFixing(false);
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
      <h1 className="text-2xl font-bold mb-6">Account Tier Management</h1>
      
      <Tabs defaultValue="update">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="update" className="flex-1">Update Account Tier</TabsTrigger>
          <TabsTrigger value="fix" className="flex-1">Fix Subscription Tiers</TabsTrigger>
        </TabsList>
        
        <TabsContent value="update">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-6">Update Account Status</h2>
            
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
                        <>
                          <p><strong>Subscription Status:</strong> {currentStatus.subscription.status}</p>
                          <p><strong>Current Plan:</strong> {currentStatus.subscription.currentPlan}</p>
                          {currentStatus.subscription.endDate && (
                            <p><strong>End Date:</strong> {new Date(currentStatus.subscription.endDate).toLocaleString()}</p>
                          )}
                          {currentStatus.subscription.cancelAtPeriodEnd && (
                            <p><strong>Cancel at Period End:</strong> Yes</p>
                          )}
                        </>
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
        </TabsContent>
        
        <TabsContent value="fix">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-6">Fix Subscription Tiers</h2>
            
            <Alert className="mb-6">
              <InfoIcon className="h-4 w-4 mr-2" />
              <AlertTitle>About this tool</AlertTitle>
              <AlertDescription>
                This tool fixes users who have canceled their subscription but are still within their paid period.
                These users should have &quot;premium&quot; account tier until their subscription actually expires.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-4 mb-6">
              <div className="space-y-2">
                <label htmlFor="specificUserId" className="text-sm font-medium">
                  Specific User ID (Optional)
                </label>
                <Input
                  id="specificUserId"
                  placeholder="Leave empty to fix all users"
                  value={specificUserId}
                  onChange={(e) => setSpecificUserId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  If you know a specific user ID that needs fixing, enter it here. Otherwise, leave empty to scan all users.
                </p>
              </div>
              
              <Button 
                onClick={() => handleFixSubscriptionTiers(specificUserId || undefined)}
                disabled={isFixing}
                className="w-full"
              >
                {isFixing ? "Fixing..." : specificUserId ? "Fix Specific User" : "Fix All Users"}
              </Button>
            </div>
            
            {fixResult && (
              <div className="space-y-4">
                <Alert className={fixResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
                  <AlertTitle>{fixResult.success ? "Success" : "Error"}</AlertTitle>
                  <AlertDescription>
                    {fixResult.success 
                      ? `Fixed ${fixResult.fixedUsers?.length || 0} users out of ${fixResult.totalProcessed} processed` 
                      : fixResult.error || "An error occurred"}
                  </AlertDescription>
                </Alert>
                
                {fixResult.fixedUsers?.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium mb-2">Fixed Users ({fixResult.fixedUsers.length})</h3>
                    <div className="bg-muted p-4 rounded-md overflow-auto max-h-60">
                      <pre className="text-xs">
                        {JSON.stringify(fixResult.fixedUsers, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
                
                {fixResult.errors?.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium mb-2 text-destructive">Errors ({fixResult.errors.length})</h3>
                    <div className="bg-muted p-4 rounded-md overflow-auto max-h-60">
                      <pre className="text-xs">
                        {JSON.stringify(fixResult.errors, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}