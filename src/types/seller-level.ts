export type SellerLevel = 1 | 2 | 3;

export interface SellerLevelRequirements {
  minCompletedSales: number;
  maxChargebackRate: number; // as percentage (e.g., 2 for 2%)
  minRating?: number;
  minReviewCount?: number;
  minAccountAge: number; // in days
  maxUnresolvedDisputes: number;
}

export interface SellerLevelLimits {
  maxTotalListingValue: number; // in dollars
  maxIndividualItemValue: number; // in dollars
  maxActiveListings?: number;
}

export interface SellerLevelData {
  level: SellerLevel;
  completedSales: number;
  chargebackRate: number;
  rating: number | null;
  reviewCount: number;
  accountAge: number; // in days
  unresolvedDisputes: number;
  lastLevelCheck: Date;
  canAdvance: boolean;
  nextLevelRequirements?: SellerLevelRequirements;
  currentLimits: SellerLevelLimits;
}

export interface SellerLevelConfig {
  level: SellerLevel;
  name: string;
  description: string;
  requirements: SellerLevelRequirements;
  limits: SellerLevelLimits;
  badge: {
    icon: string;
    color: string;
    bgColor: string;
  };
}

// Seller level configuration
export const SELLER_LEVEL_CONFIG: Record<SellerLevel, SellerLevelConfig> = {
  1: {
    level: 1,
    name: 'Level 1',
    description: 'New sellers building their reputation',
    requirements: {
      minCompletedSales: 0,
      maxChargebackRate: 100, // No limit for level 1
      minAccountAge: 7,
      maxUnresolvedDisputes: 0
    },
    limits: {
      maxTotalListingValue: 1000,
      maxIndividualItemValue: 200
    },
    badge: {
      icon: '1️⃣',
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/20'
    }
  },
  2: {
    level: 2,
    name: 'Level 2',
    description: 'Experienced sellers with proven track record',
    requirements: {
      minCompletedSales: 2,
      maxChargebackRate: 0,
      minAccountAge: 14,
      maxUnresolvedDisputes: 0
    },
    limits: {
      maxTotalListingValue: 2000,
      maxIndividualItemValue: 400
    },
    badge: {
      icon: '2️⃣',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20'
    }
  },
  3: {
    level: 3,
    name: 'Level 3',
    description: 'Top-tier sellers with excellent reputation',
    requirements: {
      minCompletedSales: 10,
      maxChargebackRate: 2,
      minRating: 4.0,
      minReviewCount: 3,
      minAccountAge: 60,
      maxUnresolvedDisputes: 0
    },
    limits: {
      maxTotalListingValue: 5000,
      maxIndividualItemValue: 1000,
      maxActiveListings: 50
    },
    badge: {
      icon: '3️⃣',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20'
    }
  }
};

// Requirements to advance to next level
export const LEVEL_ADVANCEMENT_REQUIREMENTS: Record<SellerLevel, SellerLevelRequirements | null> = {
  1: {
    minCompletedSales: 2,
    maxChargebackRate: 0,
    minAccountAge: 14,
    maxUnresolvedDisputes: 0
  },
  2: {
    minCompletedSales: 10,
    maxChargebackRate: 2,
    minRating: 4.0,
    minReviewCount: 3,
    minAccountAge: 60,
    maxUnresolvedDisputes: 0
  },
  3: null // Max level
};

export interface SellerBadgeInfo {
  level: SellerLevel;
  salesCount: number;
  rating: number | null;
  reviewCount: number;
  accountAge: number; // in days
  joinDate: Date;
}

// Helper functions
export function calculateSellerLevel(data: {
  completedSales: number;
  chargebackRate: number;
  rating: number | null;
  reviewCount: number;
  accountAge: number;
  unresolvedDisputes: number;
}): SellerLevel {
  // Start from highest level and work down
  for (let level = 3; level >= 1; level--) {
    const config = SELLER_LEVEL_CONFIG[level as SellerLevel];
    const requirements = config.requirements;
    
    // Check if user meets all requirements for this level
    if (
      data.completedSales >= requirements.minCompletedSales &&
      data.chargebackRate <= requirements.maxChargebackRate &&
      data.accountAge >= requirements.minAccountAge &&
      data.unresolvedDisputes <= requirements.maxUnresolvedDisputes &&
      (requirements.minRating === undefined || (data.rating !== null && data.rating >= requirements.minRating)) &&
      (requirements.minReviewCount === undefined || data.reviewCount >= requirements.minReviewCount)
    ) {
      return level as SellerLevel;
    }
  }
  
  return 1; // Default to level 1
}

export function canAdvanceToNextLevel(currentLevel: SellerLevel, data: {
  completedSales: number;
  chargebackRate: number;
  rating: number | null;
  reviewCount: number;
  accountAge: number;
  unresolvedDisputes: number;
}): boolean {
  if (currentLevel >= 3) return false; // Already at max level
  
  const nextLevel = (currentLevel + 1) as SellerLevel;
  const requirements = SELLER_LEVEL_CONFIG[nextLevel].requirements;
  
  return (
    data.completedSales >= requirements.minCompletedSales &&
    data.chargebackRate <= requirements.maxChargebackRate &&
    data.accountAge >= requirements.minAccountAge &&
    data.unresolvedDisputes <= requirements.maxUnresolvedDisputes &&
    (requirements.minRating === undefined || (data.rating !== null && data.rating >= requirements.minRating)) &&
    (requirements.minReviewCount === undefined || data.reviewCount >= requirements.minReviewCount)
  );
}

export function getNextLevelRequirements(currentLevel: SellerLevel): SellerLevelRequirements | null {
  return LEVEL_ADVANCEMENT_REQUIREMENTS[currentLevel];
}

export function getTenureBadge(accountAge: number): { text: string; icon: string } | null {
  if (accountAge >= 365) {
    const years = Math.floor(accountAge / 365);
    return {
      text: `${years} Year${years > 1 ? 's' : ''}`,
      icon: '🏆'
    };
  } else if (accountAge >= 180) {
    return {
      text: '6+ Months',
      icon: '📅'
    };
  } else if (accountAge >= 90) {
    return {
      text: '3+ Months',
      icon: '📆'
    };
  } else if (accountAge >= 30) {
    return {
      text: '1+ Month',
      icon: '🗓️'
    };
  }
  
  return null;
}