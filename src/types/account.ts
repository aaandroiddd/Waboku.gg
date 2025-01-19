export type AccountTier = 'free' | 'premium';

export interface AccountLimits {
  maxActiveListings: number;
  listingDuration: number; // in hours
  hasAdvancedSearch: boolean;
  hasPriorityMessaging: boolean;
  hasBulkListingTools: boolean;
  hasPriceHistory: boolean;
  hasAds: boolean;
}

export interface SubscriptionDetails {
  startDate?: string;
  endDate?: string;
  renewalDate?: string;
  status: 'active' | 'canceled' | 'none';
  stripeSubscriptionId?: string;
}

export interface AccountFeatures extends AccountLimits {
  tier: AccountTier;
  displayName: string;
  badge?: string;
}

export const ACCOUNT_TIERS: Record<AccountTier, AccountFeatures> = {
  free: {
    tier: 'free',
    displayName: 'Free Account',
    maxActiveListings: 2,
    listingDuration: 48,
    hasAdvancedSearch: false,
    hasPriorityMessaging: false,
    hasBulkListingTools: false,
    hasPriceHistory: false,
    hasAds: true
  },
  premium: {
    tier: 'premium',
    displayName: 'Premium Account',
    badge: '⭐',
    maxActiveListings: Infinity,
    listingDuration: 720, // 30 days in hours
    hasAdvancedSearch: true,
    hasPriorityMessaging: true,
    hasBulkListingTools: true,
    hasPriceHistory: true,
    hasAds: false
  }
};