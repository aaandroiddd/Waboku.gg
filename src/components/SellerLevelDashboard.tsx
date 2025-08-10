import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSellerLevel } from '@/hooks/useSellerLevel';
import { SellerLevelBadge, SellerLevelProgress } from '@/components/SellerLevelBadge';
import { SELLER_LEVEL_CONFIG, SellerLevel } from '@/types/seller-level';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, TrendingUp, Shield, Star, Calendar, Award } from 'lucide-react';

const SellerLevelDashboard = () => {
  const { sellerLevelData, isLoading, error } = useSellerLevel();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-32" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error Loading Seller Level</AlertTitle>
        <AlertDescription>
          {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!sellerLevelData) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>No Seller Level Data</AlertTitle>
        <AlertDescription>
          Unable to load your seller level information. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  const currentConfig = SELLER_LEVEL_CONFIG[sellerLevelData.level];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Seller Level</h2>
        <SellerLevelBadge
          level={sellerLevelData.level}
          salesCount={sellerLevelData.completedSales}
          rating={sellerLevelData.rating}
          reviewCount={sellerLevelData.reviewCount}
          accountAge={sellerLevelData.accountAge}
          showAllBadges={false}
        />
      </div>

      {/* Current Level Overview */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">{currentConfig.badge.icon}</span>
            <div>
              <h3 className="text-2xl font-bold">{currentConfig.name}</h3>
              <p className="text-muted-foreground font-normal">{currentConfig.description}</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">${sellerLevelData.currentLimits.maxTotalListingValue.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Listing Limit</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">${sellerLevelData.currentLimits.maxIndividualItemValue.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Max Per Item</div>
            </div>
            {sellerLevelData.currentLimits.maxActiveListings && (
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{sellerLevelData.currentLimits.maxActiveListings}</div>
                <div className="text-sm text-muted-foreground">Max Active Listings</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progress to Next Level */}
      {sellerLevelData.level < 5 && (
        <SellerLevelProgress
          currentLevel={sellerLevelData.level}
          completedSales={sellerLevelData.completedSales}
          rating={sellerLevelData.rating}
          reviewCount={sellerLevelData.reviewCount}
          accountAge={sellerLevelData.accountAge}
          chargebackRate={sellerLevelData.chargebackRate}
          unresolvedDisputes={sellerLevelData.unresolvedDisputes}
          canAdvance={sellerLevelData.canAdvance}
          nextLevelRequirements={sellerLevelData.nextLevelRequirements}
        />
      )}

      {/* Current Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sellerLevelData.completedSales}</div>
            <p className="text-xs text-muted-foreground">
              Successful transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sellerLevelData.rating ? `${sellerLevelData.rating.toFixed(1)}★` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              From {sellerLevelData.reviewCount} reviews
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Account Age</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sellerLevelData.accountAge}</div>
            <p className="text-xs text-muted-foreground">
              Days since joining
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chargeback Rate</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sellerLevelData.chargebackRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Lower is better
            </p>
          </CardContent>
        </Card>
      </div>

      {/* All Seller Levels Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Seller Level System
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {([1, 2, 3, 4, 5] as SellerLevel[]).map((level) => {
              const config = SELLER_LEVEL_CONFIG[level];
              const isCurrentLevel = level === sellerLevelData.level;
              const isUnlocked = level <= sellerLevelData.level;
              const isHighTier = level >= 4;
              
              return (
                <div
                  key={level}
                  className={`p-4 rounded-lg border transition-all ${
                    isCurrentLevel 
                      ? 'border-primary bg-primary/5' 
                      : isUnlocked 
                        ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                        : isHighTier
                          ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
                          : 'border-muted bg-muted/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`text-2xl ${isUnlocked ? '' : 'grayscale opacity-50'}`}>
                        {config.badge.icon || (isHighTier ? '👑' : '🏷️')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{config.name}</h4>
                          {isCurrentLevel && (
                            <Badge variant="default">Current</Badge>
                          )}
                          {isUnlocked && !isCurrentLevel && (
                            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                              Unlocked
                            </Badge>
                          )}
                          {isHighTier && !isUnlocked && (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                              Manual Approval Required
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{config.description}</p>
                      </div>
                    </div>
                    
                    <div className="text-right space-y-1">
                      <div className="text-sm font-medium">
                        ${config.limits.maxTotalListingValue.toLocaleString()} total
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ${config.limits.maxIndividualItemValue.toLocaleString()} per item
                      </div>
                      {config.limits.maxActiveListings && (
                        <div className="text-sm text-muted-foreground">
                          {config.limits.maxActiveListings} active max
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {level > 1 && (
                    <div className="mt-3 pt-3 border-t border-current/10">
                      <div className="text-sm text-muted-foreground">
                        <strong>Requirements:</strong>
                        <ul className="list-disc list-inside mt-1 space-y-0.5">
                          <li>{config.requirements.minCompletedSales} completed sales</li>
                          <li>≤{config.requirements.maxChargebackRate}% chargeback rate</li>
                          <li>{config.requirements.minAccountAge} days account age</li>
                          {config.requirements.minRating && (
                            <li>≥{config.requirements.minRating}★ average rating</li>
                          )}
                          {config.requirements.minReviewCount && (
                            <li>≥{config.requirements.minReviewCount} reviews</li>
                          )}
                          <li>No unresolved disputes</li>
                        </ul>
                        
                        {isHighTier && (
                          <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                              <strong>Special Requirements:</strong> {level === 4 
                                ? 'Requires Stripe Connect Standard Account, business verification, enhanced identity verification, and support ticket approval.'
                                : 'Reserved for storefronts and businesses. Requires Stripe Connect Standard Account and support ticket approval.'
                              }
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Benefits Information */}
      <Card>
        <CardHeader>
          <CardTitle>Why Seller Levels?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Our seller level system is designed to build trust and security in the marketplace while rewarding experienced sellers with increased privileges.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="font-semibold mb-2">🛡️ Enhanced Security</h5>
                <p className="text-sm text-muted-foreground">
                  Gradual limits help prevent fraud and protect both buyers and sellers from high-risk transactions.
                </p>
              </div>
              
              <div>
                <h5 className="font-semibold mb-2">⭐ Build Trust</h5>
                <p className="text-sm text-muted-foreground">
                  Higher levels demonstrate your reliability and experience to potential buyers.
                </p>
              </div>
              
              <div>
                <h5 className="font-semibold mb-2">📈 Grow Your Business</h5>
                <p className="text-sm text-muted-foreground">
                  Unlock higher listing limits as you prove your track record in the marketplace.
                </p>
              </div>
              
              <div>
                <h5 className="font-semibold mb-2">🏆 Recognition</h5>
                <p className="text-sm text-muted-foreground">
                  Your seller level badge is displayed on all your listings and profile.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SellerLevelDashboard;