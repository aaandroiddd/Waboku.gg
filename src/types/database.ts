export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  condition: string;
  game: string;
  imageUrls: string[];
  userId: string;
  username: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'active' | 'sold' | 'pending' | 'inactive' | 'archived';
  archivedAt?: Date | null;
  soldTo?: string | null;
  isGraded: boolean;
  gradeLevel?: number;
  gradingCompany?: string;
  city: string;
  state: string;
  favoriteCount?: number;
  viewCount?: number;
  cardName?: string;
  quantity?: number;
  latitude?: number;
  longitude?: number;
  distance?: number;
  offersOnly?: boolean;
  finalSale?: boolean;
  minOfferAmount?: number;
  showOffers?: boolean;
  language?: string;
  shippingCost?: number;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  needsReview?: boolean;
  reviewReason?: string;
  reviewCategory?: string;
  moderationStatus?: 'pending' | 'approved' | 'rejected';
  moderatedAt?: Date;
  hasBeenReviewed?: boolean;
  moderationDetails?: {
    moderatorId?: string;
    actionTaken?: string;
    timestamp?: Date;
    notes?: string;
    rejectionReason?: string;
    originalReviewReason?: string;
  };
}

export interface CreateListingData {
  title: string;
  description: string;
  price: string;
  condition: string;
  game: string;
  images: File[];
  isGraded: boolean;
  gradeLevel?: number;
  gradingCompany?: string;
  city: string;
  state: string;
  offersOnly?: boolean;
  finalSale?: boolean;
  minOfferAmount?: string;
  showOffers?: boolean;
  language?: string;
  shippingCost?: string;
}

export interface UserFavorite {
  userId: string;
  listingId: string;
  createdAt: Date;
}

export interface UserProfile {
  uid: string;
  username: string;
  displayName?: string;
  email: string;
  avatarUrl?: string | null;
  photoURL?: string | null;
  bio?: string;
  location?: string;
  joinDate: string;
  totalSales: number;
  rating: number | null;
  contact?: string;
  social?: {
    youtube?: string | null;
    twitter?: string | null;
    facebook?: string | null;
  } | null;
  lastUpdated?: string;
  isEmailVerified: boolean;
  verificationSentAt?: string;
  authProvider?: string;
  isAdmin?: boolean;
  accountTier?: 'free' | 'premium';
  tier?: 'free' | 'premium';
  theme?: 'light' | 'dark' | 'system';
  profileCompleted?: boolean;
  lastSignIn?: string;
  tutorialPreferences?: Record<string, boolean>;
  subscription: {
    status: 'active' | 'inactive';
    stripeSubscriptionId?: string;
    currentPlan: 'free' | 'premium';
    startDate?: string;
    endDate?: string;
  };
}