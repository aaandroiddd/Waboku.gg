import React from 'react';
import { Badge } from '@/components/ui/badge';
import { BadgeTooltip } from '@/components/BadgeTooltip';
import { 
  SELLER_LEVEL_CONFIG, 
  SellerLevel, 
  SellerBadgeInfo, 
  getTenureBadge,
  meetsLevel4Requirements,
  meetsLevel5Requirements,
  getSpecialRequirementsText
} from '@/types/seller-level';
import { cn } from '@/lib/utils';

interface SellerLevelBadgeProps {
  level: SellerLevel;
  salesCount: number;
  rating: number | null;
  reviewCount: number;
  accountAge: number;
  className?: string;
  showAllBadges?: boolean;
  compact?: boolean;
}

export function SellerLevelBadge({
  level,
  salesCount,
  rating,
  reviewCount,
  accountAge,
  className,
  showAllBadges = true,
  compact = false
}: SellerLevelBadgeProps) {
  const config = SELLER_LEVEL_CONFIG[level];
  const tenureBadge = getTenureBadge(accountAge);

  if (compact) {
    return (
      <BadgeTooltip 
        content={`${config.name} - ${salesCount} sales completed${rating ? `, ${rating.toFixed(1)}★ rating` : ''}`}
      >
        <Badge 
          variant="secondary"
          className={cn(
            config.badge.bgColor,
            config.badge.color,
            "border-current/20 inline-flex items-center text-xs",
            className
          )}
        >
          <span className="truncate">{config.name}</span>
        </Badge>
      </BadgeTooltip>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {/* Level Badge */}
      <BadgeTooltip 
        content={`${config.name}: ${config.description}`}
      >
        <Badge 
          variant="secondary"
          className={cn(
            config.badge.bgColor,
            config.badge.color,
            "border-current/20 inline-flex items-center text-xs font-medium"
          )}
        >
          <span className="truncate">{config.name}</span>
        </Badge>
      </BadgeTooltip>

      {showAllBadges && (
        <>
          {/* Sales Counter Badge */}
          {salesCount > 0 && (
            <BadgeTooltip content={`${salesCount} successful sales completed`}>
              <Badge 
                variant="outline"
                className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 inline-flex items-center text-xs"
              >
                <span className="mr-1">📦</span>
                <span className="truncate">{salesCount} Sales</span>
              </Badge>
            </BadgeTooltip>
          )}

          {/* Rating Badge */}
          {rating !== null && reviewCount > 0 && (
            <BadgeTooltip content={`${rating.toFixed(1)} star average rating from ${reviewCount} reviews`}>
              <Badge 
                variant="outline"
                className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 inline-flex items-center text-xs"
              >
                <span className="mr-1">⭐</span>
                <span className="truncate">{rating.toFixed(1)} ({reviewCount})</span>
              </Badge>
            </BadgeTooltip>
          )}

          {/* Tenure Badge */}
          {tenureBadge && (
            <BadgeTooltip content={`Member for ${tenureBadge.text.toLowerCase()}`}>
              <Badge 
                variant="outline"
                className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 inline-flex items-center text-xs"
              >
                <span className="mr-1">{tenureBadge.icon}</span>
                <span className="truncate">{tenureBadge.text}</span>
              </Badge>
            </BadgeTooltip>
          )}
        </>
      )}
    </div>
  );
}

interface SellerLevelProgressProps {
  currentLevel: SellerLevel;
  completedSales: number;
  rating: number | null;
  reviewCount: number;
  accountAge: number;
  chargebackRate: number;
  unresolvedDisputes: number;
  canAdvance: boolean;
  nextLevelRequirements?: any;
  className?: string;
}

export function SellerLevelProgress({
  currentLevel,
  completedSales,
  rating,
  reviewCount,
  accountAge,
  chargebackRate,
  unresolvedDisputes,
  canAdvance,
  nextLevelRequirements,
  className
}: SellerLevelProgressProps) {
  const currentConfig = SELLER_LEVEL_CONFIG[currentLevel];
  const sellerData = {
    completedSales,
    chargebackRate,
    rating,
    reviewCount,
    accountAge,
    unresolvedDisputes
  };
  
  // Handle max level (Level 5)
  if (currentLevel >= 5) {
    return (
      <div className={cn("p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800", className)}>
        <div className="flex items-center gap-2 mb-2">
          <div>
            <h3 className="font-semibold text-amber-700 dark:text-amber-400">
              {currentConfig.name}
            </h3>
            <p className="text-sm text-amber-600 dark:text-amber-500">
              Maximum seller level achieved!
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          You've reached the highest seller level. Keep maintaining your excellent performance!
        </p>
      </div>
    );
  }

  // Handle Level 3 - show eligibility for Level 4
  if (currentLevel === 3) {
    const meetsLevel4Reqs = meetsLevel4Requirements(sellerData);
    const level4Config = SELLER_LEVEL_CONFIG[4];
    const level4Requirements = level4Config.requirements;
    const specialRequirements = getSpecialRequirementsText(4);

    const requirements = [
      {
        label: 'Completed Sales',
        current: completedSales,
        required: level4Requirements.minCompletedSales,
        met: completedSales >= level4Requirements.minCompletedSales
      },
      {
        label: 'Account Age',
        current: `${accountAge} days`,
        required: `${level4Requirements.minAccountAge} days`,
        met: accountAge >= level4Requirements.minAccountAge
      },
      {
        label: 'Chargeback Rate',
        current: `${chargebackRate.toFixed(1)}%`,
        required: `≤${level4Requirements.maxChargebackRate}%`,
        met: chargebackRate <= level4Requirements.maxChargebackRate
      },
      {
        label: 'Average Rating',
        current: rating ? `${rating.toFixed(1)}★` : 'No ratings',
        required: `≥${level4Requirements.minRating}★`,
        met: rating !== null && rating >= level4Requirements.minRating!
      },
      {
        label: 'Review Count',
        current: reviewCount,
        required: `≥${level4Requirements.minReviewCount}`,
        met: reviewCount >= level4Requirements.minReviewCount!
      }
    ];

    return (
      <div className={cn("p-4 bg-muted/50 rounded-lg border", className)}>
        <div className="flex items-center gap-2 mb-3">
          <div>
            <h3 className="font-semibold">
              Eligibility for {level4Config.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {level4Config.description}
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-3">
          {requirements.map((req, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{req.label}:</span>
              <div className="flex items-center gap-2">
                <span className={req.met ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                  {req.current} / {req.required}
                </span>
                {req.met ? (
                  <span className="text-green-600 dark:text-green-400">✓</span>
                ) : (
                  <span className="text-muted-foreground">○</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {specialRequirements && (
          <div className="mb-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-200 dark:border-orange-800">
            <p className="text-sm text-orange-700 dark:text-orange-400">
              <strong>Special Requirements:</strong> {specialRequirements}
            </p>
          </div>
        )}

        {meetsLevel4Reqs && (
          <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-700 dark:text-green-400 font-medium">
              🎉 You meet the requirements for {level4Config.name}! Submit a support ticket to request level advancement.
            </p>
          </div>
        )}
      </div>
    );
  }

  // Handle Level 4 - show eligibility for Level 5
  if (currentLevel === 4) {
    const meetsLevel5Reqs = meetsLevel5Requirements(sellerData);
    const level5Config = SELLER_LEVEL_CONFIG[5];
    const level5Requirements = level5Config.requirements;
    const specialRequirements = getSpecialRequirementsText(5);

    const requirements = [
      {
        label: 'Completed Sales',
        current: completedSales,
        required: level5Requirements.minCompletedSales,
        met: completedSales >= level5Requirements.minCompletedSales
      },
      {
        label: 'Account Age',
        current: `${accountAge} days`,
        required: `${level5Requirements.minAccountAge} days`,
        met: accountAge >= level5Requirements.minAccountAge
      },
      {
        label: 'Chargeback Rate',
        current: `${chargebackRate.toFixed(1)}%`,
        required: `≤${level5Requirements.maxChargebackRate}%`,
        met: chargebackRate <= level5Requirements.maxChargebackRate
      },
      {
        label: 'Average Rating',
        current: rating ? `${rating.toFixed(1)}★` : 'No ratings',
        required: `≥${level5Requirements.minRating}★`,
        met: rating !== null && rating >= level5Requirements.minRating!
      },
      {
        label: 'Review Count',
        current: reviewCount,
        required: `≥${level5Requirements.minReviewCount}`,
        met: reviewCount >= level5Requirements.minReviewCount!
      }
    ];

    return (
      <div className={cn("p-4 bg-muted/50 rounded-lg border", className)}>
        <div className="flex items-center gap-2 mb-3">
          <div>
            <h3 className="font-semibold">
              Eligibility for {level5Config.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {level5Config.description}
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-3">
          {requirements.map((req, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{req.label}:</span>
              <div className="flex items-center gap-2">
                <span className={req.met ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                  {req.current} / {req.required}
                </span>
                {req.met ? (
                  <span className="text-green-600 dark:text-green-400">✓</span>
                ) : (
                  <span className="text-muted-foreground">○</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {specialRequirements && (
          <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              <strong>Special Requirements:</strong> {specialRequirements}
            </p>
          </div>
        )}

        {meetsLevel5Reqs && (
          <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-700 dark:text-green-400 font-medium">
              🎉 You meet the requirements for {level5Config.name}! Submit a support ticket to request level advancement.
            </p>
          </div>
        )}
      </div>
    );
  }

  // Handle Levels 1 and 2 - normal progression
  if (!nextLevelRequirements) return null;

  const nextLevel = (currentLevel + 1) as SellerLevel;
  const nextConfig = SELLER_LEVEL_CONFIG[nextLevel];

  const requirements = [
    {
      label: 'Completed Sales',
      current: completedSales,
      required: nextLevelRequirements.minCompletedSales,
      met: completedSales >= nextLevelRequirements.minCompletedSales
    },
    {
      label: 'Account Age',
      current: `${accountAge} days`,
      required: `${nextLevelRequirements.minAccountAge} days`,
      met: accountAge >= nextLevelRequirements.minAccountAge
    },
    {
      label: 'Chargeback Rate',
      current: `${chargebackRate.toFixed(1)}%`,
      required: `≤${nextLevelRequirements.maxChargebackRate}%`,
      met: chargebackRate <= nextLevelRequirements.maxChargebackRate
    },
    {
      label: 'Unresolved Disputes',
      current: unresolvedDisputes,
      required: `≤${nextLevelRequirements.maxUnresolvedDisputes}`,
      met: unresolvedDisputes <= nextLevelRequirements.maxUnresolvedDisputes
    }
  ];

  // Add rating requirement if it exists
  if (nextLevelRequirements.minRating) {
    requirements.push({
      label: 'Average Rating',
      current: rating ? `${rating.toFixed(1)}★` : 'No ratings',
      required: `≥${nextLevelRequirements.minRating}★`,
      met: rating !== null && rating >= nextLevelRequirements.minRating
    });
  }

  // Add review count requirement if it exists
  if (nextLevelRequirements.minReviewCount) {
    requirements.push({
      label: 'Review Count',
      current: reviewCount,
      required: `≥${nextLevelRequirements.minReviewCount}`,
      met: reviewCount >= nextLevelRequirements.minReviewCount
    });
  }

  return (
    <div className={cn("p-4 bg-muted/50 rounded-lg border", className)}>
      <div className="flex items-center gap-2 mb-3">
        <div>
          <h3 className="font-semibold">
            Progress to {nextConfig.name}
          </h3>
          <p className="text-sm text-muted-foreground">
            {nextConfig.description}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {requirements.map((req, index) => (
          <div key={index} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{req.label}:</span>
            <div className="flex items-center gap-2">
              <span className={req.met ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                {req.current} / {req.required}
              </span>
              {req.met ? (
                <span className="text-green-600 dark:text-green-400">✓</span>
              ) : (
                <span className="text-muted-foreground">○</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {canAdvance && (
        <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
          <p className="text-sm text-green-700 dark:text-green-400 font-medium">
            🎉 Congratulations! You're eligible for {nextConfig.name}
          </p>
        </div>
      )}
    </div>
  );
}