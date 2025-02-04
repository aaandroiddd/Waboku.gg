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
  archivedAt?: Date;
  isGraded: boolean;
  gradeLevel?: number;
  gradingCompany?: string;
  city: string;
  state: string;
  favoriteCount?: number;
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
}

export interface UserFavorite {
  userId: string;
  listingId: string;
  createdAt: Date;
}

export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  joinDate: string;
  totalSales: number;
  rating: number;
  contact?: string;
  social?: {
    youtube?: string;
    twitter?: string;
    facebook?: string;
  };
  lastUpdated?: string;
  isEmailVerified: boolean;
  verificationSentAt?: string;
  accountTier: 'free' | 'premium';
  subscription: {
    status: 'active' | 'inactive';
    stripeSubscriptionId?: string;
    currentPlan: 'free' | 'premium';
    startDate?: string;
    endDate?: string;
  };
}