export type SellerLevel = 1 | 2 | 3 | 4 | 5;

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
    name: 'Level 1 Seller',
    description: 'New sellers building their reputation',
    requirements: {
      minCompletedSales: 0,
      maxChargebackRate: 100, // No limit for level 1
      minAccountAge: 7,
      maxUnresolvedDisputes: 0
    },
    limits: {
      maxTotalListingValue: 1000
    },
    badge: {
      icon: '',
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/20'
    }
  },
  2: {
    level: 2,
    name: 'Level 2 Seller',
    description: 'Experienced sellers with proven track record',
    requirements: {
      minCompletedSales: 2,
      maxChargebackRate: 0,
      minAccountAge: 14,
      maxUnresolvedDisputes: 0
    },
    limits: {
      maxTotalListingValue: 2000
    },
    badge: {
      icon: '',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20'
    }
  },
  3: {
    level: 3,
    name: 'Level 3 Seller',
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
      maxTotalListingValue: 5000
    },
    badge: {
      icon: '',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20'
    }
  },
  4: {
    level: 4,
    name: 'Level 4 Seller',
    description: 'High-end sellers with established reputation or proven track record from other platforms',
    requirements: {
      minCompletedSales: 100,
      maxChargebackRate: 1,
      minRating: 4.5,
      minReviewCount: 50,
      minAccountAge: 180,
      maxUnresolvedDisputes: 0
    },
    limits: {
      maxTotalListingValue: 10000
    },
    badge: {
      icon: '',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/20'
    }
  },
  5: {
    level: 5,
    name: 'Level 5 Seller',
    description: 'Reserved for storefronts and businesses with exceptional performance',
    requirements: {
      minCompletedSales: 300,
      maxChargebackRate: 0.5,
      minRating: 4.7,
      minReviewCount: 150,
      minAccountAge: 365,
      maxUnresolvedDisputes: 0
    },
    limits: {
      maxTotalListingValue: 100000
    },
    badge: {
      icon: '',
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900/20'
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
  3: {
    minCompletedSales: 100,
    maxChargebackRate: 1,
    minRating: 4.5,
    minReviewCount: 50,
    minAccountAge: 180,
    maxUnresolvedDisputes: 0
  },
  4: {
    minCompletedSales: 300,
    maxChargebackRate: 0.5,
    minRating: 4.7,
    minReviewCount: 150,
    minAccountAge: 365,
    maxUnresolvedDisputes: 0
  },
  5: null // Max level
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
  // Note: Levels 4 and 5 require manual approval, so automatic calculation only goes up to level 3
  // Start from level 3 and work down
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
  if (currentLevel >= 5) return false; // Already at max level
  
  // Levels 4 and 5 require manual approval via support ticket
  if (currentLevel >= 3) return false;
  
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

// Check if user meets requirements for level 4 (requires manual approval)
export function meetsLevel4Requirements(data: {
  completedSales: number;
  chargebackRate: number;
  rating: number | null;
  reviewCount: number;
  accountAge: number;
  unresolvedDisputes: number;
}): boolean {
  const requirements = SELLER_LEVEL_CONFIG[4].requirements;
  
  return (
    data.completedSales >= requirements.minCompletedSales &&
    data.chargebackRate <= requirements.maxChargebackRate &&
    data.accountAge >= requirements.minAccountAge &&
    data.unresolvedDisputes <= requirements.maxUnresolvedDisputes &&
    (requirements.minRating === undefined || (data.rating !== null && data.rating >= requirements.minRating)) &&
    (requirements.minReviewCount === undefined || data.reviewCount >= requirements.minReviewCount)
  );
}

// Check if user meets requirements for level 5 (requires manual approval)
export function meetsLevel5Requirements(data: {
  completedSales: number;
  chargebackRate: number;
  rating: number | null;
  reviewCount: number;
  accountAge: number;
  unresolvedDisputes: number;
}): boolean {
  const requirements = SELLER_LEVEL_CONFIG[5].requirements;
  
  return (
    data.completedSales >= requirements.minCompletedSales &&
    data.chargebackRate <= requirements.maxChargebackRate &&
    data.accountAge >= requirements.minAccountAge &&
    data.unresolvedDisputes <= requirements.maxUnresolvedDisputes &&
    (requirements.minRating === undefined || (data.rating !== null && data.rating >= requirements.minRating)) &&
    (requirements.minReviewCount === undefined || data.reviewCount >= requirements.minReviewCount)
  );
}

// Get special requirements text for higher levels
export function getSpecialRequirementsText(level: SellerLevel): string | null {
  switch (level) {
    case 4:
      return 'Requires Stripe Connect Standard Account, business verification documentation, and enhanced identity verification. Established sellers or those with proven track records from other platforms can submit a support ticket to request level advancement.';
    case 5:
      return 'Reserved for storefronts and businesses. Requires Stripe Connect Standard Account and must submit a support ticket for manual approval.';
    default:
      return null;
  }
}