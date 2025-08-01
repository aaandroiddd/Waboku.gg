import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from '@/contexts/AuthContext';
import { User, Shield, Key, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface UserClaimsData {
  success: boolean;
  method?: string;
  userId?: string;
  email?: string;
  emailVerified?: boolean;
  disabled?: boolean;
  customClaims?: any;
  hasAdminClaim?: boolean;
  hasModeratorClaim?: boolean;
  tokenClaims?: any;
  error?: string;
  details?: string;
}

export default function AuthDebugger() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [claimsData, setClaimsData] = useState<UserClaimsData | null>(null);
  const [adminSecret, setAdminSecret] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);

  const checkUserClaims = async () => {
    if (!user) {
      toast.error('No user logged in');
      return;
    }

    try {
      setLoading(true);
      const token = await user.getIdToken();
      
      const response = await fetch('/api/debug/check-user-claims', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      setClaimsData(data);
      
      if (data.success) {
        toast.success('User claims checked successfully');
      } else {
        toast.error(data.error || 'Failed to check user claims');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to check user claims');
      setClaimsData({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const checkAdminSecret = async () => {
    if (!adminSecret) {
      toast.error('Please enter admin secret');
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch('/api/debug/check-user-claims', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminSecret}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      setClaimsData(data);
      
      if (data.success) {
        toast.success('Admin secret verified successfully');
      } else {
        toast.error(data.error || 'Invalid admin secret');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify admin secret');
      setClaimsData({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const setAdminClaims = async () => {
    if (!adminSecret) {
      toast.error('Please enter admin secret');
      return;
    }

    if (!targetUserId) {
      toast.error('Please enter target user ID');
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch('/api/debug/set-admin-claims', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminSecret}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: targetUserId,
          isAdmin,
          isModerator
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Admin claims updated successfully');
        setClaimsData(data);
      } else {
        toast.error(data.error || 'Failed to update admin claims');
        setClaimsData(data);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update admin claims');
    } finally {
      setLoading(false);
    }
  };

  const refreshToken = async () => {
    if (!user) {
      toast.error('No user logged in');
      return;
    }

    try {
      setLoading(true);
      // Force token refresh
      await user.getIdToken(true);
      toast.success('Token refreshed successfully');
      
      // Automatically check claims after refresh
      setTimeout(() => {
        checkUserClaims();
      }, 1000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to refresh token');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Authentication Debugger
          </CardTitle>
          <CardDescription>
            Debug authentication issues and manage admin claims
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="check-claims" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="check-claims">Check Claims</TabsTrigger>
              <TabsTrigger value="admin-secret">Admin Secret</TabsTrigger>
              <TabsTrigger value="set-claims">Set Claims</TabsTrigger>
            </TabsList>

            <TabsContent value="check-claims" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Current User Claims</h3>
                    <p className="text-sm text-muted-foreground">
                      Check the current user's authentication status and custom claims
                    </p>
                  </div>
                  {user && (
                    <div className="text-sm text-muted-foreground">
                      Logged in as: {user.email}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button onClick={checkUserClaims} disabled={loading || !user}>
                    {loading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Check Claims
                  </Button>
                  
                  <Button variant="outline" onClick={refreshToken} disabled={loading || !user}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Token
                  </Button>
                </div>

                {!user && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      No user is currently logged in. Please sign in first.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </TabsContent>

            <TabsContent value="admin-secret" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Admin Secret Verification</h3>
                  <p className="text-sm text-muted-foreground">
                    Test the admin secret authentication
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-secret">Admin Secret</Label>
                  <Input
                    id="admin-secret"
                    type="password"
                    placeholder="Enter admin secret"
                    value={adminSecret}
                    onChange={(e) => setAdminSecret(e.target.value)}
                  />
                </div>

                <Button onClick={checkAdminSecret} disabled={loading || !adminSecret}>
                  {loading ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Key className="h-4 w-4 mr-2" />
                  )}
                  Verify Admin Secret
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="set-claims" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Set Admin Claims</h3>
                  <p className="text-sm text-muted-foreground">
                    Grant or revoke admin/moderator privileges (requires admin secret)
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-secret-2">Admin Secret</Label>
                    <Input
                      id="admin-secret-2"
                      type="password"
                      placeholder="Enter admin secret"
                      value={adminSecret}
                      onChange={(e) => setAdminSecret(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="target-user-id">Target User ID</Label>
                    <Input
                      id="target-user-id"
                      type="text"
                      placeholder="Enter user ID to modify"
                      value={targetUserId}
                      onChange={(e) => setTargetUserId(e.target.value)}
                    />
                    {user && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTargetUserId(user.uid)}
                      >
                        Use Current User ({user.uid})
                      </Button>
                    )}
                  </div>

                  <div className="flex gap-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={isAdmin}
                        onChange={(e) => setIsAdmin(e.target.checked)}
                      />
                      <span>Admin</span>
                    </label>
                    
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={isModerator}
                        onChange={(e) => setIsModerator(e.target.checked)}
                      />
                      <span>Moderator</span>
                    </label>
                  </div>

                  <Button 
                    onClick={setAdminClaims} 
                    disabled={loading || !adminSecret || !targetUserId}
                  >
                    {loading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Shield className="h-4 w-4 mr-2" />
                    )}
                    Update Claims
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {claimsData && (
            <div className="mt-6">
              <h4 className="text-md font-medium mb-2">Results:</h4>
              <div className="bg-muted p-4 rounded-lg">
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(claimsData, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}