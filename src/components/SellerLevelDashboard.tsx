import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSellerLevel } from '@/hooks/useSellerLevel';
import { SellerLevelBadge, SellerLevelProgress } from '@/components/SellerLevelBadge';
import { SELLER_LEVEL_CONFIG, SellerLevel } from '@/types/seller-level';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TrendingUp, Shield, Star, Calendar, Award, ChevronDown, CreditCard, Info } from 'lucide-react';
import { useRouter } from 'next/router';

const SellerLevelDashboard = () => {
  const { sellerLevelData, isLoading, error } = useSellerLevel();
  const [isLevel1Open, setIsLevel1Open] = useState(false);
  const [isLevel2Open, setIsLevel2Open] = useState(false);
  const [isLevel3Open, setIsLevel3Open] = useState(false);
  const [isLevel4Open, setIsLevel4Open] = useState(false);
  const [isLevel5Open, setIsLevel5Open] = useState(false);
  const router = useRouter();

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
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Seller Level</h2>
        </div>

        <Alert>
          <CreditCard className="h-4 w-4" />
          <AlertTitle>No Seller Level Available</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>You don't have a seller level yet. To start selling and unlock seller levels, you need to set up a Stripe Connect account first.</p>
            <Button 
              onClick={() => router.push('/dashboard/seller-account?tab=setup')}
              className="w-full sm:w-auto"
            >
              Go to Account Setup
            </Button>
          </AlertDescription>
        </Alert>

        {/* Show seller level system overview for users without seller level */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Seller Level System Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <p className="text-muted-foreground">
                Our seller level system rewards experienced sellers with increased listing limits and privileges. Here's what you can unlock:
              </p>
              
              {/* Show all levels as preview */}
              {([1, 2, 3, 4, 5] as SellerLevel[]).map((level) => {
                const config = SELLER_LEVEL_CONFIG[level];
                
                return (
                  <div
                    key={level}
                    className="p-4 rounded-lg border border-muted bg-muted/30 opacity-75"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl grayscale opacity-50">
                          {config.badge.icon || '🏷️'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{config.name}</h4>
                          </div>
                          <p className="text-sm text-muted-foreground">{config.description}</p>
                        </div>
                      </div>
                      
                      <div className="text-right space-y-1">
                        <div className="text-sm font-medium">
                          {config.limits.maxTotalListingValue 
                            ? `$${config.limits.maxTotalListingValue.toLocaleString()} total`
                            : 'Unlimited'
                          }
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="space-y-2">
              <h4 className="font-semibold">What you can do at this level</h4>
              <p className="text-sm text-muted-foreground">
                You can create listings and accept offers. The total listing limit only controls Buy Now (Stripe) sales.
                When the combined value of your active Buy Now listings reaches this limit, the Buy Now button will be
                disabled on additional listings until you reduce the total. Offers and messaging are not affected.
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {sellerLevelData.currentLimits.maxTotalListingValue 
                  ? `$${sellerLevelData.currentLimits.maxTotalListingValue.toLocaleString()}`
                  : 'Unlimited'
                }
              </div>
              <div className="text-sm text-muted-foreground inline-flex items-center gap-1">
                Total Listing Limit
                <Info
                  className="h-3.5 w-3.5 text-muted-foreground"
                  title="Applies to Buy Now (Stripe) listings only. Offers and messaging are not restricted."
                />
              </div>
              {sellerLevelData.currentLimits.maxActiveListings && (
                <div className="mt-2">
                  <div className="text-2xl font-bold text-primary">{sellerLevelData.currentLimits.maxActiveListings}</div>
                  <div className="text-sm text-muted-foreground">Max Active Listings</div>
                </div>
              )}
            </div>
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
            {/* Levels 1, 2, 3 - Collapsible sections */}
            {/* Level 1 */}
            <div className={`relative w-full rounded-lg border text-sm p-3 transition-all ${
              sellerLevelData.level === 1 
                ? 'border-primary bg-primary/5' 
                : sellerLevelData.level > 1
                  ? 'border-muted bg-muted/20 opacity-60'
                  : 'border-muted bg-muted/30'
            }`}>
              <Collapsible open={isLevel1Open} onOpenChange={setIsLevel1Open}>
                <CollapsibleTrigger asChild>
                  <div className="cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded p-2 -m-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`text-2xl ${sellerLevelData.level >= 1 ? '' : 'grayscale opacity-50'}`}>
                          {SELLER_LEVEL_CONFIG[1].badge.icon || '🏷️'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{SELLER_LEVEL_CONFIG[1].name}</h4>
                            {sellerLevelData.level === 1 && (
                              <Badge variant="default">Current</Badge>
                            )}
                            {sellerLevelData.level > 1 && (
                              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                                Unlocked
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{SELLER_LEVEL_CONFIG[1].description}</p>
                        </div>
                      </div>
                      <div className="ml-auto w-32 sm:w-40 text-right space-y-1">
                        <div className="text-sm font-medium inline-flex items-center gap-1 justify-end">
                          {SELLER_LEVEL_CONFIG[1].limits.maxTotalListingValue 
                            ? `$${SELLER_LEVEL_CONFIG[1].limits.maxTotalListingValue.toLocaleString()} total`
                            : 'Unlimited'
                          }
                          <Info className="h-3.5 w-3.5 text-muted-foreground" title="Buy Now (Stripe) listings only; offers/messaging unaffected." />
                        </div>
                        {SELLER_LEVEL_CONFIG[1].limits.maxActiveListings && (
                          <div className="text-sm text-muted-foreground">
                            {SELLER_LEVEL_CONFIG[1].limits.maxActiveListings} active max
                          </div>
                        )}
                      </div>
                      <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180 ml-2" />
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 pt-3 border-t border-current/10">
                    <div className="text-sm text-muted-foreground">
                      <strong>Access & limits:</strong> The total listing limit only affects Buy Now (Stripe) purchases. Offers and messaging remain available.
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Level 2 */}
            <div className={`relative w-full rounded-lg border text-sm p-3 transition-all ${
              sellerLevelData.level === 2 
                ? 'border-primary bg-primary/5' 
                : sellerLevelData.level > 2
                  ? 'border-muted bg-muted/20 opacity-60'
                  : 'border-muted bg-muted/30'
            }`}>
              <Collapsible open={isLevel2Open} onOpenChange={setIsLevel2Open}>
                <CollapsibleTrigger asChild>
                  <div className="cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded p-2 -m-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`text-2xl ${sellerLevelData.level >= 2 ? '' : 'grayscale opacity-50'}`}>
                          {SELLER_LEVEL_CONFIG[2].badge.icon || '🏷️'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{SELLER_LEVEL_CONFIG[2].name}</h4>
                            {sellerLevelData.level === 2 && (
                              <Badge variant="default">Current</Badge>
                            )}
                            {sellerLevelData.level > 2 && (
                              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                                Unlocked
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{SELLER_LEVEL_CONFIG[2].description}</p>
                        </div>
                      </div>
                      <div className="ml-auto w-32 sm:w-40 text-right space-y-1">
                        <div className="text-sm font-medium inline-flex items-center gap-1 justify-end">
                          {SELLER_LEVEL_CONFIG[2].limits.maxTotalListingValue 
                            ? `$${SELLER_LEVEL_CONFIG[2].limits.maxTotalListingValue.toLocaleString()} total`
                            : 'Unlimited'
                          }
                          <Info className="h-3.5 w-3.5 text-muted-foreground" title="Buy Now (Stripe) listings only; offers/messaging unaffected." />
                        </div>
                        {SELLER_LEVEL_CONFIG[2].limits.maxActiveListings && (
                          <div className="text-sm text-muted-foreground">
                            {SELLER_LEVEL_CONFIG[2].limits.maxActiveListings} active max
                          </div>
                        )}
                      </div>
                      <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180 ml-2" />
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 pt-3 border-t border-current/10">
                    <div className="text-sm text-muted-foreground">
                      <strong>Requirements:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        <li>{SELLER_LEVEL_CONFIG[2].requirements.minCompletedSales} completed sales</li>
                        <li>≤{SELLER_LEVEL_CONFIG[2].requirements.maxChargebackRate}% chargeback rate</li>
                        <li>{SELLER_LEVEL_CONFIG[2].requirements.minAccountAge} days account age</li>
                        <li>No unresolved disputes</li>
                      </ul>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Level 3 */}
            <div className={`relative w-full rounded-lg border text-sm p-3 transition-all ${
              sellerLevelData.level === 3 
                ? 'border-primary bg-primary/5' 
                : sellerLevelData.level > 3
                  ? 'border-muted bg-muted/20 opacity-60'
                  : 'border-muted bg-muted/30'
            }`}>
              <Collapsible open={isLevel3Open} onOpenChange={setIsLevel3Open}>
                <CollapsibleTrigger asChild>
                  <div className="cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded p-2 -m-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`text-2xl ${sellerLevelData.level >= 3 ? '' : 'grayscale opacity-50'}`}>
                          {SELLER_LEVEL_CONFIG[3].badge.icon || '🏷️'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{SELLER_LEVEL_CONFIG[3].name}</h4>
                            {sellerLevelData.level === 3 && (
                              <Badge variant="default">Current</Badge>
                            )}
                            {sellerLevelData.level > 3 && (
                              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                                Unlocked
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{SELLER_LEVEL_CONFIG[3].description}</p>
                        </div>
                      </div>
                      <div className="ml-auto w-32 sm:w-40 text-right space-y-1">
                        <div className="text-sm font-medium inline-flex items-center gap-1 justify-end">
                          {SELLER_LEVEL_CONFIG[3].limits.maxTotalListingValue 
                            ? `$${SELLER_LEVEL_CONFIG[3].limits.maxTotalListingValue.toLocaleString()} total`
                            : 'Unlimited'
                          }
                          <Info className="h-3.5 w-3.5 text-muted-foreground" title="Buy Now (Stripe) listings only; offers/messaging unaffected." />
                        </div>
                        {SELLER_LEVEL_CONFIG[3].limits.maxActiveListings && (
                          <div className="text-sm text-muted-foreground">
                            {SELLER_LEVEL_CONFIG[3].limits.maxActiveListings} active max
                          </div>
                        )}
                      </div>
                      <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180 ml-2" />
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 pt-3 border-t border-current/10">
                    <div className="text-sm text-muted-foreground">
                      <strong>Requirements:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        <li>{SELLER_LEVEL_CONFIG[3].requirements.minCompletedSales} completed sales</li>
                        <li>≤{SELLER_LEVEL_CONFIG[3].requirements.maxChargebackRate}% chargeback rate</li>
                        <li>{SELLER_LEVEL_CONFIG[3].requirements.minAccountAge} days account age</li>
                        {SELLER_LEVEL_CONFIG[3].requirements.minRating && (
                          <li>≥{SELLER_LEVEL_CONFIG[3].requirements.minRating}★ average rating</li>
                        )}
                        {SELLER_LEVEL_CONFIG[3].requirements.minReviewCount && (
                          <li>≥{SELLER_LEVEL_CONFIG[3].requirements.minReviewCount} reviews</li>
                        )}
                        <li>No unresolved disputes</li>
                      </ul>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Level 4 - Collapsible */}
            <div className={`relative w-full rounded-lg border text-sm p-3 transition-all ${
              sellerLevelData.level === 4 
                ? 'border-primary bg-primary/5' 
                : sellerLevelData.level > 4
                  ? 'border-muted bg-muted/20 opacity-60'
                  : 'border-muted bg-muted/30'
            }`}>
              <Collapsible open={isLevel4Open} onOpenChange={setIsLevel4Open}>
                <CollapsibleTrigger asChild>
                  <div className="cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded p-2 -m-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`text-2xl ${sellerLevelData.level >= 4 ? '' : 'grayscale opacity-50'}`}>
                          {SELLER_LEVEL_CONFIG[4].badge.icon || '👑'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{SELLER_LEVEL_CONFIG[4].name}</h4>
                            {sellerLevelData.level === 4 && (
                              <Badge variant="default">Current</Badge>
                            )}
                            {sellerLevelData.level > 4 && (
                              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                                Unlocked
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-muted-foreground">{SELLER_LEVEL_CONFIG[4].description}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="ml-auto w-32 sm:w-40 text-right space-y-1">
                        <div className="text-sm font-medium inline-flex items-center gap-1 justify-end">
                          {SELLER_LEVEL_CONFIG[4].limits.maxTotalListingValue 
                            ? `$${SELLER_LEVEL_CONFIG[4].limits.maxTotalListingValue.toLocaleString()} total`
                            : 'Unlimited'
                          }
                          <Info className="h-3.5 w-3.5 text-muted-foreground" title="Buy Now (Stripe) listings only; offers/messaging unaffected." />
                        </div>
                      </div>
                      
                      <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180 ml-2" />
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 pt-3 border-t border-current/10">
                    <div className="text-sm text-muted-foreground">
                      <strong>Requirements:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        <li>{SELLER_LEVEL_CONFIG[4].requirements.minCompletedSales} completed sales</li>
                        <li>≤{SELLER_LEVEL_CONFIG[4].requirements.maxChargebackRate}% chargeback rate</li>
                        <li>{SELLER_LEVEL_CONFIG[4].requirements.minAccountAge} days account age</li>
                        <li>≥{SELLER_LEVEL_CONFIG[4].requirements.minRating}★ average rating</li>
                        <li>≥{SELLER_LEVEL_CONFIG[4].requirements.minReviewCount} reviews</li>
                        <li>No unresolved disputes</li>
                      </ul>
                      
                      <div className="mt-3 p-3 bg-muted/50 rounded border border-muted">
                        <p className="text-xs text-muted-foreground">
                          <strong>Special Requirements:</strong> Requires Stripe Connect Standard Account, business verification, enhanced identity verification, and support ticket approval. Established sellers or those with proven track records from other platforms can submit a support ticket to request level advancement.
                        </p>
                      </div>

                      {sellerLevelData.level < 4 && (
                        <div className="mt-3 pt-3 border-t border-current/10">
                          <button 
                            onClick={() => window.open('/support', '_blank')}
                            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
                          >
                            Contact Support for Level 4 Upgrade Request
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Level 5 - Collapsible */}
            <div className={`relative w-full rounded-lg border text-sm p-3 transition-all ${
              sellerLevelData.level === 5 
                ? 'border-primary bg-primary/5' 
                : 'border-muted bg-muted/30'
            }`}>
              <Collapsible open={isLevel5Open} onOpenChange={setIsLevel5Open}>
                <CollapsibleTrigger asChild>
                  <div className="cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded p-2 -m-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`text-2xl ${sellerLevelData.level >= 5 ? '' : 'grayscale opacity-50'}`}>
                          {SELLER_LEVEL_CONFIG[5].badge.icon || '🏆'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{SELLER_LEVEL_CONFIG[5].name}</h4>
                            {sellerLevelData.level === 5 && (
                              <Badge variant="default">Current</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-muted-foreground">{SELLER_LEVEL_CONFIG[5].description}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="ml-auto w-32 sm:w-40 text-right space-y-1">
                        <div className="text-sm font-medium inline-flex items-center gap-1 justify-end">
                          {SELLER_LEVEL_CONFIG[5].limits.maxTotalListingValue 
                            ? `$${SELLER_LEVEL_CONFIG[5].limits.maxTotalListingValue.toLocaleString()} total`
                            : 'Unlimited'
                          }
                          <Info className="h-3.5 w-3.5 text-muted-foreground" title="Buy Now (Stripe) listings only; offers/messaging unaffected." />
                        </div>
                      </div>
                      
                      <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180 ml-2" />
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 pt-3 border-t border-current/10">
                    <div className="text-sm text-muted-foreground">
                      <strong>Requirements:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        <li>{SELLER_LEVEL_CONFIG[5].requirements.minCompletedSales} completed sales</li>
                        <li>≤{SELLER_LEVEL_CONFIG[5].requirements.maxChargebackRate}% chargeback rate</li>
                        <li>{SELLER_LEVEL_CONFIG[5].requirements.minAccountAge} days account age</li>
                        <li>≥{SELLER_LEVEL_CONFIG[5].requirements.minRating}★ average rating</li>
                        <li>≥{SELLER_LEVEL_CONFIG[5].requirements.minReviewCount} reviews</li>
                        <li>No unresolved disputes</li>
                      </ul>
                      
                      <div className="mt-3 p-3 bg-muted/50 rounded border border-muted">
                        <p className="text-xs text-muted-foreground">
                          <strong>Special Requirements:</strong> Reserved for storefronts and businesses. Requires Stripe Connect Standard Account and support ticket approval for manual advancement.
                        </p>
                      </div>

                      {sellerLevelData.level < 5 && (
                        <div className="mt-3 pt-3 border-t border-current/10">
                          <button 
                            onClick={() => window.open('/support', '_blank')}
                            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
                          >
                            Contact Support for Level 5 Upgrade Request
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
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