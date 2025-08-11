import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { SELLER_LEVEL_CONFIG, SellerLevel, meetsLevel4Requirements, meetsLevel5Requirements } from '@/types/seller-level';
import { toast } from 'sonner';
import { 
  TrendingUp, 
  Shield, 
  Star, 
  Calendar, 
  Award, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Crown,
  Building,
  CreditCard,
  User,
  Search,
  RefreshCw
} from 'lucide-react';

interface UserLevelInfo {
  userId: string;
  username: string;
  email: string;
  currentLevel: SellerLevel;
  completedSales: number;
  rating: number | null;
  reviewCount: number;
  accountAge: number;
  chargebackRate: number;
  unresolvedDisputes: number;
  joinDate: Date;
  isPremium: boolean;
  stripeConnectStatus?: string;
  hasStripeStandard?: boolean;
}

interface RequirementCheck {
  met: boolean;
  current: number | string;
  required: number | string;
  description: string;
}

export function SellerLevelModerationTool() {
  const [searchTerm, setSearchTerm] = useState('');
  const [userInfo, setUserInfo] = useState<UserLevelInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');
  const [grantPremium, setGrantPremium] = useState(false);
  const [requirementsCheck, setRequirementsCheck] = useState<Record<string, RequirementCheck>>({});

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
      
      // Check requirements for higher levels
      checkRequirements(data);
      
      // Auto-select premium grant for Level 4 and 5
      setGrantPremium(data.currentLevel >= 4 || false);
      
    } catch (error) {
      console.error('Error searching user:', error);
      toast.error('User not found or error occurred');
      setUserInfo(null);
      setRequirementsCheck({});
    } finally {
      setIsLoading(false);
    }
  };

  const checkRequirements = (user: UserLevelInfo) => {
    const checks: Record<string, RequirementCheck> = {};

    // Check Level 4 requirements
    const level4Config = SELLER_LEVEL_CONFIG[4];
    checks.level4_sales = {
      met: user.completedSales >= level4Config.requirements.minCompletedSales,
      current: user.completedSales,
      required: level4Config.requirements.minCompletedSales,
      description: 'Completed Sales'
    };
    
    checks.level4_chargeback = {
      met: user.chargebackRate <= level4Config.requirements.maxChargebackRate,
      current: `${user.chargebackRate}%`,
      required: `≤${level4Config.requirements.maxChargebackRate}%`,
      description: 'Chargeback Rate'
    };
    
    checks.level4_rating = {
      met: user.rating !== null && user.rating >= (level4Config.requirements.minRating || 0),
      current: user.rating ? `${user.rating.toFixed(1)}★` : 'No rating',
      required: `≥${level4Config.requirements.minRating}★`,
      description: 'Average Rating'
    };
    
    checks.level4_reviews = {
      met: user.reviewCount >= (level4Config.requirements.minReviewCount || 0),
      current: user.reviewCount,
      required: level4Config.requirements.minReviewCount || 0,
      description: 'Review Count'
    };
    
    checks.level4_age = {
      met: user.accountAge >= level4Config.requirements.minAccountAge,
      current: `${user.accountAge} days`,
      required: `${level4Config.requirements.minAccountAge} days`,
      description: 'Account Age'
    };
    
    checks.level4_disputes = {
      met: user.unresolvedDisputes <= level4Config.requirements.maxUnresolvedDisputes,
      current: user.unresolvedDisputes,
      required: `≤${level4Config.requirements.maxUnresolvedDisputes}`,
      description: 'Unresolved Disputes'
    };

    // Check Level 5 requirements
    const level5Config = SELLER_LEVEL_CONFIG[5];
    checks.level5_sales = {
      met: user.completedSales >= level5Config.requirements.minCompletedSales,
      current: user.completedSales,
      required: level5Config.requirements.minCompletedSales,
      description: 'Completed Sales'
    };
    
    checks.level5_chargeback = {
      met: user.chargebackRate <= level5Config.requirements.maxChargebackRate,
      current: `${user.chargebackRate}%`,
      required: `≤${level5Config.requirements.maxChargebackRate}%`,
      description: 'Chargeback Rate'
    };
    
    checks.level5_rating = {
      met: user.rating !== null && user.rating >= (level5Config.requirements.minRating || 0),
      current: user.rating ? `${user.rating.toFixed(1)}★` : 'No rating',
      required: `≥${level5Config.requirements.minRating}★`,
      description: 'Average Rating'
    };
    
    checks.level5_reviews = {
      met: user.reviewCount >= (level5Config.requirements.minReviewCount || 0),
      current: user.reviewCount,
      required: level5Config.requirements.minReviewCount || 0,
      description: 'Review Count'
    };
    
    checks.level5_age = {
      met: user.accountAge >= level5Config.requirements.minAccountAge,
      current: `${user.accountAge} days`,
      required: `${level5Config.requirements.minAccountAge} days`,
      description: 'Account Age'
    };
    
    checks.level5_disputes = {
      met: user.unresolvedDisputes <= level5Config.requirements.maxUnresolvedDisputes,
      current: user.unresolvedDisputes,
      required: `≤${level5Config.requirements.maxUnresolvedDisputes}`,
      description: 'Unresolved Disputes'
    };

    setRequirementsCheck(checks);
  };

  const updateUserLevel = async (newLevel: SellerLevel) => {
    if (!userInfo || !upgradeReason.trim()) {
      toast.error('Please provide a reason for the level change');
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch('/api/admin/seller-level/update-level-with-premium', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: userInfo.userId, 
          newLevel,
          reason: upgradeReason.trim(),
          grantPremium: grantPremium && (newLevel >= 4),
          moderatorAction: true
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user level');
      }

      const result = await response.json();
      
      const updatedUser = { 
        ...userInfo, 
        currentLevel: newLevel,
        isPremium: result.premiumGranted || userInfo.isPremium
      };
      setUserInfo(updatedUser);
      
      let successMessage = `Successfully updated user to ${SELLER_LEVEL_CONFIG[newLevel].name}`;
      if (result.premiumGranted) {
        successMessage += ' and granted premium account benefits';
      }
      
      toast.success(successMessage);
      setUpgradeReason('');
      
      // Re-check requirements with updated level
      checkRequirements(updatedUser);
      
    } catch (error) {
      console.error('Error updating user level:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update user level');
    } finally {
      setIsUpdating(false);
    }
  };

  const getRequirementIcon = (met: boolean) => {
    return met ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-600" />
    );
  };

  const canUpgradeToLevel = (level: SellerLevel): boolean => {
    if (!userInfo) return false;
    
    if (level === 4) {
      return meetsLevel4Requirements({
        completedSales: userInfo.completedSales,
        chargebackRate: userInfo.chargebackRate,
        rating: userInfo.rating,
        reviewCount: userInfo.reviewCount,
        accountAge: userInfo.accountAge,
        unresolvedDisputes: userInfo.unresolvedDisputes
      });
    }
    
    if (level === 5) {
      return meetsLevel5Requirements({
        completedSales: userInfo.completedSales,
        chargebackRate: userInfo.chargebackRate,
        rating: userInfo.rating,
        reviewCount: userInfo.reviewCount,
        accountAge: userInfo.accountAge,
        unresolvedDisputes: userInfo.unresolvedDisputes
      });
    }
    
    return true; // Levels 1-3 can always be set manually
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Seller Level Moderation Tool
        </CardTitle>
        <CardDescription>
          Manage seller levels and premium account benefits for Level 4 and 5 sellers. 
          This tool automatically grants premium benefits when upgrading users to Level 4 or 5.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search Section */}
        <div className="space-y-2">
          <Label htmlFor="search">Search User</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Enter username or email"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchUser()}
                className="pl-10"
              />
            </div>
            <Button onClick={searchUser} disabled={isLoading}>
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {isLoading ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </div>

        {/* User Info Section */}
        {userInfo && (
          <div className="space-y-6">
            {/* Basic User Information */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                User Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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
                  <span className="text-muted-foreground">Premium Status:</span>
                  <Badge className={`ml-2 ${userInfo.isPremium ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'}`}>
                    {userInfo.isPremium ? (
                      <>
                        <Crown className="h-3 w-3 mr-1" />
                        Premium
                      </>
                    ) : (
                      'Free'
                    )}
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
                <div>
                  <span className="text-muted-foreground">Chargeback Rate:</span>
                  <span className="ml-2 font-medium">{userInfo.chargebackRate}%</span>
                </div>
                {userInfo.stripeConnectStatus && (
                  <div>
                    <span className="text-muted-foreground">Stripe Connect:</span>
                    <Badge className="ml-2" variant="outline">
                      <CreditCard className="h-3 w-3 mr-1" />
                      {userInfo.stripeConnectStatus}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Requirements Check for Level 4 */}
            {userInfo.currentLevel < 4 && (
              <div className="space-y-4">
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Crown className="h-4 w-4 text-orange-600" />
                    Level 4 Requirements Check
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {Object.entries(requirementsCheck)
                      .filter(([key]) => key.startsWith('level4_'))
                      .map(([key, check]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-muted-foreground">{check.description}:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{check.current} / {check.required}</span>
                            {getRequirementIcon(check.met)}
                          </div>
                        </div>
                      ))}
                  </div>
                  {canUpgradeToLevel(4) && (
                    <Alert className="mt-3">
                      <CheckCircle className="h-4 w-4" />
                      <AlertTitle>Eligible for Level 4</AlertTitle>
                      <AlertDescription>
                        This user meets all requirements for Level 4 upgrade.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            )}

            {/* Requirements Check for Level 5 */}
            {userInfo.currentLevel < 5 && (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Building className="h-4 w-4 text-amber-600" />
                    Level 5 Requirements Check
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {Object.entries(requirementsCheck)
                      .filter(([key]) => key.startsWith('level5_'))
                      .map(([key, check]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-muted-foreground">{check.description}:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{check.current} / {check.required}</span>
                            {getRequirementIcon(check.met)}
                          </div>
                        </div>
                      ))}
                  </div>
                  {canUpgradeToLevel(5) && (
                    <Alert className="mt-3">
                      <CheckCircle className="h-4 w-4" />
                      <AlertTitle>Eligible for Level 5</AlertTitle>
                      <AlertDescription>
                        This user meets all requirements for Level 5 upgrade.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* Level Update Section */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Update Seller Level
              </h3>
              
              {/* Reason Input */}
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Level Change *</Label>
                <Textarea
                  id="reason"
                  placeholder="Provide a detailed reason for this level change (e.g., 'User meets all Level 4 requirements and has been verified for business operations')"
                  value={upgradeReason}
                  onChange={(e) => setUpgradeReason(e.target.value)}
                  className="min-h-[80px]"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                  {upgradeReason.length}/500 characters
                </p>
              </div>

              {/* Premium Grant Option */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="grantPremium"
                  checked={grantPremium}
                  onCheckedChange={(checked) => setGrantPremium(checked as boolean)}
                />
                <Label htmlFor="grantPremium" className="text-sm">
                  Grant premium account benefits (automatically enabled for Level 4 and 5)
                </Label>
              </div>

              {/* Level Buttons */}
              <div className="grid grid-cols-5 gap-2">
                {([1, 2, 3, 4, 5] as SellerLevel[]).map((level) => {
                  const config = SELLER_LEVEL_CONFIG[level];
                  const isCurrent = userInfo.currentLevel === level;
                  const canUpgrade = canUpgradeToLevel(level);
                  const isHighLevel = level >= 4;
                  
                  return (
                    <Button
                      key={level}
                      variant={isCurrent ? "default" : "outline"}
                      size="sm"
                      disabled={isCurrent || isUpdating || !upgradeReason.trim() || (isHighLevel && !canUpgrade)}
                      onClick={() => updateUserLevel(level)}
                      className={`text-xs ${isHighLevel ? 'border-orange-300 hover:border-orange-400' : ''}`}
                      title={isHighLevel && !canUpgrade ? 'User does not meet requirements for this level' : ''}
                    >
                      {isHighLevel && (
                        <Crown className="h-3 w-3 mr-1" />
                      )}
                      Level {level}
                    </Button>
                  );
                })}
              </div>
              
              {/* Special Requirements Notice */}
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Important Notes</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p><strong>Level 4:</strong> Requires all statistical requirements to be met. Includes premium account benefits automatically.</p>
                  <p><strong>Level 5:</strong> Reserved for storefronts and businesses. Requires all statistical requirements and manual approval. Includes premium account benefits automatically.</p>
                  <p><strong>Premium Benefits:</strong> Level 4 and 5 sellers receive premium account features without subscription fees.</p>
                </AlertDescription>
              </Alert>
            </div>

            {/* Current Level Limits Display */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Current Level Limits
              </h4>
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Max Total Listing Value:</span>
                  <span className="ml-2 font-medium">
                    {SELLER_LEVEL_CONFIG[userInfo.currentLevel].limits.maxTotalListingValue 
                      ? `$${SELLER_LEVEL_CONFIG[userInfo.currentLevel].limits.maxTotalListingValue.toLocaleString()}`
                      : 'Unlimited'
                    }
                  </span>
                </p>
                {SELLER_LEVEL_CONFIG[userInfo.currentLevel].limits.maxActiveListings && (
                  <p>
                    <span className="text-muted-foreground">Max Active Listings:</span>
                    <span className="ml-2 font-medium">{SELLER_LEVEL_CONFIG[userInfo.currentLevel].limits.maxActiveListings}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}