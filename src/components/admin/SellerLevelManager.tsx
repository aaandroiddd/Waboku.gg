import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SELLER_LEVEL_CONFIG, SellerLevel } from '@/types/seller-level';
import { toast } from 'sonner';

interface UserLevelInfo {
  userId: string;
  username: string;
  email: string;
  currentLevel: SellerLevel;
  completedSales: number;
  rating: number | null;
  reviewCount: number;
  accountAge: number;
}

export function SellerLevelManager() {
  const [searchTerm, setSearchTerm] = useState('');
  const [userInfo, setUserInfo] = useState<UserLevelInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const searchUser = async () => {
    if (!searchTerm.trim()) {
      toast.error('Please enter a username or email');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/seller-level/lookup-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ searchTerm: searchTerm.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to find user');
      }

      const data = await response.json();
      setUserInfo(data);
    } catch (error) {
      console.error('Error searching user:', error);
      toast.error('User not found or error occurred');
      setUserInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserLevel = async (newLevel: SellerLevel) => {
    if (!userInfo) return;

    setIsUpdating(true);
    try {
      const response = await fetch('/api/admin/seller-level/update-level', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: userInfo.userId, 
          newLevel,
          reason: `Admin manual level update to ${SELLER_LEVEL_CONFIG[newLevel].name}`
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update user level');
      }

      const updatedUser = { ...userInfo, currentLevel: newLevel };
      setUserInfo(updatedUser);
      toast.success(`Successfully updated user to ${SELLER_LEVEL_CONFIG[newLevel].name}`);
    } catch (error) {
      console.error('Error updating user level:', error);
      toast.error('Failed to update user level');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seller Level Manager</CardTitle>
        <CardDescription>
          Manually manage seller levels for users. Levels 4 and 5 require manual approval.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search Section */}
        <div className="space-y-2">
          <Label htmlFor="search">Search User</Label>
          <div className="flex gap-2">
            <Input
              id="search"
              placeholder="Enter username or email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchUser()}
            />
            <Button onClick={searchUser} disabled={isLoading}>
              {isLoading ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </div>

        {/* User Info Section */}
        {userInfo && (
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-semibold mb-2">User Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Username:</span>
                  <span className="ml-2 font-medium">{userInfo.username}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <span className="ml-2 font-medium">{userInfo.email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Current Level:</span>
                  <Badge className="ml-2" variant="secondary">
                    {SELLER_LEVEL_CONFIG[userInfo.currentLevel].name}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Completed Sales:</span>
                  <span className="ml-2 font-medium">{userInfo.completedSales}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Rating:</span>
                  <span className="ml-2 font-medium">
                    {userInfo.rating ? `${userInfo.rating.toFixed(1)}★ (${userInfo.reviewCount} reviews)` : 'No ratings'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Account Age:</span>
                  <span className="ml-2 font-medium">{userInfo.accountAge} days</span>
                </div>
              </div>
            </div>

            {/* Level Update Section */}
            <div className="space-y-3">
              <h3 className="font-semibold">Update Seller Level</h3>
              <div className="grid grid-cols-5 gap-2">
                {([1, 2, 3, 4, 5] as SellerLevel[]).map((level) => {
                  const config = SELLER_LEVEL_CONFIG[level];
                  const isCurrent = userInfo.currentLevel === level;
                  
                  return (
                    <Button
                      key={level}
                      variant={isCurrent ? "default" : "outline"}
                      size="sm"
                      disabled={isCurrent || isUpdating}
                      onClick={() => updateUserLevel(level)}
                      className="text-xs"
                    >
                      {config.name}
                    </Button>
                  );
                })}
              </div>
              
              {/* Special Requirements Notice */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Level 4:</strong> Requires Stripe Connect Standard, business verification, and enhanced identity verification</p>
                <p><strong>Level 5:</strong> Reserved for storefronts and businesses, requires manual approval</p>
              </div>
            </div>

            {/* Level Limits Display */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="font-semibold mb-2">Current Level Limits</h4>
              <div className="text-sm space-y-1">
                <p>Max Total Listing Value: <span className="font-medium">${SELLER_LEVEL_CONFIG[userInfo.currentLevel].limits.maxTotalListingValue.toLocaleString()}</span></p>
                <p>Max Individual Item Value: <span className="font-medium">${SELLER_LEVEL_CONFIG[userInfo.currentLevel].limits.maxIndividualItemValue.toLocaleString()}</span></p>
                {SELLER_LEVEL_CONFIG[userInfo.currentLevel].limits.maxActiveListings && (
                  <p>Max Active Listings: <span className="font-medium">{SELLER_LEVEL_CONFIG[userInfo.currentLevel].limits.maxActiveListings}</span></p>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}