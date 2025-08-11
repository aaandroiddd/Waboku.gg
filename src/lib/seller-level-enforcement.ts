import { 
  SellerLevel, 
  SellerLevelData, 
  SELLER_LEVEL_CONFIG, 
  calculateSellerLevel,
  meetsLevel4Requirements,
  meetsLevel5Requirements
} from '@/types/seller-level';

export interface SellerStats {
  completedSales: number;
  chargebackRate: number;
  rating: number | null;
  reviewCount: number;
  accountAge: number;
  unresolvedDisputes: number;
}

/**
 * Enforces seller level requirements and returns the appropriate level
 * This function ensures that users can only maintain levels they qualify for
 */
export function enforceSellerLevelRequirements(
  currentLevel: SellerLevel,
  stats: SellerStats,
  manuallySet?: boolean
): SellerLevel {
  // If the level was manually set by admin/moderator, allow it to persist
  // but only for levels 4 and 5 which require manual approval
  if (manuallySet && (currentLevel === 4 || currentLevel === 5)) {
    // Still check if they meet the requirements for these levels
    if (currentLevel === 4 && meetsLevel4Requirements(stats)) {
      return 4;
    }
    if (currentLevel === 5 && meetsLevel5Requirements(stats)) {
      return 5;
    }
    // If they don't meet requirements anymore, demote them
  }

  // Calculate the level they actually qualify for based on stats
  const qualifiedLevel = calculateSellerLevel(stats);

  // For levels 1-3, always use the calculated level
  if (qualifiedLevel <= 3) {
    return qualifiedLevel;
  }

  // For levels 4-5, they need manual approval AND must meet requirements
  // If they were manually set to 4 or 5 but no longer meet requirements, demote them
  if (currentLevel >= 4) {
    if (currentLevel === 4 && !meetsLevel4Requirements(stats)) {
      return Math.min(qualifiedLevel, 3); // Demote to max level 3
    }
    if (currentLevel === 5 && !meetsLevel5Requirements(stats)) {
      return Math.min(qualifiedLevel, 3); // Demote to max level 3
    }
    // If they still meet requirements, keep their current level
    return currentLevel;
  }

  return qualifiedLevel;
}

/**
 * Validates if a user meets all requirements for a specific seller level
 */
export function validateSellerLevelRequirements(
  targetLevel: SellerLevel,
  stats: SellerStats
): { valid: boolean; failedRequirements: string[] } {
  const config = SELLER_LEVEL_CONFIG[targetLevel];
  const requirements = config.requirements;
  const failedRequirements: string[] = [];

  // Check completed sales
  if (stats.completedSales < requirements.minCompletedSales) {
    failedRequirements.push(
      `Completed sales: ${stats.completedSales} (required: ${requirements.minCompletedSales})`
    );
  }

  // Check chargeback rate
  if (stats.chargebackRate > requirements.maxChargebackRate) {
    failedRequirements.push(
      `Chargeback rate: ${stats.chargebackRate}% (max allowed: ${requirements.maxChargebackRate}%)`
    );
  }

  // Check account age
  if (stats.accountAge < requirements.minAccountAge) {
    failedRequirements.push(
      `Account age: ${stats.accountAge} days (required: ${requirements.minAccountAge} days)`
    );
  }

  // Check unresolved disputes
  if (stats.unresolvedDisputes > requirements.maxUnresolvedDisputes) {
    failedRequirements.push(
      `Unresolved disputes: ${stats.unresolvedDisputes} (max allowed: ${requirements.maxUnresolvedDisputes})`
    );
  }

  // Check rating (if required)
  if (requirements.minRating !== undefined) {
    if (stats.rating === null || stats.rating < requirements.minRating) {
      failedRequirements.push(
        `Average rating: ${stats.rating || 'N/A'} (required: ${requirements.minRating})`
      );
    }
  }

  // Check review count (if required)
  if (requirements.minReviewCount !== undefined) {
    if (stats.reviewCount < requirements.minReviewCount) {
      failedRequirements.push(
        `Review count: ${stats.reviewCount} (required: ${requirements.minReviewCount})`
      );
    }
  }

  return {
    valid: failedRequirements.length === 0,
    failedRequirements
  };
}

/**
 * Gets a detailed breakdown of requirements for a specific level
 */
export function getSellerLevelRequirementsBreakdown(
  level: SellerLevel,
  stats: SellerStats
): Array<{
  requirement: string;
  current: string | number;
  required: string | number;
  met: boolean;
}> {
  const config = SELLER_LEVEL_CONFIG[level];
  const requirements = config.requirements;
  const breakdown = [];

  // Completed sales
  breakdown.push({
    requirement: 'Completed Sales',
    current: stats.completedSales,
    required: requirements.minCompletedSales,
    met: stats.completedSales >= requirements.minCompletedSales
  });

  // Chargeback rate
  breakdown.push({
    requirement: 'Chargeback Rate',
    current: `${stats.chargebackRate}%`,
    required: `≤${requirements.maxChargebackRate}%`,
    met: stats.chargebackRate <= requirements.maxChargebackRate
  });

  // Account age
  breakdown.push({
    requirement: 'Account Age',
    current: `${stats.accountAge} days`,
    required: `${requirements.minAccountAge} days`,
    met: stats.accountAge >= requirements.minAccountAge
  });

  // Unresolved disputes
  breakdown.push({
    requirement: 'Unresolved Disputes',
    current: stats.unresolvedDisputes,
    required: `≤${requirements.maxUnresolvedDisputes}`,
    met: stats.unresolvedDisputes <= requirements.maxUnresolvedDisputes
  });

  // Rating (if required)
  if (requirements.minRating !== undefined) {
    breakdown.push({
      requirement: 'Average Rating',
      current: stats.rating ? `${stats.rating.toFixed(1)}★` : 'No rating',
      required: `≥${requirements.minRating}★`,
      met: stats.rating !== null && stats.rating >= requirements.minRating
    });
  }

  // Review count (if required)
  if (requirements.minReviewCount !== undefined) {
    breakdown.push({
      requirement: 'Review Count',
      current: stats.reviewCount,
      required: requirements.minReviewCount,
      met: stats.reviewCount >= requirements.minReviewCount
    });
  }

  return breakdown;
}

/**
 * Determines if a user should be automatically demoted from their current level
 */
export function shouldDemoteSellerLevel(
  currentLevel: SellerLevel,
  stats: SellerStats,
  manuallySet?: boolean
): { shouldDemote: boolean; newLevel: SellerLevel; reason: string } {
  // Don't demote if they're at level 1 (minimum level)
  if (currentLevel === 1) {
    return { shouldDemote: false, newLevel: currentLevel, reason: '' };
  }

  const validation = validateSellerLevelRequirements(currentLevel, stats);
  
  if (!validation.valid) {
    const newLevel = enforceSellerLevelRequirements(currentLevel, stats, manuallySet);
    
    if (newLevel < currentLevel) {
      return {
        shouldDemote: true,
        newLevel,
        reason: `No longer meets requirements: ${validation.failedRequirements.join(', ')}`
      };
    }
  }

  return { shouldDemote: false, newLevel: currentLevel, reason: '' };
}