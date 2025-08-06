import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, AlertCircle, User, Calendar, MessageSquare, Search, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';

interface UserEligibilityInfo {
  userId: string;
  email: string;
  displayName: string;
  isEligible: boolean;
  approvedBy?: string;
  approvedAt?: string;
  reason?: string;
  hasStripeAccount?: boolean;
  accountCreatedAt?: string;
}

interface StripeConnectEligibilityManagerProps {
  adminKey: string;
}

const StripeConnectEligibilityManager: React.FC<StripeConnectEligibilityManagerProps> = ({ adminKey }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [userInfo, setUserInfo] = useState<UserEligibilityInfo | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [approvalReason, setApprovalReason] = useState('');
  const [error, setError] = useState('');

  const searchUser = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a user ID or email address');
      return;
    }

    setIsSearching(true);
    setError('');
    setUserInfo(null);

    try {
      const response = await fetch('/api/admin/stripe-connect-eligibility/lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminKey}`
        },
        body: JSON.stringify({
          query: searchQuery.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to lookup user');
      }

      setUserInfo(data.user);
    } catch (err: any) {
      console.error('Error searching user:', err);
      setError(err.message || 'Failed to search user');
    } finally {
      setIsSearching(false);
    }
  };

  const updateEligibility = async (approve: boolean) => {
    if (!userInfo) return;

    if (approve && !approvalReason.trim()) {
      setError('Please provide a reason for approval');
      return;
    }

    setIsUpdating(true);
    setError('');

    try {
      const response = await fetch('/api/admin/stripe-connect-eligibility/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminKey}`
        },
        body: JSON.stringify({
          userId: userInfo.userId,
          approve,
          reason: approve ? approvalReason.trim() : 'Access revoked by moderator'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update eligibility');
      }

      // Update local state
      setUserInfo({
        ...userInfo,
        isEligible: approve,
        approvedBy: approve ? data.approvedBy : undefined,
        approvedAt: approve ? data.approvedAt : undefined,
        reason: approve ? approvalReason.trim() : 'Access revoked by moderator'
      });

      // Clear approval reason
      setApprovalReason('');

      toast.success(
        approve 
          ? 'User approved for Stripe Connect access' 
          : 'User Stripe Connect access revoked'
      );
    } catch (err: any) {
      console.error('Error updating eligibility:', err);
      setError(err.message || 'Failed to update eligibility');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Stripe Connect Eligibility Manager
          </CardTitle>
          <CardDescription>
            Manage user access to Stripe Connect seller account setup. Search for users and approve or revoke their ability to create seller accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Section */}
          <div className="space-y-3">
            <Label htmlFor="searchQuery">Search User</Label>
            <div className="flex gap-2">
              <Input
                id="searchQuery"
                placeholder="Enter user ID or email address"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isSearching) {
                    searchUser();
                  }
                }}
              />
              <Button 
                onClick={searchUser}
                disabled={isSearching || !searchQuery.trim()}
              >
                {isSearching ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Searching...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Search
                  </div>
                )}
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* User Information */}
          {userInfo && (
            <div className="space-y-4">
              <Separator />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <User className="h-5 w-5" />
                    User Information
                  </h3>
                  <Badge variant={userInfo.isEligible ? "default" : "secondary"}>
                    {userInfo.isEligible ? "Approved" : "Not Approved"}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">User ID</Label>
                    <p className="text-sm font-mono bg-muted p-2 rounded">{userInfo.userId}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                    <p className="text-sm">{userInfo.email}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Display Name</Label>
                    <p className="text-sm">{userInfo.displayName || 'Not set'}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Account Created</Label>
                    <p className="text-sm">{userInfo.accountCreatedAt || 'Unknown'}</p>
                  </div>
                </div>

                {/* Stripe Connect Status */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Stripe Connect Status</Label>
                  <div className="flex items-center gap-2">
                    {userInfo.hasStripeAccount ? (
                      <Badge variant="default" className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Has Stripe Account
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        No Stripe Account
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Current Approval Status */}
                {userInfo.isEligible && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Approval Details</Label>
                    <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg space-y-2">
                      {userInfo.approvedBy && (
                        <p className="text-sm">
                          <span className="font-medium">Approved by:</span> {userInfo.approvedBy}
                        </p>
                      )}
                      {userInfo.approvedAt && (
                        <p className="text-sm flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span className="font-medium">Approved on:</span> {new Date(userInfo.approvedAt).toLocaleString()}
                        </p>
                      )}
                      {userInfo.reason && (
                        <p className="text-sm">
                          <span className="font-medium">Reason:</span> {userInfo.reason}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Section */}
                <Separator />
                
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Update Eligibility
                  </h4>
                  
                  {!userInfo.isEligible && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="approvalReason">Approval Reason *</Label>
                        <Textarea
                          id="approvalReason"
                          placeholder="Enter the reason for approving this user's access to Stripe Connect (e.g., verified business, good standing, etc.)"
                          value={approvalReason}
                          onChange={(e) => setApprovalReason(e.target.value)}
                          rows={3}
                        />
                      </div>
                      
                      <Button
                        onClick={() => updateEligibility(true)}
                        disabled={isUpdating || !approvalReason.trim()}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        {isUpdating ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Approving...
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <UserCheck className="h-4 w-4" />
                            Approve Stripe Connect Access
                          </div>
                        )}
                      </Button>
                    </div>
                  )}
                  
                  {userInfo.isEligible && (
                    <div className="space-y-3">
                      <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <AlertDescription className="text-red-800 dark:text-red-200">
                          <p className="font-medium">Revoke Access</p>
                          <p className="text-sm mt-1">
                            This will prevent the user from creating new Stripe Connect accounts. 
                            Existing accounts will not be affected.
                          </p>
                        </AlertDescription>
                      </Alert>
                      
                      <Button
                        onClick={() => updateEligibility(false)}
                        disabled={isUpdating}
                        variant="destructive"
                        className="w-full"
                      >
                        {isUpdating ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Revoking...
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <UserX className="h-4 w-4" />
                            Revoke Stripe Connect Access
                          </div>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StripeConnectEligibilityManager;